const localPlaces = [
  ["Adum", "Adum, Kumasi, Ashanti Region, Ghana", 6.689568, -1.618825],
  ["Kumasi", "Kumasi, Ashanti Region, Ghana", 6.700071, -1.630783],
  ["Ayeduase", "Ayeduase, Kumasi, Ashanti Region, Ghana", 6.675, -1.55944],
  ["Ayeduase Newsite", "Ayeduase Newsite, Kumasi, Ashanti Region, Ghana", 6.675647, -1.563221],
  ["Kromuase", "Kromuase, Atwima Kwanwoma, Ashanti Region, Ghana", 6.673, -1.690],
  ["Kromoase", "Kromoase, Atwima Kwanwoma, Ashanti Region, Ghana", 6.673, -1.690],
  ["KNUST", "Kwame Nkrumah University of Science and Technology, Kumasi, Ghana", 6.6745, -1.5716],
  ["Kejetia", "Kejetia, Kumasi, Ashanti Region, Ghana", 6.697, -1.624],
  ["Bantama", "Bantama, Kumasi, Ashanti Region, Ghana", 6.702, -1.642],
  ["Suame", "Suame, Kumasi, Ashanti Region, Ghana", 6.716, -1.62],
  ["Asokwa", "Asokwa, Kumasi, Ashanti Region, Ghana", 6.673, -1.603],
  ["Ahodwo", "Ahodwo, Kumasi, Ashanti Region, Ghana", 6.686, -1.612],
  ["Tech Junction", "Tech Junction, Kumasi, Ghana", 6.674, -1.577],
  ["Ejisu", "Ejisu, Ashanti Region, Ghana", 6.728, -1.478],
];

function localSearch(query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return localPlaces.filter(([name, address]) => {
    const haystack = `${name} ${address}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  }).slice(0, 8).map(([name, formatted_address, lat, lng]) => ({
    name,
    formatted_address,
    geometry: { location: { lat, lng } },
    source: "LexRide Kumasi directory",
  }));
}

export default async function handler(req: any, res: any) {
  const { query, location, radius, region } = req.query;
  const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY;
  try {
    if (GEOAPIFY_API_KEY) {
      const params = new URLSearchParams({ text: `${String(query || "")}, Ghana`, filter: "countrycode:gh", limit: "8", apiKey: GEOAPIFY_API_KEY });
      if (location) params.set("bias", `proximity:${String(location).split(",").reverse().join(",")}`);
      const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`);
      const data = await response.json();
      const results = (data.features || []).map((feature: any) => ({
        name: feature.properties.name || feature.properties.formatted || "Location",
        formatted_address: feature.properties.formatted || feature.properties.address_line1 || "Ghana",
        geometry: { location: { lat: feature.properties.lat, lng: feature.properties.lon } },
        source: "Geoapify",
      }));
      return res.status(response.ok ? 200 : 502).json({ status: response.ok && results.length ? "OK" : response.ok ? "ZERO_RESULTS" : "GEOAPIFY_ERROR", source: "Geoapify", results, error: response.ok ? undefined : data.message || "Geoapify search failed" });
    }
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(200).json({ status: localSearch(String(query || "")).length ? "OK" : "ZERO_RESULTS", source: "LexRide directory", results: localSearch(String(query || "")) });
    }
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
    res.status(response.ok ? 200 : 502).json({
      status: response.ok && results.length > 0 ? "OK" : response.ok ? "ZERO_RESULTS" : "GOOGLE_ERROR",
      results,
      error: response.ok ? undefined : data.error?.message || "Google Places search failed",
    });
  } catch (error) {
    console.error("[TextSearch] Error:", error);
    res.status(500).json({ status: "ERROR", error: String(error) });
  }
}
