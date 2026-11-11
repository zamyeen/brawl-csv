const test = require("node:test");
const assert = require("node:assert/strict");
const history = require("../resource-history.js");
const chart = require("../resource-chart.js");
const calculator = require("../resource-value.js");

function storage() {
  const items = new Map();
  return {
    getItem: key => items.has(key) ? items.get(key) : null,
    setItem: (key, value) => {items.set(key, value);}
  };
}
function sample() {
  return calculator.calculate({
    brawlers:[{
      id:16000000,name:"SHELLY",power:9,gadgets:[{}],
      starPowers:[{}],buffies:{hyperCharge:true,gadget:false}
    }]
  },null,"owned");
}
const tag="#2P0Y8Q9";
test("snapshot button is allowed to save unchanged progress; automatic fetch dedupes", () => {
  const s=storage(),r=sample();
  assert.equal(history.save(s,tag,"owned",r,{timestamp:"2026-11-11T00:00:00.000Z"}).status,"saved");
  assert.equal(history.save(s,tag,"owned",r,{timestamp:"2026-11-11T01:00:00.000Z"}).status,"unchanged");
  assert.equal(history.save(s,tag,"owned",r,{manual:true,note:"After upgrading Shelly",
    timestamp:"2026-11-11T02:00:00.000Z"}).status,"saved");
  const values=history.list(s,tag,"owned");
  assert.equal(values.length,2);
  assert.equal(values[1].note,"After upgrading Shelly");
  assert.equal(values[1].source,"manual");
  assert.ok(values[1].categories.power.coins>0);
});
test("export and import merge with existing history", () => {
  const a=storage(),b=storage();
  const r=sample();
  history.save(a,tag,"owned",r,{timestamp:"2026-11-11T01:00:00.000Z"});
  history.save(a,tag,"owned",r,{manual:true,timestamp:"2026-11-11T02:00:00.000Z"});
  const blob=history.exportJSON(a);
  assert.equal(history.importJSON(b,blob).imported,2);
  assert.equal(history.importJSON(b,blob).imported,0);
  assert.equal(history.list(b,tag,"owned").length,2);
});
test("invalid backup and malformed keys are rejected or filtered", () => {
  const s=storage();
  assert.throws(()=>history.importJSON(s,'{"format":"unrelated"}'));
  assert.throws(()=>history.seriesKey("__proto__","owned"));
  assert.deepEqual(Object.keys(history.sanitize({"__proto__:owned":[{}]})),[]);
});
test("chart plots recorded dates in chronological order", () => {
  const result=chart.scaledPoints([
    {timestamp:"2026-11-12T00:00:00.000Z",coins:300},
    {timestamp:"2026-11-11T00:00:00.000Z",coins:100}
  ],"coins");
  assert.equal(result.points.length,2);
  assert.ok(result.points[0].x<result.points[1].x);
  assert.ok(result.points[0].y>result.points[1].y);
});

test("raw legacy browser history imports and preserves earlier snapshots", () => {
  const store=storage();
  const legacy={
    [tag+":owned"]:[
      {timestamp:"2026-10-01T12:00:00.000Z",coins:1500,points:800},
      {timestamp:"2026-10-12T12:00:00.000Z",coins:2500,points:1200,
        count:2,unknownBuffies:1}
    ]
  };
  const imported=history.importJSON(store,JSON.stringify(legacy));
  assert.equal(imported.imported,2);
  assert.equal(history.list(store,tag,"owned")[0].coins,1500);
  assert.equal(history.importJSON(store,JSON.stringify(legacy)).imported,0);
});
test("ordinary player JSON is not treated as a resource history backup", () => {
  const store=storage();
  assert.throws(()=>history.importJSON(store,JSON.stringify({
    tag:tag,name:"Example",brawlers:[{name:"SHELLY",power:11}]
  })),/history|History/);
  assert.equal(history.list(store,tag,"owned").length,0);
});
test("invalid legacy record does not silently overwrite stored history", () => {
  const store=storage();
  history.save(store,tag,"owned",sample(),{timestamp:"2026-11-11T10:00:00.000Z"});
  assert.throws(()=>history.importJSON(store,JSON.stringify({
    [tag+":owned"]:[{timestamp:"2026-10-15T00:00:00.000Z",coins:-1,points:50}]
  })),/invalid snapshot/);
  assert.equal(history.list(store,tag,"owned").length,1);
});
test("two-resource time graph values retain independent scales", () => {
  const series=[
    {timestamp:"2026-11-01T00:00:00.000Z",coins:50000,points:12000},
    {timestamp:"2026-11-10T00:00:00.000Z",coins:75000,points:14000}
  ];
  const coins=chart.scaledPoints(series,"coins");
  const points=chart.scaledPoints(series,"points");
  assert.equal(coins.points.length,2);
  assert.equal(points.points.length,2);
  assert.notEqual(coins.max,points.max);
  assert.ok(coins.points[0].y>coins.points[1].y);
  assert.ok(points.points[0].y>points.points[1].y);
});
test("two-profile comparison uses totals and actual category values", () => {
  const accountA=calculator.calculate({brawlers:[{
    name:"SHELLY",power:11,gadgets:[{},{}],starPowers:[{},{}],
    buffies:{hyperCharge:true,gadget:true,starPower:true}
  }]},null,"owned");
  const accountB=calculator.calculate({brawlers:[{
    name:"SHELLY",power:9,gadgets:[{}],starPowers:[],
    buffies:{hyperCharge:false,gadget:false,starPower:false}
  }]},null,"owned");
  const coins=chart.comparisonBars(accountA,accountB,"coins");
  const points=chart.comparisonBars(accountA,accountB,"points");
  const completion=chart.comparisonBars(accountA,accountB,"completion");
  assert.equal(coins.at(-1)[1],accountA.acquired.coins);
  assert.equal(coins.at(-1)[2],accountB.acquired.coins);
  assert.equal(points.at(-1)[1],accountA.acquired.points);
  assert.ok(completion[0][1]>completion[0][2]);
});
