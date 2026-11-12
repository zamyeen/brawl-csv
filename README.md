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


## Saved Resource Value checkpoints, chart, and comparison

After loading an account, the Resource Value panel now has:

- **Save snapshot:** explicitly record current account resource values, even when nothing has changed. An optional note (up to 100 characters) can describe upgrades, events or milestones. Loading a profile still records a snapshot automatically **only if its value changed**; no background polling occurs.
- **Progress graph:** an SVG line graph plots saved coin or power-point values over time. Choose the unit with the Graph resource selector. Hover a point to see the timestamp, exact amount and optional note. Gold dots indicate automatic value changes; cyan dots indicate manual checkpoints.
- **Export history / Import history:** back up all profiles' local snapshots in JSON, move progress history to another browser, or merge an existing backup without duplicating identical entries. Imports accept only the application's versioned history format and files of up to 2 MB. Stored series are capped at 500 snapshots per player per scope. Older \`resource-history:v1\` snapshots remain readable.
- **Compare saved profiles:** save at least two profiles with the existing **Save profile** button, select both tags in the new comparison section, choose Owned brawlers or Entire roster, and press **Compare profiles**. Both current player profiles are fetched live. The comparison displays resource totals, remaining costs, category-level coins and power points, completion ranges, and the A-minus-B difference. No comparison data is permanently stored.

Snapshot history is browser-local \`localStorage\`, **not** cloud storage or synced across devices. Export a backup if you want to preserve it across browsers or after clearing site data. No actual resource cost history or unspent account balances are available from the player API. Live comparison requires the Brawl Stars API; full-roster comparison additionally requires \`/api/brawlers\`.

Run the additional tests with \`node --test tests/resource-history.test.js\` or both test files with \`node --test tests/*.test.js\`.

## Dual-resource progress graph and comparison graph

- The Progress history selector now supports **Both (two axes)**, Coins only, or Power points only. When both are enabled, gold coins use the left axis and blue power points use the right axis, each with its own independently scaled units. Hover points for exact timestamps and values.
- The saved-profile comparison includes a grouped bar chart. Choose coin value, power-point value, or completion percentage. Bars compare category values and overall totals; the numeric table remains below. Completion percent uses the confirmed minimum when Buffie ownership is unknown.

### How to import older resource progress

1. **Recommended:** On your old browser, choose **Export history**, then transfer the resulting `brawl-resource-history.json` file to your new browser. Select it using **Import history**. Existing entries are merged without duplicates.
2. **Raw legacy browser storage:** If you saved the old `localStorage` entry named `brawl-csv:resource-history:v1`, copy its JSON value into a `.json` file and select that file. If you are still using the original browser, this history is detected automatically.
3. **Required legacy structure:** A JSON object whose keys look like `#PLAYERTAG:owned` or `#PLAYERTAG:all`. Every value is an array of snapshot objects containing `timestamp` (ISO-8601 UTC, such as `2026-11-01T12:00:00.000Z`), and nonnegative integer `coins` and `points`. Other snapshot fields are optional.

Example valid raw legacy JSON:

    {
      "#2P0Y8Q9:owned": [
        {"timestamp":"2026-11-01T12:00:00.000Z","coins":50000,"points":20000}
      ]
    }

4. **Not importable:** The normal **Download JSON** button exports a current player API response, not history. It cannot recreate past snapshots. If old snapshots were never saved, past resource values cannot be recovered from the present account response.

The import also accepts a versioned backup with `format: brawl-csv-resource-history`, `version: 1`, and a `history` object. JSON imports are limited to 2 MB. Malformed profile keys and invalid snapshot records are rejected with actionable errors; valid backups can be imported repeatedly without duplicating history.

## Category-level resource history, overlays, and completion

Every new saved snapshot now includes **category-level acquired coins, power points, and completion information** for Power levels, Gadgets, Star powers, Buffies, Gears, Hypercharges, and the overall total. The app still records total coin/power-point value in the older history format so old backups remain importable.

