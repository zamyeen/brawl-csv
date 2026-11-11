# Brawl Stars CSV Exporter

A deliberately tiny website: one HTML file plus one Vercel serverless function.

## What it does

- Enter a Brawl Stars player tag.
- Loads the player profile through the Brawl Stars API.
- Displays the player's brawlers in a sortable/filterable table.
- Downloads flattened brawler data as CSV.
- Downloads the original API response as JSON.
- Save multiple player profiles in this browser and reload them with one click.
- Track trophy targets, power-level upgrades (9/10/11), two-gadget and two-star-power completion for owned brawlers.
- Estimate coins and power points needed to reach the selected power level.
- Keeps the API token server-side rather than exposing it in browser JavaScript.

## Why the proxy is used

Supercell API keys are IP-whitelisted. RoyaleAPI documents a Brawl Stars proxy at:

    https://bsproxy.royaleapi.dev

Create your Brawl Stars API key at https://developer.brawlstars.com and whitelist:

    45.79.218.79

The website's serverless function sends requests to the proxy, so your home/campus/Wi-Fi IP can change without breaking the site.

## Easiest publish path: Vercel

1. Create the Supercell API key and whitelist `45.79.218.79`.
2. Put this folder in a GitHub repository, or import the folder into Vercel another way.
3. In Vercel, create/import the project. No framework/build command is needed.
4. Go to **Project Settings → Environment Variables**.
5. Add:

       BRAWL_API_KEY = <your full API token>

   Store it as a secret. Do NOT paste the token into `index.html` or commit it to Git.
6. Redeploy after adding the environment variable.
7. Open your Vercel URL and enter a player tag.

The `/api/player` route is automatically created from `api/player.js`.

## Local testing with Vercel CLI

If desired:

    npm i -g vercel
    vercel dev

Then add `BRAWL_API_KEY` to `.env.local` or use Vercel's environment tooling. Never commit the real `.env.local` file.

## Files

    index.html       Static frontend
    api/player.js    Secret-bearing server-side API proxy
    .env.example     Documents the required variable
    .gitignore       Keeps secrets/local Vercel files out of Git

No React, Next.js, database, bundler, or package dependencies are required.

## Saved profiles and milestones

1. Load a player using the existing player-tag search.
2. Click **Save profile** on the Milestones panel.
3. Select a saved profile to fetch its latest API data, or click **Remove** to unsave it.
4. Set a trophy goal and a target power level (9, 10, or 11). Those settings are saved per player tag.

Saved tags, player display names, and individual milestone settings use browser `localStorage`. Data is not synchronized between devices or browsers, and deleting site storage deletes saved profiles. No account login is required. Players' live statistics are refreshed from the Brawl Stars API when a profile is loaded, rather than retained as a snapshot.

Progress uses only owned brawlers present in the player's API response. The **Power upgrades** tile shows how many owned brawlers are below the selected Power 9, 10, or 11 target and shows power points and coins needed immediately below its progress bar.

The **Gadgets** and **Star powers** sections each show how many owned brawlers have 2, 1, or 0 of that ability, plus the completion progress bar, incomplete brawler names, and total coin cost to fill missing slots. Estimated costs: **1,000 coins per Gadget** and **2,000 coins per Star Power**.

The **Buffies** section shows how many owned eligible brawlers have 3, 2, 1, or 0 *ability* Buffies (Hypercharge, Gadget, Star Power). Only brawlers with all three reported API ownership flags enter those exact buckets. Unknown/null fields are **not** treated as missing: brawlers with incomplete ownership information are reported separately. The progress bar includes only known Buffie slots. Missing slots with an explicit `false` cost **1,000 coins and 2,000 power points each**; when any slots are unknown, displayed costs are minimums. Cosmetic Buffies are not included.

Buffie eligibility uses the 33-brawler released roster stored in `features.js` (November 2026 snapshot). Update it when the game releases more Buffies. Costs assume direct standard shop purchases / claw-machine pulls, with no free rewards or discounts. They exclude gears, Hypercharges, unlocking unowned brawlers, and other progression systems.

## Files

- `index.html`: static frontend and dashboard markup
- `features.js`: browser storage, milestones, breakdowns and upgrade-cost calculations
- `features.css`: styling for saved profiles and milestones
- `api/player.js`: serverless API proxy

## Buffie references

- https://brawlmetrics.gg/buffies
- https://supercell.com/en/games/brawlstars/blog/game-updates/release-notes-november-2026/
- https://supercell.com/en/games/brawlstars/blog/news/new-power-brawl-pass-changes-and-a-new-starr-drop-2/
