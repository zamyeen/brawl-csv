/* Trophy tracker UI: snapshots, history graph, and selected stage deltas. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const engine=window.BrawlTrophyHistory;
  const chart=window.BrawlTrophyCharts;
  const fmt=n=>new Intl.NumberFormat().format(n);
  const signed=n=>(n>0?"+":"")+fmt(n);
  let player=null,comparison=null;
  const storage=window.localStorage;
  function status(message) { $("trophyStatus").textContent=message; }
  function stages(){return player?engine.list(storage,player.tag):[];}
  function formatStage(s,i) {
    return new Date(s.timestamp).toLocaleString()+" · "+fmt(s.total)+" trophies"+
      (s.note?" · "+s.note:"")+(s.source==="manual"?" · checkpoint":"");
  }
  function selectStages() {
    const data=stages();
    const earlier=$("trophyEarlierStage"),later=$("trophyLaterStage");
    const previousA=earlier.value,previousB=later.value;
    earlier.replaceChildren();later.replaceChildren();
    data.forEach((stage,index)=>{
      for(const select of [earlier,later]){
        const option=document.createElement("option");
        option.value=String(index);option.textContent=formatStage(stage,index);
        select.append(option);
      }
    });
    if(data.length) {
      earlier.value=previousA!==""&&Number(previousA)<data.length?previousA:"0";
      later.value=previousB!==""&&Number(previousB)<data.length?previousB:String(data.length-1);
    }
    $("trophyCompareStages").disabled=data.length<2;
  }
  function selectBrawlers() {
    const existing=$("trophyTrendBrawler").value,options=new Map();
    stages().forEach(stage=>stage.brawlers.forEach(b=>options.set(engine.brawlerKey(b),b.name)));
    const select=$("trophyTrendBrawler");
    select.replaceChildren();
    const total=document.createElement("option");total.value="total";total.textContent="Account total";
    select.append(total);
    [...options].sort((a,b)=>a[1].localeCompare(b[1])).forEach(([id,name])=>{
      const option=document.createElement("option");
      option.value=id;option.textContent=name;select.append(option);
    });
    select.value=options.has(existing)||existing==="total"?existing:"total";
  }
  function renderTrend(){
    if(!player)return;
    chart.plot($("trophyTrendChart"),stages(),$("trophyTrendBrawler").value,engine);
  }
  function renderComparison(){
    if(!comparison)return;
    const root=$("trophyDifferenceRows");
    root.replaceChildren();
    const all=comparison.rows,visible=$("trophyShowUnchanged").checked?
      all:all.filter(r=>r.status!=="unchanged");
    for(const entry of visible){
      const tr=document.createElement("tr");
      tr.className="trophy-change-"+entry.status;
      const cells=[
        entry.name,entry.before===null?"Not reported":fmt(entry.before),
        entry.after===null?"Not reported":fmt(entry.after),
        entry.delta===null?"—":signed(entry.delta),
        ({gain:"Gained",loss:"Lost",unchanged:"Unchanged",new:"Newly reported",missing:"Missing from later stage"})[entry.status]
      ];
      cells.forEach((cell,index)=>{
        const td=document.createElement("td");
        td.textContent=cell;
        if(index===3)td.className="trophy-delta trophy-delta-"+entry.status;
        tr.append(td);
      });
      root.append(tr);
    }
    if(!visible.length){
      const row=document.createElement("tr"),cell=document.createElement("td");
      cell.colSpan=5;cell.textContent="No changed brawlers. Enable 'Show unchanged brawlers' to view all.";
      row.append(cell);root.append(row);
    }
  }
  function showStages() {
    const data=stages(),a=Number($("trophyEarlierStage").value),b=Number($("trophyLaterStage").value);
    if(!Number.isInteger(a)||!Number.isInteger(b)||a===b||!data[a]||!data[b]){
      status("Choose two different saved trophy stages.");
      return;
    }
    const earlier=Math.min(a,b),later=Math.max(a,b);
    comparison=engine.compare(data[earlier],data[later]);
    $("trophyStageComparison").hidden=false;
    $("trophyAccountDifference").textContent=signed(comparison.accountDelta);
    $("trophyComparableGains").textContent="+"+fmt(comparison.gains);
    $("trophyComparableLosses").textContent=signed(comparison.losses);
    $("trophyChangedBrawlers").textContent=fmt(comparison.rows.filter(r=>
      r.delta!==null&&r.delta!==0).length);
    const unexplained=comparison.unattributed;
    $("trophyStageExplanation").textContent=
      "Compared "+new Date(data[earlier].timestamp).toLocaleString()+
      " → "+new Date(data[later].timestamp).toLocaleString()+
      ". Account total changed "+signed(comparison.accountDelta)+
      ". Shared-brawler changes sum to "+signed(comparison.netComparable)+
      ". "+(comparison.unreported?"There are "+fmt(comparison.unreported)+
        " brawlers absent from one stage; no zero-based change was invented. ":"")+
      (unexplained?"Difference not accounted for by shared brawlers: "+signed(unexplained)+
        " (may include unlocks or changes to reported brawlers).":"") ;
    chart.deltaBars($("trophyDeltaChart"),comparison);
    renderComparison();
    status("Compared selected trophy stages.");
  }
  function refresh(){
    if(!player)return;
    const data=stages();
    $("trophyCurrent").textContent=fmt(player.trophies);
    $("trophyStageCount").textContent=fmt(data.length);
    const last=data.at(-1),previous=data.length>1?data.at(-2):null;
    $("trophyLatestDelta").textContent=previous?signed(last.total-previous.total):"—";
    selectStages();
    selectBrawlers();
    renderTrend();
    if(comparison){
      $("trophyStageComparison").hidden=true;
      comparison=null;
    }
  }
  $("trophyTrendBrawler").addEventListener("change",renderTrend);
  $("trophyShowUnchanged").addEventListener("change",renderComparison);
  $("trophyCompareStages").addEventListener("click",showStages);
  $("trophySaveStage").addEventListener("click",()=>{
    if(!player)return;
    try {
      engine.save(storage,player.tag,player,{
        manual:true,note:$("trophyStageNote").value
      });
      $("trophyStageNote").value="";
      status("Trophy stage saved.");
      refresh();
    }catch(e){status("Could not save trophy stage: "+e.message);}
  });
  $("trophyExport").addEventListener("click",()=>{
    try {
      const blob=new Blob([engine.exportJSON(storage)],{type:"application/json"});
      const url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download="brawl-trophy-history.json";
      document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      status("Trophy history backup downloaded.");
    }catch(e){status("Export failed: "+e.message);}
  });
  $("trophyImport").addEventListener("click",()=>$("trophyImportFile").click());
  $("trophyImportFile").addEventListener("change",async()=>{
    const file=$("trophyImportFile").files?.[0];
    if(!file)return;
    try {
      if(file.size>5*1024*1024)throw Error("Trophy history file exceeds the 5 MB limit.");
      const result=engine.importJSON(storage,await file.text());
      status("Imported "+result.imported+" trophy stages from "+result.profiles+" profiles.");
      refresh();
    }catch(e){status("Import failed: "+e.message);}
    finally{$("trophyImportFile").value="";}
  });
  document.addEventListener("brawl:player-loaded",event=>{
    player=event.detail;
    $("trophySaveStage").disabled=false;
    try {
      const result=engine.save(storage,player.tag,player);
      status(result.status==="saved"?"Captured a new trophy stage.":"Trophy values unchanged since the previous stage.");
    }catch(e){status("Could not save automatic trophy stage: "+e.message);}
    refresh();
  });
})();
