'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const zlib = require('node:zlib');

/**
 * Creates a file-like JSON import object with its UTF-8 byte size.
 * @param {Object} value - Value to serialize as JSON.
 * @returns {Object} File-like object accepted by the import helper.
 */
function createImportFile(value){
  const text = JSON.stringify(value);
  return {
    size: new TextEncoder().encode(text).byteLength,
    text: async function(){ return text; }
  };
}

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
  const providerDataPath = path.join(__dirname, '..', 'provider-data.generated.js');
  const providersPath = path.join(__dirname, '..', 'providers.js');
  const calculatorPath = path.join(__dirname, '..', 'calculator.js');
  const recommendationsPath = path.join(__dirname, '..', 'recommendations.js');
  const applicationPath = path.join(__dirname, '..', 'app.js');
  const providerDataScript = fs.readFileSync(providerDataPath, 'utf8');
  const providersScript = fs.readFileSync(providersPath, 'utf8');
  const calculatorScript = fs.readFileSync(calculatorPath, 'utf8');
  const recommendationsScript = fs.readFileSync(recommendationsPath, 'utf8');
  const exposedScript = fs.readFileSync(applicationPath, 'utf8').replace(
    /\n\s*init\(\);/,
    '\nglobalThis.__validationApi = { preventNegativeNumberEntry, validateNumberEntry, importProviderFile };' +
    '\nglobalThis.__testApi = { state: state, calculate: calculate, calculateRecommendation: recommendationData.calculateRecommendation, defaultUsage: defaultUsage, defaultLocationForProvider: defaultLocationForProvider, normalizeTariffData: normalizeTariffData, normalizeSelection: normalizeSelection, encodeSharePayload: encodeSharePayload, decodeSharePayload: decodeSharePayload, isValidSharedState: isValidSharedState, buildProviderExport: buildProviderExport, createCompactShareState: createCompactShareState, expandCompactShareState: expandCompactShareState, getLocationProvider: getLocationProvider };'
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
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'identifier-validation.js'), 'utf8'), context);
  context.window.CarshareIdentifiers = context.CarshareIdentifiers;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data-limits.js'), 'utf8'), context);
  context.window.CarshareLimits = context.CarshareLimits;
  vm.runInContext(providerDataScript, context);
  vm.runInContext(providersScript, context);
  vm.runInContext(calculatorScript, context);
  vm.runInContext(recommendationsScript, context);
  vm.runInContext(exposedScript, context);
  Object.assign(context.__testApi, context.__validationApi);
  context.__testApi.alerts = [];
  context.window.alert = function(message){ context.__testApi.alerts.push(message); };
  return context.__testApi;
}

test('numeric controls reject minus signs from keyboards, paste and drop', function(){
  const app = loadApplication();
  for(const event of [
    { key: '-' }, { data: '−12' },
    { clipboardData: { getData: function(){ return '-25'; } } },
    { dataTransfer: { getData: function(){ return '-5'; } } }
  ]){
    var blocked = false;
    event.target = { type: 'number' };
    event.preventDefault = function(){ blocked = true; };
    app.preventNegativeNumberEntry(event);
    assert.equal(blocked, true);
  }
  app.preventNegativeNumberEntry({ target: { type: 'text' }, key: '-', preventDefault: function(){ assert.fail('Text fields must accept hyphens'); } });
});

test('numeric fallback enforces bounds and preserves blank location fields and decimals', function(){
  const app = loadApplication();
  for(const entry of [
    { value: '-12', min: '0', max: '', expected: '0' },
    { value: '-1', min: '1', max: '', expected: '1' },
    { value: '8', min: '0', max: '7', expected: '7' },
    { value: '', min: '0', max: '', expected: '' },
    { value: '0.25', min: '0', max: '', expected: '0.25' }
  ]){
    const input = Object.assign({ type: 'number' }, entry);
    app.validateNumberEntry({ target: input });
    assert.equal(input.value, entry.expected);
  }
});