### Account history graph

Under **Progress history**, choose a Category (Total, Power levels, Gadgets, Star powers, Buffies, Gears or Hypercharges) and a Resource/Completion measure (Both coin and power point lines, Coins, Power points, or Completion percentage). With both resources selected, the left and right resource axes are independently scaled. Hover a point to see its exact value and date.

### Compare saved profiles over time

After comparing two saved profiles, **Compare progression over time** overlays both saved histories on the same dates and on shared units/scales. Choose the same category and measure controls used on the individual graph. Each profile is a different color; when both coin and power-point series are selected, solid lines mean coins and dashed lines mean power points. Comparing profiles also records fresh snapshots when an account's resource values change. The existing grouped comparison bar chart is retained for the present-time comparison.

### Completion by category

- **Power levels:** fraction of the Power 11 power-point requirement completed.
- **Gadgets / Star powers:** fraction of obtainable slots owned, using the live brawler catalogue where available and otherwise the existing two-slot assumption.
- **Buffies:** fraction of eligible released slots known to be owned, with a minimum–maximum range for unknown API flags.
- **Overall (core average):** equal-weight mean of the applicable Power, Gadget, Star Power and Buffie completion percentages; this is a category index, not a conversion between currencies.
- **Gears / Hypercharges:** **N/A** for completion. The player API does not provide complete and reliable availability/eligibility denominators; their acquired value can still be graphed over time.

Completion history for older snapshots is unavailable until a snapshot created by the updated app has been saved. Similarly, older snapshots containing totals but no categories will not be represented as zeros on category graphs. Percentages may change if new content is released or catalogue eligibility changes; saved historical values represent the assumptions at capture time.

### Comparison table difference labels

The final comparison column now identifies the account holding a larger numerical value (for example, `Alpha +12,000 coins` or `Beta +4.5 pp`); `Equal` is shown for ties. For the **remaining** resource rows, the account name means it has *more resources still required*, not that it is ahead in completion. Unavailable completion rows say `N/A` instead of treating missing information as 0.

## Trophy tracker and saved account-stage differences

The **Trophy tracker** section is shown whenever a player account is loaded. It saves the account's total trophies and a complete per-brawler trophy breakdown as dated checkpoints in browser localStorage.

- **Automatic stages:** Loading an account saves a new trophy stage only when total account trophies, a brawler's trophy count, or the brawler roster has changed since the last saved stage.
- **Manual stages:** Click **Save trophy stage**, optionally adding a note. Manual saves can record a checkpoint even when trophies have not changed.
- **History chart:** Switch between total account trophies and any brawler in the saved stages. Hover a point to see the exact date, trophies and stage note.
- **Compare two saved stages:** Pick any two timestamps using Earlier stage and Later stage, then click Compare stages. The comparison shows the account's total change, the sum of gains and losses among brawlers present in both stages, largest brawler changes on a divergent chart, and a color-highlighted row for every changed brawler. Enable Show unchanged brawlers to see the full roster.
- **Newly reported and missing brawlers:** If a brawler appears in only one stage, its other trophy value is not assumed to be zero. Such rows are shown separately and the difference between account total and shared-brawler deltas is disclosed as an unattributed amount.
- **History backup:** Export trophy history as `brawl-trophy-history.json`, then import it into another browser. The trophy import accepts only these versioned backups (up to 5 MB) and is separate from Resource Value history JSON and the standard player JSON export.

Saved trophy stages are stored under `brawl-csv:trophy-history:v1` (up to 500 per player). They are **local to the browser**, not synchronized between devices, and can only show changes between snapshots captured after installing the feature. The app cannot reconstruct past trophies from a current player API response. No background polling occurs. Brawler identity uses stable API IDs whenever present, with normalized names as fallback.

Run the regression tests with `node --test tests/trophy-history.test.js` (or `node --test tests/*.test.js`).
