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
    const percent = total ? Math.min(100, Math.max(0, count / total * 100)) : 100;
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
    const remainingTrophies = Math.max(0, selected.trophies - trophies);
    setMetric("trophyRemaining", remainingTrophies);
    $("trophyProgressText").textContent = fmt(trophies) + " / " + fmt(selected.trophies) + " trophies";
    renderProgress("trophyBar", trophies, selected.trophies);

    let upgraded = 0, points = 0, coins = 0, gadgetComplete = 0, starComplete = 0;
    brawlers.forEach((brawler) => {
      const level = Math.max(1, Number(brawler.power) || 1);
      if (level >= selected.power) upgraded++;
      const cost = costFromTo(level, selected.power);
      points += cost.points;
      coins += cost.coins;
      if (Array.isArray(brawler.gadgets) && brawler.gadgets.length >= 2) gadgetComplete++;
      if (Array.isArray(brawler.starPowers) && brawler.starPowers.length >= 2) starComplete++;
    });
    $("powerProgressText").textContent = fmt(upgraded) + " / " + fmt(total) + " owned brawlers at level " + selected.power;
    setMetric("powerRemaining", total - upgraded);
    renderProgress("powerBar", upgraded, total);
    setMetric("pointsRemaining", points);
    setMetric("coinsRemaining", coins);
    $("gadgetProgressText").textContent = fmt(gadgetComplete) + " / " + fmt(total) + " owned brawlers with 2 gadgets";
    setMetric("gadgetRemaining", total - gadgetComplete);
    renderProgress("gadgetBar", gadgetComplete, total);
    $("starProgressText").textContent = fmt(starComplete) + " / " + fmt(total) + " owned brawlers with 2 star powers";
    setMetric("starBar", starComplete, total);
    setMetric("starRemaining", total - starComplete);
    // The API only supplies buffie availability for some brawlers.
    // Count explicit true/false values, never treat a missing field as an unowned Buffie.
    const kinds = ["hyperCharge", "gadget", "starPower"];
    const missingByKind = {hyperCharge: 0, gadget: 0, starPower: 0};
    let buffieOwned = 0, buffieKnown = 0, unknownEligibleSlots = 0;
    let eligibleBrawlers = 0;
    let firstGadgets = 0, firstStarPowers = 0;
    const noGadgets = [], noStarPowers = [];
    brawlers.forEach((brawler) => {
      const gadgets = Array.isArray(brawler.gadgets) ? brawler.gadgets : [];
      const starPowers = Array.isArray(brawler.starPowers) ? brawler.starPowers : [];
      if (gadgets.length > 0) firstGadgets++;
      else noGadgets.push(String(brawler.name || "Unknown"));
      if (starPowers.length > 0) firstStarPowers++;
      else noStarPowers.push(String(brawler.name || "Unknown"));

      if (!isBuffieEligible(brawler)) return;
      eligibleBrawlers++;
      kinds.forEach((kind) => {
        const value = brawler.buffies?.[kind];
        if (value === true) { buffieOwned++; buffieKnown++; }
        else if (value === false) { missingByKind[kind]++; buffieKnown++; }
        else unknownEligibleSlots++;
      });
    });
    const buffieMissing = Object.values(missingByKind).reduce((a, b) => a + b, 0);
    setMetric("buffieRemaining", buffieKnown ? buffieMissing : "—");
    renderProgress("buffieBar", buffieOwned, buffieKnown);
    $("buffieProgressText").textContent = buffieKnown
      ? fmt(buffieOwned) + " / " + fmt(buffieKnown) + " reported eligible Buffies collected"
      : "No eligible Buffie ownership data reported";
    $("buffieBreakdown").textContent = fmt(eligibleBrawlers) + " owned Buffie-eligible brawlers. Missing: " +
      fmt(missingByKind.hyperCharge) + " Hypercharge, " + fmt(missingByKind.gadget) +
      " Gadget, " + fmt(missingByKind.starPower) + " Star Power." +
      (unknownEligibleSlots ? " " + fmt(unknownEligibleSlots) + " eligible slots have unknown ownership and are excluded." : "");
    setMetric("gadgetFirstRemaining", total - firstGadgets);
    renderProgress("gadgetFirstBar", firstGadgets, total);
    $("gadgetFirstProgressText").textContent = fmt(firstGadgets) + " / " + fmt(total) + " owned brawlers with a gadget";
    $("gadgetFirstNames").textContent = noGadgets.length ? "Missing: " + noGadgets.join(", ") : "All owned brawlers have a gadget.";
    setMetric("starFirstRemaining", total - firstStarPowers);
    renderProgress("starFirstBar", firstStarPowers, total);
    $("starFirstProgressText").textContent = fmt(firstStarPowers) + " / " + fmt(total) + " owned brawlers with a star power";
    $("starFirstNames").textContent = noStarPowers.length ? "Missing: " + noStarPowers.join(", ") : "All owned brawlers have a star power.";
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
