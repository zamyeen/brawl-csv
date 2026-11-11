/* Accessible dependency-free SVG visualizations for resource progress and comparisons. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BrawlResourceChart = api;
})(typeof globalThis !== "undefined" ? globalThis : null, function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = {coins:"#ffd34d", points:"#6bdcff", a:"#ffd34d", b:"#6bdcff"};
  const number = new Intl.NumberFormat();
  const compact = new Intl.NumberFormat(undefined, {notation:"compact",maximumFractionDigits:1});
  function node(doc, tag, attrs={}, text) {
    const el = doc.createElementNS(NS, tag);
    for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,String(value));
    if (text !== undefined) el.textContent = String(text);
    return el;
  }
  function append(svg, tag, attrs={}, text) {
    const el=node(svg.ownerDocument,tag,attrs,text);
    svg.append(el);
    return el;
  }
  function snapshots(series, metric) {
    return (Array.isArray(series)?series:[]).filter(entry=>
      entry && Number.isFinite(Date.parse(entry.timestamp)) &&
      Number.isFinite(entry.coins) && Number.isFinite(entry.points) &&
      (metric === "coins" || metric === "points" || metric === "both"))
      .slice().sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
  }
  function valueRange(values) {
    const lo=Math.min(...values),hi=Math.max(...values);
    const pad=Math.max(1, (hi-lo)*0.12);
    const min=Math.max(0,lo-pad),max=hi+pad;
    return {min,max};
  }
  function scaledPoints(series,unit,width=700,height=240) {
    const valid=snapshots(series,unit);
    if(!valid.length)return {points:[],min:0,max:0};
    const range=valueRange(valid.map(s=>s[unit]));
    const dates=valid.map(s=>Date.parse(s.timestamp));
    const start=Math.min(...dates),end=Math.max(...dates);
    const left=57,right=width-20,top=16,bottom=height-43;
    const points=valid.map((entry,i)=>({
      x:start===end?(left+right)/2:left+(dates[i]-start)/(end-start)*(right-left),
      y:bottom-(entry[unit]-range.min)/(range.max-range.min)*(bottom-top),
      value:entry[unit],timestamp:entry.timestamp,note:entry.note||"",source:entry.source||"auto"
    }));
    return {points,...range,start,end,left,right,top,bottom};
  }
  function render(svg,series,mode="coins") {
    const metric=["coins","points","both"].includes(mode)?mode:"coins";
    const values=snapshots(series,metric);
    svg.replaceChildren();
    svg.setAttribute("viewBox","0 0 760 270");
    svg.setAttribute("role","img");
    svg.setAttribute("aria-label",metric==="both"
      ?"Resource history: coin values on left axis and power points on right axis"
      :(metric==="coins"?"Coins":"Power points")+" history over time");
    if(!values.length) {
      append(svg,"text",{x:380,y:140,"text-anchor":"middle",fill:"#b8c3dc","font-size":15},
        "No snapshots yet. Save a snapshot to begin.");
      return;
    }
    const both=metric==="both";
    const keys=both?["coins","points"]:[metric];
    const x0=both?78:72,x1=both?672:712,y0=49,y1=224;
    const times=values.map(s=>Date.parse(s.timestamp));
    const start=times[0],end=times[times.length-1];
    const x=t=>start===end?(x0+x1)/2:x0+(t-start)/(end-start)*(x1-x0);
    const ranges={};
    keys.forEach(key=>{ranges[key]=valueRange(values.map(s=>s[key]));});
    const y=(key,v)=>y1-(v-ranges[key].min)/(ranges[key].max-ranges[key].min)*(y1-y0);
    const leftKey=keys[0];
    const rightKey=both?"points":null;

    let legendX=76;
    keys.forEach(key=>{
      append(svg,"line",{x1:legendX,x2:legendX+21,y1:20,y2:20,stroke:COLORS[key],"stroke-width":4,"stroke-linecap":"round"});
      append(svg,"text",{x:legendX+29,y:24,fill:"#dbe4f7","font-size":12},
        (key==="coins"?"Coins":"Power points")+(both?(key==="coins"?" · left axis":" · right axis"):""));
      legendX+=both?216:162;
    });
    for(let i=0;i<=4;i++){
      const yy=y1-i*(y1-y0)/4;
      append(svg,"line",{x1:x0,x2:x1,y1:yy,y2:yy,stroke:"#34435f","stroke-width":1});
      const lv=ranges[leftKey].min+(ranges[leftKey].max-ranges[leftKey].min)*i/4;
      append(svg,"text",{x:x0-9,y:yy+4,"text-anchor":"end",fill:COLORS[leftKey],"font-size":11},compact.format(lv));
      if(rightKey){
        const rv=ranges[rightKey].min+(ranges[rightKey].max-ranges[rightKey].min)*i/4;
        append(svg,"text",{x:x1+9,y:yy+4,fill:COLORS[rightKey],"font-size":11},compact.format(rv));
      }
    }
    keys.forEach(key=>{
      const pts=values.map(s=>({x:x(Date.parse(s.timestamp)),y:y(key,s[key]),snapshot:s}));
      if(pts.length>1){
        append(svg,"polyline",{
          points:pts.map(p=>p.x.toFixed(2)+","+p.y.toFixed(2)).join(" "),
          fill:"none",stroke:COLORS[key],"stroke-width":3,
          "stroke-linejoin":"round","stroke-linecap":"round"
        });
      }
      pts.forEach(p=>{
        const c=append(svg,"circle",{
          cx:p.x,cy:p.y,r:p.snapshot.source==="manual"?5.4:4.2,
          fill:p.snapshot.source==="manual"?"#0b1020":COLORS[key],
          stroke:COLORS[key],"stroke-width":p.snapshot.source==="manual"?2.6:1.5
        });
        c.append(node(svg.ownerDocument,"title",{},
          new Date(p.snapshot.timestamp).toLocaleString()+" — "+number.format(p.snapshot[key])+
          " "+(key==="coins"?"coins":"power points")+
          (p.snapshot.note?" · "+p.snapshot.note:"")));
      });
    });
    append(svg,"text",{x:x0,y:255,"text-anchor":"start",fill:"#b8c3dc","font-size":11},
      new Date(start).toLocaleDateString());
    if(end!==start)append(svg,"text",{x:x1,y:255,"text-anchor":"end",fill:"#b8c3dc","font-size":11},
      new Date(end).toLocaleDateString());
  }
  function comparisonBars(a,b,metric) {
    const sections=[
      ["power","Power levels"],["gadgets","Gadgets"],["starPowers","Star powers"],
      ["buffies","Buffies"],["gears","Gears"],["hypercharges","Hypercharges"]
    ];
    if(metric==="completion"){
      return [["Power levels","power"],["Gadgets","gadgets"],["Star powers","starPowers"],
        ["Buffies","buffies"],["Gears","gears"],["Hypercharges","hypercharges"],
        ["Total (core average)","total"]].map(([label,key])=>[
          label,a.completionByCategory?.[key]?.min??null,b.completionByCategory?.[key]?.min??null
        ]);
    }
    if(metric!=="coins"&&metric!=="points")throw Error("Invalid resource metric");
    const rows=sections.map(([key,label])=>[label,a.categories[key][metric],b.categories[key][metric]])
      .filter(([,x,y])=>x>0||y>0);
    rows.push(["Total acquired",a.acquired[metric],b.acquired[metric]]);
    return rows;
  }
  function renderComparison(svg,a,b,mode="coins",names=["Profile A","Profile B"]) {
    const metric=["coins","points","completion"].includes(mode)?mode:"coins";
    const rows=comparisonBars(a,b,metric);
    const width=900,top=62,rowHeight=60,bottom=34;
    const height=top+rows.length*rowHeight+bottom;
    const barX=172,maxX=745,usable=maxX-barX;
    const max=metric==="completion"?100:Math.max(1,...rows.flatMap(([,x,y])=>[x||0,y||0]));
    const short=n=>metric==="completion"?n.toFixed(1)+"%":number.format(n);
    const axes=metric==="completion"?"Completion (confirmed minimum)":"Resource-equivalent "+(metric==="coins"?"coins":"power points");
    svg.replaceChildren();
    svg.setAttribute("viewBox","0 0 "+width+" "+height);
    svg.setAttribute("role","img");
    svg.setAttribute("aria-label","Two-profile comparison of "+axes.toLowerCase());
    append(svg,"rect",{x:20,y:17,width:12,height:12,rx:3,fill:COLORS.a});
    append(svg,"text",{x:39,y:28,fill:"#dbe4f7","font-size":13},names[0]);
    append(svg,"rect",{x:390,y:17,width:12,height:12,rx:3,fill:COLORS.b});
    append(svg,"text",{x:409,y:28,fill:"#dbe4f7","font-size":13},names[1]);
    append(svg,"text",{x:barX,y:48,fill:"#b8c3dc","font-size":11},axes);
    rows.forEach(([label,av,bv],i)=>{
      const base=top+i*rowHeight;
      append(svg,"text",{x:barX-14,y:base+23,"text-anchor":"end",fill:"#dbe4f7","font-size":13},label);
      append(svg,"line",{x1:barX,x2:maxX,y1:base+49,y2:base+49,stroke:"#34435f","stroke-width":1});
      [av,bv].forEach((n,j)=>{
        if(n===null || n===undefined)return;
        const y=base+6+j*21;
        const barWidth=Math.max(0,n/max*usable);
        const color=j===0?COLORS.a:COLORS.b;
        const rect=append(svg,"rect",{x:barX,y,width:barWidth,height:16,rx:3,fill:color});
        rect.append(node(svg.ownerDocument,"title",{},(j===0?names[0]:names[1])+": "+short(n)+" — "+label));
        append(svg,"text",{x:Math.min(865,barX+barWidth+7),y:y+12,fill:color,"font-size":12},short(n));
      });
    });
    append(svg,"text",{x:barX,y:height-8,fill:"#b8c3dc","font-size":11},"0");
    append(svg,"text",{x:maxX,y:height-8,"text-anchor":"end",fill:"#b8c3dc","font-size":11},
      metric==="completion"?"100%":compact.format(max));
  }
  return {scaledPoints,render,comparisonBars,renderComparison};
});
