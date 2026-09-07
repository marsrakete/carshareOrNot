'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

/**
 * Creates a minimal DOM element used while loading the browser script in Node.js.
 * @returns {Object} Element stub with the methods touched during module setup.
 */
function createElementStub(){
  return {
    addEventListener: function(){},
    appendChild: function(){},
    replaceChildren: function(){},
    querySelectorAll: function(){ return []; },
    style: {},
    classList: { add: function(){}, remove: function(){} }
  };
}

/**
 * Loads provider data and application logic without running browser initialization.
 * @returns {Object} Exposed state and pure helpers for one isolated test.
 */
function loadApplication(){
  const providersPath = path.join(__dirname, '..', 'providers.js');
  const calculatorPath = path.join(__dirname, '..', 'calculator.js');
  const applicationPath = path.join(__dirname, '..', 'app.js');
  const providersScript = fs.readFileSync(providersPath, 'utf8');
  const calculatorScript = fs.readFileSync(calculatorPath, 'utf8');
  const exposedScript = fs.readFileSync(applicationPath, 'utf8').replace(
    /\n\s*init\(\);/,
    '\nglobalThis.__testApi = { state: state, calculate: calculate, defaultUsage: defaultUsage, defaultLocationForProvider: defaultLocationForProvider, normalizeTariffData: normalizeTariffData, encodeSharePayload: encodeSharePayload, decodeSharePayload: decodeSharePayload, isValidSharedState: isValidSharedState };'
  );
  const element = createElementStub();
  const context = {
    window: { location: { hash: '', href: 'https://example.test/rechner' }, confirm: function(){ return true; } },
    navigator: {},
    localStorage: { getItem: function(){ return null; }, setItem: function(){} },
    document: {
      getElementById: function(){ return element; },
      querySelectorAll: function(){ return []; },
      getElementsByName: function(){ return []; }
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    AbortController: AbortController,
    fetch: fetch,
    URL: URL,
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder,
    Blob: Blob,
    Response: Response,
    CompressionStream: CompressionStream,
    DecompressionStream: DecompressionStream,
    btoa: btoa,
    atob: atob
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(providersScript, context);
  vm.runInContext(calculatorScript, context);
  vm.runInContext(exposedScript, context);
  return context.__testApi;
}

test('default comparison remains stable', function(){
  const app = loadApplication();
  const result = app.calculate(app.state);
  assert.ok(Math.abs(result.own.total - 3754.6666666666665) < 0.001);
  assert.ok(Math.abs(result.cambio.total - 1907.3) < 0.001);
});

test('unknown locations do not invent availability', function(){
  const app = loadApplication();
  assert.deepEqual(
    JSON.parse(JSON.stringify(app.defaultLocationForProvider('cambio'))),
    { stationCount: null, walkMinutes: null, source: 'unknown' }
  );
});

test('distance tiers are applied per everyday booking', function(){
  const app = loadApplication();
  app.state.usage = Object.assign(app.defaultUsage(), {
    jahreskm: 2400,
    kurzfahrten: 1,
    mehrtagesfahrten: 0
  });
  const result = app.calculate(app.state);
  assert.ok(Math.abs(result.cambio.km - 468) < 0.001);
});

test('multi-day mileage cannot exceed annual mileage', function(){
  const app = loadApplication();
  app.state.usage = Object.assign(app.defaultUsage(), {
    jahreskm: 500,
    mehrtagesfahrten: 3,
    kmprofahrt: 250
  });
  const result = app.calculate(app.state);
  assert.equal(result.cambio.multiKm, 500);
  assert.equal(result.cambio.mileageAdjusted, true);
});

test('day trips use hourly cost caps and per-booking distance tiers', function(){
  const app = loadApplication();
  app.state.usage = Object.assign(app.defaultUsage(), {
    jahreskm: 120,
    kurzfahrten: 0,
    tagesausfluege: 1,
    stundenproausflug: 8,
    kmproausflug: 120,
    mehrtagesfahrten: 0,
    urlaubsfahrten: 0
  });
  const result = app.calculate(app.state);
  assert.ok(Math.abs(result.cambio.dayTripCost - 39.8) < 0.001);
});

test('bring and pickup trips account for recurring bookings and combined journeys', function(){
  const app = loadApplication();
  app.state.usage = Object.assign(app.defaultUsage(), {
    jahreskm: 2400,
    kurzfahrten: 0,
    bringtageprowoche: 5,
    bringwochenprojahr: 40,
    bringkmprotag: 12,
    bringbuchungenprotag: 2,
    bringstundenprobuchung: 0.75,
    bringseparatanteil: 50,
    tagesausfluege: 0,
    mehrtagesfahrten: 0,
    urlaubsfahrten: 0
  });
  const result = app.calculate(app.state);
  assert.equal(result.cambio.schoolRunTrips, 200);
  assert.equal(result.cambio.schoolRunKm, 1200);
  assert.ok(Math.abs(result.cambio.schoolRunCost - 531) < 0.001);
});

test('vacation trips use weekly and daily packages', function(){
  const app = loadApplication();
  app.state.usage = Object.assign(app.defaultUsage(), {
    jahreskm: 900,
    kurzfahrten: 0,
    tagesausfluege: 0,
    mehrtagesfahrten: 0,
    urlaubsfahrten: 1,
    tageprourlaub: 9,
    kmprourlaub: 900
  });
  const result = app.calculate(app.state);
  assert.ok(Math.abs(result.cambio.vacationCost - 298) < 0.001);
});

test('detailed trip mileage is proportionally capped at annual mileage', function(){
  const app = loadApplication();
  app.state.usage = Object.assign(app.defaultUsage(), {
    jahreskm: 1000,
    kurzfahrten: 0,
    tagesausfluege: 2,
    kmproausflug: 120,
    mehrtagesfahrten: 2,
    kmprofahrt: 250,
    urlaubsfahrten: 1,
    kmprourlaub: 900
  });
  const result = app.calculate(app.state);
  const categories = result.cambio.tripCategories;
  const detailedKm = categories.schoolRuns.km + categories.dayTrips.km + categories.multiDay.km + categories.vacations.km;
  assert.ok(Math.abs(detailedKm - 1000) < 0.001);
  assert.equal(result.cambio.mileageAdjusted, true);
});

test('billing model can include distance in the time price', function(){
  const app = loadApplication();
  app.state.selection = { providerId: 'free2move', classId: 'klein', tariffId: 'zeit' };
  const result = app.calculate(app.state);
  assert.equal(result.cambio.km, 0);
  assert.equal(result.cambio.billingMode, 'time-with-included-distance');
});

test('distance billing skips everyday time but keeps multi-day packages', function(){
  const app = loadApplication();
  app.state.selection = { providerId: 'miles', classId: 'klein', tariffId: 'km' };
  const result = app.calculate(app.state);
  assert.equal(result.cambio.billingMode, 'distance-with-packages');
  assert.equal(result.cambio.fuel, 405);
});

test('every built-in tariff carries source metadata', function(){
  const app = loadApplication();
  app.state.providers.forEach(function(provider){
    provider.classes.forEach(function(cls){
      cls.tariffs.forEach(function(selectedTariff){
        assert.equal(typeof selectedTariff.v.meta.region, 'string');
        assert.match(selectedTariff.v.meta.sourceUrl, /^https:\/\//);
        assert.equal(typeof selectedTariff.v.meta.lastVerifiedAt, 'string');
      });
    });
  });
});

test('legacy tariff data receives billing and source metadata', function(){
  const app = loadApplication();
  const legacyProviders = JSON.parse(JSON.stringify(app.state.providers));
  delete legacyProviders[0].classes[0].tariffs[0].v.billingMode;
  delete legacyProviders[0].classes[0].tariffs[0].v.meta;
  const normalized = app.normalizeTariffData(legacyProviders);
  const values = normalized[0].classes[0].tariffs[0].v;
  assert.equal(values.billingMode, 'time-and-distance');
  assert.match(values.meta.sourceUrl, /^https:\/\//);
});

test('registration fee uses the independent comparison horizon', function(){
  const app = loadApplication();
  app.state.usage.vergleichsjahre = 3;
  const result = app.calculate(app.state);
  assert.ok(Math.abs(result.cambio.fix - 130) < 0.001);
});

test('share payload round-trips every setting and rejects incomplete state', async function(){
  const app = loadApplication();
  app.state.location.address = 'Köln, Äußere Kanalstraße 1';
  app.state.own.kaufpreis = 12345;
  app.state.providers[0].name = 'Cambio & Partner';
  const expected = JSON.stringify(app.state);
  const payload = await app.encodeSharePayload(app.state);
  const wrapper = await app.decodeSharePayload(payload);
  assert.equal(wrapper.version, 1);
  assert.equal(JSON.stringify(wrapper.state), expected);
  assert.equal(app.isValidSharedState(wrapper.state), true);
  delete wrapper.state.usage.jahreskm;
  assert.equal(app.isValidSharedState(wrapper.state), false);
});
