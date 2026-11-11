const test = require("node:test");
const assert = require("node:assert/strict");
const {calculate, levelValue, gearValue} = require("../resource-value.js");

test("power-level cumulative values and exact max", () => {
  assert.deepEqual(levelValue(1), {coins: 0, points: 0});
  assert.deepEqual(levelValue(9), {coins: 3090, points: 1410});
  assert.deepEqual(levelValue(10), {coins: 4965, points: 2300});
  assert.deepEqual(levelValue(11), {coins: 7765, points: 3740});
});

test("empty owned roster has no spend and undefined completion", () => {
  const result = calculate({brawlers: []}, null, "owned");
  assert.deepEqual(result.acquired, {coins: 0, points: 0});
  assert.equal(result.progress.coins, null);
  assert.equal(result.progress.points, null);
});

test("full Shelly example separates known, missing, unknown and extras", () => {
  const result = calculate({brawlers:[{
    id:1,name:"SHELLY",power:11,
    gadgets:[{},{}],starPowers:[{},{}],
    buffies:{hyperCharge:true,gadget:false},
    gears:[{name:"DAMAGE"}],
    hyperCharges:[{}]
  }]},null,"owned");
  assert.deepEqual(result.acquired, {coins: 20765, points: 5740});
  assert.deepEqual(result.remainingKnown, {coins: 1000, points: 2000});
  assert.deepEqual(result.unknown, {coins:1000, points:2000});
  assert.equal(result.warnings.buffieSlots,1);
});

test("entire roster includes unowned accounts and all power upgrades", () => {
  const result=calculate({
    brawlers:[{id:1,name:"SHELLY",power:9,gadgets:[],starPowers:[],buffies:{hyperCharge:false,gadget:false,starPower:false}}]
  },[
    {id:1,name:"SHELLY",gadgets:[1,2],starPowers:[3,4]},
    {id:2,name:"NITA",gadgets:[5,6],starPowers:[7,8]}
  ],"all");
  assert.equal(result.mode,"all");
  assert.equal(result.unownedCount,1);
  assert.equal(result.rosterCount,2);
  assert.equal(result.categories.power.coins,3090);
  assert.equal(result.categories.power.remainingCoins,2*7765-3090);
  assert.equal(result.categories.gadgets.remainingCoins,4000);
  assert.equal(result.categories.starPowers.remainingCoins,8000);
  assert.equal(result.categories.buffies.remainingCoins,6000);
  assert.equal(result.warnings.buffieSlots,0);
});

test("full roster mode safely falls back to owned without catalog", () => {
  const result=calculate({brawlers:[{name:"SHELLY",power:4}]},null,"all");
  assert.equal(result.mode,"owned");
  assert.equal(result.rosterCount,1);
});

test("explicitly released ability slots define gadget and star power max", () => {
  const result=calculate({brawlers:[{id:7,name:"OTHER",power:1,gadgets:[{}],starPowers:[]}]},[
    {id:7,name:"OTHER",gadgets:[1],starPowers:[1,2]}
  ],"owned");
  assert.equal(result.categories.gadgets.remainingCoins,0);
  assert.equal(result.categories.starPowers.remainingCoins,4000);
});

test("gear rarity is never inferred from gear level", () => {
  assert.deepEqual(gearValue({rarity:"EPIC",name:"OTHER"}), {coins:1500,estimated:false});
  assert.deepEqual(gearValue({rarity:"MYTHIC",name:"OTHER"}), {coins:2000,estimated:false});
  assert.deepEqual(gearValue({name:"SPECIAL GEAR",level:2}), {coins:1000,estimated:true});
});

test("percent range is not falsely 100% when buffie status unknown", () => {
  const result=calculate({brawlers:[{name:"SHELLY",power:11,gadgets:[{},{}],starPowers:[{},{}]}]},null,"owned");
  assert.ok(result.progress.coins.min < result.progress.coins.max);
  assert.ok(result.progress.coins.max <= 100);
  assert.equal(result.warnings.buffieSlots,3);
});
