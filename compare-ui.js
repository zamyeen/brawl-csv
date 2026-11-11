/* Compare two saved player tags using fresh API data, never cached snapshots. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const STORE_KEY="brawl-csv:saved-profiles:v1";
  const calc=window.BrawlResourceValue;
  const nf=new Intl.NumberFormat();
  const fmt=n=>nf.format(n);
  const validTag=/^#[0289PYLQGRJCUV]+$/;
  let controller=null, sequence=0;
  function getSaved() {
    try {
      const value=JSON.parse(localStorage.getItem(STORE_KEY));
      if(!Array.isArray(value))return [];
      return [...new Map(value.filter(x=>x && validTag.test(x.tag))
        .map(x=>[x.tag,{tag:x.tag,name:String(x.name||x.tag)}])).values()];
    }catch{return [];}
  }
  function populate() {
    const saved=getSaved();
    for(const id of ["compareProfileA","compareProfileB"]){
      const select=$(id),old=select.value;
      select.replaceChildren();
      const empty=document.createElement("option");
      empty.value="";empty.textContent="Choose saved profile";
      select.append(empty);
      saved.forEach(profile=>{
        const option=document.createElement("option");
        option.value=profile.tag;option.textContent=profile.name+" ("+profile.tag+")";
        select.append(option);
      });
      if(saved.some(x=>x.tag===old))select.value=old;
    }
    updateButton();
  }
  function updateButton() {
    const a=$("compareProfileA").value,b=$("compareProfileB").value;
    $("compareProfiles").disabled=!a||!b||a===b;
    if(a && b && a===b) $("compareStatus").textContent="Choose two different saved profiles.";
  }
  async function loadPlayer(tag,signal) {
    const response=await fetch("/api/player?tag="+encodeURIComponent(tag),
      {signal,headers:{Accept:"application/json"}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.message||"Could not load "+tag);
    if(!Array.isArray(data.brawlers))throw Error("Missing brawler data for "+tag);
    return data;
  }
  async function loadRoster(signal) {
    const response=await fetch("/api/brawlers",{signal,headers:{Accept:"application/json"}});
    if(!response.ok)throw Error("Cannot load complete brawler roster.");
    const data=await response.json();
    if(!Array.isArray(data.items)||!data.items.length)throw Error("Invalid roster data.");
    return data.items;
  }
  function appendRow(label,a,b,format,unit="",higherBetter=true) {
    const tr=document.createElement("tr");
    const left=$("compareHeaderA").textContent,right=$("compareHeaderB").textContent;
    const diff=a==null||b==null?"Unavailable"
      :Math.abs(a-b)<0.0001?"Equal"
      :(a>b?left:right)+" +"+(unit==="pp"?Math.abs(a-b).toFixed(1)+" pp"
          :format(Math.abs(a-b))+(unit?" "+unit:""))+
          (higherBetter?"":" (more remaining)");
    [label,a==null?"N/A":format(a),b==null?"N/A":format(b),diff].forEach(value=>{
      const td=document.createElement("td");td.textContent=value;tr.append(td);
    });
    $("compareRows").append(tr);
  }
  const history=window.BrawlResourceHistory;
  let previousComparison=null;
  function drawTrend(){
    if(!previousComparison)return;
    const {a,b,scope}=previousComparison;
    const category=$("compareTrendCategory").value;
    const resource=$("compareTrendResource").value;
    window.BrawlTrendChart.draw($("compareTrendChart"),[
      {name:a.name||a.tag,history:history.list(localStorage,a.tag,scope)},
      {name:b.name||b.tag,history:history.list(localStorage,b.tag,scope)}
    ],{category,resource});
    $("compareTrendHint").textContent=resource==="completion"&&(category==="gears"||category==="hypercharges")
      ?"Completion is unavailable for gears and Hypercharges without a reliable maximum."
      :resource==="completion"
        ?"Completion is a confirmed minimum. The overall metric averages measurable core categories equally."
        :"Each account has its own color. With both resources selected, solid lines show coins and dashed lines show power points on shared per-resource scales. Older snapshots without category data are skipped.";
  }
  function drawComparison(){
    if(!previousComparison)return;
    const {a,b,resultA,resultB}=previousComparison;
    const metric=$("compareChartMetric").value;
    window.BrawlResourceChart.renderComparison(
      $("compareBarChart"),resultA,resultB,metric,[a.name||a.tag,b.name||b.tag]);
    $("compareChartDescription").textContent=metric==="completion"
      ? "Bars show confirmed minimum completion. Unknown Buffie ownership may increase the final percentage."
      : "Grouped bars show each account's collected "+(metric==="coins"?"coin":"power-point")+
        " equivalent value by category and overall. Unreported API resources remain excluded.";
  }
  function renderComparison(a,b,resultA,resultB,scope) {
    previousComparison={a,b,resultA,resultB,scope};
    drawComparison();
    drawTrend();
    $("compareResults").hidden=false;
    $("compareHeaderA").textContent=a.name||a.tag;
    $("compareHeaderB").textContent=b.name||b.tag;
    $("compareNames").textContent=(a.name||a.tag)+" vs. "+(b.name||b.tag)+" · "+(scope==="all"?"Entire roster":"Owned brawlers");
    $("compareRows").replaceChildren();
    const pct=n=>n.toFixed(1)+"%";
    const metrics=[
      ["Brawlers owned",resultA.ownedCount,resultB.ownedCount,fmt,"brawlers"],
      ["Coins acquired",resultA.acquired.coins,resultB.acquired.coins,fmt,"coins"],
      ["Power points acquired",resultA.acquired.points,resultB.acquired.points,fmt,"power points"],
      ["Known coins remaining",resultA.remainingKnown.coins,resultB.remainingKnown.coins,fmt,"coins",false],
      ["Known power points remaining",resultA.remainingKnown.points,resultB.remainingKnown.points,fmt,"power points",false]
    ];
    for(const [key,label] of [["coins","Coin completion"],["points","Power point completion"]]){
      const aRange=resultA.progress[key],bRange=resultB.progress[key];
      if(aRange&&bRange){
        metrics.push([label+" (confirmed minimum)",aRange.min,bRange.min,pct,"pp"]);
        if(aRange.max>aRange.min||bRange.max>bRange.min)
          metrics.push([label+" (possible maximum)",aRange.max,bRange.max,pct,"pp"]);
      }
    }
    for(const [key,label] of [
      ["power","Power levels"],["gadgets","Gadgets"],["starPowers","Star powers"],
      ["buffies","Buffies"],["gears","Gears"],["hypercharges","Hypercharges"],
      ["total","Overall (core average)"]
    ]){
      const ca=resultA.completionByCategory?.[key];
      const cb=resultB.completionByCategory?.[key];
      metrics.push([label+" · completion",ca?.min??null,cb?.min??null,pct,"pp"]);
      if(ca&&cb&&(ca.max>ca.min||cb.max>cb.min))
        metrics.push([label+" · possible completion",ca.max,cb.max,pct,"pp"]);
    }
    for(const [category,label] of [
      ["power","Power levels"],["gadgets","Gadgets"],["starPowers","Star powers"],
      ["buffies","Buffies"],["gears","Gears"],["hypercharges","Hypercharges"]]){
      metrics.push([label+" · coins",resultA.categories[category].coins,resultB.categories[category].coins,fmt,"coins"]);
      if(resultA.categories[category].points||resultB.categories[category].points){
        metrics.push([label+" · points",resultA.categories[category].points,resultB.categories[category].points,fmt,"power points"]);
      }
    }
    metrics.forEach(([name,x,y,format,unit,higherBetter])=>appendRow(name,x,y,format,unit,higherBetter));
    const warnings=[];
    [resultA,resultB].forEach((r,i)=>{
      const player=i===0?a:b;
      const problems=[];
      if(r.warnings.buffieSlots)problems.push(r.warnings.buffieSlots+" unknown Buffie slots");
      if(r.warnings.hyperchargeBrawlers)problems.push(r.warnings.hyperchargeBrawlers+" brawlers missing Hypercharge data");
      if(r.warnings.gearRarity)problems.push(r.warnings.gearRarity+" provisionally valued gears");
      if(problems.length)warnings.push((player.name||player.tag)+": "+problems.join(", "));
    });
    $("compareCaveats").textContent="These are standard resource-equivalent values (not actual purchase history). "+
      (warnings.length?"Incomplete API data: "+warnings.join("; ")+". ":"")+
      "The last column names the profile with the larger value and how much larger it is. For remaining resources, more means additional upgrades are needed. Completion differences are in percentage points.";
  }
  async function compare() {
    const aTag=$("compareProfileA").value,bTag=$("compareProfileB").value;
    if(!aTag||!bTag||aTag===bTag)return;
    if(controller)controller.abort();
    controller=new AbortController();
    const mySeq=++sequence;
    $("compareProfiles").disabled=true;
    $("compareResults").hidden=true;
    previousComparison=null;
    $("compareStatus").textContent="Loading fresh values for both profiles…";
    try {
      const scope=$("compareScope").value;
      const [a,b,roster]=await Promise.all([
        loadPlayer(aTag,controller.signal),loadPlayer(bTag,controller.signal),
        scope==="all"?loadRoster(controller.signal):Promise.resolve(null)
      ]);
      if(mySeq!==sequence)return;
      const ra=calc.calculate(a,roster,scope),rb=calc.calculate(b,roster,scope);
      // Comparing fetched accounts also captures updated progression.
      try {
        history.save(localStorage,a.tag,scope,ra);
        history.save(localStorage,b.tag,scope,rb);
      } catch(error) {
        $("compareStatus").textContent="Could not save progress history: "+error.message;
      }
      renderComparison(a,b,ra,rb,scope);
      $("compareStatus").textContent="Comparison loaded. Select different profiles and compare again to refresh.";
    }catch(error){
      if(error.name!=="AbortError"&&mySeq===sequence){
        $("compareStatus").textContent="Comparison failed: "+error.message;
      }
    }finally{
      if(mySeq===sequence) updateButton();
    }
  }
  $("compareChartMetric").addEventListener("change",drawComparison);
  ["compareTrendCategory","compareTrendResource"].forEach(id=>$(id).addEventListener("change",drawTrend));
  $("compareProfileA").addEventListener("change",updateButton);
  $("compareProfileB").addEventListener("change",updateButton);
  $("compareScope").addEventListener("change",()=>{$("compareResults").hidden=true;previousComparison=null;});
  $("compareProfiles").addEventListener("click",compare);
  // Save action in features.js updates localStorage; clicks happen after the
  // Save button listener, so refresh choices on the same turn.
  document.addEventListener("click",e=>{
    if(e.target && (e.target.closest("#saveProfile")||e.target.closest(".saved-profile-remove")))populate();
  });
  window.addEventListener("storage",e=>{if(e.key===STORE_KEY)populate();});
  populate();
})();
