import { Router, type Request, type Response } from "express";

const router = Router();

/**
 * GET /api/maps/key
 * Returns the Google Maps API key so it's never bundled into client code.
 */
router.get("/key", (_req: Request, res: Response) => {
  const key = process.env["GOOGLE_MAPS_API_KEY"] || "";
  res.json({ key });
});

/**
 * GET /api/maps/places?q=query&lat=xx&lng=yy
 * Server-side Google Places Autocomplete proxy.
 * Runs TWO parallel requests: one for precise street addresses ("address")
 * and one for businesses/POIs ("establishment"), then merges + deduplicates.
 * This gives house numbers, street names, flats, AND shop names.
 */
router.get("/places", async (req: Request, res: Response) => {
  const { q, lat, lng } = req.query as Record<string, string>;
  const key = process.env["GOOGLE_MAPS_API_KEY"] || "";

  if (!key) {
    res.status(503).json({ error: "Maps not configured" });
    return;
  }
  if (!q?.trim()) {
    res.json({ predictions: [] });
    return;
  }

  const inputText = q.trim();

  // Base params shared by both requests
  const baseParams: Record<string, string> = {
    input: inputText,
    key,
    language: "en",
    components: "country:in",
  };

  // Bias toward Punjab; if user location supplied, use that radius=50km
  if (lat && lng) {
    baseParams["location"] = `${lat},${lng}`;
    baseParams["radius"] = "50000";
    baseParams["strictbounds"] = "false";
  } else {
    // Default center on Punjab (Chandigarh)
    baseParams["location"] = "30.7333,76.7794";
    baseParams["radius"] = "250000";
    baseParams["strictbounds"] = "false";
  }

  const buildUrl = (extraParams: Record<string, string>) => {
    const p = new URLSearchParams({ ...baseParams, ...extraParams });
    return `https://maps.googleapis.com/maps/api/place/autocomplete/json?${p}`;
  };

  const callPlaces = async (extraParams: Record<string, string>): Promise<any[]> => {
    try {
      const r = await fetch(buildUrl(extraParams));
      const d: any = await r.json();
      return ["OK", "ZERO_RESULTS"].includes(d.status) ? d.predictions || [] : [];
    } catch { return []; }
  };

  // Detect bare house number queries (e.g. "1792", "45B", "221")
  const isShortOrNumeric = /^\d/.test(inputText) && inputText.length <= 8 && !/[a-zA-Z]{3,}/.test(inputText);
  const nearestCity = (() => {
    if (!lat || !lng) return "Ludhiana";
    const cities = [
      { name: "Ludhiana", la: 30.9009, ln: 75.8573 },
      { name: "Chandigarh", la: 30.7333, ln: 76.7794 },
      { name: "Amritsar", la: 31.634, ln: 74.8723 },
      { name: "Jalandhar", la: 31.326, ln: 75.5762 },
      { name: "Mohali", la: 30.7046, ln: 76.7179 },
      { name: "Patiala", la: 30.3398, ln: 76.3869 },
    ];
    const la = parseFloat(lat), ln = parseFloat(lng);
    let best = cities[0], minD = Infinity;
    for (const c of cities) { const d = Math.abs(c.la - la) + Math.abs(c.ln - ln); if (d < minD) { minD = d; best = c; } }
    return best.name;
  })();

  const callGeocode = async (address: string): Promise<any[]> => {
    try {
      const p = new URLSearchParams({ address, key, language: "en", components: "country:in" });
      if (lat && lng) p.set("bounds", `${parseFloat(lat)-0.4},${parseFloat(lng)-0.4}|${parseFloat(lat)+0.4},${parseFloat(lng)+0.4}`);
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${p}`);
      const d: any = await r.json();
      return ["OK", "ZERO_RESULTS"].includes(d.status) ? (d.results || []) : [];
    } catch { return []; }
  };

  /** Convert Geocoding API results into autocomplete-shaped predictions */
  const geocodeToPredictions = (geocodeResults: any[]): any[] =>
    geocodeResults.slice(0, 6).map((r: any) => {
      const comps: Record<string, string> = {};
      for (const comp of r.address_components || []) {
        for (const t of comp.types as string[]) comps[t] = comp.long_name;
      }
      const streetNum = comps["street_number"] || "";
      const route = comps["route"] || "";
      const sub = comps["sublocality_level_1"] || comps["sublocality"] || comps["neighborhood"] || "";
      const city2 = comps["locality"] || comps["administrative_area_level_2"] || "";
      const state = comps["administrative_area_level_1"] || "";
      const parts: string[] = [];
      if (streetNum && route) parts.push(`${streetNum} ${route}`); else if (route) parts.push(route);
      if (sub) parts.push(sub); if (city2) parts.push(city2); if (state) parts.push(state);
      const addr = parts.length >= 2 ? parts.join(", ") : r.formatted_address;
      const mainText = parts[0] || addr.split(",")[0];
      return {
        place_id: r.place_id,
        description: addr,
        structured_formatting: { main_text: mainText, secondary_text: parts.slice(1).join(", ") },
        _fromGeocode: true,
        _lat: r.geometry?.location?.lat,
        _lng: r.geometry?.location?.lng,
      };
    });

  try {
    // For short/numeric queries, run Places + Geocoding in parallel from the start —
    // no need to exhaust 4 rounds of Autocomplete before falling back.
    if (isShortOrNumeric) {
      const enhanced = `${inputText} ${nearestCity} Punjab`;
      const buildEnhanced = (extra: Record<string, string>) =>
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${new URLSearchParams({ ...baseParams, input: enhanced, ...extra })}`;
      const callEnhanced = async (extra: Record<string, string>): Promise<any[]> => {
        try { const r = await fetch(buildEnhanced(extra)); const d: any = await r.json(); return ["OK","ZERO_RESULTS"].includes(d.status) ? d.predictions || [] : []; } catch { return []; }
      };

      const [addrP, estP, eAddr, eGeo, geoFallback] = await Promise.all([
        callPlaces({ types: "address" }),
        callPlaces({ types: "establishment" }),
        callEnhanced({ types: "address" }),
        callEnhanced({ types: "geocode" }),
        callGeocode(enhanced),
      ]);

      const seen = new Set<string>(); const merged: any[] = [];
      for (const p of [...addrP, ...estP, ...eAddr, ...eGeo]) {
        if (!seen.has(p.place_id)) { seen.add(p.place_id); merged.push(p); }
      }
      if (merged.length > 0) { res.json({ predictions: merged.slice(0, 8) }); return; }

      const geoPreds = geocodeToPredictions(geoFallback);
      if (geoPreds.length > 0) { res.json({ predictions: geoPreds }); return; }

      res.json({ predictions: [] }); return;
    }

    // Round 1: precise addresses + businesses in parallel
    const [addrP, estP] = await Promise.all([
      callPlaces({ types: "address" }),
      callPlaces({ types: "establishment" }),
    ]);

    const seen = new Set<string>();
    const merged: any[] = [];
    for (const p of [...addrP, ...estP]) {
      if (!seen.has(p.place_id)) { seen.add(p.place_id); merged.push(p); }
    }
    if (merged.length > 0) { res.json({ predictions: merged.slice(0, 8) }); return; }

    // Round 2: broader geocode (areas, sectors, pin codes, neighborhoods)
    const geoP = await callPlaces({ types: "geocode" });
    if (geoP.length > 0) { res.json({ predictions: geoP.slice(0, 8) }); return; }

    // Round 3: no type restriction — catches everything
    const anyP = await callPlaces({});
    if (anyP.length > 0) { res.json({ predictions: anyP.slice(0, 8) }); return; }

    // Round 4: Geocoding API — final fallback for hard-to-find addresses
    const geocodeResults = await callGeocode(inputText);
    if (geocodeResults.length > 0) {
      res.json({ predictions: geocodeToPredictions(geocodeResults) }); return;
    }

    res.json({ predictions: [] });
  } catch (err) {
    req.log?.error({ err }, "Places proxy error");
    res.status(500).json({ error: "Failed to fetch places" });
  }
});

