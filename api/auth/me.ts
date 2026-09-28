import { getAccountFromToken, readCookie } from "../_authStore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const account = await getAccountFromToken(readCookie(req.headers.cookie, "lexride_session"));
    return res.status(200).json({ account });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Could not read session" });
  }
}
