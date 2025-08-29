// Vercel Serverless Function
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const { secret, data } = req.body || {};
  // 驗證：和前端/Apps Script 約定的密鑰
  if (!secret || secret !== process.env.SHEET_SECRET) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  // 轉送到 Apps Script Web App（/exec）
  try {
    const r = await fetch(process.env.SHEET_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, data })
    });
    // Apps Script 若未回傳 JSON 也沒關係，統一回 ok:true
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ ok: true });
  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
