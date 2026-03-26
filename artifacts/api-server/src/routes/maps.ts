import { Router, type Request, type Response } from "express";

const router = Router();

/**
 * GET /api/maps/key
 * Returns the Google Maps API key so it's never bundled into client code.
 * Rate-limited by the fact it's a simple GET with no sensitive data exposure
 * (the key itself must be restricted in Google Cloud Console to your domain).
 */
router.get("/key", (_req: Request, res: Response) => {
  const key = process.env["GOOGLE_MAPS_API_KEY"] || "";
  res.json({ key });
});

/**
 * GET /api/maps/places?q=query
 * Server-side Google Places Autocomplete proxy — keeps the key off the client
 * for the search modal (which can't use an iframe).
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

  try {
    const params = new URLSearchParams({
      input: q.trim(),
      key,
      language: "en",
      components: "country:in",
      types: "geocode|establishment",
    });

    // Bias results toward Punjab if user location available
    if (lat && lng) {
      params.set("location", `${lat},${lng}`);
      params.set("radius", "100000");
    } else {
      // Center on Punjab (Chandigarh)
      params.set("location", "30.7333,76.7794");
      params.set("radius", "300000");
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;
    const r = await fetch(url);
    const data: any = await r.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      req.log?.warn({ status: data.status }, "Places API error");
      res.json({ predictions: [] });
      return;
    }

    res.json({ predictions: data.predictions || [] });
  } catch (err) {
    req.log?.error({ err }, "Places proxy error");
    res.status(500).json({ error: "Failed to fetch places" });
  }
});

/**
 * GET /api/maps/place-details?place_id=xxx
 * Returns lat/lng for a selected Place ID.
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
      fields: "geometry,formatted_address,name",
      language: "en",
    });

    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`;
    const r = await fetch(url);
    const data: any = await r.json();

    if (data.status !== "OK" || !data.result) {
      res.status(404).json({ error: "Place not found" });
      return;
    }

    const loc = data.result.geometry?.location;
    res.json({
      lat: loc?.lat,
      lng: loc?.lng,
      formatted_address: data.result.formatted_address,
      name: data.result.name,
      place_id,
    });
  } catch (err) {
    req.log?.error({ err }, "Place details proxy error");
    res.status(500).json({ error: "Failed to fetch place details" });
  }
});

export default router;
