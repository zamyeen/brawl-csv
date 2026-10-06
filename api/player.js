const PROXY_BASE = "https://bsproxy.royaleapi.dev";
const VALID_TAG = /^#[0289PYLQGRJCUV]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed." });
  }

  const token = process.env.BRAWL_API_KEY;
  if (!token) {
    return res.status(500).json({ message: "Server is missing BRAWL_API_KEY." });
  }

  const rawTag = Array.isArray(req.query.tag) ? req.query.tag[0] : req.query.tag;
  const tag = String(rawTag || "").trim().toUpperCase();

  if (!VALID_TAG.test(tag)) {
    return res.status(400).json({ message: "Enter a valid Brawl Stars player tag, for example #2P0Y8Q9." });
  }

  try {
    const upstream = await fetch(`${PROXY_BASE}/v1/players/${encodeURIComponent(tag)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    const body = await upstream.text();
    let data;
    try { data = JSON.parse(body); }
    catch { data = { message: body || "Brawl Stars returned an unreadable response." }; }

    if (!upstream.ok) {
      const reason = data?.reason || data?.message || `Brawl Stars request failed (${upstream.status}).`;
      let message = reason;
      if (upstream.status === 403) {
        message = `${reason} Check that your Supercell API key whitelists 45.79.218.79.`;
      }
      return res.status(upstream.status).json({ ...data, message });
    }

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(502).json({ message: "Could not reach the Brawl Stars API proxy." });
  }
}
