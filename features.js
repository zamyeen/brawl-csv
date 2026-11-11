/* Saved accounts and progression dashboard — no build tools required. */
(() => {
  "use strict";
  const STORAGE_KEY = "brawl-csv:saved-profiles:v1";
  const GOALS_KEY = "brawl-csv:milestone-goals:v1";
  const TAG_PATTERN = /^#[0289PYLQGRJCUV]+$/;
  // Released Buffie roster (BrawlMetrics; six November additions also noted
  // in Supercell's November 2026 release notes). Review when updates add more.
  const BUFFIE_ELIGIBLE = new Set([
    "8-BIT", "AMBER", "BERRY", "BIBI", "BO", "BROCK", "BULL",
    "CHESTER", "CHUCK", "COLETTE", "COLT", "CROW", "EDGAR",
    "EL PRIMO", "EMZ", "FRANK", "GALE", "GRIFF", "GUS",
    "LEON", "LOU", "MANDY", "MAX", "MEG", "MORTIS",
    "MR. P", "NITA", "POCO", "RICO", "SHADE", "SHELLY",
    "SPIKE", "SURGE"
  ]);
  function isBuffieEligible(brawler) {
    return BUFFIE_ELIGIBLE.has(String(brawler.name || "").trim().toUpperCase());
  }

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => new Intl.NumberFormat().format(n);
  let currentPlayer = null;
  let saved = readJSON(STORAGE_KEY, []);
  let goals = readJSON(GOALS_KEY, {});
  let storageAvailable = true;

  // Cumulative level-up costs are derived from these individual transitions:
  // 1→2, ... , 10→11. Update these values when game economy changes.
  const LEVEL_COSTS = {
    points: [20, 30, 50, 80, 130, 210, 340, 550, 890, 1440],
    coins:  [20, 35, 75, 140, 290, 480, 800, 1250, 1875, 2800]
  };

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function persist(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      storageAvailable = true;
      return true;
    } catch {
      storageAvailable = false;
      $("profilesNotice").textContent = "Browser storage is unavailable. Changes won't persist after this page closes.";
      return false;
    }
  }

  function normalizeTag(tag) {
    const cleaned = String(tag || "").trim().toUpperCase().replace(/\s+/g, "");
    return cleaned ? (cleaned.startsWith("#") ? cleaned : "#" + cleaned) : "";
  }

  function normalizeSaved(value) {
    if (!Array.isArray(value)) return [];
    const unique = new Map();
    value.forEach((item) => {
      const tag = normalizeTag(item && item.tag);
      if (TAG_PATTERN.test(tag)) unique.set(tag, {tag, name: String(item.name || tag).slice(0, 80)});
    });
    return [...unique.values()];
  }
  saved = normalizeSaved(saved);
  if (!goals || typeof goals !== "object" || Array.isArray(goals)) goals = {};

  function targetFor(tag) {
    const value = goals[tag] || {};
    return {
      trophies: Math.max(0, Math.min(1000000, Number(value.trophies) || 50000)),
      power: [9, 10, 11].includes(Number(value.power)) ? Number(value.power) : 11
    };
  }

  function renderSaved() {
    const root = $("savedProfiles");
    root.replaceChildren();
    $("savedCount").textContent = String(saved.length);
    $("savedEmpty").hidden = saved.length !== 0;
    saved.forEach(({tag, name}) => {
      const item = document.createElement("div");
      item.className = "saved-profile";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "saved-profile-load";
      const title = document.createElement("strong");
      title.textContent = name;
      const subtitle = document.createElement("small");
      subtitle.textContent = tag;
      button.append(title, subtitle);
      button.title = "Load " + name;
      button.addEventListener("click", () => {
        $("tag").value = tag;
        $("load").click();
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "saved-profile-remove secondary";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", "Remove " + name + " from saved profiles");
      remove.addEventListener("click", () => {
        saved = saved.filter((profile) => profile.tag !== tag);
        persist(STORAGE_KEY, saved);
        renderSaved();
        updateSaveButton();
      });
      item.append(button, remove);
      root.append(item);
    });
  }

  function updateSaveButton() {
    const isSaved = !!currentPlayer && saved.some(({tag}) => tag === normalizeTag(currentPlayer.tag));
    $("saveProfile").disabled = !currentPlayer;
    $("saveProfile").textContent = isSaved ? "Saved ✓" : "Save profile";
    $("saveProfile").setAttribute("aria-pressed", String(isSaved));
  }

  function costFromTo(current, target) {
    const start = Math.max(1, Math.min(11, Number(current) || 1));
    const end = Math.max(start, Math.min(11, target));
    let points = 0, coins = 0;
    for (let level = start; level < end; level++) {
      points += LEVEL_COSTS.points[level - 1];
      coins += LEVEL_COSTS.coins[level - 1];
    }
    return {points, coins};
  }

  function setMetric(id, value) {
    $(id).textContent = typeof value === "number" ? fmt(value) : value;
  }

  function renderProgress(id, count, total) {
    const percent = total ? Math.min(100, Math.max(0, count / total * 100)) : 0;
    $(id).style.width = percent.toFixed(2) + "%";
    $(id).setAttribute("aria-valuenow", String(Math.round(percent)));
  }


  function renderMilestones() {
    if (!currentPlayer) return;
    const tag = normalizeTag(currentPlayer.tag);
    const selected = targetFor(tag);
    $("trophyGoal").value = String(selected.trophies);
    $("powerGoal").value = String(selected.power);
    const brawlers = Array.isArray(currentPlayer.brawlers) ? currentPlayer.brawlers : [];
    const total = brawlers.length;
    const trophies = Math.max(0, Number(currentPlayer.trophies) || 0);
    setMetric("trophyRemaining", Math.max(0, selected.trophies - trophies));
    $("trophyProgressText").textContent = fmt(trophies) + " / " + fmt(selected.trophies) + " trophies";
    renderProgress("trophyBar", trophies, selected.trophies);

    let upgraded = 0, points = 0, coins = 0;
    const gadgets = [0, 0, 0], stars = [0, 0, 0];
    const gadgetMissingNames = [], starMissingNames = [];
    const buffies = [0, 0, 0, 0];
    const kinds = ["hyperCharge", "gadget", "starPower"];
    let eligibleBrawlers = 0, unknownBrawlers = 0, unknownSlots = 0;
    let knownBuffies = 0, ownedBuffies = 0, missingBuffies = 0;

    brawlers.forEach((brawler) => {
      const level = Math.max(1, Number(brawler.power) || 1);
      if (level >= selected.power) upgraded++;
      const cost = costFromTo(level, selected.power);
      points += cost.points;
      coins += cost.coins;

      const gadgetCount = Math.min(2, Array.isArray(brawler.gadgets) ? brawler.gadgets.length : 0);
      const starCount = Math.min(2, Array.isArray(brawler.starPowers) ? brawler.starPowers.length : 0);
      gadgets[gadgetCount]++;
      stars[starCount]++;
      if (gadgetCount < 2) gadgetMissingNames.push(String(brawler.name || "Unknown"));
      if (starCount < 2) starMissingNames.push(String(brawler.name || "Unknown"));

      if (!isBuffieEligible(brawler)) return;
      eligibleBrawlers++;
      let brawlerOwned = 0, brawlerUnknown = 0;
      kinds.forEach((kind) => {
        const value = brawler.buffies?.[kind];
        if (value === true) {
          brawlerOwned++;
          ownedBuffies++;
          knownBuffies++;
        } else if (value === false) {
          missingBuffies++;
          knownBuffies++;
        } else {
          brawlerUnknown++;
          unknownSlots++;
        }
      });
      if (brawlerUnknown) unknownBrawlers++;
      else buffies[brawlerOwned]++;
    });

    $("powerRemainingLabel").textContent = "owned brawlers below Power " + selected.power;
    setMetric("powerRemaining", total - upgraded);
    $("powerProgressText").textContent = fmt(upgraded) + " / " + fmt(total) + " owned brawlers at Power " + selected.power;
    renderProgress("powerBar", upgraded, total);
    setMetric("pointsRemaining", points);
    setMetric("coinsRemaining", coins);

    for (let count = 0; count <= 2; count++) {
      setMetric("gadgetCount" + count, gadgets[count]);
      setMetric("starCount" + count, stars[count]);
    }
    $("gadgetProgressText").textContent = fmt(gadgets[2]) + " / " + fmt(total) + " owned brawlers have both gadgets";
    $("starProgressText").textContent = fmt(stars[2]) + " / " + fmt(total) + " owned brawlers have both star powers";
    renderProgress("gadgetBar", gadgets[2], total);
    renderProgress("starBar", stars[2], total);
    setMetric("gadgetCoinCost", (gadgets[0] * 2 + gadgets[1]) * 1000);
    setMetric("starCoinCost", (stars[0] * 2 + stars[1]) * 2000);
    $("gadgetMissingNames").textContent = gadgetMissingNames.length
      ? "Still missing gadgets: " + gadgetMissingNames.join(", ")
      : "All owned brawlers have both gadgets.";
    $("starMissingNames").textContent = starMissingNames.length
      ? "Still missing star powers: " + starMissingNames.join(", ")
      : "All owned brawlers have both star powers.";

    for (let count = 0; count <= 3; count++) setMetric("buffieCount" + count, buffies[count]);
    renderProgress("buffieBar", ownedBuffies, knownBuffies);
    $("buffieProgressText").textContent = knownBuffies
      ? fmt(ownedBuffies) + " / " + fmt(knownBuffies) + " reported ability Buffies collected"
      : "No ability Buffie ownership data reported";
    // Unknown API fields are not treated as missing. The estimate is a lower bound
    // whenever the API does not report all three types for eligible owned brawlers.
    setMetric("buffieCoinCost", knownBuffies ? missingBuffies * 1000 : "—");
    setMetric("buffiePointCost", knownBuffies ? missingBuffies * 2000 : "—");
    $("buffieCoinLabel").textContent = unknownSlots ? "Minimum known coins needed" : "Coins for missing Buffies";
    $("buffiePointLabel").textContent = unknownSlots ? "Minimum known power points needed" : "Power points for missing Buffies";
    $("buffieBreakdown").textContent = fmt(eligibleBrawlers) + " owned eligible brawlers. " +
      (unknownBrawlers
        ? fmt(unknownBrawlers) + " brawlers have incomplete API ownership data (" +
          fmt(unknownSlots) + " unknown Buffie slots); excluded from the 0–3 brawler breakdown. Costs are minimums."
        : "All eligible brawlers have reported ownership for the three ability Buffies.") +
      " Estimates assume 1,000 coins + 2,000 power points per missing Buffie; cosmetic Buffies are excluded.";
    $("milestonePlayer").textContent = currentPlayer.name || tag;
  }

  function saveGoal() {
    if (!currentPlayer) return;
    const tag = normalizeTag(currentPlayer.tag);
    goals[tag] = {
      trophies: Math.max(0, Math.min(1000000, Math.floor(Number($("trophyGoal").value) || 0))),
      power: Number($("powerGoal").value)
    };
    persist(GOALS_KEY, goals);
    renderMilestones();
  }

  $("saveProfile").addEventListener("click", () => {
    if (!currentPlayer) return;
    const tag = normalizeTag(currentPlayer.tag);
    if (!TAG_PATTERN.test(tag)) return;
    const updated = {tag, name: String(currentPlayer.name || tag).slice(0, 80)};
    saved = [...saved.filter((profile) => profile.tag !== tag), updated];
    persist(STORAGE_KEY, saved);
    renderSaved();
    updateSaveButton();
  });
  $("trophyGoal").addEventListener("change", saveGoal);
  $("powerGoal").addEventListener("change", saveGoal);
  document.addEventListener("brawl:player-loaded", (event) => {
    currentPlayer = event.detail;
    updateSaveButton();
    const tag = normalizeTag(currentPlayer.tag);
    const item = saved.find((profile) => profile.tag === tag);
    if (item && item.name !== currentPlayer.name) {
      item.name = String(currentPlayer.name || tag).slice(0, 80);
      persist(STORAGE_KEY, saved);
      renderSaved();
    }
    renderMilestones();
  });
  renderSaved();
  updateSaveButton();
})();
