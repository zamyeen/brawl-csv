/* Shared dependency-free SVG history chart for one or two profiles. */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.BrawlTrendChart=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
 "use strict";
 const NS="http://www.w3.org/2000/svg";
 const COLORS=["#ffd34d","#6bdcff","#a7ee8e","#fa96d4"];
 const LABELS={total:"Total",power:"Power levels",gadgets:"Gadgets",starPowers:"Star powers",buffies:"Buffies",gears:"Gears",hypercharges:"Hypercharges"};
 const nf=new Intl.NumberFormat(),compact=new Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:1});
 function metricValue(snapshot,category,resource){
   if(!snapshot)return null;
   if(resource==="completion"){
     const range=snapshot.completion?.[category];
     return range&&Number.isFinite(range.min)?range.min:null;
   }
   const value=category==="total"?snapshot[resource]:snapshot.categories?.[category]?.[resource];
   return Number.isFinite(value)?value:null;
 }
 function seriesPoints(series,category,resource){
   return (Array.isArray(series)?series:[]).map(entry=>({
     at:Date.parse(entry.timestamp),value:metricValue(entry,category,resource),
     timestamp:entry.timestamp,note:entry.note||"",source:entry.source||"auto"
   })).filter(p=>Number.isFinite(p.at)&&p.value!==null&&Number.isFinite(p.value))
     .sort((a,b)=>a.at-b.at);
 }
 function element(doc,tag,attrs={},text){
   const el=doc.createElementNS(NS,tag);
   for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
   if(text!==undefined)el.textContent=String(text);
   return el;
 }
 function draw(svg,tracks,options={}){
   const category=options.category||"total",resource=options.resource||"coins";
   const keys=resource==="both"?["coins","points"]:[resource];
   const traces=[];
   tracks.forEach((track,index)=>{
     keys.forEach((key,keyIndex)=>{
       const points=seriesPoints(track.history||[],category,key);
       if(points.length)traces.push({
         key,name:track.name||("Profile "+(index+1)),index,keyIndex,points,
         color:tracks.length>1?COLORS[index]:COLORS[keyIndex],
         dashed:tracks.length>1&&keyIndex===1
       });
     });
   });
   const w=780,h=295,left=resource==="both"?82:72,right=resource==="both"?682:712,top=61,bottom=244;
   svg.replaceChildren();
   svg.setAttribute("viewBox","0 0 "+w+" "+h);
   svg.setAttribute("role","img");
   svg.setAttribute("aria-label",(LABELS[category]||category)+" "+resource+" progression for "+tracks.map(t=>t.name).join(" and "));
   const append=(tag,attrs={},text)=>{
     const el=element(svg.ownerDocument,tag,attrs,text);svg.append(el);return el;
   };
   if(!traces.length){
     append("text",{x:w/2,y:150,fill:"#b8c3dc","text-anchor":"middle","font-size":14},
       resource==="completion"&&(category==="gears"||category==="hypercharges")
         ?"Completion unavailable: no reliable maximum for this category."
         :"No compatible saved snapshots. Load an account and save a new snapshot.");
     return;
   }
   const all=traces.flatMap(t=>t.points.map(p=>p.at));
   const minDate=Math.min(...all),maxDate=Math.max(...all);
   const x=t=>minDate===maxDate?(left+right)/2:left+(t-minDate)/(maxDate-minDate)*(right-left);
   const ranges={};
   keys.forEach(key=>{
     const values=traces.filter(t=>t.key===key).flatMap(t=>t.points.map(p=>p.value));
     if(!values.length)return;
     const lo=Math.min(...values),hi=Math.max(...values),pad=Math.max(1,(hi-lo)*0.12);
     ranges[key]=key==="completion"?{min:0,max:100}:{min:Math.max(0,lo-pad),max:hi+pad};
   });
   const y=(key,value)=>{
     const range=ranges[key];return bottom-(value-range.min)/(range.max-range.min)*(bottom-top);
   };
   traces.forEach((trace,i)=>{
     const xx=left+(i%2)*320,yy=14+Math.floor(i/2)*18;
     append("line",{x1:xx,x2:xx+18,y1:yy,y2:yy,stroke:trace.color,
       "stroke-width":3,"stroke-dasharray":trace.dashed?"5 4":"none"});
     append("text",{x:xx+23,y:yy+4,fill:"#dbe4f7","font-size":11},
       trace.name+" · "+(trace.key==="coins"?"Coins":trace.key==="points"?"Power points":"Completion"));
   });
   const first=keys.find(k=>ranges[k]);
   const second=resource==="both"&&ranges.points?"points":null;
   for(let i=0;i<=4;i++){
     const yy=bottom-(bottom-top)*i/4;
     append("line",{x1:left,x2:right,y1:yy,y2:yy,stroke:"#34435f","stroke-width":1});
     const v=ranges[first].min+(ranges[first].max-ranges[first].min)*i/4;
     append("text",{x:left-9,y:yy+4,"text-anchor":"end",fill:"#b8c3dc","font-size":11},
       first==="completion"?v.toFixed(0)+"%":compact.format(v));
     if(second&&first!==second){
       const rv=ranges[second].min+(ranges[second].max-ranges[second].min)*i/4;
       append("text",{x:right+8,y:yy+4,fill:"#b8c3dc","font-size":11},compact.format(rv));
     }
   }
   traces.forEach(trace=>{
     const pts=trace.points.map(p=>({x:x(p.at),y:y(trace.key,p.value),data:p}));
     if(pts.length>1)append("polyline",{
       points:pts.map(p=>p.x.toFixed(2)+","+p.y.toFixed(2)).join(" "),
       fill:"none",stroke:trace.color,"stroke-width":3,"stroke-linecap":"round",
       "stroke-linejoin":"round","stroke-dasharray":trace.dashed?"7 5":"none"
     });
     pts.forEach(p=>{
       const dot=append("circle",{cx:p.x,cy:p.y,r:p.data.source==="manual"?5.5:4,
         fill:p.data.source==="manual"?"#0d1427":trace.color,stroke:trace.color,"stroke-width":2});
       dot.append(element(svg.ownerDocument,"title",{},
         trace.name+" · "+new Date(p.data.at).toLocaleString()+" · "+
         (trace.key==="completion"?p.data.value.toFixed(1)+"%":nf.format(p.data.value)+" "+trace.key)+
         (p.data.note?" · "+p.data.note:"")));
     });
   });
   append("text",{x:left,y:h-13,"text-anchor":"start",fill:"#b8c3dc","font-size":11},
     new Date(minDate).toLocaleDateString());
   if(maxDate!==minDate)append("text",{x:right,y:h-13,"text-anchor":"end",fill:"#b8c3dc","font-size":11},
     new Date(maxDate).toLocaleDateString());
 }
 return {metricValue,seriesPoints,draw,LABELS};
});
