import { getRide } from "../_rideStore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { id } = req.query;
    const ride = await getRide(String(id));
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    return res.status(200).json(ride);
  } catch (error) {
    console.error("[GetRide] Error:", error);
    return res.status(500).json({ error: String(error) });
  }
}
