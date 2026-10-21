'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

/**
 * Loads browser modules in HTML order with observable storage, timers and UI access.
 * @returns {Object} Isolated globals and captured effects for controller contract checks.
 */
function createEnvironment(){
  const timers = new Map();
  const saved = new Map();
  const effects = [];
  const status = {};
  let timerId = 0;
  const context = {
    document: { getElementById: function(id){ effects.push(id); return status; } },
    localStorage: {
      getItem: function(key){ return saved.get(key) || null; },
      setItem: function(key, value){ saved.set(key, value); }
    },
    setTimeout: function(callback){ timerId += 1; timers.set(timerId, callback); return timerId; },
    clearTimeout: function(id){ timers.delete(id); }
  };
  context.window = context;
  vm.createContext(context);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for(const match of html.matchAll(/<script src="([^"]+)"><\/script>/g)){
    if(match[1] !== 'app.js'){
      vm.runInContext(fs.readFileSync(path.join(root, match[1]), 'utf8'), context);
    }
  }
  return { context, timers, saved, effects, status };
}

/**
 * Creates independent calculator state from the loaded public data APIs.
 * @param {Object} context - Browser module globals.
 * @returns {Object} Complete mutable calculator state.
 */
function createState(context){
  return {
    own: context.CarshareData.defaultOwn(),
    usage: context.CarshareData.defaultUsage(),
    location: context.CarshareStateValidation.defaultLocation(),
    providers: context.CarshareData.defaultProviders(),
    selection: { providerId: 'cambio', classId: 'klein', tariffId: 'aktiv', recommendationMode: 'manual' }
  };
}

test('controller construction performs no UI, callback, storage write or timer work', function(){
  const env = createEnvironment();
  const dependencies = { state: createState(env.context) };
  for(const name of ['CarshareStateStorage', 'CarshareSharing', 'CarshareProfilesUI', 'CarshareLocationUI', 'CarshareResultsUI', 'CarshareTariffEditor', 'CarshareInputGroupsUI']){
    assert.equal(typeof env.context[name].create(dependencies), 'object');
  }
  assert.deepEqual(env.effects, []);
  assert.equal(env.timers.size, 0);
  assert.equal(env.saved.size, 0);
});

test('location controllers observe replaced state sections and stay isolated', function(){
  const env = createEnvironment();
  const firstState = createState(env.context);
  const secondState = createState(env.context);
  const first = env.context.CarshareLocationUI.create({ state: firstState });
  const second = env.context.CarshareLocationUI.create({ state: secondState });
  firstState.location = { address: '', byProvider: { cambio: { stationCount: 7, walkMinutes: 5, serviceAvailable: null, source: 'manual' } } };
  assert.equal(first.getProviderLocation('cambio').stationCount, 7);
  assert.equal(second.getProviderLocation('cambio').stationCount, null);
});

test('sharing reads current state sections without retaining an obsolete profile', function(){
  const env = createEnvironment();
  const state = createState(env.context);
  const controller = env.context.CarshareSharing.create({ state });
  const original = state.usage;
  state.usage = Object.assign({}, original, { jahreskm: 13440 });
  state.own = Object.assign({}, state.own, { sonstigesExtra: 77 });
  const snapshot = controller.createCompactShareState();
  assert.equal(snapshot.usage.jahreskm, 13440);
  assert.equal(snapshot.own.sonstigesExtra, 77);
  assert.notEqual(original.jahreskm, 13440);
  assert.equal(snapshot.providerOverrides.length, 0);
});

test('storage debounce belongs to each controller and persists the latest state', async function(){
  const env = createEnvironment();
  const state = createState(env.context);
  const controller = env.context.CarshareStateStorage.create({ state });
  controller.scheduleSave();
  state.own = Object.assign({}, state.own, { sonstigesExtra: 99 });
  controller.scheduleSave();
  assert.equal(env.timers.size, 1);
  const other = env.context.CarshareStateStorage.create({ state: createState(env.context) });
  other.scheduleSave();
  assert.equal(env.timers.size, 2);
  const firstTimer = env.timers.values().next().value;
  firstTimer();
  await Promise.resolve();
  assert.equal(JSON.parse(env.saved.get('carsharing-rechner:v1')).own.sonstigesExtra, 99);
  const restored = createState(env.context);
  await env.context.CarshareStateStorage.create({ state: restored }).loadState();
  assert.equal(restored.own.sonstigesExtra, 99);
  assert.equal(restored.providers.length, state.providers.length);
});


test('location reads do not create synthetic or missing provider entries', function(){
  const env = createEnvironment();
  const state = createState(env.context);
  const controller = env.context.CarshareLocationUI.create({ state });
  const before = JSON.stringify(state);
  for(const providerId of ['supplement-transit', 'supplement-taxi', 'supplement-rental', 'unknown-provider']){
    assert.equal(controller.getProviderLocation(providerId).source, 'unknown');
  }
  assert.equal(JSON.stringify(state), before);
});

test('share snapshots exclude orphan locations without mutating current state', function(){
  const env = createEnvironment();
  const state = createState(env.context);
  state.location.byProvider['supplement-transit'] = env.context.CarshareStateValidation.defaultLocationForProvider('supplement-transit');
  state.location.byProvider['removed-provider'] = { stationCount: 3, walkMinutes: 5, serviceAvailable: null, source: 'manual' };
  const before = JSON.stringify(state);
  const controller = env.context.CarshareSharing.create({ state });
  const snapshot = controller.expandCompactShareState(controller.createCompactShareState());
  assert.equal(Object.hasOwn(snapshot.location.byProvider, 'supplement-transit'), false);
  assert.equal(Object.hasOwn(snapshot.location.byProvider, 'removed-provider'), false);
  assert.equal(env.context.CarshareStateValidation.isValidSharedState(snapshot), true);
  assert.equal(env.context.CarshareStateValidation.isValidSharedState(state), false);
  assert.equal(JSON.stringify(state), before);
});

test('storage repairs orphan locations while preserving custom providers and valid location values', async function(){
  const env = createEnvironment();
  const saved = createState(env.context);
  const customProvider = JSON.parse(JSON.stringify(saved.providers[0]));
  customProvider.id = 'local-carshare';
  saved.providers.push(customProvider);
  saved.location.byProvider['local-carshare'] = { stationCount: 4, walkMinutes: 6, serviceAvailable: null, source: 'manual' };
  saved.location.byProvider['supplement-transit'] = env.context.CarshareStateValidation.defaultLocationForProvider('supplement-transit');
  saved.location.byProvider['removed-provider'] = env.context.CarshareStateValidation.defaultLocationForProvider('removed-provider');
  env.saved.set('carsharing-rechner:v1', JSON.stringify(saved));
  const restored = createState(env.context);
  await env.context.CarshareStateStorage.create({ state: restored }).loadState();
  assert.equal(Object.hasOwn(restored.location.byProvider, 'supplement-transit'), false);
  assert.equal(Object.hasOwn(restored.location.byProvider, 'removed-provider'), false);
  assert.equal(restored.location.byProvider['local-carshare'].stationCount, 4);
  assert.equal(restored.location.byProvider['local-carshare'].walkMinutes, 6);
  assert.equal(env.context.CarshareStateValidation.isValidSharedState(restored), true);
});
