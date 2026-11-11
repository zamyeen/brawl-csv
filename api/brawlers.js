const PROXY_BASE = "https://bsproxy.royaleapi.dev";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({message: "Method not allowed."});
  }
  const token = process.env.BRAWL_API_KEY;
  if (!token) return res.status(500).json({message: "Server is missing BRAWL_API_KEY."});
  try {
    const response = await fetch(PROXY_BASE + "/v1/brawlers", {
      headers: {Authorization: "Bearer " + token, Accept: "application/json"}
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({
      message: data.reason || data.message || "Unable to retrieve brawler roster."
    });
    if (!Array.isArray(data.items)) {
      return res.status(502).json({message: "Brawler roster was returned in an unexpected format."});
    }
    // Only fields needed for completion targets; the API key stays server-side.
    const items = data.items.filter(b => b && b.id != null && b.name).map(b => ({
      id: b.id,
      name: b.name,
      gadgets: Array.isArray(b.gadgets) ? b.gadgets.map(g => g.id) : null,
      starPowers: Array.isArray(b.starPowers) ? b.starPowers.map(s => s.id) : null
    }));
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json({items});
  } catch (error) {
    console.error("Brawler roster fetch failed", error);
    return res.status(502).json({message: "Could not reach the Brawl Stars brawler roster."});
  }
};
