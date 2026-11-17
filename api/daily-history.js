// Public daily history of explicitly tracked public Brawl Stars profiles.
const { neon } = require("@neondatabase/serverless");
const VALID_TAG = /^#[0289PYLQGRJCUV]+$/;
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({message:"Method not allowed"});
  }
  const tag = String(Array.isArray(req.query.tag) ? req.query.tag[0] : req.query.tag || "")
    .trim().toUpperCase();
  if (!VALID_TAG.test(tag)) return res.status(400).json({message:"Valid player tag required"});
  if (!process.env.DATABASE_URL) return res.status(503).json({message:"Daily history database not configured"});
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT snapshot_date::text AS date, captured_at, trophies,
             highest_trophies, brawler_count,
             account->'brawlers' AS brawlers
      FROM public.brawl_daily_snapshots
      WHERE player_tag = ${tag}
      ORDER BY snapshot_date DESC
      LIMIT 366
    `;
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
    return res.status(200).json({tag, snapshots:rows.reverse()});
  } catch (err) {
    console.error("Daily history read failed", err);
    return res.status(502).json({message:"Could not load daily snapshots"});
  }
};
