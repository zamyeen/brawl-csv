/* Renders account resource values and records local snapshots after each load. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat().format(n);
  const calc = window.BrawlResourceValue;
  const history = window.BrawlResourceHistory;
  const chart = window.BrawlResourceChart;
  let player = null;
  let roster = null;
  let rosterPromise = null;
  let lastResult = null;
  let lastRequestedScope = null;
  let lastRecordedTag = null;
  const storage = window.localStorage;

  function saveSnapshot(result, manual = false) {
    if (!player || !player.tag) return {status:"unavailable"};
    return history.save(storage, player.tag, result.mode, result, {
      manual, note: manual ? $("resourceSnapshotNote").value : ""
    });
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
    const series=history.list(storage,player.tag,result.mode);
    const root=$("resourceHistoryList");
    root.replaceChildren();
    series.slice(-5).reverse().forEach(entry=>{
      const li=document.createElement("li");
      const date=document.createElement("span");
      const value=document.createElement("strong");
      date.textContent=new Date(entry.timestamp).toLocaleString() +
        (entry.source==="manual"?" · Saved checkpoint":"") +
        (entry.note?" · "+entry.note:"");
      value.textContent=fmt(entry.coins)+" coins · "+fmt(entry.points)+" power points";
      li.append(date,value);
      root.append(li);
    });
    $("resourceGrowth").textContent=series.length>1
      ? "Since first snapshot: "+signed(series.at(-1).coins-series[0].coins)+" coins, "+
        signed(series.at(-1).points-series[0].points)+" power points."
      : "Save another checkpoint later to track value growth.";
    const category=$("resourceChartCategory").value;
    const resource=$("resourceChartMetric").value;
    window.BrawlTrendChart.draw($("resourceHistoryChart"),[
      {name:player.name||player.tag,history:series}
    ],{category,resource});
    const requiresCompletion=resource==="completion";
    $("resourceChartHint").textContent=requiresCompletion
      ? category==="gears"||category==="hypercharges"
        ? "Completion unavailable: the API does not reliably provide the full number of obtainable gears or Hypercharges."
        : category==="total"
          ? "Total completion is the equal-weight average of Power, Gadgets, Star Powers and Buffies (where defined). Buffie uncertainty is shown as a confirmed minimum."
          : "Completion uses this category's released upgrades. Unknown Buffies are excluded from the confirmed minimum."
      : "Coin and power-point values use their own scales when both are shown. Older snapshots without category detail cannot display those category histories.";
  }
  function signed(value) {return (value>0?"+":"")+fmt(value);}

  function render(record = false) {
    if (!player) return;
    const mode = $("resourceScope").value;
    const result = calc.calculate(player, roster, mode);
    lastResult = result;
    lastRequestedScope = mode;
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

    if (record && (mode === "owned" || result.mode === "all")) {
      try {saveSnapshot(result);} catch(error) { $("resourceHistoryStatus").textContent = "Could not save resource history: " + error.message; }
    }
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
  $("resourceSaveSnapshot").addEventListener("click",()=>{
    if(!player || !lastResult || lastResult.mode!==lastRequestedScope){
      $("resourceHistoryStatus").textContent="Load the selected roster before saving a checkpoint.";
      return;
    }
    try {
      saveSnapshot(lastResult,true);
      $("resourceHistoryStatus").textContent="Snapshot saved for "+(player.name||player.tag)+".";
      $("resourceSnapshotNote").value="";
      displayHistory(lastResult);
    } catch(error) {
      $("resourceHistoryStatus").textContent="Save failed: "+error.message;
    }
  });
  ["resourceChartCategory","resourceChartMetric"].forEach(id=>{
    $(id).addEventListener("change",()=>{
      if(player && lastResult) displayHistory(lastResult);
    });
  });
  $("resourceExportHistory").addEventListener("click",()=>{
    const blob=new Blob([history.exportJSON(storage)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=url;
    anchor.download="brawl-resource-history.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    $("resourceHistoryStatus").textContent="History backup downloaded.";
  });
  $("resourceImportHistory").addEventListener("click",()=>$("resourceImportFile").click());
  $("resourceImportFile").addEventListener("change",async()=>{
    const file=$("resourceImportFile").files?.[0];
    if(!file)return;
    try {
      if(file.size>2*1024*1024) throw new Error("File is too large (2 MB limit).");
      const result=history.importJSON(storage,await file.text());
      $("resourceHistoryStatus").textContent=
        "Imported "+result.imported+" new snapshots across "+result.profiles+" histories.";
      if(player && lastResult) displayHistory(lastResult);
    } catch(error) {
      $("resourceHistoryStatus").textContent="Import failed: "+error.message;
    } finally {$("resourceImportFile").value="";}
  });
  $("resourceSaveSnapshot").disabled=true;
  $("resourceScope").addEventListener("change", () => {
    if (player) {
      // Record a baseline for each scope; subsequent progress is compared within
      // that same scope, not between owned and full-roster completion.
      render(true);
    }
  });
  document.addEventListener("brawl:player-loaded", event => {
    player = event.detail;
    $("resourceSaveSnapshot").disabled=false;
    $("resourceHistoryStatus").textContent="";
    render(true);
    loadRoster().then(() => {
      // After catalogue load, record the complete-roster snapshot only if selected.
      if (player && $("resourceScope").value === "all" && roster) render(true);
    });
  });
})();