import { addMessage } from "../../_rideStore.js";

export default function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { id } = req.query;
  const { sender, text } = req.body || {};
  if (!sender || !text) return res.status(400).json({ error: "Missing sender or text" });

  const result = addMessage(String(id), sender, text);
  if ("error" in result) {
    return res.status(result.status).json({ error: result.error });
  }
  res.status(200).json(result);
}
