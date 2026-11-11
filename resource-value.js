/* Resource-equivalent account valuation. No DOM/network dependencies.
   Values represent standard shop/upgrade equivalents, not actual spending. */
(function (root, factory) {
  const calculator = factory();
  if (typeof module === "object" && module.exports) module.exports = calculator;
  if (root) root.BrawlResourceValue = calculator;
})(typeof globalThis !== "undefined" ? globalThis : null, function () {
  "use strict";
  const LEVEL_POINTS = [20, 30, 50, 80, 130, 210, 340, 550, 890, 1440];
  const LEVEL_COINS = [20, 35, 75, 140, 290, 480, 800, 1250, 1875, 2800];
  const PRICES = Object.freeze({
    gadget: 1000, starPower: 2000, buffieCoins: 1000,
    buffiePoints: 2000, hypercharge: 5000, gearBase: 1000
  });
  // Released eligibility roster — update as the game adds Buffies.
  const BUFFIE_NAMES = new Set([
    "8-BIT", "AMBER", "BERRY", "BIBI", "BO", "BROCK", "BULL",
    "CHESTER", "CHUCK", "COLETTE", "COLT", "CROW", "EDGAR",
    "EL PRIMO", "EMZ", "FRANK", "GALE", "GRIFF", "GUS",
    "LEON", "LOU", "MANDY", "MAX", "MEG", "MORTIS",
    "MR. P", "NITA", "POCO", "RICO", "SHADE", "SHELLY",
    "SPIKE", "SURGE"
  ]);
  const BUFFIE_TYPES = ["hyperCharge", "gadget", "starPower"];
  const GEAR_PRICES = {superrare: 1000, epic: 1500, mythic: 2000};
  const SUPER_RARE_GEAR_NAMES = new Set(["DAMAGE", "SPEED", "HEALTH", "SHIELD", "VISION"]);

  function normalizeName(name) {
    return String(name || "").trim().toUpperCase().replace(/\s+/g, " ");
  }
  function levelValue(level) {
    const value = Math.min(11, Math.max(1, Math.floor(Number(level) || 1)));
    return {
      coins: LEVEL_COINS.slice(0, value - 1).reduce((a, b) => a + b, 0),
      points: LEVEL_POINTS.slice(0, value - 1).reduce((a, b) => a + b, 0)
    };
  }
  function newCategory() {
    return {coins: 0, points: 0, remainingCoins: 0, remainingPoints: 0, unknownCoins: 0, unknownPoints: 0};
  }
  function gearValue(gear) {
    const raw = typeof gear?.rarity === "object" ? gear.rarity?.name : gear?.rarity;
    const tier = String(raw || "").toLowerCase().replace(/[\s_-]/g, "");
    if (GEAR_PRICES[tier]) return {coins: GEAR_PRICES[tier], estimated: false};
    if (SUPER_RARE_GEAR_NAMES.has(normalizeName(gear?.name))) {
      return {coins: PRICES.gearBase, estimated: false};
    }
    // Never invent an Epic/Mythic tier from a gear ID or old gear.level value.
    // 1000 is a lower-bound fallback, not an exact valuation.
    return {coins: PRICES.gearBase, estimated: true};
  }
  function catalogueKey(b) {
    return Number.isInteger(Number(b?.id)) ? "id:" + Number(b.id) : "name:" + normalizeName(b?.name);
  }
  function calculate(player, catalogue, mode) {
    const owned = Array.isArray(player?.brawlers) ? player.brawlers : [];
    const isEntireRoster = mode === "all" && Array.isArray(catalogue) && catalogue.length > 0;
    const catalogById = new Map();
    const catalogByName = new Map();
    if (Array.isArray(catalogue)) {
      catalogue.forEach((b) => {
        catalogById.set(catalogueKey(b), b);
        catalogByName.set(normalizeName(b.name), b);
      });
    }
    const ownedById = new Map(owned.map(b => [catalogueKey(b), b]));
    const ownedByName = new Map(owned.map(b => [normalizeName(b.name), b]));
    const catalogRows = isEntireRoster ? catalogue.map(b => ({
      own: ownedById.get(catalogueKey(b)) || ownedByName.get(normalizeName(b.name)) || null,
      catalog: b
    })) : [];
    if (isEntireRoster) {
      // Player API can be newer than the catalog endpoint; never drop owned items.
      owned.forEach(b => {
        if (!catalogById.has(catalogueKey(b)) && !catalogByName.has(normalizeName(b.name))) {
          catalogRows.push({own: b, catalog: null});
        }
      });
    }
    const rows = isEntireRoster ? catalogRows : owned.map(b => ({
      own: b,
      catalog: catalogById.get(catalogueKey(b)) || catalogByName.get(normalizeName(b.name)) || null
    }));
    const byCategory = {
      power: newCategory(), gadgets: newCategory(),
      starPowers: newCategory(), buffies: newCategory(),
      gears: newCategory(), hypercharges: newCategory()
    };
    const warnings = {buffieSlots: 0, gearRarity: 0, hyperchargeBrawlers: 0, gearBrawlers: 0};
    let unowned = 0, buffieEligible = 0, reportedBuffieSlots = 0;
    rows.forEach(({own, catalog}) => {
      if (!own) unowned++;
      const b = own || catalog;
      const level = own ? levelValue(own.power) : {coins: 0, points: 0};
      const max = levelValue(11);
      byCategory.power.coins += level.coins;
      byCategory.power.points += level.points;
      byCategory.power.remainingCoins += max.coins - level.coins;
      byCategory.power.remainingPoints += max.points - level.points;

      [["gadgets", PRICES.gadget], ["starPowers", PRICES.starPower]].forEach(([kind, cost]) => {
        const held = own && Array.isArray(own[kind]) ? own[kind].length : 0;
        // The live catalog knows whether a particular brawler has fewer than 2 released abilities.
        const released = catalog && Array.isArray(catalog[kind]) ? catalog[kind].length : 2;
        const possible = Math.max(held, released);
        byCategory[kind].coins += held * cost;
        byCategory[kind].remainingCoins += Math.max(0, possible - held) * cost;
      });

      if (BUFFIE_NAMES.has(normalizeName(b?.name))) {
        buffieEligible++;
        BUFFIE_TYPES.forEach(kind => {
          const flag = own ? own.buffies?.[kind] : false;
          if (flag === true) {
            byCategory.buffies.coins += PRICES.buffieCoins;
            byCategory.buffies.points += PRICES.buffiePoints;
            reportedBuffieSlots++;
          } else if (flag === false) {
            byCategory.buffies.remainingCoins += PRICES.buffieCoins;
            byCategory.buffies.remainingPoints += PRICES.buffiePoints;
            reportedBuffieSlots++;
          } else {
            warnings.buffieSlots++;
            byCategory.buffies.unknownCoins += PRICES.buffieCoins;
            byCategory.buffies.unknownPoints += PRICES.buffiePoints;
          }
        });
      }

      // Acquired gears/hypercharges are extra value. The API does not reliably
      // supply all available gear types or Hypercharge ownership/eligibility,
      // so these extras have no "remaining to max" denominator.
      if (own) {
        if (Array.isArray(own.gears)) {
          own.gears.forEach(g => {
            const price = gearValue(g);
            byCategory.gears.coins += price.coins;
            if (price.estimated) warnings.gearRarity++;
          });
        } else {
          warnings.gearBrawlers++;
        }
        const hypercharges = Array.isArray(own.hyperCharges) ? own.hyperCharges :
          (Array.isArray(own.hypercharges) ? own.hypercharges : null);
        if (hypercharges) byCategory.hypercharges.coins += hypercharges.length * PRICES.hypercharge;
        else warnings.hyperchargeBrawlers++;
      }
    });

    const coreCategories = ["power", "gadgets", "starPowers", "buffies"];
    const extraCategories = ["gears", "hypercharges"];
    function sum(categories, field) {
      return categories.reduce((total, name) => total + byCategory[name][field], 0);
    }
    const coreCoins = sum(coreCategories, "coins");
    const corePoints = sum(coreCategories, "points");
    const extraCoins = sum(extraCategories, "coins");
    const remainingCoins = sum(coreCategories, "remainingCoins");
    const remainingPoints = sum(coreCategories, "remainingPoints");
    const unknownCoins = sum(coreCategories, "unknownCoins");
    const unknownPoints = sum(coreCategories, "unknownPoints");
    // Completion percentages intentionally exclude extras, whose max values
    // can't be established from the player API. Unknown Buffies yield a range.
    function percentRange(acquired, missing, unknown) {
      const possible = acquired + missing + unknown;
      if (!possible) return null;
      return {min: 100 * acquired / possible, max: 100 * (acquired + unknown) / possible};
    }

    // An honest category completion metric uses an actual known maximum.
    // Power levels use their cumulative power-point requirement; gadgets and
    // star powers use available slots; Buffies use eligible known/unknown slots.
    // Gear/Hypercharge availability is not complete in the player API, so their
    // completion is unavailable rather than falsely treated as 0% or 100%.
    const completionByCategory = {
      power: percentRange(byCategory.power.points, byCategory.power.remainingPoints, 0),
      gadgets: percentRange(byCategory.gadgets.coins, byCategory.gadgets.remainingCoins, 0),
      starPowers: percentRange(byCategory.starPowers.coins, byCategory.starPowers.remainingCoins, 0),
      buffies: percentRange(byCategory.buffies.points, byCategory.buffies.remainingPoints, byCategory.buffies.unknownPoints),
      gears: null,
      hypercharges: null,
      total: null
    };
    // "Total" is an explicitly equal-weight average of the applicable core
    // category percentages, not a fictitious conversion of coins into points.
    const tracked = ["power", "gadgets", "starPowers", "buffies"]
      .map(key => completionByCategory[key]).filter(Boolean);
    if (tracked.length) {
      completionByCategory.total = {
        min: tracked.reduce((sum, x) => sum + x.min, 0) / tracked.length,
        max: tracked.reduce((sum, x) => sum + x.max, 0) / tracked.length
      };
    }
    return {
      mode: isEntireRoster ? "all" : "owned",
      rosterCount: rows.length,
      ownedCount: owned.length,
      unownedCount: unowned,
      eligibleBuffieBrawlers: buffieEligible,
      reportedBuffieSlots,
      categories: byCategory,
      completionByCategory,
      acquired: {coins: coreCoins + extraCoins, points: corePoints},
      coreAcquired: {coins: coreCoins, points: corePoints},
      remainingKnown: {coins: remainingCoins, points: remainingPoints},
      unknown: {coins: unknownCoins, points: unknownPoints},
      progress: {
        coins: percentRange(coreCoins, remainingCoins, unknownCoins),
        points: percentRange(corePoints, remainingPoints, unknownPoints)
      },
      warnings
    };
  }
  return {calculate, levelValue, gearValue, PRICES, BUFFIE_NAMES};
});
