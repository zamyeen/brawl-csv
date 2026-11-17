-- Run once in your Neon database SQL editor.
CREATE TABLE IF NOT EXISTS public.brawl_daily_snapshots (
  player_tag TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trophies INTEGER NOT NULL DEFAULT 0,
  highest_trophies INTEGER NOT NULL DEFAULT 0,
  brawler_count INTEGER NOT NULL DEFAULT 0,
  account JSONB NOT NULL,
  PRIMARY KEY (player_tag, snapshot_date)
);
CREATE INDEX IF NOT EXISTS brawl_daily_snapshots_recent
  ON public.brawl_daily_snapshots (player_tag, captured_at DESC);
