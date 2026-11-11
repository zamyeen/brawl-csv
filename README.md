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

Progress uses only brawlers present in the player's API response. The two-gadget and two-star-power milestones count owned brawlers with two items in those categories. Power-point and coin estimates cover base power-level upgrades only and exclude buying gadgets, star powers, gears, hypercharges, and unlocking unowned brawlers. Update the cost table in `features.js` if the game's upgrade economy changes.

## New files

- `features.js`: Browser storage, saved-profile shortcuts, milestones, and upgrade-cost calculations.
- `features.css`: Styling for saved accounts and milestones.

