import { deleteSession, getAccountFromToken, readCookie, signIn, signUp } from "./_authStore.js";

function sessionCookie(token: string, maxAge = 2592000) {
  return `lexride_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Secure`;
}

function route(req: any) {
  const value = req.query?.path;
  return Array.isArray(value) ? value.join("/") : String(value || "").replace(/^\/+|\/+$/g, "");
}

export default async function handler(req: any, res: any) {
  const path = route(req);
  try {
    if (path === "signup" && req.method === "POST") {
      const { fullName, sex, password } = req.body || {};
      if (!fullName || !sex || !password) return res.status(400).json({ error: "Name, sex, and password are required" });
      if (sex !== "Male" && sex !== "Female") return res.status(400).json({ error: "Sex must be Male or Female" });
      const result = await signUp(fullName, sex, password);
      res.setHeader("Set-Cookie", sessionCookie(result.token));
      return res.status(201).json({ account: result.account });
    }
    if (path === "signin" && req.method === "POST") {
      const { fullName, password } = req.body || {};
      if (!fullName || !password) return res.status(400).json({ error: "Name and password are required" });
      const result = await signIn(fullName, password);
      res.setHeader("Set-Cookie", sessionCookie(result.token));
      return res.status(200).json({ account: result.account });
    }
    if (path === "me" && req.method === "GET") {
      return res.status(200).json({ account: await getAccountFromToken(readCookie(req.headers.cookie, "lexride_session")) });
    }
    if (path === "signout" && req.method === "POST") {
      await deleteSession(readCookie(req.headers.cookie, "lexride_session"));
      res.setHeader("Set-Cookie", sessionCookie("", 0));
      return res.status(200).json({ ok: true });
    }
    return res.status(404).json({ error: "Auth route not found" });
  } catch (error) {
    const status = path === "signin" ? 401 : 400;
    return res.status(status).json({ error: error instanceof Error ? error.message : "Authentication request failed" });
  }
}
