const test=require("node:test");
const assert=require("node:assert/strict");
const trophies=require("../trophy-history.js");
const chart=require("../trophy-charts.js");
const tag="#2P0Y8Q9";
function storage(){
 const db=new Map();
 return {getItem:key=>db.get(key)||null,setItem:(key,value)=>db.set(key,value)};
}
function player(total,values){
 return {tag,trophies:total,highestTrophies:total+100,
   brawlers:values.map(([id,name,trophies])=>({id,name,trophies,highestTrophies:trophies+30}))};
}
const a=player(1050,[[1,"SHELLY",500],[2,"NITA",350],[3,"COLT",200]]);
const b=player(1190,[[1,"SHELLY",570],[2,"NITA",325],[3,"COLT",295]]);
test("automatic snapshots dedupe, manual saves are allowed",()=>{
 const db=storage();
 assert.equal(trophies.save(db,tag,a,{timestamp:"2026-11-01T10:00:00.000Z"}).status,"saved");
 assert.equal(trophies.save(db,tag,a,{timestamp:"2026-11-02T10:00:00.000Z"}).status,"unchanged");
 assert.equal(trophies.save(db,tag,a,{manual:true,note:"Weekend push",
   timestamp:"2026-11-03T10:00:00.000Z"}).status,"saved");
 assert.equal(trophies.list(db,tag).length,2);
 assert.equal(trophies.list(db,tag)[1].note,"Weekend push");
});
test("brawler gain/loss comparisons reconcile account total",()=>{
 const earlier=trophies.fromPlayer(a,{timestamp:"2026-11-01T10:00:00.000Z"});
 const later=trophies.fromPlayer(b,{timestamp:"2026-11-03T10:00:00.000Z"});
 const diff=trophies.compare(earlier,later);
 assert.equal(diff.accountDelta,140);
 assert.equal(diff.gains,165);
 assert.equal(diff.losses,-25);
 assert.equal(diff.netComparable,140);
 assert.equal(diff.unattributed,0);
 assert.equal(diff.rows.find(r=>r.name==="SHELLY").delta,70);
 assert.equal(diff.rows.find(r=>r.name==="NITA").status,"loss");
});
test("new brawlers are not falsely assigned gains from zero",()=>{
 const earlier=trophies.fromPlayer(a,{timestamp:"2026-11-01T10:00:00.000Z"});
 const later=trophies.fromPlayer(player(1390,[
   [1,"SHELLY",570],[2,"NITA",325],[3,"COLT",295],[4,"BULL",200]
 ]),{timestamp:"2026-11-03T10:00:00.000Z"});
 const diff=trophies.compare(earlier,later);
 const bull=diff.rows.find(r=>r.name==="BULL");
 assert.equal(bull.status,"new");assert.equal(bull.before,null);assert.equal(bull.delta,null);
 assert.equal(diff.accountDelta,340);assert.equal(diff.netComparable,140);
 assert.equal(diff.unattributed,200);
});
test("missing brawler at later stage is not reported as a loss",()=>{
 const earlier=trophies.fromPlayer(a,{timestamp:"2026-11-01T10:00:00.000Z"});
 const later=trophies.fromPlayer(player(650,[[1,"SHELLY",500],[2,"NITA",150]]),
   {timestamp:"2026-11-03T10:00:00.000Z"});
 const missing=trophies.compare(earlier,later).rows.find(r=>r.name==="COLT");
 assert.equal(missing.status,"missing");assert.equal(missing.after,null);assert.equal(missing.delta,null);
});
test("individual and account trophy series return historical values",()=>{
 const arr=[
  trophies.fromPlayer(a,{timestamp:"2026-11-01T10:00:00.000Z"}),
  trophies.fromPlayer(b,{timestamp:"2026-11-03T10:00:00.000Z"})
 ];
 assert.deepEqual(trophies.trophySeries(arr).map(r=>r.value),[1050,1190]);
 assert.deepEqual(trophies.trophySeries(arr,"id:1").map(r=>r.value),[500,570]);
 assert.deepEqual(trophies.trophySeries(arr,"id:404"),[]);
});
test("trophy history export/import preserves tags and brawler values",()=>{
 const source=storage(),target=storage();
 trophies.save(source,tag,a,{timestamp:"2026-11-01T10:00:00.000Z"});
 const backup=trophies.exportJSON(source);
 assert.equal(trophies.importJSON(target,backup).imported,1);
 assert.equal(trophies.importJSON(target,backup).imported,0);
 assert.equal(trophies.list(target,tag)[0].brawlers.length,3);
 assert.throws(()=>trophies.importJSON(target,JSON.stringify(a)),/trophy-history backup/);
});
test("malformed historical brawler entries are rejected",()=>{
 const db=storage();
 const bad=JSON.parse(trophies.exportJSON(db));
 bad.history[tag]=[{timestamp:"2026-11-01T10:00:00.000Z",total:100,
   brawlers:[{id:1,name:"SHELLY",trophies:-10}]}];
 assert.throws(()=>trophies.importJSON(db,JSON.stringify(bad)),/invalid trophy stage/);
 assert.equal(trophies.list(db,tag).length,0);
});
test("chart renderers draw stage trend and changed-brawler bars",()=>{
 function node(name){
  return {name,children:[],ownerDocument:{createElementNS:(ns,name)=>node(name)},
    setAttribute(){},append(...parts){this.children.push(...parts)},
    replaceChildren(){this.children=[]},set textContent(v){this.text=v}};
 }
 const first=trophies.fromPlayer(a,{timestamp:"2026-11-01T10:00:00.000Z"});
 const second=trophies.fromPlayer(b,{timestamp:"2026-11-03T10:00:00.000Z"});
 const svg=node("svg");
 chart.plot(svg,[first,second],"total",trophies);
 assert.equal(svg.children.filter(x=>x.name==="polyline").length,1);
 chart.deltaBars(svg,trophies.compare(first,second));
 assert.ok(svg.children.some(x=>x.name==="rect"));
});
