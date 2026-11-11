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
- View resource-equivalent value of all owned upgrades, remaining core upgrade costs, owned/full-roster completion, and locally recorded progression history.
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


## Account Resource Value (new)

The **Account Resource Value** panel appears above Milestones after loading a player.

- **Acquired** totals display the standard coin/power point equivalent of the player's existing levels, gadgets, star powers, ability Buffies, reported gears and Hypercharges.
- **Remaining (known)** totals include Power 11 upgrades, gadgets, star powers and released Buffies. The remaining totals exclude unknown Buffie slots, unknown Hypercharge availability, and gears whose completion denominator cannot be reliably obtained.
- **Owned brawlers** is the default target. **Entire roster** uses the live \`/api/brawlers\` catalog to include unowned brawlers' power upgrades and available gadgets/star powers. The catalog endpoint fetches \`/v1/brawlers\` through the same server-side API-token proxy and never exposes the key. If it cannot load, the dashboard shows a clear fallback message and uses the owned roster.
- **Completion percentages** intentionally cover power levels, gadgets, star powers and released Buffies; confirmed gear/Hypercharge values are extra collected value and are not added to that percentage's denominator.
- **Buffie ownership** is counted only when the player API returns explicit true/false flags. Unknown slots are shown as unresolved; the completion % shows a lower–upper range and the cost estimate is a confirmed minimum. The released eligibility roster is the November 2026 snapshot and must be maintained as updates ship.
- **Gears** use rarity if provided (\`super rare: 1,000\`, \`epic: 1,500\`, \`mythic: 2,000\` coins). Recognized basic gear names are 1,000. If rarity is missing, 1,000 is a **provisional floor** and the count is flagged.
- **Hypercharges** are valued at 5,000 coins each only if the player payload explicitly contains a \`hyperCharges\` or \`hypercharges\` array. Missing ownership data is flagged, not assumed to be zero.
- **Progress history** records only changed resource snapshots per player and scope in browser \`localStorage\` (up to 60 snapshots); values are not synchronized, and deleting browser site data removes the snapshots. New data is collected only when you load an account, not in the background.

Standard price assumptions: level transition arrays defined in \`resource-value.js\`; gadget = 1,000 coins, star power = 2,000 coins, ability Buffie = 1,000 coins + 2,000 power points, Hypercharge = 5,000 coins, gear by rarity. Free rewards and previous discounts are still valued at current standard cost rather than historical purchase price. Unspent coins/power points, unlocking brawlers, skins, and cosmetics are not counted.

This feature uses \`resource-value.js\` for reusable calculations, \`resource-ui.js\` for rendering/snapshot storage, \`resource.css\` for layout, and \`api/brawlers.js\` for complete-roster metadata. Calculation regression tests live in \`tests/resource-value.test.js\`; run with \`node --test tests/resource-value.test.js\`.
