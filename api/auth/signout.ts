import { deleteSession, readCookie } from "../_authStore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    await deleteSession(readCookie(req.headers.cookie, "lexride_session"));
    res.setHeader("Set-Cookie", "lexride_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure");
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Could not sign out" });
  }
}
