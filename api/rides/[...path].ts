import { addMessage, createRide, getRide, getRideCreatorAccountId, joinRide, setMemberStatus } from "../_rideStore.js";
import { getAccountFromToken, readCookie } from "../_authStore.js";

function route(req: any) {
  const value = req.query?.path;
  if (value) return (Array.isArray(value) ? value.join("/") : String(value)).replace(/^\/+|\/+$/g, "");
  const pathname = String(req.url || "").split("?", 1)[0];
  return pathname.replace(/^\/api\/rides\/?/, "").replace(/^\/+|\/+$/g, "");
}

export default async function handler(req: any, res: any) {
  const path = route(req);
  const parts = path ? path.split("/") : [];
  try {
    if (parts.length === 0 && req.method === "POST") {
      const account = await getAccountFromToken(readCookie(req.headers.cookie, "lexride_session"));
      if (!account) return res.status(401).json({ error: "Sign in required" });
      const { fromLabel, toLabel, toLat, toLng, date, time, seats, platform, creatorName, creatorSex } = req.body || {};
      if (!fromLabel || !toLabel || !time || !creatorName) return res.status(400).json({ error: "Missing required ride fields" });
      return res.status(200).json(await createRide({ fromLabel, toLabel, toLat, toLng, date, time, seats, platform, creatorName, creatorSex, creatorAccountId: account.id }));
    }
    if (parts.length === 1 && req.method === "GET") {
      const ride = await getRide(parts[0]);
      return ride ? res.status(200).json(ride) : res.status(404).json({ error: "Ride not found" });
    }
    if (parts.length === 2 && parts[1] === "join" && req.method === "POST") {
      const account = await getAccountFromToken(readCookie(req.headers.cookie, "lexride_session"));
      if (!account) return res.status(401).json({ error: "Sign in required" });
      const { firstName, sex } = req.body || {};
      if (!firstName || !sex) return res.status(400).json({ error: "Missing firstName or sex" });
      if (sex !== "Male" && sex !== "Female") return res.status(400).json({ error: "Sex must be Male or Female" });
      const result = await joinRide(parts[0], firstName, sex, account.id);
      if ("error" in result) return res.status(result.status).json({ error: result.error });
      return res.status(200).json(result);
    }
    if (parts.length === 2 && parts[1] === "messages" && req.method === "POST") {
      const { sender, senderSex, text } = req.body || {};
      if (!sender || !text) return res.status(400).json({ error: "Missing sender or text" });
      const result = await addMessage(parts[0], sender, text, senderSex);
      if ("error" in result) return res.status(result.status).json({ error: result.error });
      return res.status(200).json(result);
    }
    if (parts.length === 3 && parts[1] === "members" && req.method === "PATCH") {
      const account = await getAccountFromToken(readCookie(req.headers.cookie, "lexride_session"));
      if (!account) return res.status(401).json({ error: "Sign in required" });
      const { status } = req.body || {};
      if (status !== "Approved" && status !== "Declined") return res.status(400).json({ error: "Status must be Approved or Declined" });
      const creatorAccountId = await getRideCreatorAccountId(parts[0]);
      if (creatorAccountId === undefined) return res.status(404).json({ error: "Trip not found" });
      if (creatorAccountId !== account.id) return res.status(403).json({ error: "Only the trip host can manage join requests" });
      const result = await setMemberStatus(parts[0], parts[2], status);
      if ("error" in result) return res.status(result.status).json({ error: result.error });
      return res.status(200).json(result);
    }
    return res.status(404).json({ error: "Ride route not found" });
  } catch (error) {
    console.error("[Rides] Error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Ride request failed" });
  }
}
