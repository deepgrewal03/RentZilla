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

  try {
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

    if (merged.length > 0) {
      res.json({ predictions: merged.slice(0, 8) });
      return;
    }

    // Round 2: broader geocode (areas, sectors, pin codes, neighborhoods)
    const geoP = await callPlaces({ types: "geocode" });
    if (geoP.length > 0) {
      res.json({ predictions: geoP.slice(0, 8) });
      return;
    }

    // Round 3: no type restriction — catches everything
    const anyP = await callPlaces({});
    res.json({ predictions: anyP.slice(0, 8) });
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
