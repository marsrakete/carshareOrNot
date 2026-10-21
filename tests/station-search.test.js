'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

/**
 * Loads the request helper with an isolated transport and immediate retry delays.
 * @param {Function} fetchHandler - Simulated fetch implementation.
 * @returns {Object} API, request log, retry log and active timeout handles.
 */
function loadSearch(fetchHandler){
  const calls = [], retries = [], timers = new Set();
  const context = {
    AbortController,
    fetch: async function(url, options){
      calls.push({ url, options });
      return fetchHandler(url, options, calls.length);
    },
    setTimeout: function(callback, delay){
      const handle = {};
      timers.add(handle);
      if(delay === 1000){
        queueMicrotask(function(){ timers.delete(handle); callback(); });
      }
      return handle;
    },
    clearTimeout: function(handle){ timers.delete(handle); }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'station-search.js'), 'utf8'), context);
  return {
    request: context.CarshareStationSearch.requestStations,
    calls, retries, timers,
    onRetry: function(attempt, endpoint){ retries.push({ attempt, endpoint }); }
  };
}

/**
 * Creates a simulated Overpass HTTP response.
 * @param {number} status - HTTP status.
 * @param {Object} data - JSON response body.
 * @returns {Object} Fetch response subset.
 */
function response(status, data){
  return { ok: status >= 200 && status < 300, status, json: async function(){ return data; } };
}

test('Overpass retries primary 502 and then uses independent fallback with the same encoded query', async function(){
  const search = loadSearch(function(url, options, count){
    if(count < 3) return response(502, {});
    return response(200, { elements: [{ id: 1 }] });
  });
  const data = await search.request('node(around:1500,50,7);out;', function(){ return true; }, search.onRetry);
  assert.equal(data.elements[0].id, 1);
  assert.deepEqual(search.calls.map(function(call){ return call.url; }), [
    'https://overpass-api.de/api/interpreter', 'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
  ]);
  search.calls.forEach(function(call){
    assert.equal(call.options.body, 'data=' + encodeURIComponent('node(around:1500,50,7);out;'));
    assert.equal(call.options.headers['Content-Type'], 'application/x-www-form-urlencoded;charset=UTF-8');
  });
  assert.equal(search.retries.length, 2);
  assert.equal(search.timers.size, 0);
});

test('Overpass stops after three failed requests', async function(){
  const search = loadSearch(function(){ return response(503, {}); });
  await assert.rejects(search.request('query', function(){ return true; }, search.onRetry), /station-search-failed/);
  assert.equal(search.calls.length, 3);
  assert.equal(search.timers.size, 0);
});

test('Overpass does not retry invalid HTTP requests', async function(){
  const search = loadSearch(function(){ return response(400, {}); });
  await assert.rejects(search.request('query', function(){ return true; }, search.onRetry), /station-search-rejected/);
  assert.equal(search.calls.length, 1);
});

test('Overpass rejects partial runtime-error and malformed payloads instead of treating them as zero stations', async function(){
  for(const data of [{ elements: [], remark: 'runtime error: timed out' }, {}, null]){
    const search = loadSearch(function(){ return response(200, data); });
    await assert.rejects(search.request('query', function(){ return true; }, search.onRetry), /station-search-failed/);
    assert.equal(search.calls.length, 3);
  }
});

test('Overpass accepts a valid empty result without retry', async function(){
  const search = loadSearch(function(){ return response(200, { elements: [] }); });
  const result = await search.request('query', function(){ return true; }, search.onRetry);
  assert.equal(result.elements.length, 0);
  assert.equal(search.calls.length, 1);
});

test('Overpass stops retrying when the visible search context changes', async function(){
  let current = true;
  const search = loadSearch(function(){ return response(502, {}); });
  await assert.rejects(search.request('query', function(){ return current; }, function(){ current = false; }), /station-search-stale/);
  assert.equal(search.calls.length, 1);
  assert.equal(search.timers.size, 0);
});

test('Overpass retries network and abort errors within the same limit', async function(){
  const search = loadSearch(function(url, options, count){
    if(count === 1) throw new TypeError('Network failure');
    if(count === 2){
      const error = new Error('Timed out');
      error.name = 'AbortError';
      throw error;
    }
    return response(200, { elements: [] });
  });
  await search.request('query', function(){ return true; }, search.onRetry);
  assert.equal(search.calls.length, 3);
  assert.equal(search.timers.size, 0);
});

test('Overpass discards results when context changes during JSON processing', async function(){
  let current = true;
  const search = loadSearch(function(){
    return { ok: true, status: 200, json: async function(){ current = false; return { elements: [] }; } };
  });
  await assert.rejects(search.request('query', function(){ return current; }, search.onRetry), /station-search-stale/);
  assert.equal(search.calls.length, 1);
});
