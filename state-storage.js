(function(){
  'use strict';

  /**
   * Creates the state-storage controller without starting UI or network work.
   * @param {Object} dependencies - Explicit controller dependencies.
   * @param {Object} dependencies.state - Shared state container; its sections may be replaced.
   * @returns {Object} Functions owned by this controller.
   */
  function create(dependencies){
    var providerData = window.CarshareData;
    var identifiers = window.CarshareIdentifiers;
    var defaultProviders = providerData.defaultProviders;
    var normalizeTariffData = providerData.normalizeTariffData;
    var defaultLocation = window.CarshareStateValidation.defaultLocation;
    var normalizeLocationEntry = window.CarshareStateValidation.normalizeLocationEntry;
    var normalizeSelection = window.CarshareStateValidation.normalizeSelection;
    var normalizeStoredUsage = window.CarshareStateValidation.normalizeStoredUsage;
    var filterProviderLocations = window.CarshareStateValidation.filterProviderLocations;
    var state = dependencies.state;

    var STORAGE_KEY = 'carsharing-rechner:v1';
    var saveTimer = null;
    // Läuft die Datei innerhalb von claude.ai, nutzen wir die dortige Speicher-API (privat pro Nutzer/Konto).
    // Läuft sie standalone (heruntergeladen, im eigenen Browser geöffnet), gibt es kein window.storage mehr –
    // dann speichern wir stattdessen lokal im Browser (localStorage), damit Eingaben trotzdem erhalten bleiben.
    var storageAdapter;
    if(typeof window.storage !== 'undefined' && window.storage){
      storageAdapter = {
        get: function(key){ return window.storage.get(key, false); },
        set: function(key, value){ return window.storage.set(key, value, false); }
      };
    } else {
      storageAdapter = {
        get: async function(key){
          var value = localStorage.getItem(key);
          if(value === null){
            return null;
          }
          return { key: key, value: value };
        },
        set: async function(key, value){
          localStorage.setItem(key, value);
          return { key: key, value: value };
        }
      };
    }

    /**
     * Debounces persistence of the current application state.
     * @returns {void}
     */
    function scheduleSave(){
      var el = document.getElementById('save-status');
      if(el) el.textContent = 'Speichern …';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function(){
        storageAdapter.set(STORAGE_KEY, JSON.stringify(state))
          .then(function(res){
            if(!el){
              return;
            }
            if(res){
              el.textContent = 'Gespeichert';
            } else {
              el.textContent = 'Speichern fehlgeschlagen';
            }
          })
          .catch(function(){ if(el) el.textContent = 'Speichern fehlgeschlagen'; });
      }, 500);
    }

    /**
     * Loads persisted state and migrates older location and provider data.
     * @returns {Promise<void>} Resolves after stored data has been applied or defaults retained.
     */
    async function loadState(){
      try{
        var res = await storageAdapter.get(STORAGE_KEY);
        if(res && res.value){
          var parsed = JSON.parse(res.value);
          if(parsed.own) state.own = providerData.normalizeOwn(parsed.own);
          if(parsed.usage) state.usage = normalizeStoredUsage(parsed.usage);
          if(parsed.location){
            if(parsed.location.byProvider){
              state.location = defaultLocation();
              state.location.address = parsed.location.address || '';
              Object.keys(parsed.location.byProvider).forEach(function(providerId){
                if(identifiers.isValidProviderId(providerId)){
                  state.location.byProvider[providerId] = normalizeLocationEntry(parsed.location.byProvider[providerId]);
                }
              });
            } else if(typeof parsed.location.stationCount === 'number'){
              state.location = defaultLocation();
              state.location.address = parsed.location.address || '';
              state.location.byProvider.cambio = {
                stationCount: parsed.location.stationCount, walkMinutes: parsed.location.walkMinutes, source: 'legacy'
              };
            }
          }
          if(parsed.providers && parsed.providers.length && identifiers.hasValidProviderIdentifiers(parsed.providers)){
            state.providers = normalizeTariffData(parsed.providers);
            // Neu hinzugekommene Standard-Anbieter ergänzen, falls ein älterer Stand geladen wird
            defaultProviders().forEach(function(dp){
              if(!state.providers.some(function(p){ return p.id === dp.id; })){
                state.providers.push(dp);
              }
            });
          }
          if(parsed.selection && identifiers.isValidProviderId(parsed.selection.providerId) && identifiers.isValidIdentifier(parsed.selection.classId) && identifiers.isValidIdentifier(parsed.selection.tariffId)){
            state.selection = normalizeSelection(parsed.selection);
          }
          // Repair persisted orphan entries only after custom providers have been restored.
          state.location.byProvider = filterProviderLocations(state.location.byProvider, state.providers);
        }
      }catch(e){ /* kein gespeicherter Stand vorhanden - Standardwerte werden verwendet */ }
    }

    return {
      scheduleSave: scheduleSave,
      loadState: loadState
    };
  }

  window.CarshareStateStorage = { create: create };
})();
