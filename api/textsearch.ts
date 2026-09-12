export default async function handler(req: any, res: any) {
  const { query, location, radius, region } = req.query;
  const GOOGLE_MAPS_API_KEY = process.env.GEMINI_API_KEY;
  try {
    if (!GOOGLE_MAPS_API_KEY) throw new Error("Missing API Key");
    const body: any = {
      textQuery: query,
      regionCode: region || "GH",
      maxResultCount: 10,
    };

    if (location && radius) {
      const [lat, lng] = String(location).split(",").map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        body.locationBias = {
          circle: { center: { latitude: lat, longitude: lng }, radius: Number(radius) || 20000 },
        };
      }
    }

    const response = await fetch(`https://places.googleapis.com/v1/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location,places.shortFormattedAddress,places.types",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    const results = (data.places || []).map((p: any) => ({
      name: p.displayName?.text || "",
      formatted_address: p.formattedAddress || p.shortFormattedAddress || "",
      geometry: { location: { lat: p.location.latitude, lng: p.location.longitude } },
    }));
    res.status(200).json({
      status: response.ok && results.length > 0 ? "OK" : "ZERO_RESULTS",
      results,
    });
  } catch (error) {
    console.error("[TextSearch] Error:", error);
    res.status(500).json({ status: "ERROR", error: String(error) });
  }
}
