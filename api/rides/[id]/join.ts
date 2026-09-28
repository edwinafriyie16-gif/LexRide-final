import { joinRide } from "../../_rideStore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { id } = req.query;
    const { firstName, sex } = req.body || {};
    if (!firstName || !sex) return res.status(400).json({ error: "Missing firstName or sex" });
    if (sex !== "Male" && sex !== "Female") return res.status(400).json({ error: "Sex must be Male or Female" });

    const result = await joinRide(String(id), firstName, sex);
    if ("error" in result) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result);
  } catch (error) {
    console.error("[JoinRide] Error:", error);
    return res.status(500).json({ error: String(error) });
  }
}
