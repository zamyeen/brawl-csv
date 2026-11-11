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
