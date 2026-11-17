/* Read-only cloud snapshot chart. Existing local history stays unchanged. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const label = $("dailyHistoryStatus");
  const select = $("dailyHistoryBrawler");
  const chart = $("dailyHistoryChart");
  let snapshots = [];
  function render() {
    const key = select.value;
    const points = snapshots.map(s => {
      if (key === "total") return {date:s.date, value:Number(s.trophies)||0};
      const b = Array.isArray(s.brawlers) && s.brawlers.find(x=>String(x.id)===key);
      return {date:s.date,value:b ? Number(b.trophies)||0 : null};
    }).filter(p=>p.value !== null);
    chart.replaceChildren();
    if (!points.length) {
      label.textContent = snapshots.length ? "No saved values for this selection." : "No daily data yet.";
      return;
    }
    const svgNS = "http://www.w3.org/2000/svg";
    const make=(tag,attrs,text)=>{
      const el=document.createElementNS(svgNS,tag);
      Object.entries(attrs||{}).forEach(([k,v])=>el.setAttribute(k,String(v)));
      if(text!==undefined)el.textContent=text;
      chart.append(el);
      return el;
    };
    const min=Math.min(...points.map(p=>p.value)),max=Math.max(...points.map(p=>p.value));
    const spread=Math.max(1,max-min);
    const left=60,right=725,top=20,bottom=210;
    const coords=points.map((p,i)=>({
      x:left+(points.length===1?0.5:i/(points.length-1))*(right-left),
      y:bottom-(p.value-min)/spread*(bottom-top),...p
    }));
    for(let k=0;k<4;k++){
      const value=min+spread*k/3, y=bottom-(value-min)/spread*(bottom-top);
      make("line",{x1:left,x2:right,y1:y,y2:y,stroke:"#35415b"});
      make("text",{x:5,y:y+4,fill:"#a9bad6","font-size":12},Math.round(value).toLocaleString());
    }
    const line=coords.map((p,i)=>(i?"L":"M")+p.x.toFixed(2)+" "+p.y.toFixed(2)).join(" ");
    make("path",{d:line,fill:"none",stroke:"#ffd34d","stroke-width":3});
    coords.forEach(p=>{
      const c=make("circle",{cx:p.x,cy:p.y,r:4,fill:"#6bdcff"});
      const title=document.createElementNS(svgNS,"title");
      title.textContent=p.date+": "+p.value.toLocaleString()+" trophies";
      c.append(title);
    });
    make("text",{x:left,y:247,fill:"#a9bad6","font-size":12},points[0].date);
    make("text",{x:right,y:247,fill:"#a9bad6","text-anchor":"end","font-size":12},points[points.length-1].date);
    label.textContent=points.length+" daily snapshots · "+points[0].date+" to "+points[points.length-1].date;
  }
  async function load(event) {
    const player=event.detail;
    select.replaceChildren(new Option("Account total","total"));
    snapshots=[];
    chart.replaceChildren();
    label.textContent="Loading daily snapshots…";
    try {
      const response=await fetch("/api/daily-history?tag="+encodeURIComponent(player.tag));
      const data=await response.json();
      if(!response.ok)throw Error(data.message||"History unavailable");
      snapshots=Array.isArray(data.snapshots)?data.snapshots:[];
      const brawlers=new Map();
      snapshots.forEach(s=>(Array.isArray(s.brawlers)?s.brawlers:[]).forEach(b=>{
        if(b.id!==undefined)brawlers.set(String(b.id),String(b.name||b.id));
      }));
      [...brawlers.entries()].sort((a,b)=>a[1].localeCompare(b[1]))
        .forEach(([id,name])=>select.add(new Option(name,id)));
      render();
    }catch(err){
      label.textContent=err.message||"Could not load daily history.";
    }
  }
  document.addEventListener("brawl:player-loaded",load);
  select.addEventListener("change",render);
})();
