// Public daily history of explicitly tracked public Brawl Stars profiles.
const { neon } = require("@neondatabase/serverless");
const { calculate } = require("../resource-value.js");
const VALID_TAG = /^#[0289PYLQGRJCUV]+$/;
const CATEGORIES = ["power", "gadgets", "starPowers", "buffies", "gears", "hypercharges"];

function resourceForAccount(account) {
  // Reuse the exact valuation engine used by the live Account Resource Value panel.
  // Historic full-roster calculations aren't possible without the historic catalog;
  // only the owned-brawler scope can be reconstructed faithfully.
  const result = calculate(account, null, "owned");
  return {
    coins: result.acquired.coins,
    points: result.acquired.points,
    categories: Object.fromEntries(CATEGORIES.map(key => [
      key, {
        coins: result.categories[key].coins,
        points: result.categories[key].points,
        remainingCoins: result.categories[key].remainingCoins,
        remainingPoints: result.categories[key].remainingPoints,
        unknownCoins: result.categories[key].unknownCoins,
        unknownPoints: result.categories[key].unknownPoints
      }
    ])),
    completion: result.completionByCategory
  };
}

function formatDailyRow(row) {
  const account = typeof row.account === "string" ? JSON.parse(row.account) : row.account;
  if (!account || !Array.isArray(account.brawlers)) {
    throw new Error("Invalid stored account snapshot");
  }
  return {
    date: row.date,
    captured_at: row.captured_at,
    trophies: row.trophies,
    highest_trophies: row.highest_trophies,
    brawler_count: row.brawler_count,
    brawlers: account.brawlers,
    resource: resourceForAccount(account)
  };
}

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
             highest_trophies, brawler_count, account
      FROM public.brawl_daily_snapshots
      WHERE player_tag = ${tag}
      ORDER BY snapshot_date DESC
      LIMIT 366
    `;
    // API response includes the same historical trophy fields as before, with
    // resource totals calculated on the server from the archived account.
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
    return res.status(200).json({tag, snapshots:rows.reverse().map(formatDailyRow), resourceScope:"owned"});
  } catch (err) {
    console.error("Daily history read failed", err);
    return res.status(502).json({message:"Could not load daily snapshots"});
  }
};
module.exports.resourceForAccount = resourceForAccount;
module.exports.formatDailyRow = formatDailyRow;
