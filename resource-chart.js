/* Lightweight, accessible SVG chart of saved snapshots. */
(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BrawlResourceChart = api;
})(typeof globalThis !== "undefined" ? globalThis : null, function() {
  "use strict";
  const NS="http://www.w3.org/2000/svg";
  function scaledPoints(series, unit, width=700, height=240) {
    const valid=series.filter(s => Number.isFinite(Date.parse(s.timestamp)) &&
      Number.isFinite(s[unit])).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
    if (!valid.length) return {points:[],min:0,max:0};
    const values=valid.map(s=>s[unit]);
    const minVal=Math.min(...values), maxVal=Math.max(...values);
    const pad=Math.max(1,(maxVal-minVal)*0.12);
    const min=Math.max(0,minVal-pad),max=maxVal+pad;
    const dates=valid.map(s=>Date.parse(s.timestamp));
    const start=Math.min(...dates), end=Math.max(...dates);
    const left=57,right=width-20,top=16,bottom=height-43;
    const points=valid.map((entry,i)=>({
      x:start===end ? (left+right)/2 : left+(dates[i]-start)/(end-start)*(right-left),
      y:bottom-(entry[unit]-min)/(max-min)*(bottom-top),
      value:entry[unit],timestamp:entry.timestamp,note:entry.note||"",source:entry.source||"auto"
    }));
    return {points,min,max,start,end,left,right,top,bottom};
  }
  function render(svg, series, unit) {
    const doc=svg.ownerDocument;
    function el(name, attrs={},text) {
      const node=doc.createElementNS(NS,name);
      Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,String(value)));
      if (text!==undefined) node.textContent=text;
      return node;
    }
    svg.replaceChildren();
    svg.setAttribute("viewBox","0 0 700 240");
    svg.setAttribute("role","img");
    const label=unit==="points"?"Power points":"Coins";
    svg.setAttribute("aria-label",label+" resource-value history");
    const data=scaledPoints(series,unit);
    if (!data.points.length) {
      svg.append(el("text",{x:350,y:120,"text-anchor":"middle",fill:"currentColor","font-size":15},
        "No snapshots yet. Save your first snapshot to start the graph."));
      return;
    }
    const f=n=>new Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:1}).format(n);
    for(let i=0;i<=4;i++){
      const y=data.bottom-i*(data.bottom-data.top)/4;
      const v=data.min+(data.max-data.min)*i/4;
      svg.append(el("line",{x1:data.left,x2:data.right,y1:y,y2:y,stroke:"#34435f","stroke-width":1}));
      svg.append(el("text",{x:data.left-7,y:y+4,"text-anchor":"end",fill:"#b8c3dc","font-size":11},f(v)));
    }
    if(data.points.length>1) {
      const line=data.points.map(p=>p.x.toFixed(2)+","+p.y.toFixed(2)).join(" ");
      svg.append(el("polyline",{points:line,fill:"none",stroke:"#ffd34d","stroke-width":3,"stroke-linecap":"round","stroke-linejoin":"round"}));
    }
    data.points.forEach(p=>{
      const circle=el("circle",{cx:p.x,cy:p.y,r:5,fill:p.source==="manual"?"#6bdcff":"#ffd34d",stroke:"#0b1020","stroke-width":2});
      circle.append(el("title",{},new Date(p.timestamp).toLocaleString()+": "+
        new Intl.NumberFormat().format(p.value)+" "+label+(p.note?" — "+p.note:"")));
      svg.append(circle);
    });
    const dateLabel=v=>new Date(v).toLocaleDateString();
    svg.append(el("text",{x:data.left,y:heightBottom(),"text-anchor":"start",fill:"#b8c3dc","font-size":11},dateLabel(data.start)));
    if(data.start!==data.end){
      svg.append(el("text",{x:data.right,y:heightBottom(),"text-anchor":"end",fill:"#b8c3dc","font-size":11},dateLabel(data.end)));
    }
    function heightBottom(){return 230;}
  }
  return {scaledPoints,render};
});
