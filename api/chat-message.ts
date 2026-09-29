import { addMessage, canAccessTripChat } from "./_rideStore.js";
import { getAccountFromToken, readCookie } from "./_authStore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  res.setHeader("Cache-Control", "private, no-store");
  try {
    const account = await getAccountFromToken(readCookie(req.headers?.cookie, "lexride_session"));
    if (!account) return res.status(401).json({ error: "Sign in required" });

    const { tripId, text } = req.body || {};
    if (typeof tripId !== "string" || !tripId.trim()) return res.status(400).json({ error: "Trip ID is required" });
    if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "Message is empty" });
    if (!(await canAccessTripChat(tripId, account.id))) {
      return res.status(403).json({ error: "Only the trip host and approved passengers can access this chat" });
    }

    const result = await addMessage(tripId, account.fullName, text, account.sex);
    if ("error" in result) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result);
  } catch (error) {
    console.error("[Trip chat message] Error:", error);
    return res.status(500).json({ error: "Could not send chat message. Please try again." });
  }
}
