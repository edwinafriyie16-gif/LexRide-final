export default async function handler(req: any, res: any) {
  const { location, radius } = req.query;
  const GOOGLE_MAPS_API_KEY = process.env.GEMINI_API_KEY;
  try {
    if (!GOOGLE_MAPS_API_KEY) throw new Error("Missing API Key");

    const coords = String(location).split(",");
    const lat = parseFloat(coords[0]);
    const lng = parseFloat(coords[1]);
    if (isNaN(lat) || isNaN(lng)) throw new Error("Invalid Coords");

    const response = await fetch(`https://places.googleapis.com/v1/places:searchNearby`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask":
          "places.displayName,places.location,places.types,places.formattedAddress,places.shortFormattedAddress",
      },
      body: JSON.stringify({
        maxResultCount: 12,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: Number(radius) || 500 },
        },
        includedTypes: ["gas_station", "bank", "restaurant", "fast_food"],
      }),
    });

    const data = await response.json();
    res.status(200).json({
      status: response.ok ? "OK" : "ERROR",
      results: (data.places || []).map((p: any) => ({
        name: p.displayName?.text || "Place",
        geometry: { location: { lat: p.location.latitude, lng: p.location.longitude } },
        types: p.types || [],
        vicinity: p.shortFormattedAddress || p.formattedAddress || "",
      })),
    });
  } catch (error) {
    console.error("[NearbySearch] Error:", error);
    res.status(500).json({ status: "ERROR", error: String(error) });
  }
}
