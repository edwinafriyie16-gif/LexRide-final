import { setMemberStatus } from "../../../_rideStore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { id, memberId } = req.query;
    const { status } = req.body || {};
    if (status !== "Approved" && status !== "Declined") return res.status(400).json({ error: "Status must be Approved or Declined" });
    const result = await setMemberStatus(String(id), String(memberId), status);
    if ("error" in result) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result);
  } catch (error) {
    console.error("[SetMemberStatus] Error:", error);
    return res.status(500).json({ error: String(error) });
  }
}
