import { getAccountFromToken, readCookie } from "./_authStore.js";
import { setMemberStatus } from "./_rideStore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });
  try {
    const account = await getAccountFromToken(readCookie(req.headers.cookie, "lexride_session"));
    if (!account) return res.status(401).json({ error: "Sign in required" });
    const { tripId, memberId, status } = req.body || {};
    if (!tripId || !memberId || (status !== "Approved" && status !== "Declined")) return res.status(400).json({ error: "Missing trip, member, or valid status" });
    const result = await setMemberStatus(String(tripId), String(memberId), status);
    if ("error" in result) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result);
  } catch (error) {
    console.error("[Member status] Error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Could not update passenger status" });
  }
}