/**
 * GET /api/maps/place-details?place_id=xxx
 * Returns full address details including street number, route, sublocality, etc.
 */
router.get("/place-details", async (req: Request, res: Response) => {
  const { place_id } = req.query as Record<string, string>;
  const key = process.env["GOOGLE_MAPS_API_KEY"] || "";

  if (!key || !place_id) {
    res.status(400).json({ error: "Missing params" });
    return;
  }

  try {
    const params = new URLSearchParams({
      place_id,
      key,
      fields: "geometry,formatted_address,name,address_components",
      language: "en",
    });

    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`;
    const r = await fetch(url);
    const data: any = await r.json();

    if (data.status !== "OK" || !data.result) {
      res.status(404).json({ error: "Place not found" });
      return;
    }

    const result = data.result;
    const loc = result.geometry?.location;

    // Extract structured address components
    const components: Record<string, string> = {};
    for (const comp of result.address_components || []) {
      for (const type of comp.types as string[]) {
        components[type] = comp.long_name;
      }
    }

    // Build a human-friendly street address
    const streetNumber = components["street_number"] || "";
    const route = components["route"] || "";
    const sublocality =
      components["sublocality_level_1"] ||
      components["sublocality"] ||
      "";
    const locality = components["locality"] || components["administrative_area_level_2"] || "";
    const state = components["administrative_area_level_1"] || "";

    let streetAddress = result.formatted_address || result.name || "";

    // If address_components has detail, build a cleaner display string
    const parts: string[] = [];
    if (streetNumber && route) parts.push(`${streetNumber} ${route}`);
    else if (route) parts.push(route);
    if (sublocality) parts.push(sublocality);
    if (locality) parts.push(locality);
    if (state) parts.push(state);

    if (parts.length >= 2) {
      streetAddress = parts.join(", ");
    }

    res.json({
      lat: loc?.lat,
      lng: loc?.lng,
      formatted_address: streetAddress,
      name: result.name,
      place_id,
      components,
    });
  } catch (err) {
    req.log?.error({ err }, "Place details proxy error");
    res.status(500).json({ error: "Failed to fetch place details" });
  }
});

export default router;
