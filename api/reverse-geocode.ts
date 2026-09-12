export default async function handler(req: any, res: any) {
  const { latlng } = req.query;
  const GOOGLE_MAPS_API_KEY = process.env.GEMINI_API_KEY;
  try {
    if (!GOOGLE_MAPS_API_KEY) throw new Error("Missing API Key");
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latlng}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("[ReverseGeocode] Error:", error);
    res.status(500).json({ status: "ERROR", error: String(error) });
  }
}
