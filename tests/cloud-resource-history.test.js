const test = require("node:test");
const assert = require("node:assert/strict");
const {toSeries} = require("../cloud-resource-history.js");

const day = (date, coins, points, completion=40) => ({
  date, resource:{
    coins,points,categories:{
      power:{coins:coins/2,points:points/2},
      gadgets:{coins:coins/2,points:0}
    },
    completion:{
      power:{min:completion,max:completion},
      total:{min:completion,max:completion+5},
      gears:null
    }
  }
});

test("cloud snapshots become sorted compatible resource-chart series", () => {
  const series = toSeries([
    day("2026-11-17",1200,1000,50),
    day("2026-11-16",1000,800,30)
  ]);
  assert.equal(series.length,2);
  assert.equal(series[0].timestamp,"2026-11-16T12:00:00.000Z");
  assert.equal(series[1].coins,1200);
  assert.equal(series[1].categories.power.points,500);
  assert.deepEqual(series[1].completion.total,{min:50,max:55});
  assert.equal(series[1].completion.gears,null);
});

test("bad records are excluded and same-date duplicates resolve to last row", () => {
  const series = toSeries([
    null, {}, {date:"not-a-date",resource:{coins:5,points:5}},
    day("2026-11-16",100,200),day("2026-11-16",300,400),
    {date:"2026-11-17",resource:{coins:-1,points:0}}
  ]);
  assert.equal(series.length,1);
  assert.equal(series[0].coins,300);
  assert.equal(series[0].points,400);
});

test("missing categories and completion are unavailable, not falsely zero", () => {
  const series = toSeries([{date:"2026-11-16",resource:{coins:0,points:0}}]);
  assert.equal(series.length,1);
  assert.equal(series[0].categories.gears,undefined);
  assert.equal(series[0].completion.total,null);
  assert.equal(series[0].completion.buffies,null);
});