test('provider import refuses every negative tariff price without changing state', async function(){
  const app = loadApplication();
  const original = JSON.stringify(app.state);
  for(const field of ['grundgebuehr', 'zeitpreis', 'tagespreis', 'wochenpreis', 'kmBis100', 'kmAb100', 'anmeldegebuehr']){
    const exported = app.buildProviderExport(app.state.providers[0]);
    exported.provider.classes[0].tariffs[0][field] = -0.01;
    await app.importProviderFile(createImportFile(exported));
    assert.equal(JSON.stringify(app.state), original);
    assert.match(app.alerts.pop(), /Import abgelehnt/);
  }
});

test('share validation refuses negative numbers in all numeric sections', function(){
  const app = loadApplication();
  for(const section of [app.state.own, app.state.usage, app.state.providers[0].classes[0].tariffs[0].v, app.state.location.byProvider.cambio]){
    for(const field of Object.keys(section)){
      const original = section[field];
      if(typeof original !== 'number' && original !== null){ continue; }
      section[field] = -1;
      assert.equal(app.isValidSharedState(app.state), false, field);
      section[field] = original;
    }
  }
});

test('numeric overflow inputs are bounded before calculation', function(){
  const app = loadApplication();
  Object.keys(app.state.own).forEach(function(field){ app.state.own[field] = Number.MAX_VALUE; });
  Object.keys(app.state.usage).forEach(function(field){
    if(typeof app.state.usage[field] === 'number'){
      app.state.usage[field] = Number.MAX_VALUE;
    }
  });
  const tariffValues = app.state.providers[0].classes[0].tariffs[0].v;
  Object.keys(tariffValues).forEach(function(field){
    if(typeof tariffValues[field] === 'number'){
      tariffValues[field] = Number.MAX_VALUE;
    }
  });
  const result = app.calculate(app.state);
  assert.equal(Number.isFinite(result.own.total), true);
  assert.equal(Number.isFinite(result.cambio.total), true);
  assert.equal(app.isValidSharedState(app.state), false);
});

test('share validation rejects reserved IDs and duplicates in every identifier scope', function(){
  const app = loadApplication();
  const original = JSON.stringify(app.state);
  for(const id of ['__proto__', 'constructor', 'prototype', 'tostring', 'recommend-single', 'recommend-mix', 'supplement-taxi', '', 'a|b', 'a=b', 'A', 'a'.repeat(65)]){
    Object.assign(app.state, JSON.parse(original));
    app.state.providers[0].id = id;
    assert.equal(app.isValidSharedState(app.state), false, id);
    Object.assign(app.state, JSON.parse(original));
    Object.defineProperty(app.state.location.byProvider, id, { value: { stationCount: null, walkMinutes: null }, enumerable: true });
    assert.equal(app.isValidSharedState(app.state), false, 'location: ' + id);
  }
  for(const scope of ['providers', 'classes', 'tariffs']){
    Object.assign(app.state, JSON.parse(original));
    let collection = app.state.providers;
    if(scope === 'classes'){ collection = collection[0].classes; }
    if(scope === 'tariffs'){ collection = collection[0].classes[0].tariffs; }
    collection.push(JSON.parse(JSON.stringify(collection[0])));
    assert.equal(app.isValidSharedState(app.state), false, scope);
  }
});

test('compact links reject duplicate overrides before merging them', function(){
  const app = loadApplication();
  const compact = app.createCompactShareState();
  compact.providerOverrides = [app.state.providers[0], app.state.providers[0]];
  assert.throws(function(){ app.expandCompactShareState(compact); }, /provider-identifiers/);
  compact.providerOverrides = [];
  compact.removedProviderIds = ['__proto__'];
  assert.throws(function(){ app.expandCompactShareState(compact); }, /provider-identifiers/);
});

