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
      action === "delete" ? { secret, action: "delete", id } :
      action === "list"   ? { secret, action: "list" } :
                            { secret, action: "create", data };

    const r = await fetch(process.env.SHEET_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // list 需要把資料回傳給前端；其他動作回傳 ok:true 即可
    let body = { ok: true };
    if (action === "list") {
      try { body = await r.json(); } catch (_) { body = { ok:false, error:'bad_json' }; }
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(body);
  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
