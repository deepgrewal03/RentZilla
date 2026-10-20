/** Verified driving distances only: never substitute straight-line distances. */
export async function roadRoute(
  fromLat: number, fromLng: number, toLat: number, toLng: number,
  fetcher: typeof fetch = fetch,
  key: string | undefined = process.env.GOOGLE_MAPS_API_KEY,
) {
  if (![fromLat,fromLng,toLat,toLng].every(Number.isFinite) ||
    Math.abs(fromLat)>90 || Math.abs(toLat)>90 || Math.abs(fromLng)>180 || Math.abs(toLng)>180) {
    throw new Error("Invalid route coordinates");
  }
  if (!key) throw new Error("Google Maps is not configured");
  const params = new URLSearchParams({origin:`${fromLat},${fromLng}`,destination:`${toLat},${toLng}`,mode:"driving",key});
  const response = await fetcher(`https://maps.googleapis.com/maps/api/directions/json?${params}`, {signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error("Google road directions are unavailable");
  const data = await response.json();
  const leg = data.routes?.[0]?.legs?.[0];
  if (data.status !== "OK" || !Number.isFinite(leg?.distance?.value) || leg.distance.value <= 0 ||
    !Number.isFinite(leg?.duration?.value)) throw new Error("Google road directions are unavailable");
  return {distanceKm: Number((leg.distance.value/1000).toFixed(1)),durationMin:Math.round(leg.duration.value/60)};
}
