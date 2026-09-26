export default async function handler(req: any, res: any) {
  const { lat, lng } = req.query;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ status: "INVALID_COORDINATES", error: "Valid latitude and longitude are required" });
  }

  const geoapifyKey = process.env.GEOAPIFY_API_KEY;
  try {
    if (geoapifyKey) {
      const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), apiKey: geoapifyKey });
      const response = await fetch(`https://api.geoapify.com/v1/geocode/reverse?${params.toString()}`);
      const data = await response.json();
      const properties = data.features?.[0]?.properties;
      if (response.ok && properties) {
        return res.status(200).json({
          status: "OK",
          source: "Geoapify",
          result: {
            name: properties.name || properties.city || properties.suburb || properties.district || "Current location",
            formatted_address: properties.formatted || "Current location",
            geometry: { location: { lat: latitude, lng: longitude } },
          },
        });
      }
    }

    return res.status(200).json({
      status: "OK",
      source: "Device GPS",
      result: {
        name: "Your current location",
        formatted_address: `GPS location · ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        geometry: { location: { lat: latitude, lng: longitude } },
      },
    });
  } catch (error) {
    console.error("[ReverseGeocode] Error:", error);
    return res.status(200).json({
      status: "OK",
      source: "Device GPS",
      result: {
        name: "Your current location",
        formatted_address: `GPS location · ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        geometry: { location: { lat: latitude, lng: longitude } },
      },
    });
  }
}
