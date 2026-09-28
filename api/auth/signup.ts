import { signUp } from "../_authStore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { fullName, sex, password } = req.body || {};
    if (!fullName || !sex || !password) return res.status(400).json({ error: "Name, sex, and password are required" });
    if (sex !== "Male" && sex !== "Female") return res.status(400).json({ error: "Sex must be Male or Female" });
    const result = await signUp(fullName, sex, password);
    res.setHeader("Set-Cookie", `lexride_session=${encodeURIComponent(result.token)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure`);
    return res.status(201).json({ account: result.account });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Could not create account" });
  }
}
