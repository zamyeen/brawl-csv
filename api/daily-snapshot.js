// Vercel Cron: one complete public player snapshot per tracked tag, per UTC day.
const { neon } = require("@neondatabase/serverless");
const VALID_TAG = /^#[0289PYLQGRJCUV]+$/;
const BASE = "https://bsproxy.royaleapi.dev";

function trackedTags(raw) {
  const tags = String(raw || "").split(",").map(x => x.trim().toUpperCase())
    .map(x => x.startsWith("#") ? x : "#" + x);
  return [...new Set(tags.filter(x => VALID_TAG.test(x)))].slice(0, 25);
}

async function retrievePlayer(tag, token) {
  const response = await fetch(BASE + "/v1/players/" + encodeURIComponent(tag), {
    headers: {Authorization: "Bearer " + token, Accept: "application/json"},
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("Brawl Stars returned HTTP " + response.status);
  const player = await response.json();
  if (!player || player.tag !== tag || !Array.isArray(player.brawlers))
    throw new Error("Unexpected Brawl Stars player response");
  return player;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({message:"Method not allowed"});
  }
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== "Bearer " + secret)
    return res.status(401).json({message:"Unauthorized"});
  const token = process.env.BRAWL_API_KEY;
  const connection = process.env.DATABASE_URL;
  const tags = trackedTags(process.env.TRACKED_PLAYER_TAGS);
  if (!token || !connection || !tags.length)
    return res.status(503).json({message:"Missing BRAWL_API_KEY, DATABASE_URL, or TRACKED_PLAYER_TAGS configuration"});
  const sql = neon(connection);
  const snapshotDate = new Date().toISOString().slice(0, 10); // UTC
  const results = [];
  for (const tag of tags) {
    try {
      const player = await retrievePlayer(tag, token);
      // Idempotent: a repeated cron invocation updates today's row.
      await sql`
        INSERT INTO public.brawl_daily_snapshots
          (player_tag, snapshot_date, captured_at, trophies, highest_trophies, brawler_count, account)
        VALUES
          (${tag}, ${snapshotDate}::date, now(), ${Number(player.trophies) || 0},
           ${Number(player.highestTrophies) || 0}, ${player.brawlers.length},
           ${JSON.stringify(player)}::jsonb)
        ON CONFLICT (player_tag, snapshot_date) DO UPDATE SET
          captured_at = EXCLUDED.captured_at,
          trophies = EXCLUDED.trophies,
          highest_trophies = EXCLUDED.highest_trophies,
          brawler_count = EXCLUDED.brawler_count,
          account = EXCLUDED.account
      `;
      results.push({tag, ok:true});
    } catch (err) {
      console.error("Snapshot failed", tag, err);
      results.push({tag, ok:false, error:String(err.message || err).slice(0,120)});
    }
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(results.every(x => x.ok) ? 200 : 207)
    .json({date:snapshotDate, attempted:tags.length, succeeded:results.filter(x=>x.ok).length, results});
};
module.exports.trackedTags = trackedTags;
