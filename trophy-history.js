/* Per-player trophy stage snapshots and comparisons; no browser dependencies. */
(function (root, factory) {
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.BrawlTrophyHistory=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
  "use strict";
  const KEY="brawl-csv:trophy-history:v1";
  const FORMAT="brawl-csv-trophy-history",LIMIT=500;
  const TAG=/^#[0289PYLQGRJCUV]+$/;
  const safe=n=>Number.isSafeInteger(n)&&n>=0;
  function tagKey(tag) {
    const key=String(tag||"").trim().toUpperCase();
    if(!TAG.test(key))throw Error("Invalid player tag.");
    return key;
  }
  function brawlerKey(b) {
    const id=Number(b?.id);
    return Number.isSafeInteger(id)&&id>0?"id:"+id:
      "name:"+String(b?.name||"").trim().toUpperCase();
  }
  function normalizeBrawler(b) {
    if(!b||typeof b!=="object"||!safe(b.trophies))return null;
    const id=Number(b.id), name=String(b.name||"").trim().slice(0,80);
    if(!name && (!Number.isSafeInteger(id)||id<=0))return null;
    const r={name:name||(String(id)),trophies:b.trophies};
    if(Number.isSafeInteger(id)&&id>0)r.id=id;
    if(safe(b.highestTrophies))r.highestTrophies=b.highestTrophies;
    return r;
  }
  function normalizeStage(stage) {
    if(!stage||typeof stage!=="object"||Array.isArray(stage))return null;
    const time=Date.parse(stage.timestamp);
    if(!Number.isFinite(time)||new Date(time).toISOString()!==stage.timestamp||
       !safe(stage.total)||!Array.isArray(stage.brawlers))return null;
    const seen=new Set(),brawlers=[];
    for(const item of stage.brawlers){
      const b=normalizeBrawler(item);
      if(!b)return null;
      const key=brawlerKey(b);
      if(seen.has(key))return null;
      seen.add(key);brawlers.push(b);
    }
    const normalized={timestamp:stage.timestamp,total:stage.total,
      brawlers:brawlers.sort((a,b)=>brawlerKey(a).localeCompare(brawlerKey(b))),
      source:stage.source==="manual"?"manual":"auto"};
    if(typeof stage.note==="string"&&stage.note.trim())normalized.note=stage.note.trim().slice(0,100);
    if(safe(stage.highestTrophies))normalized.highestTrophies=stage.highestTrophies;
    return normalized;
  }
  function fromPlayer(player,options={}){
    if(!player||!Array.isArray(player.brawlers)||!safe(player.trophies))throw Error("Account trophy data unavailable.");
    const timestamp=options.timestamp||new Date().toISOString();
    const stage=normalizeStage({timestamp,total:player.trophies,
      highestTrophies:player.highestTrophies,brawlers:player.brawlers.map(b=>({
        id:b.id,name:b.name,trophies:b.trophies,highestTrophies:b.highestTrophies
      })),source:options.manual?"manual":"auto",note:options.note});
    if(!stage)throw Error("Player brawler trophy data is incomplete.");
    return stage;
  }
  function sanitize(raw) {
    const data=Object.create(null);
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return data;
    for(const [tag,stages] of Object.entries(raw)){
      if(!TAG.test(tag)||!Array.isArray(stages))continue;
      const entries=new Map();
      stages.slice(-2000).forEach(item=>{
        const stage=normalizeStage(item);
        if(stage)entries.set(stage.timestamp+"|"+stage.total+"|"+
          stage.brawlers.map(b=>brawlerKey(b)+":"+b.trophies).join(";"),stage);
      });
      data[tag]=[...entries.values()].sort((a,b)=>
        a.timestamp.localeCompare(b.timestamp)).slice(-LIMIT);
    }
    return data;
  }
  function read(storage) {
    try{return sanitize(JSON.parse(storage.getItem(KEY)));}
    catch{return Object.create(null);}
  }
  function list(storage,tag){return read(storage)[tagKey(tag)]||[];}
  function sameTrophies(a,b) {
    if(!a||!b||a.total!==b.total||a.brawlers.length!==b.brawlers.length)return false;
    const byKey=new Map(a.brawlers.map(p=>[brawlerKey(p),p.trophies]));
    return b.brawlers.every(p=>byKey.get(brawlerKey(p))===p.trophies);
  }
  function save(storage,tag,player,options={}){
    const key=tagKey(tag),stage=fromPlayer(player,options);
    const data=read(storage),entries=data[key]||[];
    const last=entries.at(-1);
    if(last && !options.manual && sameTrophies(last,stage))
      return {status:"unchanged",stage:last};
    data[key]=[...entries,stage].slice(-LIMIT);
    storage.setItem(KEY,JSON.stringify(data));
    return {status:"saved",stage};
  }
  function compare(earlier,later) {
    if(!earlier||!later)throw Error("Choose two saved trophy stages.");
    const before=new Map(earlier.brawlers.map(b=>[brawlerKey(b),b]));
    const after=new Map(later.brawlers.map(b=>[brawlerKey(b),b]));
    const keys=new Set([...before.keys(),...after.keys()]);
    const rows=[];
    let gains=0,losses=0,unchanged=0,unreported=0;
    for(const key of keys){
      const a=before.get(key),b=after.get(key);
      const delta=a&&b?b.trophies-a.trophies:null;
      const status=!a?"new":!b?"missing":delta>0?"gain":delta<0?"loss":"unchanged";
      if(status==="gain")gains+=delta;
      if(status==="loss")losses+=delta;
      if(status==="unchanged")unchanged++;
      if(status==="new"||status==="missing")unreported++;
      rows.push({id:key,name:b?.name||a?.name||key,before:a?.trophies??null,
        after:b?.trophies??null,delta,status});
    }
    const rank={gain:0,loss:1,new:2,missing:3,unchanged:4};
    rows.sort((a,b)=>rank[a.status]-rank[b.status]||
      (a.delta!==null&&b.delta!==null?Math.abs(b.delta)-Math.abs(a.delta):0)||
      a.name.localeCompare(b.name));
    const accountDelta=later.total-earlier.total;
    return {
      before:earlier,after:later,accountDelta,
      gains,losses,netComparable:gains+losses,unattributed:accountDelta-gains-losses,
      unchanged,unreported,rows
    };
  }
  function trophySeries(stages,selected="total"){
    return stages.map(stage=>{
      const value=selected==="total"?stage.total:
        stage.brawlers.find(b=>brawlerKey(b)===selected)?.trophies;
      return {timestamp:stage.timestamp,value:value??null,note:stage.note||"",source:stage.source};
    }).filter(s=>s.value!==null);
  }
  function exportJSON(storage) {
    return JSON.stringify({format:FORMAT,version:1,exportedAt:new Date().toISOString(),
      history:read(storage)},null,2);
  }
  function importJSON(storage,text){
    const payload=JSON.parse(text);
    if(!payload||payload.format!==FORMAT||payload.version!==1||
       !payload.history||typeof payload.history!=="object"||Array.isArray(payload.history))
       throw Error("Choose a trophy-history backup exported from this website (not the regular player JSON export).");
    const raw=payload.history,keys=Object.keys(raw);
    if(keys.some(key=>!TAG.test(key)||!Array.isArray(raw[key])))
      throw Error("Invalid trophy-history profile keys.");
    let bad=0;
    keys.forEach(key=>raw[key].forEach(x=>{if(!normalizeStage(x))bad++;}));
    if(bad)throw Error(bad+" invalid trophy stage(s) in backup.");
    const existing=read(storage),incoming=sanitize(raw);
    let count=0;
    for(const key of keys){
      const entries=existing[key]||[];
      const previous=new Set(entries.map(x=>x.timestamp+"|"+x.total+"|"+JSON.stringify(x.brawlers)));
      for(const x of incoming[key]){
        const signature=x.timestamp+"|"+x.total+"|"+JSON.stringify(x.brawlers);
        if(!previous.has(signature)){count++;entries.push(x);previous.add(signature);}
      }
      existing[key]=entries.sort((a,b)=>a.timestamp.localeCompare(b.timestamp)).slice(-LIMIT);
    }
    storage.setItem(KEY,JSON.stringify(existing));
    return {imported:count,profiles:keys.length};
  }
  return {KEY,FORMAT,LIMIT,tagKey,brawlerKey,normalizeStage,fromPlayer,read,list,
    save,compare,trophySeries,exportJSON,importJSON};
});
