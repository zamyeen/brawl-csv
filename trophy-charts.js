/* Small accessible SVG timeline and stage-delta graph. */
(function(root,factory) {
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.BrawlTrophyCharts=api;
})(typeof globalThis!=="undefined"?globalThis:null,function() {
 "use strict";
 const NS="http://www.w3.org/2000/svg";
 const COLORS={line:"#ffd34d",gain:"#8ef0ad",loss:"#ff7b8c",muted:"#9aa7c2"};
 const nf=new Intl.NumberFormat();
 const compact=new Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:1});
 function el(svg,tag,attrs={},value){
   const result=svg.ownerDocument.createElementNS(NS,tag);
   for(const [key,v] of Object.entries(attrs))result.setAttribute(key,String(v));
   if(value!==undefined)result.textContent=String(value);
   svg.append(result);return result;
 }
 function plot(svg,stages,selected,engine) {
   svg.replaceChildren();
   svg.setAttribute("viewBox","0 0 760 265");
   svg.setAttribute("role","img");
   svg.setAttribute("aria-label","Trophy history over time");
   const points=engine.trophySeries(stages,selected);
   if(!points.length){
     el(svg,"text",{x:380,y:126,"text-anchor":"middle",fill:COLORS.muted,"font-size":14},
       "No trophy snapshots yet for this selection.");
     return;
   }
   const x0=72,x1=710,y0=32,y1=224;
   const times=points.map(p=>Date.parse(p.timestamp)),minT=Math.min(...times),maxT=Math.max(...times);
   const vals=points.map(p=>p.value),lo=Math.min(...vals),hi=Math.max(...vals);
   const pad=Math.max(1,(hi-lo)*0.12),min=Math.max(0,lo-pad),max=hi+pad;
   const x=t=>minT===maxT?(x0+x1)/2:x0+(t-minT)/(maxT-minT)*(x1-x0);
   const y=v=>y1-(v-min)/(max-min)*(y1-y0);
   for(let i=0;i<=4;i++){
     const yy=y1-i*(y1-y0)/4;
     el(svg,"line",{x1:x0,x2:x1,y1:yy,y2:yy,stroke:"#34435f","stroke-width":1});
     el(svg,"text",{x:x0-8,y:yy+4,"text-anchor":"end",fill:COLORS.muted,"font-size":11},
       compact.format(min+(max-min)*i/4));
   }
   if(points.length>1){
     el(svg,"polyline",{points:points.map(p=>x(Date.parse(p.timestamp)).toFixed(2)+","+
       y(p.value).toFixed(2)).join(" "),fill:"none",stroke:COLORS.line,"stroke-width":3,
       "stroke-linecap":"round","stroke-linejoin":"round"});
   }
   points.forEach(p=>{
     const dot=el(svg,"circle",{cx:x(Date.parse(p.timestamp)),cy:y(p.value),
       r:p.source==="manual"?5.4:4.2,fill:p.source==="manual"?"#0d1427":COLORS.line,
       stroke:COLORS.line,"stroke-width":2});
     const title=svg.ownerDocument.createElementNS(NS,"title");
     title.textContent=new Date(p.timestamp).toLocaleString()+" · "+nf.format(p.value)+" trophies"+
       (p.note?" · "+p.note:"");dot.append(title);
   });
   el(svg,"text",{x:x0,y:256,fill:COLORS.muted,"font-size":11},new Date(minT).toLocaleDateString());
   if(maxT!==minT)el(svg,"text",{x:x1,y:256,"text-anchor":"end",fill:COLORS.muted,"font-size":11},
     new Date(maxT).toLocaleDateString());
 }
 function deltaBars(svg,comparison,limit=12) {
   svg.replaceChildren();
   const rows=comparison.rows.filter(r=>r.delta!==null&&r.delta!==0).slice()
     .sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,limit);
   const width=800,height=Math.max(110,50+rows.length*36);
   svg.setAttribute("viewBox","0 0 "+width+" "+height);
   svg.setAttribute("role","img");
   svg.setAttribute("aria-label","Largest brawler trophy gains and losses");
   if(!rows.length){
     el(svg,"text",{x:400,y:72,"text-anchor":"middle",fill:COLORS.muted,"font-size":14},
       "No comparable brawlers changed trophies between these stages.");
     return;
   }
   const center=423,range=230,max=Math.max(1,...rows.map(r=>Math.abs(r.delta)));
   el(svg,"line",{x1:center,x2:center,y1:24,y2:height-17,stroke:"#8492b1","stroke-width":1});
   rows.forEach((r,i)=>{
     const cy=35+i*36,w=Math.max(1,Math.abs(r.delta)/max*range);
     el(svg,"text",{x:174,y:cy+5,"text-anchor":"end",fill:"#dbe4f7","font-size":13},r.name);
     const x=r.delta>0?center:center-w;
     const bar=el(svg,"rect",{x,y:cy-11,width:w,height:22,rx:4,
       fill:r.delta>0?COLORS.gain:COLORS.loss});
     const title=svg.ownerDocument.createElementNS(NS,"title");
     title.textContent=r.name+": "+nf.format(r.before)+" → "+nf.format(r.after)+
       " ("+(r.delta>0?"+":"")+nf.format(r.delta)+")";
     bar.append(title);
     el(svg,"text",{x:r.delta>0?x+w+7:x-7,y:cy+5,
       "text-anchor":r.delta>0?"start":"end",
       fill:r.delta>0?COLORS.gain:COLORS.loss,"font-size":12},
       (r.delta>0?"+":"")+nf.format(r.delta));
   });
   el(svg,"text",{x:center,y:height-6,"text-anchor":"middle",fill:COLORS.muted,"font-size":10},"0");
 }
 return {plot,deltaBars};
});
