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
 *
 * Google Places Autocomplete + Geocoding proxy.
 *
 * Strategy (India-tuned):
 * – types:"address" is unreliable in India for house numbers.
 * – We use NO type filter as the primary call so Google returns the
 *   broadest set (house numbers, areas, businesses, landmarks).
 * – For short/numeric queries (e.g. "1972") we simultaneously hit the
 *   city-enhanced variant ("1972 Ludhiana Punjab") + Geocoding API.
 * – Geocoding results are filtered: only include rows whose
 *   formatted_address contains the original query token (so "1972"
 *   doesn't match a result for "Ludhiana city").
 */
router.get("/places", async (req: Request, res: Response) => {
  // Never serve stale place results — disable browser/proxy caching
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  const { q, lat, lng } = req.query as Record<string, string>;
  const key = process.env["GOOGLE_MAPS_API_KEY"] || "";

  if (!key) { res.status(503).json({ error: "Maps not configured" }); return; }
  if (!q?.trim()) { res.json({ predictions: [] }); return; }

  const inputText = q.trim();

  // Location bias — user GPS wins; default to Chandigarh (centre of Punjab)
  const locParams: Record<string, string> = lat && lng
    ? { location: `${lat},${lng}`, radius: "50000", strictbounds: "false" }
    : { location: "30.7333,76.7794", radius: "250000", strictbounds: "false" };

  // Base autocomplete params (NO types filter — broadest results)
  const baseParams: Record<string, string> = {
    key,
    language: "en",
    components: "country:in",
    ...locParams,
  };

  /** Call Places Autocomplete with a specific input string + extra params */
  const callPlaces = async (input: string, extra: Record<string, string> = {}): Promise<any[]> => {
    try {
      const p = new URLSearchParams({ ...baseParams, input, ...extra });
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${p}`);
      const d: any = await r.json();
      if (!["OK", "ZERO_RESULTS"].includes(d.status)) {
        req.log?.warn({ status: d.status, reason: String(d.error_message || "").replaceAll(key, "[redacted]") }, "Places API non-OK");
        throw new Error("Google address search is unavailable. Please try again later.");
      }
      return d.predictions || [];
    } catch (error) { throw error; }
  };

  /** Call Geocoding API */
  const callGeocode = async (address: string): Promise<any[]> => {
    try {
      const p = new URLSearchParams({ address, key, language: "en", components: "country:in" });
      if (lat && lng) {
        const la = parseFloat(lat), ln = parseFloat(lng);
        p.set("bounds", `${la - 0.5},${ln - 0.5}|${la + 0.5},${ln + 0.5}`);
      }
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${p}`);
      const d: any = await r.json();
      return d.results || [];
    } catch { return []; }
  };

  /** Nearest Punjab city from GPS coords */
  const nearestCity = (() => {
    const cities = [
      { name: "Ludhiana", la: 30.9009, ln: 75.8573 },
      { name: "Chandigarh", la: 30.7333, ln: 76.7794 },
      { name: "Amritsar", la: 31.6340, ln: 74.8723 },
      { name: "Jalandhar", la: 31.3260, ln: 75.5762 },
      { name: "Mohali", la: 30.7046, ln: 76.7179 },
      { name: "Patiala", la: 30.3398, ln: 76.3869 },
    ];
    if (!lat || !lng) return cities[0].name;
    const la = parseFloat(lat), ln = parseFloat(lng);
    let best = cities[0], minD = Infinity;
    for (const c of cities) { const d = Math.abs(c.la - la) + Math.abs(c.ln - ln); if (d < minD) { minD = d; best = c; } }
    return best.name;
  })();

  /**
   * Convert Geocoding API results into autocomplete-shaped predictions.
   * Filters out results that do not contain the original query token
   * (prevents city-level results from bleeding through when user types "1972").
   */
  const geocodeToPredictions = (geocodeResults: any[], queryToken: string): any[] => {
    const token = queryToken.toLowerCase();
    return geocodeResults
      .filter((r: any) => {
        // Only include result if formatted_address actually contains the token
        return r.formatted_address?.toLowerCase().includes(token);
      })
      .slice(0, 6)
      .map((r: any) => {
        const comps: Record<string, string> = {};
        for (const comp of r.address_components || []) {
          for (const t of comp.types as string[]) comps[t] = comp.long_name;
        }
        const streetNum = comps["street_number"] || "";
        const route     = comps["route"] || "";
        const sub       = comps["sublocality_level_2"] || comps["sublocality_level_1"] || comps["sublocality"] || comps["neighborhood"] || "";
        const city2     = comps["locality"] || comps["administrative_area_level_2"] || "";
        const state     = comps["administrative_area_level_1"] || "";

        // Build the main display label — always lead with house number if present
        let mainText: string;
        if (streetNum && route)      mainText = `${streetNum}, ${route}`;
        else if (streetNum && sub)   mainText = `${streetNum}, ${sub}`;
        else if (streetNum && city2) mainText = `${streetNum}, ${city2}`;
        else if (streetNum)          mainText = streetNum;
        else if (route)              mainText = route;
        else if (sub)                mainText = sub;
        else                         mainText = r.formatted_address.split(",")[0];

        // Build secondary text (everything after mainText)
        const secondary = r.formatted_address
          .replace(mainText, "")
          .replace(/^,\s*/, "")
          .trim();

        return {
          place_id: r.place_id,
          description: r.formatted_address,
          structured_formatting: { main_text: mainText, secondary_text: secondary },
          _fromGeocode: true,
          _lat: r.geometry?.location?.lat,
          _lng: r.geometry?.location?.lng,
        };
      });
  };

  /** Deduplicate a list of predictions by place_id */
  const dedup = (list: any[]): any[] => {
    const seen = new Set<string>();
    return list.filter((p) => {
      if (seen.has(p.place_id)) return false;
      seen.add(p.place_id);
      return true;
    });
  };

  // Detect bare house number queries (e.g. "1972", "45B", "221A")
  const isShortOrNumeric = /^\d/.test(inputText) && inputText.length <= 10 && !/[a-zA-Z]{4,}/.test(inputText);

  // Punjab-wide params — used for the city-context enhanced query so results
  // are NOT locked to the user's 50 km radius around a single city.
  const punjabWideParams: Record<string, string> = {
    key,
    language: "en",
    components: "country:in",
    location: "30.7333,76.7794", // Chandigarh — geographic centre of Punjab
    radius: "300000",            // 300 km covers all of Punjab + Haryana belt
    strictbounds: "false",
  };
  const callPlacesPunjab = async (input: string, extra: Record<string, string> = {}): Promise<any[]> => {
    try {
      const p = new URLSearchParams({ ...punjabWideParams, input, ...extra });
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${p}`);
      const d: any = await r.json();
      return d.predictions || [];
    } catch { return []; }
  };

  try {
    if (isShortOrNumeric) {
      // For numeric house-number queries, run FOUR calls in parallel:
      // 1) Original query, user-biased radius (finds nearby results first)
      // 2) "701 Punjab India" — Punjab-wide, NOT city-restricted
      // 3) Original + establishments (shops/flats)
      // 4) Geocoding API with Punjab context (hard fallback)
      const enhanced = `${inputText} Punjab India`;
      const [noType, enhanced1, estP, geoResults] = await Promise.all([
        callPlaces(inputText),
        callPlacesPunjab(enhanced),
        callPlaces(inputText, { types: "establishment" }),
        callGeocode(enhanced),
      ]);

      const merged = dedup([...noType, ...enhanced1, ...estP]);
      if (merged.length > 0) {
        res.json({ predictions: merged.slice(0, 8) });
        return;
      }

      // Geocoding fallback — filter to results that actually contain the number
      const geoPreds = geocodeToPredictions(geoResults, inputText);
      if (geoPreds.length > 0) {
        res.json({ predictions: geoPreds });
        return;
      }

      res.json({ predictions: [] });
      return;
    }

    // ── Normal (non-numeric) query ──────────────────────────────────────────
    // Round 1: no type filter (broadest) + establishments in parallel
    const [anyP, estP] = await Promise.all([
      callPlaces(inputText),
      callPlaces(inputText, { types: "establishment" }),
    ]);
    const merged = dedup([...anyP, ...estP]);
    if (merged.length > 0) { res.json({ predictions: merged.slice(0, 8) }); return; }

    // Round 2: Geocoding API fallback
    const geoResults = await callGeocode(inputText);
    const geoPreds = geocodeToPredictions(geoResults, inputText);
    if (geoPreds.length > 0) { res.json({ predictions: geoPreds }); return; }

    res.json({ predictions: [] });
  } catch (err) {
    req.log?.error({ err }, "Places proxy error");
    res.status(503).json({ error: "Google address search is currently unavailable. Please try again later." });
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
      res.status(data.status === "ZERO_RESULTS" ? 404 : 503).json({ error: "Unable to resolve this address. Please try again or choose another location." });
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

    // Keep Google's full address, including house number and postal code.
    if (!streetAddress) streetAddress = parts.join(", ");

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
