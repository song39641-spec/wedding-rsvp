// api/submit.js
export default async function handler(req, res) {
  // CORS
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

  const { secret, action = "create", data, id } = req.body || {};
  if (!secret || secret !== process.env.SHEET_SECRET) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const payload =
      action === "delete"
        ? { secret, action: "delete", id }
        : { secret, action: "create", data };

    await fetch(process.env.SHEET_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ ok: true });
  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
