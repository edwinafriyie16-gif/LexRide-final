import { getRide } from "../_rideStore";

export default function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { id } = req.query;
  const ride = getRide(String(id));
  if (!ride) return res.status(404).json({ error: "Ride not found" });
  res.status(200).json(ride);
}
