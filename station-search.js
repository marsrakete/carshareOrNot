(function(global){
  'use strict';

  var PRIMARY_ENDPOINT = 'https://overpass-api.de/api/interpreter';
  var FALLBACK_ENDPOINT = 'https://overpass.private.coffee/api/interpreter';
  var REQUEST_TIMEOUT_MS = 20000;
  var RETRY_DELAY_MS = 1000;

  /**
   * Requests station data with one primary retry and one independent fallback attempt.
   * @param {string} query - Overpass QL containing coordinates and radius, never the entered address.
   * @param {Function} isCurrent - Returns whether the search may still affect the current UI.
   * @param {Function} onRetry - Receives the next attempt number and endpoint before a retry.
   * @returns {Promise<Object>} Complete Overpass data or a rejection on failure or stale context.
   */
  async function requestStations(query, isCurrent, onRetry){
    var endpoints = [PRIMARY_ENDPOINT, PRIMARY_ENDPOINT, FALLBACK_ENDPOINT];
    for(var attempt = 0; attempt < endpoints.length; attempt += 1){
      if(!isCurrent()){
        throw new Error('station-search-stale');
      }
      if(attempt > 0){
        onRetry(attempt + 1, endpoints[attempt]);
        await new Promise(function(resolve){ global.setTimeout(resolve, RETRY_DELAY_MS); });
        if(!isCurrent()){
          throw new Error('station-search-stale');
        }
      }
      var controller = new global.AbortController();
      var timer = global.setTimeout(function(){ controller.abort(); }, REQUEST_TIMEOUT_MS);
      try{
        var response = await global.fetch(endpoints[attempt], {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'Accept': 'application/json' },
          body: 'data=' + encodeURIComponent(query),
          signal: controller.signal
        });
        if(!isCurrent()){
          throw new Error('station-search-stale');
        }
        if(!response.ok){
          if(response.status !== 429 && response.status < 500){
            throw new Error('station-search-rejected');
          }
          throw new Error('station-search-unavailable');
        }
        var data = await response.json();
        if(!isCurrent()){
          throw new Error('station-search-stale');
        }
        if(!data || !Array.isArray(data.elements) || data.remark){
          throw new Error('station-search-incomplete');
        }
        return data;
      }catch(error){
        if(error.message === 'station-search-stale' || error.message === 'station-search-rejected'){
          throw error;
        }
        if(attempt === endpoints.length - 1){
          throw new Error('station-search-failed');
        }
      }finally{
        global.clearTimeout(timer);
      }
    }
    throw new Error('station-search-failed');
  }

  global.CarshareStationSearch = { requestStations: requestStations };
})(globalThis);
