(function(){
  'use strict';

  /**
   * Creates the location-ui controller without starting UI or network work.
   * @param {Object} dependencies - Explicit controller dependencies.
   * @param {Object} dependencies.state - Shared state container; its sections may be replaced.
   * @param {Function} dependencies.calculateDisplayedResult - Application callback calculateDisplayedResult; called only after initialization.
   * @param {Function} dependencies.findProvider - Application callback findProvider; called only after initialization.
   * @param {Function} dependencies.appendSelectOption - Application callback appendSelectOption; called only after initialization.
   * @param {Function} dependencies.render - Application callback render; called only after initialization.
   * @param {Function} dependencies.scheduleSave - Application callback scheduleSave; called only after initialization.
   * @returns {Object} Functions owned by this controller.
   */
  function create(dependencies){
    var recommendationData = window.CarshareRecommendations;
    var MODE_MANUAL = recommendationData.MODE_MANUAL;
    var MODE_SINGLE = recommendationData.MODE_SINGLE;
    var defaultLocationForProvider = window.CarshareStateValidation.defaultLocationForProvider;
    var state = dependencies.state;
    var calculateDisplayedResult = dependencies.calculateDisplayedResult;
    var findProvider = dependencies.findProvider;
    var appendSelectOption = dependencies.appendSelectOption;
    var render = dependencies.render;
    var scheduleSave = dependencies.scheduleSave;

    var stationSearchGeneration = 0;
    var locationProviderOverride = "";
    var displayedLocationProviderId = "";

    /**
     * Reads provider location values without creating entries for missing or synthetic providers.
     * @param {string} providerId - Provider identifier.
     * @returns {Object} Existing location values or detached defaults when no entry exists.
     */
    function getProviderLocation(providerId){
      if(Object.prototype.hasOwnProperty.call(state.location.byProvider, providerId)){
        return state.location.byProvider[providerId];
      }
      return defaultLocationForProvider(providerId);
    }

    /**
     * Lists providers whose location can affect the active selection or recommendation.
     * @returns {Array<Object>} Eligible providers, including those currently marked unavailable.
     */
    function getLocationProviders(){
      if(state.selection.recommendationMode === MODE_MANUAL){
        var manualProvider = findProvider(state.selection.providerId);
        if(manualProvider){
          return [manualProvider];
        }
        return [];
      }
      return state.providers.filter(function(provider){
        return recommendationData.isProviderAllowedForRecommendation(state, provider) &&
          provider.classes.some(function(cls){ return cls.id === state.selection.classId; });
      });
    }

    /**
     * Resolves the provider currently edited, without falling back to an excluded provider.
     * @param {Object} result - Current calculation or recommendation result.
     * @returns {Object|null} Eligible location provider or null when none remain.
     */
    function getLocationProvider(result){
      var providers = getLocationProviders();
      var provider = providers.find(function(candidate){ return candidate.id === locationProviderOverride; });
      if(provider){
        return provider;
      }
      if(result.recommendation){
        provider = providers.find(function(candidate){ return candidate.id === result.recommendation.primaryProviderId; });
        if(provider){
          return provider;
        }
      }
      return providers[0] || null;
    }

    /**
     * Copies location values for the selected or recommended provider into the form.
     * @param {Object} result - Optional current result used to resolve a recommendation.
     * @returns {void}
     */
    function fillLocationInputs(result){
      if(!result){
        result = calculateDisplayedResult();
      }
      document.getElementById('loc_address').value = state.location.address;
      var provider = getLocationProvider(result);
      var providerSelect = document.getElementById('loc_provider');
      providerSelect.replaceChildren();
      getLocationProviders().forEach(function(candidate){
        appendSelectOption(providerSelect, candidate.id, candidate.name);
      });
      document.getElementById('location-provider-row').hidden = state.selection.recommendationMode === MODE_MANUAL || !provider;
      var locationProviderId = '';
      if(provider){
        locationProviderId = provider.id;
        providerSelect.value = provider.id;
      }
      if(displayedLocationProviderId !== locationProviderId){
        document.getElementById('loc_status').textContent = '';
        displayedLocationProviderId = locationProviderId;
      }
      var stationFields = document.getElementById('station-location-fields');
      var floatingFields = document.getElementById('free-floating-location-fields');
      var locationContextHint = document.getElementById('location-context-hint');
      if(!provider){
        stationFields.hidden = true;
        floatingFields.hidden = true;
        document.getElementById('loc-search-btn').disabled = true;
        document.getElementById('loc_address').disabled = true;
        locationContextHint.textContent = 'Für die gewählte Fahrzeugklasse und Alltagseignung gibt es keinen passenden Anbieter zur Standortprüfung.';
        return;
      }
      var pl = getProviderLocation(provider.id);
      var isFreeFloating = provider.operationMode === 'free-floating';
      if(state.selection.recommendationMode === MODE_MANUAL){
        locationContextHint.textContent = 'Die Prüfung richtet sich nach dem oben ausgewählten Anbieter.';
      } else if(state.selection.recommendationMode === MODE_SINGLE){
        locationContextHint.textContent = 'Standortprüfung für ' + provider.name + '. Die Auswahl unten ändert nur, wessen Verfügbarkeit du prüfst; die Empfehlung wird weiterhin automatisch ermittelt.';
      } else {
        locationContextHint.textContent = 'Prüfe die Anbieter für den Mobilitätsmix einzeln über die Auswahl unten. Anbieter, die wegen deiner Alltagseignung ausgeschlossen sind, werden nicht angeboten.';
      }
      stationFields.hidden = isFreeFloating;
      floatingFields.hidden = !isFreeFloating;
      document.getElementById('loc-search-btn').disabled = isFreeFloating;
      document.getElementById('loc_address').disabled = isFreeFloating;
      document.getElementById('loc_count').value = '';
      document.getElementById('loc_walk').value = '';
      if(pl.stationCount !== null){
        document.getElementById('loc_count').value = pl.stationCount;
      }
      if(pl.walkMinutes !== null){
        document.getElementById('loc_walk').value = pl.walkMinutes;
      }
      document.getElementById('loc-provider-label-count').textContent = 'für ' + provider.name;
      document.getElementById('loc-provider-label-walk').textContent = 'für ' + provider.name + ', Min.';
      var floatingValue = 'unknown';
      if(pl.serviceAvailable === true){
        floatingValue = 'yes';
      } else if(pl.serviceAvailable === false){
        floatingValue = 'no';
      }
      document.getElementById('loc_freefloating').value = floatingValue;
      document.getElementById('loc-freefloating-provider').textContent = provider.name;
    }

    /**
     * Reads an optional number input and preserves an empty field as null.
     * @param {string} id - Input element identifier.
     * @returns {number|null} Parsed number or null for an empty field.
     */
    function readNullableNumberInput(id){
      var rawValue = document.getElementById(id).value;
      if(rawValue === ''){
        return null;
      }
      var numberValue = Number(rawValue);
      if(!isFinite(numberValue) || numberValue < 0){
        return null;
      }
      return numberValue;
    }

    /**
     * Copies address and availability inputs into provider-specific state.
     * @returns {void}
     */
    function readLocationFromInputs(){
      state.location.address = document.getElementById('loc_address').value;
      var provider = getLocationProvider(calculateDisplayedResult());
      if(!provider){
        return;
      }
      state.location.byProvider[provider.id] = {
        stationCount: readNullableNumberInput('loc_count'),
        walkMinutes: readNullableNumberInput('loc_walk'),
        serviceAvailable: null,
        source: 'manual'
      };
    }

    /**
     * Speichert, ob ein Free-Floating-Anbieter am Standort ein Geschäftsgebiet hat.
     * @returns {void}
     */
    function readFreeFloatingLocationFromInput(){
      var provider = getLocationProvider(calculateDisplayedResult());
      if(!provider){
        return;
      }
      var selectedValue = document.getElementById('loc_freefloating').value;
      var serviceAvailable = null;
      if(selectedValue === 'yes'){
        serviceAvailable = true;
      } else if(selectedValue === 'no'){
        serviceAvailable = false;
      }
      state.location.byProvider[provider.id] = {
        stationCount: null,
        walkMinutes: null,
        serviceAvailable: serviceAvailable,
        source: 'manual'
      };
    }

    /**
     * Copies only the address field into application state.
     * @returns {void}
     */
    function readAddressFromInput(){
      state.location.address = document.getElementById('loc_address').value;
    }

    /**
     * Calculates the straight-line distance between two geographic coordinates.
     * @param {number} lat1 - Latitude of the first coordinate.
     * @param {number} lon1 - Longitude of the first coordinate.
     * @param {number} lat2 - Latitude of the second coordinate.
     * @param {number} lon2 - Longitude of the second coordinate.
     * @returns {number} Distance in meters.
     */
    function haversineMeters(lat1, lon1, lat2, lon2){
      var R = 6371000, toRad = function(x){ return x * Math.PI / 180; };
      var dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
      var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * Checks whether an asynchronous station search still belongs to the visible provider.
     * @param {number} generation - Sequence number captured when the search started.
     * @param {string} providerId - Provider selected when the search started.
     * @returns {boolean} True while the result may still update the current view.
     */
    function isCurrentStationSearch(generation, providerId){
      var provider = getLocationProvider(calculateDisplayedResult());
      return !!provider && generation === stationSearchGeneration && providerId === provider.id;
    }

    /**
     * Geocodes the entered address and looks up verified stations for the selected provider.
     * @returns {Promise<void>} Resolves after the search result or error has been displayed.
     */
    async function searchStations(){
      var address = document.getElementById('loc_address').value.trim();
      var statusEl = document.getElementById('loc_status');
      var btn = document.getElementById('loc-search-btn');
      var provider = getLocationProvider(calculateDisplayedResult());
      if(!provider){
        statusEl.textContent = 'Kein passender Anbieter für die Standortprüfung vorhanden.';
        return;
      }
      if(provider.operationMode === 'free-floating'){
        statusEl.textContent = provider.name + ' ist ein Free-Floating-Angebot. Prüfe das Geschäftsgebiet und verfügbare Fahrzeuge direkt in der Anbieter-App.';
        return;
      }
      if(!address){
        statusEl.textContent = 'Bitte zuerst eine Adresse eingeben.';
        return;
      }

      stationSearchGeneration += 1;
      var currentGeneration = stationSearchGeneration;
      var providerId = provider.id;
      var geoTimer = null;
      var searchStage = 'address';
      btn.disabled = true;
      statusEl.textContent = 'Adresse wird gesucht …';

      try{
        var geoCtrl = new AbortController();
        geoTimer = setTimeout(function(){ geoCtrl.abort(); }, 8000);
        var geoRes = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(address), { signal: geoCtrl.signal });
        clearTimeout(geoTimer);
        geoTimer = null;
        if(!isCurrentStationSearch(currentGeneration, providerId)){
          return;
        }
        if(!geoRes.ok){
          throw new Error('geocode-error');
        }
        var geoData = await geoRes.json();
        if(!geoData.length){
          statusEl.textContent = 'Adresse nicht gefunden. Bitte Anzahl und Gehzeit unten manuell eintragen.';
          return;
        }
        var lat = parseFloat(geoData[0].lat);
        var lon = parseFloat(geoData[0].lon);
        statusEl.textContent = 'Stationen von ' + provider.name + ' in der Nähe werden gesucht …';

        var radius = 1500;
        var query = '[out:json][timeout:15];node(around:' + radius + ',' + lat + ',' + lon + ')["amenity"="car_sharing"];out body;';
        searchStage = 'stations';
        var opData = await window.CarshareStationSearch.requestStations(query, function(){
          return isCurrentStationSearch(currentGeneration, providerId);
        }, function(attempt){
          if(attempt === 2){
            statusEl.textContent = 'Stationsdienst vorübergehend nicht erreichbar. Ein erneuter Versuch wird gestartet …';
          } else {
            statusEl.textContent = 'Stationsdienst weiterhin nicht erreichbar. Die Suche wird über den Ersatzdienst fortgesetzt …';
          }
        });
        if(!isCurrentStationSearch(currentGeneration, providerId)){
          return;
        }
        var allStations = opData.elements || [];

        var needle = provider.name.toLowerCase().replace('(vormals share now)', '').trim();
        var aliasMap = {
          free2move: ['free2move', 'share now', 'sharenow', 'car2go'],
          sixtshare: ['sixt'],
          'gruene-flotte': ['grüne flotte', 'gruene flotte', 'gruene-flotte']
        };
        var needles = aliasMap[provider.id] || [needle];

        /**
         * Checks whether OpenStreetMap tags identify the selected provider.
         * @param {Object|undefined} tags - Tags attached to an OpenStreetMap station.
         * @returns {boolean} True when a provider alias occurs in the station tags.
         */
        function matchesProvider(tags){
          if(!tags){
            return false;
          }
          var haystack = [tags.operator, tags.brand, tags.network, tags.name].filter(Boolean).join(' ').toLowerCase();
          return needles.some(function(n){ return haystack.indexOf(n) !== -1; });
        }

        var stations = allStations.filter(function(s){ return matchesProvider(s.tags); });
        if(!stations.length && allStations.length){
          statusEl.textContent = allStations.length + ' Carsharing-Station(en) allgemein gefunden. Weil der Betreiber in OpenStreetMap nicht eindeutig ' + provider.name + ' zugeordnet ist, wurden die Anbieterwerte nicht verändert.';
          return;
        }

        state.location.address = address;
        if(!stations.length){
          state.location.byProvider[providerId] = { stationCount: 0, walkMinutes: 0, serviceAvailable: null, source: 'search' };
          fillLocationInputs();
          statusEl.textContent = 'Keine Station von ' + provider.name + ' im Umkreis von 1,5 km in OpenStreetMap gefunden. Falls dir Stationen bekannt sind, trag sie unten manuell ein.';
        } else {
          var minDist = Infinity;
          stations.forEach(function(station){
            var distance = haversineMeters(lat, lon, station.lat, station.lon);
            if(distance < minDist){
              minDist = distance;
            }
          });
          var walkMin = Math.max(1, Math.round(minDist / 80));
          state.location.byProvider[providerId] = { stationCount: stations.length, walkMinutes: walkMin, serviceAvailable: null, source: 'search' };
          fillLocationInputs();
          statusEl.textContent = stations.length + ' Station(en) von ' + provider.name + ' im Umkreis von 1,5 km gefunden · nächste ca. ' + walkMin + ' Gehminuten entfernt.';
        }
        render();
        scheduleSave();
      }catch(e){
        if(isCurrentStationSearch(currentGeneration, providerId)){
          if(searchStage === 'stations'){
            statusEl.textContent = 'Die Stationsdienste sind gerade nicht erreichbar oder haben keine vollständige Antwort geliefert. Deine bisherigen Standortwerte bleiben erhalten. Bitte versuche es später erneut oder trage Anzahl und Gehzeit für ' + provider.name + ' manuell ein.';
          } else {
            statusEl.textContent = 'Die Adresssuche ist gerade nicht erreichbar. Deine bisherigen Standortwerte bleiben erhalten. Bitte versuche es später erneut oder trage Anzahl und Gehzeit für ' + provider.name + ' manuell ein.';
          }
        }
      }finally{
        if(geoTimer !== null){
          clearTimeout(geoTimer);
        }
        if(currentGeneration === stationSearchGeneration){
          btn.disabled = false;
        }
      }
    }

    /**
     * Invalidates pending station searches when the selected provider mode changes.
     * @returns {void}
     */
    function invalidateProvider(){
      locationProviderOverride = '';
      stationSearchGeneration += 1;
    }

    /**
     * Selects an eligible provider for editing its location and invalidates older searches.
     * @param {string} providerId - Provider selected in the location form.
     * @returns {void}
     */
    function selectProvider(providerId){
      locationProviderOverride = providerId;
      stationSearchGeneration += 1;
      document.getElementById('loc_status').textContent = '';
      fillLocationInputs();
    }

    return {
      getProviderLocation: getProviderLocation,
      getLocationProvider: getLocationProvider,
      fillLocationInputs: fillLocationInputs,
      readLocationFromInputs: readLocationFromInputs,
      readFreeFloatingLocationFromInput: readFreeFloatingLocationFromInput,
      readAddressFromInput: readAddressFromInput,
      searchStations: searchStations,
      invalidateProvider: invalidateProvider,
      selectProvider: selectProvider
    };
  }

  window.CarshareLocationUI = { create: create };
})();
