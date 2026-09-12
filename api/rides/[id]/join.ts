import { joinRide } from "../../_rideStore.js";

export default function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { id } = req.query;
  const { firstName } = req.body || {};
  if (!firstName) return res.status(400).json({ error: "Missing firstName" });

  const result = joinRide(String(id), firstName);
  if ("error" in result) {
    return res.status(result.status).json({ error: result.error });
  }
  res.status(200).json(result);
}
