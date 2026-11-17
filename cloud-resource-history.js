/* Convert cloud daily resource records into the existing chart's history format. */
(function(root,factory) {
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.BrawlCloudResourceHistory = api;
})(typeof globalThis !== "undefined" ? globalThis : null,function() {
  "use strict";
  const CATEGORIES = ["power","gadgets","starPowers","buffies","gears","hypercharges"];
  const nonnegative = value => Number.isFinite(value) && value >= 0;
  const percentage = range => range && Number.isFinite(range.min) &&
    Number.isFinite(range.max) && range.min >= 0 && range.max <= 100 &&
    range.min <= range.max ? {min:range.min,max:range.max} : null;

  function toSeries(snapshots) {
    if(!Array.isArray(snapshots)) return [];
    const byDate = new Map();
    snapshots.forEach(row => {
      const date = row?.date;
      const value = row?.resource;
      if(typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
         Number.isNaN(Date.parse(date+"T12:00:00.000Z")) ||
         !value || !nonnegative(value.coins) || !nonnegative(value.points)) return;
      const categories = {};
      CATEGORIES.forEach(key => {
        const input = value.categories?.[key];
        if(!input || !nonnegative(input.coins) || !nonnegative(input.points)) return;
        categories[key] = {coins:input.coins,points:input.points};
      });
      const completion = {};
      [...CATEGORIES,"total"].forEach(key => {
        completion[key] = percentage(value.completion?.[key]);
      });
      byDate.set(date,{
        timestamp:date+"T12:00:00.000Z",
        coins:value.coins, points:value.points, categories,completion,
        source:"auto", note:"Automatic daily cloud snapshot"
      });
    });
    return [...byDate.values()].sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  }
  return {toSeries};
});
