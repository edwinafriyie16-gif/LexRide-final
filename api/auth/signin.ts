import { readCookie, signIn } from "../_authStore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { fullName, password } = req.body || {};
    if (!fullName || !password) return res.status(400).json({ error: "Name and password are required" });
    const result = await signIn(fullName, password);
    res.setHeader("Set-Cookie", `lexride_session=${encodeURIComponent(result.token)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure`);
    return res.status(200).json({ account: result.account });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : "Could not sign in" });
  }
}
