import { getAccountFromToken, readCookie } from "./_authStore.js";
import { joinRide } from "./_rideStore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const account = await getAccountFromToken(readCookie(req.headers.cookie, "lexride_session"));
    if (!account) return res.status(401).json({ error: "Sign in required" });
    const { tripId, firstName, sex } = req.body || {};
    if (!tripId || !firstName || !sex) return res.status(400).json({ error: "Missing trip, name, or sex" });
    if (sex !== "Male" && sex !== "Female") return res.status(400).json({ error: "Sex must be Male or Female" });
    const result = await joinRide(String(tripId), String(firstName), sex, account.id);
    if ("error" in result) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result);
  } catch (error) {
    console.error("[Join] Error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Join request failed" });
  }
}
