export default async function handler(req: any, res: any) {
  const { origin, destination } = req.query;
  const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY;
  try {
    if (GEOAPIFY_API_KEY) {
      const [originLat, originLng] = String(origin || "").split(",").map(Number);
      const [destinationLat, destinationLng] = String(destination || "").split(",").map(Number);
      const waypoints = `${originLat},${originLng}|${destinationLat},${destinationLng}`;
      const response = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${encodeURIComponent(waypoints)}&mode=drive&format=json&apiKey=${encodeURIComponent(GEOAPIFY_API_KEY)}`);
      const data = await response.json();
      const route = data.features?.[0];
      return res.status(response.ok && route ? 200 : 502).json({
        status: response.ok && route ? "OK" : "GEOAPIFY_ERROR",
        source: "Geoapify",
        routes: route ? [{ duration: route.properties.time, distance: route.properties.distance, geometry: route.geometry }] : [],
        error: response.ok ? undefined : data.message || "Geoapify routing failed",
      });
    }
    if (!GOOGLE_MAPS_API_KEY) {
      const [originLat, originLng] = String(origin || "").split(",").map(Number);
      const [destinationLat, destinationLng] = String(destination || "").split(",").map(Number);
      if ([originLat, originLng, destinationLat, destinationLng].every(Number.isFinite)) {
        return res.status(200).json({ status: "OK", source: "LexRide directory", routes: [{ overview_polyline: { points: encodePolyline([[originLat, originLng], [destinationLat, destinationLng]]) } }] });
      }
      return res.status(200).json({ status: "ZERO_RESULTS", routes: [] });
    }
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(String(origin || ""))}&destination=${encodeURIComponent(String(destination || ""))}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("[Directions] Error:", error);
    res.status(500).json({ status: "ERROR", error: String(error) });
  }
}

function encodePolyline(points: Array<[number, number]>) {
  let lastLat = 0; let lastLng = 0; let output = "";
  for (const [lat, lng] of points) {
    const latValue = Math.round(lat * 1e5); const lngValue = Math.round(lng * 1e5);
    output += encodeValue(latValue - lastLat) + encodeValue(lngValue - lastLng);
    lastLat = latValue; lastLng = lngValue;
  }
  return output;
}

function encodeValue(value: number) {
  let encoded = value < 0 ? ~(value << 1) : value << 1;
  let output = "";
  while (encoded >= 0x20) { output += String.fromCharCode((0x20 | (encoded & 0x1f)) + 63); encoded >>= 5; }
  return output + String.fromCharCode(encoded + 63);
}