test('provider imports with reserved or duplicate identifiers leave state untouched', async function(){
  const app = loadApplication();
  const original = JSON.stringify(app.state);
  for(const kind of ['reserved', 'classes', 'tariffs']){
    const exported = app.buildProviderExport(app.state.providers[0]);
    if(kind === 'reserved'){
      exported.provider.id = '__proto__';
    } else if(kind === 'classes'){
      exported.provider.classes.push(exported.provider.classes[0]);
    } else {
      exported.provider.classes[0].tariffs.push(exported.provider.classes[0].tariffs[0]);
    }
    await app.importProviderFile(createImportFile(exported));
    assert.equal(JSON.stringify(app.state), original);
    assert.match(app.alerts.pop(), /kennungen/);
  }
});

test('shared identifier rules accept shipped definitions and reject duplicate build data', function(){
  const identifiers = require('../identifier-validation.js');
  const app = loadApplication();
  const definitions = app.state.providers.map(function(provider){ return app.buildProviderExport(provider).provider; });
  assert.equal(identifiers.hasValidProviderIdentifiers(definitions), true);
  definitions.push(definitions[0]);
  assert.equal(identifiers.hasValidProviderIdentifiers(definitions), false);
  assert.equal(identifiers.isValidProviderId('book-n-drive_2'), true);
});

test('default comparison remains stable', function(){
  const app = loadApplication();
  const result = app.calculate(app.state);
  assert.ok(Math.abs(result.own.total - 3754.6666666666665) < 0.001);
  assert.ok(Math.abs(result.cambio.total - 1907.3) < 0.001);
});

test('additional owned-car miscellaneous cost starts at zero and affects fixed costs', function(){
  const app = loadApplication();
  const baseline = app.calculate(app.state);
  app.state.own.sonstigesExtra = 125;
  const changed = app.calculate(app.state);
  assert.equal(baseline.own.fix + 125, changed.own.fix);
  assert.equal(baseline.own.total + 125, changed.own.total);
});

test('negative owned-car values cannot produce income in either parking mode', function(){
  const app = loadApplication();
  Object.keys(app.state.own).forEach(function(field){ app.state.own[field] = -100; });
  const original = JSON.stringify(app.state.own);
  for(const rentedParking of [false, true]){
    app.state.usage.parkplatz = rentedParking;
    const result = app.calculate(app.state);
    assert.equal(result.own.total, 0);
    assert.equal(result.own.fix, 0);
    assert.equal(result.own.fuel, 0);
  }
  assert.equal(JSON.stringify(app.state.own), original);
});

test('provider export uses the maintainable versioned JSON format', function(){
  const app = loadApplication();
  const exported = app.buildProviderExport(app.state.providers[0]);
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'providers', 'cambio.json'), 'utf8'));
  assert.equal(JSON.stringify(exported), JSON.stringify(source));
});

