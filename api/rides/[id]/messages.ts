import { addMessage } from "../../_rideStore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { id } = req.query;
    const { sender, senderSex, text } = req.body || {};
    if (!sender || !text) return res.status(400).json({ error: "Missing sender or text" });

    const result = await addMessage(String(id), sender, text, senderSex);
    if ("error" in result) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result);
  } catch (error) {
    console.error("[AddMessage] Error:", error);
    return res.status(500).json({ error: String(error) });
  }
}
