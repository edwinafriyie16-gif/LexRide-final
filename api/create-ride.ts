import { getAccountFromToken, readCookie } from "./_authStore.js";
import { createRide } from "./_rideStore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const account = await getAccountFromToken(readCookie(req.headers.cookie, "lexride_session"));
    if (!account) return res.status(401).json({ error: "Sign in required" });
    const { fromLabel, toLabel, toLat, toLng, date, time, seats, platform } = req.body || {};
    if (!fromLabel || !toLabel || !time) return res.status(400).json({ error: "Missing route or departure time" });
    const ride = await createRide({ fromLabel, toLabel, toLat, toLng, date, time, seats, platform, creatorName: account.fullName, creatorSex: account.sex, creatorAccountId: account.id });
    return res.status(201).json(ride);
  } catch (error) {
    console.error("[Create ride] Error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Could not create trip" });
  }
}
