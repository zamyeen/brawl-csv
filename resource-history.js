/* Browser-local resource snapshots, backup and restore. Compatible with v1 history. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BrawlResourceHistory = api;
})(typeof globalThis !== "undefined" ? globalThis : null, function () {
  "use strict";
  const KEY = "brawl-csv:resource-history:v1";
  const FORMAT = "brawl-csv-resource-history";
  const LIMIT = 500;
  const KEY_PATTERN = /^#[0289PYLQGRJCUV]+:(owned|all)$/;
  const CATEGORIES = ["power", "gadgets", "starPowers", "buffies", "gears", "hypercharges"];
  function value(v, fallback = 0) {
    return Number.isSafeInteger(v) && v >= 0 ? v : fallback;
  }
  function normalizeTag(tag) {
    return String(tag || "").trim().toUpperCase();
  }
  function seriesKey(tag, scope) {
    const key = normalizeTag(tag) + ":" + scope;
    if (!KEY_PATTERN.test(key)) throw new Error("Invalid player tag or snapshot scope.");
    return key;
  }
  function normalizedSnapshot(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const time = Date.parse(item.timestamp);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== item.timestamp) return null;
    if (!Number.isSafeInteger(item.coins) || item.coins < 0 ||
        !Number.isSafeInteger(item.points) || item.points < 0) return null;
    const result = {
      timestamp: item.timestamp,
      coins: item.coins,
      points: item.points,
      count: value(item.count),
      unknownBuffies: value(item.unknownBuffies),
      remainingCoins: value(item.remainingCoins),
      remainingPoints: value(item.remainingPoints),
      source: item.source === "manual" ? "manual" : "auto"
    };
    if (typeof item.note === "string" && item.note.trim()) result.note = item.note.trim().slice(0, 100);
    if (item.categories && typeof item.categories === "object") {
      result.categories = {};
      CATEGORIES.forEach(category => {
        const b = item.categories[category];
        if (b && typeof b === "object") {
          result.categories[category] = {
            coins: value(b.coins), points: value(b.points)
          };
        }
      });
    }
    return result;
  }
  function sanitize(raw) {
    const data = Object.create(null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return data;
    Object.keys(raw).forEach(key => {
      if (!KEY_PATTERN.test(key) || !Array.isArray(raw[key])) return;
      const distinct = new Map();
      raw[key].slice(-2000).forEach(item => {
        const snapshot = normalizedSnapshot(item);
        if (snapshot) distinct.set(snapshot.timestamp + "|" + snapshot.coins + "|" + snapshot.points, snapshot);
      });
      data[key] = [...distinct.values()]
        .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
        .slice(-LIMIT);
    });
    return data;
  }
  function read(storage) {
    try { return sanitize(JSON.parse(storage.getItem(KEY))); }
    catch { return Object.create(null); }
  }
  function list(storage, tag, scope) {
    return read(storage)[seriesKey(tag, scope)] || [];
  }
  function write(storage, data) {
    storage.setItem(KEY, JSON.stringify(data)); // Throw on failure; do not claim saved.
  }
  function snapshotFromResult(result, source, note, timestamp = new Date().toISOString()) {
    return normalizedSnapshot({
      timestamp,
      coins: result.acquired.coins,
      points: result.acquired.points,
      count: result.rosterCount,
      unknownBuffies: result.warnings.buffieSlots,
      remainingCoins: result.remainingKnown.coins,
      remainingPoints: result.remainingKnown.points,
      source, note,
      categories: Object.fromEntries(CATEGORIES.map(c => [
        c, {coins: result.categories[c].coins, points: result.categories[c].points}
      ]))
    });
  }
  function save(storage, tag, scope, result, options = {}) {
    if (!result || result.mode !== scope) throw new Error("Roster data has not loaded for this scope.");
    const key = seriesKey(tag, scope);
    const history = read(storage);
    const series = history[key] || [];
    const note = options.note || "";
    const next = snapshotFromResult(result, options.manual ? "manual" : "auto", note,
      options.timestamp || new Date().toISOString());
    if (!next) throw new Error("Invalid snapshot values.");
    const last = series[series.length - 1];
    const unchanged = last && last.coins === next.coins && last.points === next.points &&
      last.count === next.count && last.unknownBuffies === next.unknownBuffies &&
      last.remainingCoins === next.remainingCoins && last.remainingPoints === next.remainingPoints;
    if (unchanged && !options.manual) return {status: "unchanged", snapshot: last};
    history[key] = [...series, next].slice(-LIMIT);
    write(storage, history);
    return {status: "saved", snapshot: next};
  }
  function exportJSON(storage) {
    return JSON.stringify({
      format: FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      history: read(storage)
    }, null, 2);
  }
  function importJSON(storage, text) {
    const payload = JSON.parse(text);
    if (!payload || payload.format !== FORMAT || payload.version !== 1 ||
        !payload.history || typeof payload.history !== "object" || Array.isArray(payload.history)) {
      throw new Error("Choose a Brawl CSV resource-history JSON backup.");
    }
    const original = read(storage);
    const incoming = sanitize(payload.history);
    let imported = 0;
    Object.keys(incoming).forEach(key => {
      const existing = original[key] || [];
      const existingKeys = new Set(existing.map(s => s.timestamp + "|" + s.coins + "|" + s.points));
      incoming[key].forEach(s => {
        const dedupe = s.timestamp + "|" + s.coins + "|" + s.points;
        if (!existingKeys.has(dedupe)) imported++;
      });
      original[key] = sanitize({[key]: [...existing, ...incoming[key]]})[key] || [];
    });
    write(storage, original);
    return {imported, profiles: Object.keys(incoming).length};
  }
  return {KEY, LIMIT, seriesKey, read, list, save, exportJSON, importJSON, sanitize};
});
