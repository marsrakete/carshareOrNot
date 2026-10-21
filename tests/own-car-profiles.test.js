'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const profileData = require('../own-car-profiles.js');

const expected = [
  ['city', 1038, 1090, 43, 82],
  ['small', 1242, 1260, 75, 82],
  ['compact', 1422, 1275, 81, 82],
  ['estate', 1518, 1177, 120, 82],
  ['suv', 1488, 1366, 155, 82],
  ['van', 1650, 1406, 254, 82]
];

test('all owned-car profiles apply researched annual costs and preserve independent settings', function(){
  const own = { kaufpreis: 12000, haltedauer: 7, restwert: 3000, wartung: 800, versicherung: 700, sonstiges: 400, sonstigesExtra: 123, verbrauch: 7.5, kraftstoffpreis: 1.9, stellplatz: 50, parkausweis: 30 };
  const original = JSON.stringify(own);
  for(const [id, workshop, insurance, tax, inspection] of expected){
    const actual = profileData.applyProfile(own, id);
    assert.deepEqual(actual, Object.assign({}, own, { wartung: workshop, versicherung: insurance, sonstiges: tax + inspection }));
    assert.equal(JSON.stringify(own), original);
    const profile = profileData.profiles.find(function(candidate){ return candidate.id === id; });
    assert.equal(profile.annualTaxCost, tax);
    assert.equal(profile.annualInspectionCost, inspection);
    assert.equal(profile.annualWorkshopCost, profile.monthlyWorkshopCosts.reduce(function(sum, value){ return sum + value; }, 0) / 2 * 12);
  }
});

test('unknown owned-car profile does not replace existing settings', function(){
  const own = { wartung: 800, versicherung: 500, sonstiges: 150 };
  assert.equal(profileData.applyProfile(own, 'missing'), null);
  assert.deepEqual(own, { wartung: 800, versicherung: 500, sonstiges: 150 });
});