test('unknown locations do not invent availability', function(){
  const app = loadApplication();
  assert.deepEqual(
    JSON.parse(JSON.stringify(app.defaultLocationForProvider('cambio'))),
    { stationCount: null, walkMinutes: null, serviceAvailable: null, source: 'unknown' }
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
  delete legacyProviders[0].classes[0].childSeats;
  const normalized = app.normalizeTariffData(legacyProviders);
  const values = normalized[0].classes[0].tariffs[0].v;
  assert.equal(values.billingMode, 'time-and-distance');
  assert.match(values.meta.sourceUrl, /^https:\/\//);
  assert.equal(values.meta.lastVerifiedAt, '2026-09-07');
  assert.equal(JSON.stringify(normalized[0].classes[0].childSeats), JSON.stringify({ infant: 'bring-own', booster: 'included', boosterCount: 1 }));
  const fallbackProviders = JSON.parse(JSON.stringify(app.state.providers));
  fallbackProviders[0].classes[0].childSeats = { infant: 'bring-own', booster: 'bring-own', boosterCount: 0 };
  const migratedFallback = app.normalizeTariffData(fallbackProviders);
  assert.equal(migratedFallback[0].classes[0].childSeats.booster, 'included');
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
  assert.equal(wrapper.version, 2);
  assert.equal(JSON.stringify(wrapper.state), expected);
  assert.equal(app.isValidSharedState(wrapper.state), true);
  delete wrapper.state.usage.jahreskm;
  assert.equal(app.isValidSharedState(wrapper.state), false);
});

test('share payloads enforce link and decompressed data limits', async function(){
  const app = loadApplication();
  await assert.rejects(
    app.encodeSharePayload({ padding: 'x'.repeat(100000) }),
    /share-size/
  );
  const expandedWrapper = JSON.stringify({ version: 2, state: { padding: 'x'.repeat(100000) } });
  const compressed = zlib.gzipSync(expandedWrapper);
  const payload = 'g.' + compressed.toString('base64url');
  assert.ok(payload.length < 16384);
  await assert.rejects(app.decodeSharePayload(payload), /share-size/);
  await assert.rejects(app.decodeSharePayload('j.' + 'a'.repeat(16384)), /share-format/);
});

test('provider imports reject oversized files and provider structures before state changes', async function(){
  const app = loadApplication();
  const original = JSON.stringify(app.state);
  await app.importProviderFile({
    size: 131073,
    text: async function(){ assert.fail('Large files must not be read.'); }
  });
  assert.equal(JSON.stringify(app.state), original);
  assert.match(app.alerts.pop(), /128 KB/);

  const exported = app.buildProviderExport(app.state.providers[0]);
  const originalClass = exported.provider.classes[0];
  exported.provider.classes = [];
  for(let index = 0; index < 21; index += 1){
    const providerClass = JSON.parse(JSON.stringify(originalClass));
    providerClass.id = 'klasse' + index;
    providerClass.tariffs[0].id = 'tarif' + index;
    exported.provider.classes.push(providerClass);
  }
  await app.importProviderFile(createImportFile(exported));
  assert.equal(JSON.stringify(app.state), original);
  assert.match(app.alerts.pop(), /höchstens 20 Fahrzeugklassen/);
});

test('compact share state omits unchanged default providers and restores overrides', function(){
  const app = loadApplication();
  const compactDefault = app.createCompactShareState();
  assert.equal(compactDefault.providerOverrides.length, 0);
  assert.equal(Object.hasOwn(compactDefault, 'providers'), false);
  app.state.providers[0].name = 'Cambio angepasst';
  const compactChanged = app.createCompactShareState();
  assert.equal(compactChanged.providerOverrides.length, 1);
  const expanded = app.expandCompactShareState(JSON.parse(JSON.stringify(compactChanged)));
  assert.equal(expanded.providers[0].name, 'Cambio angepasst');
});

test('split return creates two everyday bookings without doubling total usage time', function(){
  const app = loadApplication();
  app.state.usage.alltagsmodell = 'split-return';
  const result = app.calculate(app.state);
  assert.equal(result.cambio.tripCategories.everyday.trips, app.state.usage.kurzfahrten * 24);
  assert.ok(Math.abs(result.cambio.tripCategories.everyday.timeCost - 244.8) < 0.001);
});

test('single-provider recommendation ranks the cheapest matching tariffs', function(){
  const app = loadApplication();
  app.state.selection.recommendationMode = 'recommend-single';
  const result = app.calculateRecommendation(app.state);
  assert.equal(result.recommendation.mode, 'recommend-single');
  assert.equal(result.recommendation.rows.length, 3);
  assert.ok(result.recommendation.rows[0].cost <= result.recommendation.rows[1].cost);
  assert.ok(result.recommendation.rows[1].cost <= result.recommendation.rows[2].cost);
  assert.equal(result.cambio.total, result.recommendation.rows[0].cost);
});

test('single-provider recommendation uses its result provider for location editing', function(){
  const app = loadApplication();
  app.state.selection.providerId = 'sixtshare';
  app.state.selection.recommendationMode = 'recommend-single';
  app.state.providers.forEach(function(provider){
    if(provider.operationMode === 'free-floating'){
      app.state.location.byProvider[provider.id] = { stationCount: null, walkMinutes: null, serviceAvailable: false, source: 'manual' };
    }
  });
  const result = app.calculateRecommendation(app.state);
  const locationProvider = app.getLocationProvider(result);
  assert.equal(locationProvider.id, result.recommendation.primaryProviderId);
  assert.notEqual(locationProvider.id, 'sixtshare');
  assert.equal(locationProvider.operationMode, 'station-based');
});

test('mobility mix never costs more than its best single-provider option', function(){
  const app = loadApplication();
  app.state.selection.recommendationMode = 'recommend-single';
  const singleResult = app.calculateRecommendation(app.state);
  app.state.selection.recommendationMode = 'recommend-mix';
  const mixResult = app.calculateRecommendation(app.state);
  assert.equal(mixResult.recommendation.mode, 'recommend-mix');
  assert.ok(mixResult.recommendation.rows.length > 0);
  assert.ok(mixResult.cambio.total <= singleResult.cambio.total + 0.001);
  assert.ok(Math.abs(mixResult.cambio.total - mixResult.cambio.fix - mixResult.cambio.fuel - mixResult.cambio.km) < 0.001);
  const displayedTotal = mixResult.recommendation.rows.reduce(function(sum, row){ return sum + row.cost; }, 0);
  assert.ok(Math.abs(displayedTotal - mixResult.cambio.total) < 0.001);
});

test('mobility mix assigns different trip types and counts each selected tariff fee once', function(){
  const app = loadApplication();
  app.state.usage = Object.assign(app.defaultUsage(), {
    jahreskm: 1200,
    kurzfahrten: 12,
    stundenprofahrt: 1,
    tagesausfluege: 0,
    mehrtagesfahrten: 1,
    tageprofahrt: 7,
    kmprofahrt: 700,
    urlaubsfahrten: 0
  });
  app.state.providers = [
    {
      id: 'short', name: 'Kurzstrecke', classes: [{ id: 'klein', name: 'Kleinwagen', tariffs: [{
        id: 'short-rate', name: 'Kurz', v: {
          grundgebuehr: 0, zeitpreis: 0.1, tagespreis: 100, wochenpreis: 1000,
          kmBis100: 0.01, kmAb100: 0.01, anmeldegebuehr: 60, billingMode: 'time-and-distance'
        }
      }] }]
    },
    {
      id: 'long', name: 'Langstrecke', classes: [{ id: 'klein', name: 'Kleinwagen', tariffs: [{
        id: 'long-rate', name: 'Lang', v: {
          grundgebuehr: 1, zeitpreis: 0, tagespreis: 50, wochenpreis: 100,
          kmBis100: 1, kmAb100: 1, anmeldegebuehr: 0, billingMode: 'distance-with-packages'
        }
      }] }]
    }
  ];
  app.state.location.byProvider.short = { stationCount: null, walkMinutes: null, source: 'unknown' };
  app.state.location.byProvider.long = { stationCount: null, walkMinutes: null, source: 'unknown' };
  app.state.selection = { providerId: 'short', classId: 'klein', tariffId: 'short-rate', recommendationMode: 'recommend-mix' };
  const result = app.calculateRecommendation(app.state);
  const assignments = result.recommendation.rows.map(function(row){ return row.providerId; });
  assert.equal(JSON.stringify(assignments), JSON.stringify(['short', 'supplement-rental']));
  assert.ok(Math.abs(result.cambio.fix - 10) < 0.001);
  assert.ok(Math.abs(result.cambio.total - 540.4) < 0.001);
});

test('recommendations exclude a provider with confirmed zero stations', function(){
  const app = loadApplication();
  app.state.selection.recommendationMode = 'recommend-single';
  const firstResult = app.calculateRecommendation(app.state);
  const excludedProviderId = firstResult.recommendation.primaryProviderId;
  const excludedProvider = app.state.providers.find(function(provider){ return provider.id === excludedProviderId; });
  if(excludedProvider.operationMode === 'free-floating'){
    app.state.location.byProvider[excludedProviderId] = { stationCount: null, walkMinutes: null, serviceAvailable: false, source: 'manual' };
  } else {
    app.state.location.byProvider[excludedProviderId] = { stationCount: 0, walkMinutes: 0, serviceAvailable: null, source: 'manual' };
  }
  const nextResult = app.calculateRecommendation(app.state);
  assert.notEqual(nextResult.recommendation.primaryProviderId, excludedProviderId);
});

test('recommendation reports no candidate when every provider is unavailable', function(){
  const app = loadApplication();
  app.state.providers.forEach(function(provider){
    if(provider.operationMode === 'free-floating'){
      app.state.location.byProvider[provider.id] = { stationCount: null, walkMinutes: null, serviceAvailable: false, source: 'manual' };
    } else {
      app.state.location.byProvider[provider.id] = { stationCount: 0, walkMinutes: 0, serviceAvailable: null, source: 'search' };
    }
  });
  app.state.selection.recommendationMode = 'recommend-single';
  assert.equal(app.calculateRecommendation(app.state), null);
});

test('free-floating providers use business-area availability instead of station counts', function(){
  const app = loadApplication();
  app.state.selection.recommendationMode = 'recommend-single';
  app.state.location.byProvider.free2move = { stationCount: 0, walkMinutes: 0, serviceAvailable: true, source: 'manual' };
  const availableResult = app.calculateRecommendation(app.state);
  assert.equal(availableResult.recommendation.primaryProviderId, 'free2move');
  app.state.location.byProvider.free2move.serviceAvailable = false;
  const unavailableResult = app.calculateRecommendation(app.state);
  assert.notEqual(unavailableResult.recommendation.primaryProviderId, 'free2move');
});

test('automatic family profile downranks free-floating without changing tariff costs', function(){
  const app = loadApplication();
  app.state.selection.recommendationMode = 'recommend-single';
  app.state.usage.childSeatInfantCount = 1;
  const familyResult = app.calculateRecommendation(app.state);
  const familyProvider = app.state.providers.find(function(provider){ return provider.id === familyResult.recommendation.primaryProviderId; });
  assert.equal(familyProvider.operationMode, 'station-based');
  assert.match(familyResult.recommendation.fitSummary, /Kindersitz/);
  assert.ok(familyResult.recommendation.rows.some(function(row){ return /Sitz.*15 kg/.test(row.childSeatNote); }));

  app.state.usage.freefloatingFit = 'suitable';
  const overriddenResult = app.calculateRecommendation(app.state);
  assert.equal(overriddenResult.recommendation.primaryProviderId, 'free2move');
  app.state.selection = { providerId: 'free2move', classId: 'klein', tariffId: 'zeit', recommendationMode: 'manual' };
  const directTariffResult = app.calculate(app.state);
  assert.ok(Math.abs(overriddenResult.cambio.total - directTariffResult.cambio.total) < 0.001);
});

test('legacy selections default to manual mode before share validation', function(){
  const app = loadApplication();
  delete app.state.selection.recommendationMode;
  app.normalizeSelection(app.state.selection);
  assert.equal(app.state.selection.recommendationMode, 'manual');
  assert.equal(app.isValidSharedState(app.state), true);
});

test('shared provider validation rejects unknown operation modes', function(){
  const app = loadApplication();
  app.state.providers[0].operationMode = 'unknown';
  assert.equal(app.isValidSharedState(app.state), false);
});

test('shared state validation rejects unknown everyday booking models', function(){
  const app = loadApplication();
  app.state.usage.alltagsmodell = 'unknown';
  assert.equal(app.isValidSharedState(app.state), false);
});
