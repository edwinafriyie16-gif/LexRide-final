import { createRide } from "../_rideStore.js";

export default function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { fromLabel, toLabel, toLat, toLng, time, seats, platform, creatorName } = req.body || {};
    if (!fromLabel || !toLabel || !time || !creatorName) {
      return res.status(400).json({ error: "Missing required ride fields" });
    }
    const ride = createRide({ fromLabel, toLabel, toLat, toLng, time, seats, platform, creatorName });
    res.status(200).json(ride);
  } catch (error) {
    console.error("[CreateRide] Error:", error);
    res.status(500).json({ error: String(error) });
  }
}
