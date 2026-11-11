/* Renders account resource values and records local snapshots after each load. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat().format(n);
  const calc = window.BrawlResourceValue;
  const HISTORY_KEY = "brawl-csv:resource-history:v1";
  let player = null;
  let roster = null;
  let rosterPromise = null;

  function readHistory() {
    try {
      const result = JSON.parse(localStorage.getItem(HISTORY_KEY));
      return result && typeof result === "object" && !Array.isArray(result) ? result : {};
    } catch { return {}; }
  }
  function saveSnapshot(result) {
    if (!player || !player.tag) return;
    const tag = String(player.tag).trim().toUpperCase();
    const key = tag + ":" + result.mode;
    const history = readHistory();
    const series = Array.isArray(history[key]) ? history[key] : [];
    const snapshot = {
      timestamp: new Date().toISOString(),
      coins: result.acquired.coins,
      points: result.acquired.points,
      count: result.rosterCount,
      unknownBuffies: result.warnings.buffieSlots
    };
    const prior = series[series.length - 1];
    if (prior && prior.coins === snapshot.coins && prior.points === snapshot.points &&
        prior.count === snapshot.count && prior.unknownBuffies === snapshot.unknownBuffies) return;
    const next = [...series, snapshot].slice(-60);
    history[key] = next;
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }
    catch { /* Private browsing/storage quotas should not break the account. */ }
  }
  function percentLabel(range) {
    if (!range) return "—";
    if (Math.abs(range.min - range.max) < 0.05) return range.min.toFixed(1) + "%";
    return range.min.toFixed(1) + "–" + range.max.toFixed(1) + "%";
  }
  function progress(id, range) {
    const percent = range ? Math.max(0, Math.min(100, range.min)) : 0;
    const bar = $(id);
    bar.style.width = percent.toFixed(2) + "%";
    bar.setAttribute("aria-valuenow", String(Math.round(percent)));
  }
  function displayHistory(result) {
    const tag = String(player.tag || "").trim().toUpperCase();
    const series = readHistory()[tag + ":" + result.mode] || [];
    const root = $("resourceHistoryList");
    root.replaceChildren();
    const recent = series.slice(-5).reverse();
    recent.forEach(entry => {
      const li = document.createElement("li");
      const date = document.createElement("span");
      const value = document.createElement("strong");
      date.textContent = new Date(entry.timestamp).toLocaleString();
      value.textContent = fmt(entry.coins) + " coins · " + fmt(entry.points) + " power points";
      li.append(date, value);
      root.append(li);
    });
    const growth = $("resourceGrowth");
    if (series.length > 1) {
      const first = series[0], last = series[series.length - 1];
      const delta = (v) => (v > 0 ? "+" : "") + fmt(v);
      growth.textContent = "Since first snapshot: " + delta(last.coins - first.coins) +
        " coins, " + delta(last.points - first.points) + " power points of resource value.";
    } else growth.textContent = "A later change in this account's resources will appear here.";
  }
  function render(record = false) {
    if (!player) return;
    const mode = $("resourceScope").value;
    const result = calc.calculate(player, roster, mode);
    $("resourceCoinsAcquired").textContent = fmt(result.acquired.coins);
    $("resourcePointsAcquired").textContent = fmt(result.acquired.points);
    $("resourceCoinsRemaining").textContent = fmt(result.remainingKnown.coins);
    $("resourcePointsRemaining").textContent = fmt(result.remainingKnown.points);
    for (const [key, title] of [["coins", "Coins"], ["points", "Points"]]) {
      const range = result.progress[key];
      $( "resource" + title + "Percent").textContent = percentLabel(range);
      progress("resource" + title + "Bar", range);
      const extra = result.unknown[key];
      $("resource" + title + "ProgressDetail").textContent = extra
        ? fmt(extra) + " resource value unresolved (unknown Buffie ownership). Bar shows confirmed minimum."
        : "Completion of known core upgrades; gears and Hypercharges are tracked as extras.";
    }
    const root = $("resourceRows");
    root.replaceChildren();
    const labels = {
      power: "Power levels", gadgets: "Gadgets", starPowers: "Star powers",
      buffies: "Buffies", gears: "Gears (owned only)", hypercharges: "Hypercharges (reported only)"
    };
    for (const [key, label] of Object.entries(labels)) {
      const cat = result.categories[key];
      const tr = document.createElement("tr");
      for (const value of [label, fmt(cat.coins), fmt(cat.points), fmt(cat.remainingCoins), fmt(cat.remainingPoints)]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      root.append(tr);
    }
    const total = document.createElement("tr");
    for (const value of ["Total (known)", fmt(result.acquired.coins), fmt(result.acquired.points),
      fmt(result.remainingKnown.coins), fmt(result.remainingKnown.points)]) {
      const td = document.createElement("td");
      td.textContent = value;
      total.append(td);
    }
    root.append(total);

    const messages = [];
    messages.push(result.mode === "all"
      ? "Entire roster: " + fmt(result.rosterCount) + " brawlers, including " +
        fmt(result.unownedCount) + " unowned."
      : "Owned roster: " + fmt(result.rosterCount) + " brawlers.");
    if (mode === "all" && result.mode !== "all") {
      messages.push("The complete roster could not be loaded; showing owned-brawler estimates until it becomes available.");
    }
    if (result.warnings.buffieSlots) {
      messages.push(fmt(result.warnings.buffieSlots) + " eligible Buffie ownership fields are unknown. Resource totals and remaining costs are minimum confirmed values.");
    }
    if (result.warnings.hyperchargeBrawlers) {
      messages.push("Hypercharge ownership is absent for " + fmt(result.warnings.hyperchargeBrawlers) +
        " owned brawlers in the API; their Hypercharge value is not counted.");
    }
    if (result.warnings.gearBrawlers) {
      messages.push("Gear ownership is not reported for " + fmt(result.warnings.gearBrawlers) + " owned brawlers.");
    }
    if (result.warnings.gearRarity) {
      messages.push(fmt(result.warnings.gearRarity) +
        " gear values use a provisional 1,000-coin floor because rarity is unavailable.");
    }
    messages.push("Completion percentages use power levels, gadgets, star powers and eligible Buffies. Gears and Hypercharges contribute known resource value but have no reliable completion denominator. Unlock costs, unspent balances and free-reward history are excluded.");
    $("resourceNotes").textContent = messages.join(" ");

    if (record) saveSnapshot(result);
    displayHistory(result);
  }
  async function loadRoster() {
    if (rosterPromise) return rosterPromise;
    rosterPromise = (async () => {
      try {
        const response = await fetch("/api/brawlers", {headers: {Accept: "application/json"}});
        if (!response.ok) throw new Error("Roster endpoint unavailable");
        const data = await response.json();
        if (!Array.isArray(data.items) || !data.items.length) throw new Error("Invalid roster");
        roster = data.items;
      } catch {
        roster = null;
      }
      if (player) render(false);
    })();
    return rosterPromise;
  }
  $("resourceScope").addEventListener("change", () => {
    if (player) {
      // Record a baseline for each scope; subsequent progress is compared within
      // that same scope, not between owned and full-roster completion.
      render(true);
    }
  });
  document.addEventListener("brawl:player-loaded", event => {
    player = event.detail;
    render(true);
    loadRoster().then(() => {
      // Capturing the fully resolved scope avoids mixing fallback snapshots with
      // historical full-roster values.
      if (player && $("resourceScope").value === "all" && roster) render(true);
    });
  });
})();