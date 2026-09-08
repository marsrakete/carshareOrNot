(function(){
  'use strict';

  // ---------- Defaults ----------

  var providerData = window.CarshareData;
  var BILLING_DISTANCE_WITH_PACKAGES = providerData.BILLING_DISTANCE_WITH_PACKAGES;
  var BILLING_TIME_WITH_INCLUDED_DISTANCE = providerData.BILLING_TIME_WITH_INCLUDED_DISTANCE;
  var isKnownBillingMode = providerData.isKnownBillingMode;
  var defaultOwn = providerData.defaultOwn;
  var defaultUsage = providerData.defaultUsage;
  var tariff = providerData.tariff;
  var defaultProviders = providerData.defaultProviders;
  var normalizeTariffData = providerData.normalizeTariffData;
  var recommendationData = window.CarshareRecommendations;
  var MODE_MANUAL = recommendationData.MODE_MANUAL;
  var MODE_SINGLE = recommendationData.MODE_SINGLE;
  var MODE_MIX = recommendationData.MODE_MIX;
  /**
   * Creates the default location estimate for one provider.
   * @param {string} providerId - Provider identifier.
   * @returns {Object} Station count and walking-time estimate.
   */
  function defaultLocationForProvider(providerId){
    return { stationCount: null, walkMinutes: null, serviceAvailable: null, source: 'unknown' };
  }
  /**
   * Creates default location data for every built-in provider.
   * @returns {Object} Address and provider-specific location values.
   */
  function defaultLocation(){
    var byProvider = {};
    defaultProviders().forEach(function(p){ byProvider[p.id] = defaultLocationForProvider(p.id); });
    return { address: '', byProvider: byProvider };
  }

  /**
   * Normalizes stored provider availability and marks unclassified legacy values for confirmation.
   * @param {Object} entry - Stored provider location entry.
   * @returns {Object} Normalized location entry.
   */
  function normalizeLocationEntry(entry){
    if(!isObject(entry) || !isNullableNumber(entry.stationCount) || !isNullableNumber(entry.walkMinutes)){
      return { stationCount: null, walkMinutes: null, serviceAvailable: null, source: 'unknown' };
    }
    var source = entry.source;
    if(source !== 'manual' && source !== 'search' && source !== 'unknown'){
      if(entry.stationCount === null && entry.walkMinutes === null){
        source = 'unknown';
      } else {
        source = 'legacy';
      }
    }
    var serviceAvailable = null;
    if(typeof entry.serviceAvailable === 'boolean'){
      serviceAvailable = entry.serviceAvailable;
    }
    return { stationCount: entry.stationCount, walkMinutes: entry.walkMinutes, serviceAvailable: serviceAvailable, source: source };
  }
  /**
   * Returns location values for a provider and initializes missing values.
   * @param {string} providerId - Provider identifier.
   * @returns {Object} Mutable provider-specific location values.
   */
  function getProviderLocation(providerId){
    if(!state.location.byProvider[providerId]){
      state.location.byProvider[providerId] = defaultLocationForProvider(providerId);
    }
    return state.location.byProvider[providerId];
  }

  var state = {
    own: defaultOwn(),
    usage: defaultUsage(),
    location: defaultLocation(),
    providers: defaultProviders(),
    selection: { providerId: 'cambio', classId: 'klein', tariffId: 'aktiv', recommendationMode: MODE_MANUAL }
  };

  var usageScenarios = [
    {
      id: 'family-commute', title: 'Familie, Pendler, 2 Kleinkinder', iconId: 'scenario-icon-family',
      summary: '12.000 km · 5 Kita-Tage/Woche · 2 Urlaube',
      values: { jahreskm: 12000, kurzfahrten: 20, stundenprofahrt: 1.5, bringtageprowoche: 5, bringwochenprojahr: 46, bringkmprotag: 16, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 60, kindersitz: true, tagesausfluege: 8, stundenproausflug: 8, kmproausflug: 100, mehrtagesfahrten: 4, tageprofahrt: 3, kmprofahrt: 300, urlaubsfahrten: 2, tageprourlaub: 7, kmprourlaub: 800, flex: 'teilweise', freefloatingFit: 'auto' }
    },
    {
      id: 'family-homeoffice', title: 'Familie, kein Pendeln, 2 Kleinkinder', iconId: 'scenario-icon-home',
      summary: '7.500 km · 5 Kita-Tage/Woche · mehr Ausflüge',
      values: { jahreskm: 7500, kurzfahrten: 8, stundenprofahrt: 2, bringtageprowoche: 5, bringwochenprojahr: 46, bringkmprotag: 16, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 60, kindersitz: true, tagesausfluege: 12, stundenproausflug: 8, kmproausflug: 100, mehrtagesfahrten: 5, tageprofahrt: 3, kmprofahrt: 250, urlaubsfahrten: 2, tageprourlaub: 7, kmprourlaub: 700, flex: 'teilweise', freefloatingFit: 'auto' }
    },
    {
      id: 'care-weekly', title: 'Pflegefahrten wöchentlich', iconId: 'scenario-icon-care',
      summary: '6.000 km · 2 flexible Fahrten/Woche · bis 50 km',
      values: { jahreskm: 6000, kurzfahrten: 9, stundenprofahrt: 3, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 0, stundenproausflug: 8, kmproausflug: 120, mehrtagesfahrten: 0, tageprofahrt: 3, kmprofahrt: 250, urlaubsfahrten: 0, tageprourlaub: 7, kmprourlaub: 900, flex: 'spontan', freefloatingFit: 'supplement' }
    },
    {
      id: 'single-commute', title: 'Single & Pendeln', iconId: 'scenario-icon-commute',
      summary: '10.000 km · 20 Arbeitstage/Monat · flexibel',
      values: { jahreskm: 10000, kurzfahrten: 20, stundenprofahrt: 9, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 3, stundenproausflug: 8, kmproausflug: 100, mehrtagesfahrten: 2, tageprofahrt: 2, kmprofahrt: 250, urlaubsfahrten: 1, tageprourlaub: 7, kmprourlaub: 700, flex: 'teilweise', freefloatingFit: 'suitable' }
    },
    {
      id: 'care-frequent', title: 'Pflegefahrten häufig', iconId: 'scenario-icon-care',
      summary: '13.000 km · werktäglich flexibel · bis 50 km',
      values: { jahreskm: 13000, kurzfahrten: 22, stundenprofahrt: 3, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 0, stundenproausflug: 8, kmproausflug: 120, mehrtagesfahrten: 0, tageprofahrt: 3, kmprofahrt: 250, urlaubsfahrten: 0, tageprourlaub: 7, kmprourlaub: 900, flex: 'spontan', freefloatingFit: 'unsuitable' }
    },
    {
      id: 'single-parent-weekend', title: 'Alleinerziehend & Wochenendbeziehung', iconId: 'scenario-icon-family',
      summary: '7.000 km · 40 Wochenenden · je 100 km',
      values: { jahreskm: 7000, kurzfahrten: 6, stundenprofahrt: 2, bringtageprowoche: 2, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 50, kindersitz: true, tagesausfluege: 2, stundenproausflug: 8, kmproausflug: 100, mehrtagesfahrten: 40, tageprofahrt: 2, kmprofahrt: 100, urlaubsfahrten: 1, tageprourlaub: 7, kmprourlaub: 600, flex: 'teilweise', freefloatingFit: 'auto' }
    },
    {
      id: 'urban-couple', title: 'Paar, städtisch & Homeoffice', iconId: 'scenario-icon-home',
      summary: '4.500 km · Freizeit · gelegentliche Wochenenden',
      values: { jahreskm: 4500, kurzfahrten: 8, stundenprofahrt: 2, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 6, stundenproausflug: 8, kmproausflug: 100, mehrtagesfahrten: 4, tageprofahrt: 2, kmprofahrt: 200, urlaubsfahrten: 1, tageprourlaub: 7, kmprourlaub: 700, flex: 'teilweise', freefloatingFit: 'suitable' }
    },
    {
      id: 'retirement', title: 'Ruhestand mit Terminen', iconId: 'scenario-icon-care',
      summary: '5.000 km · Arzt und Einkauf · meist planbar',
      values: { jahreskm: 5000, kurzfahrten: 12, stundenprofahrt: 3, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 4, stundenproausflug: 7, kmproausflug: 80, mehrtagesfahrten: 2, tageprofahrt: 3, kmprofahrt: 200, urlaubsfahrten: 1, tageprourlaub: 7, kmprourlaub: 600, flex: 'planbar', freefloatingFit: 'supplement' }
    },
    {
      id: 'low-mileage', title: 'Wenigfahrer', iconId: 'scenario-icon-route',
      summary: '2.500 km · 3 Alltagsfahrten/Monat · 1 Urlaub',
      values: { jahreskm: 2500, kurzfahrten: 3, stundenprofahrt: 2, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 3, stundenproausflug: 8, kmproausflug: 100, mehrtagesfahrten: 2, tageprofahrt: 2, kmprofahrt: 200, urlaubsfahrten: 1, tageprourlaub: 7, kmprourlaub: 600, flex: 'planbar', freefloatingFit: 'supplement' }
    },
    {
      id: 'leisure', title: 'Freizeit & Ausflüge', iconId: 'scenario-icon-route',
      summary: '7.000 km · 18 Tagesausflüge · 8 Wochenenden',
      values: { jahreskm: 7000, kurzfahrten: 4, stundenprofahrt: 2, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 18, stundenproausflug: 9, kmproausflug: 120, mehrtagesfahrten: 8, tageprofahrt: 2, kmprofahrt: 300, urlaubsfahrten: 1, tageprourlaub: 7, kmprourlaub: 800, flex: 'planbar', freefloatingFit: 'supplement' }
    }
  ];
  var showAllUsageScenarios = false;
  var scenarioUndoUsage = null;
  var activeScenarioTitle = '';
  var scenarioPickerCollapsed = false;

  var STORAGE_KEY = 'carsharing-rechner:v1';
  var SHARE_FORMAT_VERSION = 2;
  var saveTimer = null;
  var stationSearchGeneration = 0;

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
   * Converts bytes to URL-safe Base64 without padding.
   * @param {Uint8Array} bytes - Bytes to encode.
   * @returns {string} URL-safe Base64 text.
   */
  function bytesToBase64Url(bytes){
    var binary = '';
    var chunkSize = 8192;
    for(var offset = 0; offset < bytes.length; offset += chunkSize){
      var chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  /**
   * Converts URL-safe Base64 text back to bytes.
   * @param {string} encoded - URL-safe Base64 text.
   * @returns {Uint8Array} Decoded bytes.
   */
  function base64UrlToBytes(encoded){
    var normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while(normalized.length % 4 !== 0){
      normalized += '=';
    }
    var binary = atob(normalized);
    var bytes = new Uint8Array(binary.length);
    for(var index = 0; index < binary.length; index += 1){
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  /**
   * Encodes a complete state snapshot for use in a share URL.
   * @param {Object} snapshot - Application state to encode.
   * @returns {Promise<string>} Versioned compressed or plain payload.
   */
  async function encodeSharePayload(snapshot){
    var wrapper = { version: SHARE_FORMAT_VERSION, state: snapshot };
    var bytes = new TextEncoder().encode(JSON.stringify(wrapper));
    if(typeof CompressionStream !== 'undefined'){
      try{
        var compressedStream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
        var compressedBuffer = await new Response(compressedStream).arrayBuffer();
        return 'g.' + bytesToBase64Url(new Uint8Array(compressedBuffer));
      }catch(error){
        // Uncompressed encoding remains interoperable when compression is unavailable at runtime.
      }
    }
    return 'j.' + bytesToBase64Url(bytes);
  }

  /**
   * Decodes a state wrapper from a versioned share payload.
   * @param {string} payload - Payload stored after the share hash marker.
   * @returns {Promise<Object>} Parsed wrapper containing version and state.
   */
  async function decodeSharePayload(payload){
    if(typeof payload !== 'string' || payload.length < 3 || payload.charAt(1) !== '.'){
      throw new Error('share-format');
    }
    var encoding = payload.charAt(0);
    var bytes = base64UrlToBytes(payload.slice(2));
    if(encoding === 'g'){
      if(typeof DecompressionStream === 'undefined'){
        throw new Error('share-compression-unsupported');
      }
      var decompressedStream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      var decompressedBuffer = await new Response(decompressedStream).arrayBuffer();
      bytes = new Uint8Array(decompressedBuffer);
    } else if(encoding !== 'j'){
      throw new Error('share-encoding');
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  /**
   * Checks whether a value is a non-array object.
   * @param {*} value - Value to inspect.
   * @returns {boolean} True for non-null, non-array objects.
   */
  function isObject(value){
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Checks whether a value is null or a finite non-negative number.
   * @param {*} value - Value to inspect.
   * @returns {boolean} True for null or a valid non-negative number.
   */
  function isNullableNumber(value){
    if(value === null){
      return true;
    }
    return typeof value === 'number' && isFinite(value) && value >= 0;
  }

  /**
   * Prüft, ob ein Wert null oder ein boolescher Verfügbarkeitswert ist.
   * @param {*} value - Zu prüfender Wert.
   * @returns {boolean} True für null oder boolean.
   */
  function isNullableBoolean(value){
    return value === null || typeof value === 'boolean';
  }

  /**
   * Ergänzt und bereinigt den Auswahlmodus älterer gespeicherter Zustände.
   * @param {Object} selection - Gespeicherte Anbieter-, Klassen- und Tarifauswahl.
   * @returns {Object} Auswahl mit einem unterstützten Empfehlungsmodus.
   */
  function normalizeSelection(selection){
    if(!isObject(selection)){
      return selection;
    }
    if(!recommendationData.isKnownMode(selection.recommendationMode)){
      selection.recommendationMode = MODE_MANUAL;
    }
    return selection;
  }

  /**
   * Checks whether an object contains finite non-negative numbers for all named fields.
   * @param {Object} value - Object containing numeric settings.
   * @param {Array<string>} fields - Required numeric field names.
   * @returns {boolean} True when every required field is valid.
   */
  function hasValidNumbers(value, fields){
    if(!isObject(value)){
      return false;
    }
    return fields.every(function(field){
      return typeof value[field] === 'number' && isFinite(value[field]) && value[field] >= 0;
    });
  }

  /**
   * Validates provider, class and tariff structures received through a share link.
   * @param {Array<Object>} providers - Provider collection to validate.
   * @returns {boolean} True when the complete provider hierarchy is usable.
   */
  function hasValidProviders(providers){
    var tariffFields = ['grundgebuehr','zeitpreis','tagespreis','wochenpreis','kmBis100','kmAb100','anmeldegebuehr'];
    if(!Array.isArray(providers) || providers.length === 0){
      return false;
    }
    return providers.every(function(provider){
      if(!isObject(provider) || typeof provider.id !== 'string' || typeof provider.name !== 'string' || !Array.isArray(provider.classes) || provider.classes.length === 0){
        return false;
      }
      if(provider.operationMode !== 'station-based' && provider.operationMode !== 'free-floating'){
        return false;
      }
      return provider.classes.every(function(cls){
        if(!isObject(cls) || typeof cls.id !== 'string' || typeof cls.name !== 'string' || !Array.isArray(cls.tariffs) || cls.tariffs.length === 0){
          return false;
        }
        return cls.tariffs.every(function(selectedTariff){
          if(!isObject(selectedTariff) || typeof selectedTariff.id !== 'string' || typeof selectedTariff.name !== 'string' || !hasValidNumbers(selectedTariff.v, tariffFields)){
            return false;
          }
          if(typeof selectedTariff.v.billingMode !== 'undefined' && !isKnownBillingMode(selectedTariff.v.billingMode)){
            return false;
          }
          if(typeof selectedTariff.v.meta !== 'undefined'){
            if(!isObject(selectedTariff.v.meta) || typeof selectedTariff.v.meta.sourceUrl !== 'string' || typeof selectedTariff.v.meta.region !== 'string' || typeof selectedTariff.v.meta.lastVerifiedAt !== 'string'){
              return false;
            }
          }
          return true;
        });
      });
    });
  }

  /**
   * Validates a complete application state received from an untrusted URL.
   * @param {Object} snapshot - Decoded application state.
   * @returns {boolean} True when the state can safely drive the calculator.
   */
  function isValidSharedState(snapshot){
    var ownFields = ['kaufpreis','haltedauer','restwert','wartung','versicherung','sonstiges','sonstigesExtra','verbrauch','kraftstoffpreis','stellplatz','parkausweis'];
    var usageFields = [
      'jahreskm','vergleichsjahre','kurzfahrten','stundenprofahrt',
      'bringtageprowoche','bringwochenprojahr','bringkmprotag','bringbuchungenprotag','bringstundenprobuchung','bringseparatanteil',
      'tagesausfluege','stundenproausflug','kmproausflug',
      'mehrtagesfahrten','tageprofahrt','kmprofahrt',
      'urlaubsfahrten','tageprourlaub','kmprourlaub'
    ];
    if(!isObject(snapshot) || !hasValidNumbers(snapshot.own, ownFields) || !hasValidNumbers(snapshot.usage, usageFields)){
      return false;
    }
    if(typeof snapshot.usage.flex !== 'string' || !recommendationData.isKnownFreeFloatingFit(snapshot.usage.freefloatingFit) || typeof snapshot.usage.parkplatz !== 'boolean' || typeof snapshot.usage.kindersitz !== 'boolean'){
      return false;
    }
    if(snapshot.usage.alltagsmodell !== 'continuous' && snapshot.usage.alltagsmodell !== 'split-return' && snapshot.usage.alltagsmodell !== 'one-way'){
      return false;
    }
    if(!isObject(snapshot.location) || typeof snapshot.location.address !== 'string' || !isObject(snapshot.location.byProvider)){
      return false;
    }
    var validLocations = Object.keys(snapshot.location.byProvider).every(function(providerId){
      var locationEntry = snapshot.location.byProvider[providerId];
      if(!isObject(locationEntry)){
        return false;
      }
      var serviceAvailable = null;
      if(typeof locationEntry.serviceAvailable !== 'undefined'){
        serviceAvailable = locationEntry.serviceAvailable;
      }
      return isNullableNumber(locationEntry.stationCount) && isNullableNumber(locationEntry.walkMinutes) && isNullableBoolean(serviceAvailable);
    });
    if(!validLocations || !hasValidProviders(snapshot.providers) || !isObject(snapshot.selection)){
      return false;
    }
    return typeof snapshot.selection.providerId === 'string' &&
      typeof snapshot.selection.classId === 'string' &&
      typeof snapshot.selection.tariffId === 'string' &&
      recommendationData.isKnownMode(snapshot.selection.recommendationMode);
  }

  /**
   * Replaces current state with a validated shared snapshot.
   * @param {Object} snapshot - Validated application state.
   * @returns {void}
   */
  function applySharedState(snapshot){
    state.own = snapshot.own;
    state.usage = snapshot.usage;
    state.location = snapshot.location;
    state.providers = snapshot.providers;
    state.selection = normalizeSelection(snapshot.selection);
  }

  /**
   * Creates a share snapshot containing only providers that differ from built-in defaults.
   * @returns {Object} Compact state plus provider overrides and removed default identifiers.
   */
  function createCompactShareState(){
    var defaults = defaultProviders();
    var overrides = [];
    var removedProviderIds = [];
    state.providers.forEach(function(provider){
      var defaultProvider = defaults.find(function(candidate){ return candidate.id === provider.id; });
      if(!defaultProvider || JSON.stringify(provider) !== JSON.stringify(defaultProvider)){
        overrides.push(provider);
      }
    });
    defaults.forEach(function(defaultProvider){
      var stillPresent = state.providers.some(function(provider){ return provider.id === defaultProvider.id; });
      if(!stillPresent){
        removedProviderIds.push(defaultProvider.id);
      }
    });
    return {
      own: state.own,
      usage: state.usage,
      location: state.location,
      selection: state.selection,
      providerOverrides: overrides,
      removedProviderIds: removedProviderIds
    };
  }

  /**
   * Reconstructs complete provider data for a compact version-two share state.
   * @param {Object} snapshot - Compact decoded state.
   * @returns {Object} State with a complete providers collection.
   */
  function expandCompactShareState(snapshot){
    if(Array.isArray(snapshot.providers)){
      return snapshot;
    }
    var providers = defaultProviders();
    var removedProviderIds = snapshot.removedProviderIds;
    if(!Array.isArray(removedProviderIds)){
      removedProviderIds = [];
    }
    providers = providers.filter(function(provider){ return removedProviderIds.indexOf(provider.id) === -1; });
    var overrides = snapshot.providerOverrides;
    if(!Array.isArray(overrides)){
      overrides = [];
    }
    overrides.forEach(function(override){
      var existingIndex = providers.findIndex(function(provider){ return provider.id === override.id; });
      if(existingIndex >= 0){
        providers[existingIndex] = override;
      } else {
        providers.push(override);
      }
    });
    snapshot.providers = providers;
    return snapshot;
  }

  /**
   * Loads and applies shared settings from the current URL hash.
   * @returns {Promise<Object>} Result with load state and a user-facing message.
   */
  async function loadSharedState(){
    var marker = '#share=';
    if(window.location.hash.indexOf(marker) !== 0){
      return { found: false, loaded: false, message: '' };
    }
    try{
      var payload = decodeURIComponent(window.location.hash.slice(marker.length));
      var wrapper = await decodeSharePayload(payload);
      if(isObject(wrapper) && wrapper.version === 2 && isObject(wrapper.state)){
        wrapper.state = expandCompactShareState(wrapper.state);
      }
      if(isObject(wrapper) && isObject(wrapper.state) && isObject(wrapper.state.usage)){
        var sharedUsage = Object.assign(defaultUsage(), wrapper.state.usage);
        if(typeof wrapper.state.usage.vergleichsjahre !== 'number' && isObject(wrapper.state.own) && typeof wrapper.state.own.haltedauer === 'number'){
          sharedUsage.vergleichsjahre = Math.max(wrapper.state.own.haltedauer, 1);
        }
        wrapper.state.usage = sharedUsage;
      }
      if(isObject(wrapper) && isObject(wrapper.state)){
        wrapper.state.selection = normalizeSelection(wrapper.state.selection);
      }
      var supportedVersion = isObject(wrapper) && (wrapper.version === 1 || wrapper.version === SHARE_FORMAT_VERSION);
      if(!supportedVersion || !isValidSharedState(wrapper.state)){
        throw new Error('share-state');
      }
      wrapper.state.providers = normalizeTariffData(wrapper.state.providers);
      Object.keys(wrapper.state.location.byProvider).forEach(function(providerId){
        wrapper.state.location.byProvider[providerId] = normalizeLocationEntry(wrapper.state.location.byProvider[providerId]);
      });
      applySharedState(wrapper.state);
      return { found: true, loaded: true, message: 'Geteilte Einstellungen wurden geladen.' };
    }catch(error){
      return { found: true, loaded: false, message: 'Der geteilte Link ist ungültig oder wird von diesem Browser nicht unterstützt.' };
    }
  }

  /**
   * Creates a URL containing the complete current state in its hash.
   * @returns {Promise<string>} Shareable URL.
   */
  async function createShareUrl(){
    var payload = await encodeSharePayload(createCompactShareState());
    var url = new URL(window.location.href);
    url.hash = 'share=' + payload;
    return url.toString();
  }

  /**
   * Displays a share URL in a selectable fallback field.
   * @param {string} url - URL the user should copy manually.
   * @returns {void}
   */
  function showShareFallback(url){
    var fallback = document.getElementById('share-fallback');
    fallback.hidden = false;
    fallback.value = url;
    fallback.focus();
    fallback.select();
    document.getElementById('share-status').textContent = 'Automatisches Teilen oder Kopieren ist hier nicht verfügbar. Der Link ist zum manuellen Kopieren markiert.';
  }

  /**
   * Copies a share URL or exposes it for manual copying.
   * @param {string} url - URL to copy.
   * @returns {Promise<void>} Resolves after copying or showing the fallback field.
   */
  async function copyShareUrl(url){
    if(navigator.clipboard && typeof navigator.clipboard.writeText === 'function'){
      try{
        await navigator.clipboard.writeText(url);
        document.getElementById('share-status').textContent = 'Link wurde kopiert.';
        return;
      }catch(error){
        // The visible fallback below keeps sharing possible without clipboard permission.
      }
    }
    showShareFallback(url);
  }

  /**
   * Opens the native share sheet when available and otherwise copies the state URL.
   * @returns {Promise<void>} Resolves after the share interaction or fallback completes.
   */
  async function shareCurrentState(){
    var button = document.getElementById('share-btn');
    var status = document.getElementById('share-status');
    var fallback = document.getElementById('share-fallback');
    button.disabled = true;
    fallback.hidden = true;
    status.textContent = 'Link wird erstellt …';
    try{
      var url = await createShareUrl();
      var shareData = {
        title: 'Auto oder Carsharing?',
        text: 'Meine Einstellungen für den Vergleich von eigenem Auto und Carsharing.',
        url: url
      };
      var nativeShareAvailable = typeof navigator.share === 'function';
      if(nativeShareAvailable && typeof navigator.canShare === 'function'){
        nativeShareAvailable = navigator.canShare(shareData);
      }
      if(nativeShareAvailable){
        try{
          await navigator.share(shareData);
          status.textContent = 'Geteilt.';
          return;
        }catch(error){
          if(error && error.name === 'AbortError'){
            status.textContent = 'Teilen wurde abgebrochen.';
            return;
          }
        }
      }
      await copyShareUrl(url);
    }catch(error){
      status.textContent = 'Der Link konnte nicht erstellt werden.';
    }finally{
      button.disabled = false;
    }
  }

  /**
   * Draws wrapped text onto a canvas within a maximum width.
   * @param {CanvasRenderingContext2D} context - Canvas drawing context.
   * @param {string} text - Text to draw.
   * @param {number} x - Left position in pixels.
   * @param {number} y - First baseline in pixels.
   * @param {number} maxWidth - Maximum line width in pixels.
   * @param {number} lineHeight - Distance between baselines in pixels.
   * @returns {number} Baseline position after the final line.
   */
  function drawWrappedCanvasText(context, text, x, y, maxWidth, lineHeight){
    var words = text.split(' ');
    var line = '';
    var currentY = y;
    words.forEach(function(word){
      var candidate = line;
      if(candidate){
        candidate += ' ';
      }
      candidate += word;
      if(line && context.measureText(candidate).width > maxWidth){
        context.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
      } else {
        line = candidate;
      }
    });
    if(line){
      context.fillText(line, x, currentY);
    }
    return currentY;
  }

  /**
   * Adds a rounded rectangle path with a fallback for browsers without Canvas roundRect.
   * @param {CanvasRenderingContext2D} context - Canvas drawing context.
   * @param {number} x - Left edge in pixels.
   * @param {number} y - Top edge in pixels.
   * @param {number} width - Rectangle width in pixels.
   * @param {number} height - Rectangle height in pixels.
   * @param {number} radius - Corner radius in pixels.
   * @returns {void} No return value.
   */
  function addRoundedRectanglePath(context, x, y, width, height, radius){
    if(typeof context.roundRect === 'function'){
      context.roundRect(x, y, width, height, radius);
      return;
    }
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  /**
   * Downloads a blob through a temporary object URL.
   * @param {Blob} blob - File contents to download.
   * @param {string} filename - Suggested download filename.
   * @returns {void} No return value.
   */
  function downloadBlob(blob, filename){
    var imageUrl = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function(){ URL.revokeObjectURL(imageUrl); }, 0);
  }

  /**
   * Creates a polished PNG summary of the current comparison.
   * @returns {Promise<Blob>} PNG image blob.
   */
  function createResultImageBlob(){
    var result = calculateDisplayedResult();
    var canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    var context = canvas.getContext('2d');
    var gradient = context.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, '#dff4e8');
    gradient.addColorStop(1, '#f7fbf6');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1200, 630);
    context.fillStyle = '#ffffff';
    context.beginPath();
    addRoundedRectanglePath(context, 70, 64, 1060, 502, 28);
    context.fill();
    context.fillStyle = '#173f35';
    context.font = '700 48px sans-serif';
    context.fillText('Auto oder Carsharing?', 120, 135);
    context.font = '24px sans-serif';
    context.fillStyle = '#557169';
    context.fillText('Mein persönlicher Jahresvergleich', 120, 177);
    var largestTotal = Math.max(result.own.total, result.cambio.total, 1);
    var ownWidth = Math.max(24, 380 * result.own.total / largestTotal);
    context.fillStyle = '#ad493d';
    context.fillRect(120, 245, ownWidth, 26);
    context.fillStyle = '#167c63';
    var providerWidth = 0;
    if(result.cambio){
      providerWidth = Math.max(24, 380 * result.cambio.total / largestTotal);
    }
    context.fillRect(120, 355, providerWidth, 26);
    context.fillStyle = '#173f35';
    context.font = '700 28px sans-serif';
    context.fillText('Eigenes Auto', 120, 230);
    context.fillText(fmtEUR(result.own.total) + ' / Jahr', 530, 270);
    context.fillText(result.providerName, 120, 340);
    if(result.cambio){
      context.fillText(fmtEUR(result.cambio.total) + ' / Jahr', 530, 380);
    }
    context.fillStyle = '#167c63';
    context.font = '700 58px sans-serif';
    if(result.cambio){
      context.fillText(fmtEUR(Math.abs(result.own.total - result.cambio.total)), 730, 280);
    }
    context.font = '700 24px sans-serif';
    context.fillText('Unterschied pro Jahr', 730, 320);
    context.fillStyle = '#557169';
    context.font = '20px sans-serif';
    drawWrappedCanvasText(context, describeRecommendationReason(result), 730, 370, 330, 30);
    context.fillStyle = '#173f35';
    context.font = '18px sans-serif';
    context.fillText('carshareOrNot · marsrakete.de', 120, 520);
    return new Promise(function(resolve, reject){
      canvas.toBlob(function(blob){
        if(blob){
          resolve(blob);
        } else {
          reject(new Error('image'));
        }
      }, 'image/png');
    });
  }

  /**
   * Shares the result image natively when possible and otherwise downloads it.
   * @returns {Promise<void>} Resolves after sharing or downloading the PNG.
   */
  async function shareResultImage(){
    var button = document.getElementById('share-image-btn');
    var status = document.getElementById('share-status');
    button.disabled = true;
    status.textContent = 'Ergebnisgrafik wird erstellt …';
    try{
      var blob = await createResultImageBlob();
      var shareData = null;
      if(typeof File === 'function'){
        var file = new File([blob], 'carshare-ergebnis.png', { type: 'image/png' });
        shareData = { title: 'Auto oder Carsharing?', text: 'Mein persönlicher Kostenvergleich.', files: [file] };
      }
      if(shareData && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare(shareData)){
        await navigator.share(shareData);
        status.textContent = 'Ergebnisgrafik geteilt.';
      } else {
        downloadBlob(blob, 'carshare-ergebnis.png');
        status.textContent = 'Ergebnisgrafik heruntergeladen.';
      }
    }catch(error){
      if(error && error.name === 'AbortError'){
        status.textContent = 'Teilen wurde abgebrochen.';
      } else {
        status.textContent = 'Die Ergebnisgrafik konnte nicht erstellt werden.';
      }
    }finally{
      button.disabled = false;
    }
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
        if(parsed.own) state.own = Object.assign(defaultOwn(), parsed.own);
        if(parsed.usage) state.usage = Object.assign(defaultUsage(), parsed.usage);
        if(parsed.location){
          if(parsed.location.byProvider){
            state.location = defaultLocation();
            state.location.address = parsed.location.address || '';
            Object.keys(parsed.location.byProvider).forEach(function(providerId){
              state.location.byProvider[providerId] = normalizeLocationEntry(parsed.location.byProvider[providerId]);
            });
          } else if(typeof parsed.location.stationCount === 'number'){
            state.location = defaultLocation();
            state.location.address = parsed.location.address || '';
            state.location.byProvider.cambio = {
              stationCount: parsed.location.stationCount, walkMinutes: parsed.location.walkMinutes, source: 'legacy'
            };
          }
        }
        if(parsed.providers && parsed.providers.length){
          state.providers = normalizeTariffData(parsed.providers);
          // Neu hinzugekommene Standard-Anbieter ergänzen, falls ein älterer Stand geladen wird
          defaultProviders().forEach(function(dp){
            if(!state.providers.some(function(p){ return p.id === dp.id; })){
              state.providers.push(dp);
            }
          });
        }
        if(parsed.selection) state.selection = normalizeSelection(parsed.selection);
      }
    }catch(e){ /* kein gespeicherter Stand vorhanden - Standardwerte werden verwendet */ }
  }

  // ---------- Helpers ----------

  /**
   * Formats a number as whole euros for the German locale.
   * @param {number} n - Monetary amount.
   * @returns {string} Localized euro amount.
   */
  function fmtEUR(n){
    if(!isFinite(n)) n = 0;
    return n.toLocaleString('de-DE', {minimumFractionDigits:0, maximumFractionDigits:0}) + ' €';
  }
  /**
   * Formats a number as euros with two decimal places.
   * @param {number} n - Monetary amount.
   * @returns {string} Localized euro amount with cents.
   */
  function fmtEURcents(n){
    if(!isFinite(n)) n = 0;
    return n.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
  }
  /**
   * Finds a provider in the current state.
   * @param {string} id - Provider identifier.
   * @returns {Object|undefined} Matching provider when available.
   */
  function findProvider(id){ return state.providers.find(function(p){ return p.id === id; }); }

  /**
   * Finds a vehicle class within a provider.
   * @param {Object} provider - Provider containing vehicle classes.
   * @param {string} id - Vehicle-class identifier.
   * @returns {Object|undefined} Matching vehicle class when available.
   */
  function findClass(provider, id){ return provider.classes.find(function(c){ return c.id === id; }); }

  /**
   * Finds a tariff within a vehicle class.
   * @param {Object} cls - Vehicle class containing tariffs.
   * @param {string} id - Tariff identifier.
   * @returns {Object|undefined} Matching tariff when available.
   */
  function findTariff(cls, id){ return cls.tariffs.find(function(t){ return t.id === id; }); }

  /**
   * Creates a compact identifier for a user-added data record.
   * @param {string} prefix - Human-readable identifier prefix.
   * @returns {string} Generated identifier.
   */
  function uid(prefix){ return prefix + '_' + Math.random().toString(36).slice(2,9); }

  // ---------- Calculation ----------

  var calculate = window.CarshareCalculator.calculate;

  /**
   * Berechnet entweder die manuelle Tarifauswahl oder den gewählten Empfehlungsmodus.
   * @returns {Object} Vollständiges Ergebnis für die aktuelle Darstellung.
   */
  function calculateResultForState(currentState){
    if(currentState.selection.recommendationMode === MODE_SINGLE || currentState.selection.recommendationMode === MODE_MIX){
      var recommendedResult = recommendationData.calculateRecommendation(currentState);
      if(recommendedResult){
        return recommendedResult;
      }
      var unavailableResult = calculate(currentState);
      unavailableResult.cambio = null;
      unavailableResult.providerName = 'Keine Empfehlung';
      var unavailableTitle = 'Empfehlung – ein Anbieter';
      if(currentState.selection.recommendationMode === MODE_MIX){
        unavailableTitle = 'Empfehlung – Mobilitätsmix';
      }
      unavailableResult.recommendation = {
        mode: currentState.selection.recommendationMode,
        title: unavailableTitle,
        primaryProviderId: '',
        providerIds: [],
        rows: [],
        locationKnown: false,
        unavailable: true
      };
      return unavailableResult;
    }
    return calculate(currentState);
  }

  /**
   * Calculates the result for the current interactive state.
   * @returns {Object} Complete displayed calculation result.
   */
  function calculateDisplayedResult(){
    return calculateResultForState(state);
  }

  // ---------- Rendering: Rechner tab ----------

  /**
   * Copies owned-car state into its form controls.
   * @returns {void}
   */
  function fillOwnInputs(){
    var o = state.own;
    document.getElementById('own_kaufpreis').value = o.kaufpreis;
    document.getElementById('own_haltedauer').value = o.haltedauer;
    document.getElementById('own_restwert').value = o.restwert;
    document.getElementById('own_wartung').value = o.wartung;
    document.getElementById('own_versicherung').value = o.versicherung;
    document.getElementById('own_sonstiges').value = o.sonstiges;
    document.getElementById('own_sonstiges_extra').value = o.sonstigesExtra;
    document.getElementById('own_verbrauch').value = o.verbrauch;
    document.getElementById('own_kraftstoffpreis').value = o.kraftstoffpreis;
    document.getElementById('own_stellplatz').value = o.stellplatz;
    document.getElementById('own_parkausweis').value = o.parkausweis;
  }

  /**
   * Findet eine Nutzungsvorlage anhand ihrer Kennung.
   * @param {string} scenarioId - Kennung der gesuchten Vorlage.
   * @returns {Object|undefined} Passende Nutzungsvorlage.
   */
  function findUsageScenario(scenarioId){
    return usageScenarios.find(function(scenario){ return scenario.id === scenarioId; });
  }

  /**
   * Rendert die sichtbaren Nutzungsvorlagen aus dem wiederverwendbaren Karten-Template.
   * @returns {void}
   */
  function renderUsageScenarios(){
    var browser = document.getElementById('scenario-browser');
    var status = document.getElementById('scenario-status');
    browser.hidden = scenarioPickerCollapsed;
    status.hidden = !scenarioPickerCollapsed;
    if(scenarioPickerCollapsed){
      document.getElementById('scenario-status-text').textContent = 'Vorlage „' + activeScenarioTitle + '“ übernommen.';
      return;
    }

    var visibleCount = 4;
    if(showAllUsageScenarios){
      visibleCount = usageScenarios.length;
    }
    var template = document.getElementById('scenario-card-template');
    var fragment = document.createDocumentFragment();
    for(var index = 0; index < visibleCount; index += 1){
      var scenario = usageScenarios[index];
      var card = template.content.firstElementChild.cloneNode(true);
      card.querySelector('.scenario-icon-use').setAttribute('href', '#' + scenario.iconId);
      card.querySelector('.scenario-title').textContent = scenario.title;
      card.querySelector('.scenario-summary').textContent = scenario.summary;
      var applyButton = card.querySelector('.scenario-apply');
      applyButton.setAttribute('data-scenario-id', scenario.id);
      applyButton.setAttribute('aria-label', 'Vorlage ' + scenario.title + ' übernehmen');
      applyButton.addEventListener('click', function(event){
        applyUsageScenario(event.currentTarget.getAttribute('data-scenario-id'));
      });
      fragment.appendChild(card);
    }
    document.getElementById('scenario-list').replaceChildren(fragment);
    var moreButton = document.getElementById('scenario-more-btn');
    moreButton.setAttribute('aria-expanded', String(showAllUsageScenarios));
    moreButton.textContent = 'Weitere Szenarien anzeigen';
    if(showAllUsageScenarios){
      moreButton.textContent = 'Weniger Szenarien anzeigen';
    }
  }

  /**
   * Übernimmt die Fahrdaten einer Vorlage und bewahrt unabhängige Nutzereinstellungen.
   * @param {string} scenarioId - Kennung der anzuwendenden Vorlage.
   * @returns {void}
   */
  function applyUsageScenario(scenarioId){
    var scenario = findUsageScenario(scenarioId);
    if(!scenario){
      return;
    }
    scenarioUndoUsage = Object.assign({}, state.usage);
    var comparisonYears = state.usage.vergleichsjahre;
    var parkingRequired = state.usage.parkplatz;
    state.usage = Object.assign(defaultUsage(), scenario.values);
    state.usage.vergleichsjahre = comparisonYears;
    state.usage.parkplatz = parkingRequired;
    activeScenarioTitle = scenario.title;
    scenarioPickerCollapsed = true;
    fillUsageInputs();
    renderUsageScenarios();
    render();
    scheduleSave();
  }

  /**
   * Stellt die Nutzungseingaben vom Zeitpunkt vor der letzten Vorlagenwahl wieder her.
   * @returns {void}
   */
  function restoreUsageBeforeScenario(){
    if(!scenarioUndoUsage){
      return;
    }
    state.usage = scenarioUndoUsage;
    scenarioUndoUsage = null;
    activeScenarioTitle = '';
    scenarioPickerCollapsed = false;
    fillUsageInputs();
    renderUsageScenarios();
    render();
    scheduleSave();
  }

  /**
   * Öffnet die Vorlagenauswahl, damit eine andere Ausgangslage gewählt werden kann.
   * @returns {void}
   */
  function reopenUsageScenarios(){
    scenarioPickerCollapsed = false;
    renderUsageScenarios();
  }

  /**
   * Setzt den Fokus auf das erste von einer Vorlage ausgefüllte Nutzungsfeld.
   * @returns {void}
   */
  function focusScenarioUsageValues(){
    var annualMileage = document.getElementById('use_jahreskm');
    annualMileage.focus();
    annualMileage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Klappt die zusätzlichen Nutzungsvorlagen ein oder aus.
   * @returns {void}
   */
  function toggleAdditionalUsageScenarios(){
    showAllUsageScenarios = !showAllUsageScenarios;
    renderUsageScenarios();
  }
  /**
   * Copies usage state into its form controls and updates dependent controls.
   * @returns {void}
   */
  function fillUsageInputs(){
    var u = state.usage;
    document.getElementById('use_jahreskm').value = u.jahreskm;
    document.getElementById('use_vergleichsjahre').value = u.vergleichsjahre;
    document.getElementById('use_kurzfahrten').value = u.kurzfahrten;
    document.getElementById('use_stundenprofahrt').value = u.stundenprofahrt;
    document.getElementById('use_booking_model').value = u.alltagsmodell;
    document.getElementById('use_bringtageprowoche').value = u.bringtageprowoche;
    document.getElementById('use_bringwochenprojahr').value = u.bringwochenprojahr;
    document.getElementById('use_bringkmprotag').value = u.bringkmprotag;
    document.getElementById('use_bringbuchungenprotag').value = u.bringbuchungenprotag;
    document.getElementById('use_bringstundenprobuchung').value = u.bringstundenprobuchung;
    document.getElementById('use_bringseparatanteil').value = u.bringseparatanteil;
    document.getElementById('use_kindersitz').checked = !!u.kindersitz;
    document.getElementById('use_tagesausfluege').value = u.tagesausfluege;
    document.getElementById('use_stundenproausflug').value = u.stundenproausflug;
    document.getElementById('use_kmproausflug').value = u.kmproausflug;
    document.getElementById('use_mehrtagesfahrten').value = u.mehrtagesfahrten;
    document.getElementById('use_tageprofahrt').value = u.tageprofahrt;
    document.getElementById('use_kmprofahrt').value = u.kmprofahrt;
    document.getElementById('use_urlaubsfahrten').value = u.urlaubsfahrten;
    document.getElementById('use_tageprourlaub').value = u.tageprourlaub;
    document.getElementById('use_kmprourlaub').value = u.kmprourlaub;
    document.getElementById('use_freefloating_fit').value = u.freefloatingFit;
    document.getElementById('use_parkplatz').checked = !!u.parkplatz;
    var radios = document.getElementsByName('flex');
    for(var i=0;i<radios.length;i++){ radios[i].checked = (radios[i].value === u.flex); }
    updateStellplatzState(u.parkplatz);
    renderFreeFloatingFitHint();
  }

  /**
   * Erklärt die aktuelle automatische oder manuelle Free-Floating-Einstufung.
   * @returns {void}
   */
  function renderFreeFloatingFitHint(){
    var fit = recommendationData.resolveFreeFloatingFit(state);
    var prefix = 'Für Empfehlungen: ';
    if(fit.selected === recommendationData.FREE_FLOATING_AUTO){
      prefix = 'Automatische Einstufung: ';
    }
    document.getElementById('freefloating-fit-hint').textContent = prefix + fit.reason + '. Die angezeigten Eurobeträge bleiben unverändert.';
  }

  /**
   * Shows whether detailed trip mileage conflicts with the annual mileage.
   * @param {Object} result - Current calculation result.
   * @returns {void}
   */
  function renderUsageValidation(result){
    var validation = document.getElementById('usage-km-validation');
    var messages = [];
    if(result.cambio && result.cambio.mileageAdjusted){
      messages.push('Bring- und Abholfahrten, Tagesausflüge, Mehrtages- und Urlaubsfahrten ergeben zusammen mehr Kilometer als die gesamte Fahrleistung. Für die Berechnung werden diese Strecken anteilig auf die jährliche Fahrleistung begrenzt.');
    }
    if(result.cambio && result.cambio.implicitShortTrip){
      messages.push('Nach Abzug der einzeln erfassten Fahrten bleiben Kilometer übrig, obwohl keine Alltagsfahrten angegeben sind. Diese Strecke wird für die Berechnung als eine Fahrt behandelt.');
    }
    validation.textContent = messages.join(' ');
  }

  /**
   * Switches parking-related inputs and help text for the selected parking mode.
   * @param {boolean} active - Whether a rented guaranteed space is required.
   * @returns {void}
   */
  function updateStellplatzState(active){
    var stellplatzInput = document.getElementById('own_stellplatz');
    var parkausweisInput = document.getElementById('own_parkausweis');
    var hint = document.getElementById('stellplatz-hint');
    stellplatzInput.disabled = !active;
    stellplatzInput.style.opacity = '0.45';
    if(active){
      stellplatzInput.style.opacity = '1';
    }
    parkausweisInput.disabled = active;
    parkausweisInput.style.opacity = '1';
    if(active){
      parkausweisInput.style.opacity = '0.45';
      hint.textContent = 'Die Stellplatzmiete wird zu den jährlichen Fixkosten des eigenen Autos addiert.';
    } else {
      hint.textContent = 'Ohne garantierten Platz gehen wir von Parken auf öffentlichem Grund aus \u2013 dafür zählt stattdessen der Anwohnerparkausweis mit. Zeitaufwand und Stress der Parkplatzsuche sind hier nicht eingepreist, siehe Hinweis rechts.';
    }
  }

  /**
   * Resolves the provider whose location values are currently shown and edited.
   * @param {Object} result - Current calculation or recommendation result.
   * @returns {Object} Selected or recommended provider.
   */
  function getLocationProvider(result){
    var providerId = state.selection.providerId;
    if(state.selection.recommendationMode === MODE_SINGLE && result.recommendation && result.recommendation.primaryProviderId){
      providerId = result.recommendation.primaryProviderId;
    }
    return findProvider(providerId) || state.providers[0];
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
    var pl = getProviderLocation(provider.id);
    var stationFields = document.getElementById('station-location-fields');
    var floatingFields = document.getElementById('free-floating-location-fields');
    var isFreeFloating = provider.operationMode === 'free-floating';
    var locationContextHint = document.getElementById('location-context-hint');
    if(state.selection.recommendationMode === MODE_MANUAL){
      locationContextHint.textContent = 'Die Prüfung richtet sich nach dem oben ausgewählten Anbieter.';
    } else if(state.selection.recommendationMode === MODE_SINGLE){
      locationContextHint.textContent = 'Die Prüfung richtet sich nach dem aktuell empfohlenen Anbieter ' + provider.name + '.';
    } else {
      locationContextHint.textContent = 'Für Empfehlungen zählen die Standortwerte aller Anbieter. Wähle oben vorübergehend einen einzelnen Anbieter, um dessen Werte zu prüfen oder zu ändern.';
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
    return generation === stationSearchGeneration && providerId === provider.id;
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
    var opTimer = null;
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
      var opCtrl = new AbortController();
      opTimer = setTimeout(function(){ opCtrl.abort(); }, 12000);
      var opRes = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', body: 'data=' + encodeURIComponent(query), signal: opCtrl.signal
      });
      clearTimeout(opTimer);
      opTimer = null;
      if(!isCurrentStationSearch(currentGeneration, providerId)){
        return;
      }
      if(!opRes.ok){
        throw new Error('overpass-error');
      }
      var opData = await opRes.json();
      var allStations = opData.elements || [];

      var needle = provider.name.toLowerCase().replace('(vormals share now)', '').trim();
      var aliasMap = { free2move: ['free2move', 'share now', 'sharenow', 'car2go'], sixtshare: ['sixt'] };
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
        statusEl.textContent = 'Automatische Suche gerade nicht möglich. Bitte Anzahl und Gehzeit für ' + provider.name + ' unten manuell eintragen.';
      }
    }finally{
      if(geoTimer !== null){
        clearTimeout(geoTimer);
      }
      if(opTimer !== null){
        clearTimeout(opTimer);
      }
      btn.disabled = false;
    }
  }

  /**
   * Sammelt alle Fahrzeugklassen, die mindestens ein Anbieter anbietet.
   * @returns {Array<Object>} Eindeutige Klassen mit Kennung und Name.
   */
  function getRecommendationClasses(){
    var classesById = {};
    var classes = [];
    state.providers.forEach(function(provider){
      provider.classes.forEach(function(cls){
        if(!classesById[cls.id]){
          classesById[cls.id] = true;
          classes.push({ id: cls.id, name: cls.name });
        }
      });
    });
    return classes;
  }

  /**
   * Fügt einem Auswahlfeld eine Option hinzu.
   * @param {HTMLSelectElement} select - Auswahlfeld, das die Option erhält.
   * @param {string} value - Technischer Optionswert.
   * @param {string} label - Sichtbare Beschriftung.
   * @returns {void}
   */
  function appendSelectOption(select, value, label){
    var option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  /**
   * Gibt alle Anbieter zurück, die am angezeigten Ergebnis beteiligt sind.
   * @param {Object} result - Aktuelles Berechnungs- oder Empfehlungsergebnis.
   * @returns {Array<Object>} Beteiligte Anbieter ohne Duplikate.
   */
  function getResultProviders(result){
    var providerIds = [state.selection.providerId];
    if(result.recommendation && Array.isArray(result.recommendation.providerIds)){
      providerIds = result.recommendation.providerIds;
    }
    var providers = [];
    providerIds.forEach(function(providerId){
      var provider = findProvider(providerId);
      if(provider && providers.indexOf(provider) === -1){
        providers.push(provider);
      }
    });
    return providers;
  }

  /**
   * Prüft, ob mindestens ein am Ergebnis beteiligter Anbieter Free-Floating nutzt.
   * @param {Object} result - Aktuelles Berechnungs- oder Empfehlungsergebnis.
   * @returns {boolean} True, wenn öffentliche Rückgabeplätze zum Modell gehören.
   */
  function resultUsesFreeFloating(result){
    return getResultProviders(result).some(function(provider){ return provider.operationMode === 'free-floating'; });
  }

  /**
   * Prüft, ob mindestens ein am Ergebnis beteiligter Anbieter stationsbasiert arbeitet.
   * @param {Object} result - Aktuelles Berechnungs- oder Empfehlungsergebnis.
   * @returns {boolean} True, wenn feste Stationen zum Ergebnis gehören.
   */
  function resultUsesStations(result){
    return getResultProviders(result).some(function(provider){ return provider.operationMode !== 'free-floating'; });
  }

  /**
   * Rebuilds provider, vehicle-class and tariff selects from current state.
   * @param {Object} result - Bereits berechnetes Ergebnis für dynamische Empfehlungstexte.
   * @returns {void}
   */
  function populateSelects(result){
    var provSel = document.getElementById('sel_provider');
    var classSel = document.getElementById('sel_class');
    var tariffSel = document.getElementById('sel_tariff');

    provSel.replaceChildren();
    appendSelectOption(provSel, MODE_SINGLE, 'Empfehlung – ein Anbieter');
    appendSelectOption(provSel, MODE_MIX, 'Empfehlung – Mobilitätsmix');
    state.providers.forEach(function(p){
      appendSelectOption(provSel, p.id, p.name);
    });
    document.getElementById('provider-select-row').style.display = 'grid';

    if(!findProvider(state.selection.providerId)) state.selection.providerId = state.providers[0].id;
    if(state.selection.recommendationMode === MODE_SINGLE || state.selection.recommendationMode === MODE_MIX){
      provSel.value = state.selection.recommendationMode;
    } else {
      provSel.value = state.selection.providerId;
    }

    var provider = findProvider(state.selection.providerId);
    var availableClasses = provider.classes;
    if(state.selection.recommendationMode === MODE_SINGLE || state.selection.recommendationMode === MODE_MIX){
      availableClasses = getRecommendationClasses();
    }
    classSel.replaceChildren();
    availableClasses.forEach(function(c){
      appendSelectOption(classSel, c.id, c.name);
    });
    var classAvailable = availableClasses.some(function(cls){ return cls.id === state.selection.classId; });
    if(!classAvailable) state.selection.classId = availableClasses[0].id;
    classSel.value = state.selection.classId;

    tariffSel.replaceChildren();
    tariffSel.disabled = false;
    if(state.selection.recommendationMode === MODE_SINGLE){
      var recommendedTariffLabel = 'Kein verfügbarer Tarif';
      if(result.cambio){
        recommendedTariffLabel = result.providerName + ' · ' + result.cambio.tariffName;
      }
      appendSelectOption(tariffSel, 'automatic', recommendedTariffLabel);
      tariffSel.disabled = true;
    } else if(state.selection.recommendationMode === MODE_MIX){
      appendSelectOption(tariffSel, 'automatic', 'Passende Tarife je Fahrtart');
      tariffSel.disabled = true;
    } else {
      var cls = findClass(provider, state.selection.classId);
      cls.tariffs.forEach(function(t){
        appendSelectOption(tariffSel, t.id, t.name);
      });
      if(!findTariff(cls, state.selection.tariffId)) state.selection.tariffId = cls.tariffs[0].id;
      tariffSel.value = state.selection.tariffId;
    }
  }

  /**
   * Derives explanatory cards from costs, availability and usage preferences.
   * @param {Object} r - Current cost calculation result.
   * @returns {Array<Object>} Insight cards with tone, title and text.
   */
  function computeInsights(r){
    var locationProviderId = state.selection.providerId;
    if(r.recommendation && r.recommendation.primaryProviderId){
      locationProviderId = r.recommendation.primaryProviderId;
    }
    var loc = getProviderLocation(locationProviderId), u = state.usage;
    var cards = [];

    // Flexibilität anhand Stationsdichte und Gehzeit
    var flexHint = {
      spontan: ' Da du oft spontan losfährst, wirkt sich die Stationsnähe hier besonders stark aus.',
      teilweise: '',
      planbar: ' Da deine Fahrten meist planbar sind, lässt sich das per Vorausbuchung gut ausgleichen.'
    }[u.flex] || '';

    var selectedLocationProvider = findProvider(locationProviderId);
    var locationIsFreeFloating = selectedLocationProvider && selectedLocationProvider.operationMode === 'free-floating';
    if(r.recommendation && r.recommendation.unavailable){
      cards.push({ tone: 'bad', title: 'Keine verfügbare Empfehlung',
        text: 'Für diese Fahrzeugklasse sind alle passenden Anbieter am bestätigten Standort ausgeschlossen.' });
    } else if(r.recommendation && !r.recommendation.locationKnown){
      var missingLocationText = 'Für mindestens einen vorgeschlagenen Anbieter fehlen bestätigte Standortwerte. Prüfe die Verfügbarkeit vor deiner Entscheidung.';
      if(resultUsesFreeFloating(r) && !resultUsesStations(r)){
        missingLocationText = 'Für mindestens einen vorgeschlagenen Free-Floating-Anbieter ist das Geschäftsgebiet noch nicht bestätigt. Prüfe es vor deiner Entscheidung in der Anbieter-App.';
      }
      cards.push({ tone: 'mid', title: 'Rein rechnerische Empfehlung',
        text: missingLocationText });
    } else if(r.recommendation && r.recommendation.locationKnown){
      cards.push({ tone: 'good', title: 'Verfügbarkeit geprüft',
        text: 'Für alle vorgeschlagenen Anbieter liegen bestätigte Stations- und Gehzeitwerte vor. Innerhalb der verfügbaren Angebote entscheidet der Preis.' });
    } else if(locationIsFreeFloating && loc.serviceAvailable === null){
      cards.push({ tone: 'mid', title: 'Geschäftsgebiet noch nicht geprüft',
        text: 'Prüfe in der Anbieter-App, ob dein Standort im Geschäftsgebiet liegt und aktuell Fahrzeuge in erreichbarer Nähe stehen.' + flexHint });
    } else if(locationIsFreeFloating && loc.serviceAvailable === false){
      cards.push({ tone: 'bad', title: 'Free-Floating nicht verfügbar',
        text: 'Der ausgewählte Anbieter hat an deinem Standort kein nutzbares Geschäftsgebiet.' + flexHint });
    } else if(locationIsFreeFloating && loc.serviceAvailable === true){
      cards.push({ tone: 'good', title: 'Free-Floating ist grundsätzlich verfügbar',
        text: 'Fahrzeuge stehen verteilt im Geschäftsgebiet. Die tatsächliche Entfernung und Verfügbarkeit prüfst du vor jeder Fahrt in der Anbieter-App.' + flexHint });
    } else if(loc.source === 'unknown'){
      cards.push({ tone: 'mid', title: 'Standort noch nicht bewertet',
        text: 'Suche nach Stationen oder trage Stationszahl und Gehzeit ein. Erst danach kann die Verfügbarkeit des ausgewählten Anbieters bewertet werden.' + flexHint });
    } else if(loc.source === 'legacy'){
      cards.push({ tone: 'mid', title: 'Gespeicherte Standortwerte bitte bestätigen',
        text: 'Diese Werte stammen aus einer älteren Version und werden erst nach einer manuellen Änderung oder neuen Suche für die Bewertung verwendet.' + flexHint });
    } else if(loc.stationCount === null){
      cards.push({ tone: 'mid', title: 'Stationszahl fehlt noch',
        text: 'Ergänze die Zahl der Stationen im Umkreis, damit die Verfügbarkeit bewertet werden kann.' + flexHint });
    } else if(loc.stationCount > 0 && loc.walkMinutes === null){
      cards.push({ tone: 'mid', title: 'Gehzeit fehlt noch',
        text: 'Ergänze die Gehzeit zur nächsten Station, damit die Verfügbarkeit bewertet werden kann.' + flexHint });
    } else if(loc.stationCount >= 3 && loc.walkMinutes <= 10){
      cards.push({ tone: 'good', title: 'Du bist damit flexibel',
        text: loc.stationCount + ' Stationen in der Nähe, die nächste rund ' + loc.walkMinutes + ' Gehminuten entfernt. Spontane Fahrten sind gut möglich.' + flexHint });
    } else if(loc.stationCount >= 1 && loc.walkMinutes <= 20){
      cards.push({ tone: 'mid', title: 'Eingeschränkt flexibel',
        text: 'Nur ' + loc.stationCount + ' Station(en) in der Nähe, rund ' + loc.walkMinutes + ' Gehminuten entfernt. Für spontane Fahrten solltest du etwas Vorlauf einplanen.' + flexHint });
    } else if(loc.stationCount === 0){
      cards.push({ tone: 'bad', title: 'Keine Station in der Nähe',
        text: 'Keine Station des ausgewählten Anbieters im angegebenen Umkreis gefunden.' + flexHint });
    } else {
      cards.push({ tone: 'bad', title: 'Eingeschränkt, weil der nächste Standort zu weit ist',
        text: loc.stationCount + ' Station(en) in der Nähe. Bei rund ' + loc.walkMinutes + ' Gehminuten bis zur nächsten Station ist Carsharing für spontane Fahrten wenig praktikabel.' + flexHint });
    }

    if(r.cambio && u.bringtageprowoche > 0 && u.bringwochenprojahr > 0){
      var schoolRunTone = 'good';
      var schoolRunTitle = 'Bring- und Abholfahrten sind eingerechnet';
      var schoolRunNotes = [];
      var schoolRunDays = Math.round(u.bringtageprowoche * u.bringwochenprojahr);
      var schoolRunBookings = Math.round(r.cambio.schoolRunTrips);
      if(loc.source === 'unknown' || loc.source === 'legacy' || loc.stationCount === null || loc.walkMinutes === null){
        schoolRunTone = 'mid';
        schoolRunTitle = 'Zeitkritische Bringfahrten brauchen Planung';
        schoolRunNotes.push('Prüfe die Fahrzeugverfügbarkeit zu den festen Bring- und Abholzeiten.');
      } else if(loc.stationCount === 0 || loc.walkMinutes > 10){
        schoolRunTone = 'mid';
        schoolRunTitle = 'Der Stationsweg erschwert regelmäßige Bringfahrten';
        schoolRunNotes.push('Der Weg zur Station kommt bei jeder einzelnen Buchung zur Fahrzeit hinzu.');
      }
      if(u.kindersitz){
        schoolRunTone = 'mid';
        schoolRunTitle = 'Kindersitz und Verfügbarkeit vorher klären';
        schoolRunNotes.push('Ein passender Kindersitz ist bei Carsharing-Fahrzeugen nicht selbstverständlich; auch Transport und Aufbewahrung können zusätzlichen Aufwand verursachen.');
      }
      if(u.bringseparatanteil < 100){
        schoolRunNotes.push('Der kombinierte Anteil wird anderen ohnehin stattfindenden Wegen zugerechnet.');
      }
      cards.push({
        tone: schoolRunTone,
        title: schoolRunTitle,
        text: schoolRunDays + ' Bring-/Abholtage ergeben rund ' + schoolRunBookings + ' eigenständige Buchungen und ' + fmtEUR(r.cambio.schoolRunCost) + ' Fahrtkosten pro Jahr. ' + schoolRunNotes.join(' ')
      });
    }

    // Wochenend-/Mehrtagesfahrten: Kostenanteil vs. Kilometeranteil
    if(r.cambio && u.mehrtagesfahrten > 0 && u.jahreskm > 0){
      var kmShare = r.cambio.multiKm / u.jahreskm;
      var costShare = 0;
      if(r.cambio.total > 0){
        costShare = r.cambio.multiCost / r.cambio.total;
      }
      var kmPct = Math.round(kmShare * 100), costPct = Math.round(costShare * 100);
      if(costShare - kmShare > 0.15 || costShare > 0.4){
        cards.push({ tone: 'mid', title: 'Wochenend- und Mehrtagesfahrten sind teuer',
          text: 'Deine ' + u.mehrtagesfahrten + ' Mehrtagesfahrten pro Jahr machen ' + kmPct + '\u00A0% deiner Kilometer aus, aber ' + costPct + '\u00A0% der Kosten bei ' + r.providerName +
                ' (' + fmtEUR(r.cambio.multiCost) + '/Jahr). Für solche Fahrten kann sich ein klassischer Mietwagen oder ein eigenes Auto eher lohnen.' });
      } else {
        cards.push({ tone: 'good', title: 'Mehrtagesfahrten fallen nicht überproportional ins Gewicht',
          text: 'Deine ' + u.mehrtagesfahrten + ' Mehrtagesfahrten pro Jahr verursachen ' + costPct + '\u00A0% der Kosten bei ' + r.providerName + ' \u2013 das entspricht in etwa ihrem Kilometeranteil.' });
      }
    }

    if(r.cambio && u.urlaubsfahrten > 0 && u.jahreskm > 0){
      var vacationKmShare = r.cambio.vacationKm / u.jahreskm;
      var vacationCostShare = 0;
      if(r.cambio.total > 0){
        vacationCostShare = r.cambio.vacationCost / r.cambio.total;
      }
      var vacationKmPct = Math.round(vacationKmShare * 100);
      var vacationCostPct = Math.round(vacationCostShare * 100);
      var vacationTripLabel = 'Urlaubsfahrten';
      var vacationVerb = 'verursachen';
      if(u.urlaubsfahrten === 1){
        vacationTripLabel = 'Urlaubsfahrt';
        vacationVerb = 'verursacht';
      }
      var vacationTone = 'good';
      var vacationTitle = 'Urlaubsfahrten bleiben im Verhältnis';
      var vacationAdvice = 'Die Kosten liegen ungefähr im Verhältnis zu ihrem Kilometeranteil.';
      if(vacationCostShare - vacationKmShare > 0.15 || vacationCostShare > 0.4){
        vacationTone = 'mid';
        vacationTitle = 'Urlaubsfahrten prägen die Carsharing-Kosten';
        vacationAdvice = 'Für diese langen Buchungen lohnt sich zusätzlich ein Vergleich mit klassischen Mietwagenangeboten.';
      }
      cards.push({
        tone: vacationTone,
        title: vacationTitle,
        text: 'Deine ' + u.urlaubsfahrten + ' ' + vacationTripLabel + ' ' + vacationVerb + ' ' + vacationKmPct + '\u00A0% der Kilometer und ' + vacationCostPct + '\u00A0% der Kosten bei ' + r.providerName + ' (' + fmtEUR(r.cambio.vacationCost) + '/Jahr). ' + vacationAdvice
      });
    }

    // Parkplatzsuche ohne garantierten Platz: Nachteil beim eigenen Auto benennen
    if(!u.parkplatz && r.cambio){
      var parkingPermitText = '';
      if(state.own.parkausweis > 0){
        parkingPermitText = 'Der Anwohnerparkausweis (' + fmtEUR(state.own.parkausweis) + '/Jahr) ist bereits in den Autokosten eingerechnet, der Zeitaufwand selbst aber nicht. ';
      }
      var parkingComparison = '';
      var usesFreeFloating = resultUsesFreeFloating(r);
      var usesStations = resultUsesStations(r);
      if(!usesFreeFloating && !usesStations){
        parkingComparison = 'Da keine Carsharing-Fahrten anfallen, entsteht auf dieser Seite auch keine Parkplatzsuche.';
      } else if(usesFreeFloating && usesStations){
        parkingComparison = 'Im vorgeschlagenen Mix haben stationsbasierte Fahrzeuge einen festen Rückgabeort. Bei Free-Floating musst du dagegen selbst einen legalen öffentlichen Stellplatz im Geschäftsgebiet finden; zulässige Parkgebühren übernimmt der Anbieter nach seinen lokalen Regeln.';
      } else if(usesFreeFloating){
        parkingComparison = 'Auch bei ' + r.providerName + ' musst du zum Fahrtende selbst einen legalen öffentlichen Stellplatz im Geschäftsgebiet finden. Zulässige Parkgebühren übernimmt der Anbieter nach seinen lokalen Regeln, die Parkplatzsuche bleibt aber bestehen.';
      } else {
        parkingComparison = 'Bei ' + r.providerName + ' bringst du das Fahrzeug zu einem vorgesehenen Rückgabeort zurück. Die Suche nach einem eigenen Dauerparkplatz entfällt damit weitgehend.';
      }
      cards.push({ tone: 'mid', title: 'Parkplatzsuche realistisch vergleichen',
        text: 'Ohne garantierten Platz kostet die tägliche Parkplatzsuche auf öffentlichem Grund Zeit und Nerven, gerade abends in dicht bebauten Vierteln. ' +
              parkingPermitText + parkingComparison });
    }

    return cards;
  }

  /**
   * Renders insight cards with safe text nodes cloned from a template.
   * @param {Object} r - Current cost calculation result.
   * @returns {void}
   */
  function renderInsights(r){
    var el = document.getElementById('insights');
    var cards = computeInsights(r);
    var template = document.getElementById('insight-card-template');
    var fragment = document.createDocumentFragment();
    cards.forEach(function(card){
      var element = template.content.firstElementChild.cloneNode(true);
      element.classList.add('tone-' + card.tone);
      element.querySelector('.insight-title').textContent = card.title;
      element.querySelector('.insight-text').textContent = card.text;
      fragment.appendChild(element);
    });
    el.replaceChildren(fragment);
  }

  /**
   * Renders annual carsharing costs split by usage category.
   * @param {Object} result - Current cost calculation result.
   * @returns {void}
   */
  function renderTripCostBreakdown(result){
    var container = document.getElementById('trip-cost-breakdown');
    var template = document.getElementById('trip-cost-row-template');
    var fragment = document.createDocumentFragment();
    var rows = [
      { key: 'everyday', label: 'Alltagsfahrten' },
      { key: 'schoolRuns', label: 'Bring- und Abholfahrten' },
      { key: 'dayTrips', label: 'Tagesausflüge' },
      { key: 'multiDay', label: 'Mehrtagesfahrten' },
      { key: 'vacations', label: 'Urlaubsfahrten' }
    ];

    for(var index = 0; index < rows.length; index += 1){
      var row = rows[index];
      var value = 0;
      if(result.cambio && result.cambio.tripCategories[row.key]){
        value = result.cambio.tripCategories[row.key].total;
      }
      var element = template.content.firstElementChild.cloneNode(true);
      element.querySelector('.trip-cost-label').textContent = row.label;
      element.querySelector('.trip-cost-value').textContent = fmtEUR(value);
      fragment.appendChild(element);
    }
    container.replaceChildren(fragment);
  }

  /**
   * Zeichnet die Kostenanteile von eigenem Auto und Carsharing als gestapelte Balken.
   * @param {Object} result - Aktuelles Berechnungsergebnis.
   * @returns {void}
   */
  function renderCostComposition(result){
    var container = document.getElementById('cost-composition-bars');
    var template = document.getElementById('cost-composition-row-template');
    var rows = [{ name: 'Eigenes Auto', values: result.own }];
    if(result.cambio){
      rows.push({ name: result.providerName, values: result.cambio });
    }
    var fragment = document.createDocumentFragment();
    rows.forEach(function(row){
      var element = template.content.firstElementChild.cloneNode(true);
      var total = Math.max(row.values.total, 0);
      var fixPercent = 0;
      var timePercent = 0;
      var distancePercent = 0;
      if(total > 0){
        fixPercent = Math.max(row.values.fix, 0) / total * 100;
        timePercent = Math.max(row.values.fuel, 0) / total * 100;
        distancePercent = Math.max(row.values.km, 0) / total * 100;
      }
      element.querySelector('.cost-composition-name').textContent = row.name;
      element.querySelector('.cost-composition-total').textContent = fmtEUR(total);
      element.querySelector('.segment-fix').style.width = fixPercent + '%';
      element.querySelector('.segment-time').style.width = timePercent + '%';
      element.querySelector('.segment-distance').style.width = distancePercent + '%';
      element.querySelector('.cost-stack').setAttribute('aria-label', row.name + ': ' + Math.round(fixPercent) + ' Prozent Fixkosten, ' + Math.round(timePercent) + ' Prozent Fahrzeit oder Kraftstoff und ' + Math.round(distancePercent) + ' Prozent Kilometerkosten.');
      fragment.appendChild(element);
    });
    container.replaceChildren(fragment);
  }

  /**
   * Zeigt Rangliste oder Tarifzuordnung für das berechnete Empfehlungsergebnis.
   * @param {Object} result - Aktuelles Berechnungsergebnis mit optionaler Empfehlung.
   * @returns {void}
   */
  function renderRecommendation(result){
    var panel = document.getElementById('recommendation-panel');
    var list = document.getElementById('recommendation-list');
    if(!result.recommendation){
      panel.hidden = true;
      list.replaceChildren();
      return;
    }

    panel.hidden = false;
    document.getElementById('recommendation-title').textContent = result.recommendation.title;
    var basis = '';
    if(result.recommendation.unavailable){
      basis = 'Für die gewählte Fahrzeugklasse bleibt nach den bestätigten Standortangaben kein verfügbarer Anbieter übrig.';
    } else {
      basis = 'Grundgebühren und anteilige Anmeldegebühren sind im Gesamtergebnis enthalten. ';
      if(result.recommendation.locationKnown){
        basis += 'Bestätigte Verfügbarkeit wurde als Ausschlusskriterium berücksichtigt.';
      } else {
        basis += 'Die Empfehlung ist rein rechnerisch, solange Standortwerte fehlen.';
      }
      if(result.recommendation.fitSummary){
        basis += ' Free-Floating wird für die Reihenfolge ' + result.recommendation.fitSummary + '; die tatsächlichen Kosten bleiben unverändert.';
      }
    }
    document.getElementById('recommendation-basis').textContent = basis;

    var template = document.getElementById('recommendation-row-template');
    var fragment = document.createDocumentFragment();
    result.recommendation.rows.forEach(function(row, index){
      var element = template.content.firstElementChild.cloneNode(true);
      var label = row.label;
      if(result.recommendation.mode === MODE_SINGLE){
        label = (index + 1) + '. ' + label;
      }
      element.querySelector('.recommendation-label').textContent = label;
      var detail = row.detail || '';
      if(row.freshnessNote){
        if(detail){
          detail += ' · ';
        }
        detail += row.freshnessNote;
      }
      element.querySelector('.recommendation-detail').textContent = detail;
      element.querySelector('.recommendation-cost').textContent = fmtEUR(row.cost);
      fragment.appendChild(element);
    });
    list.replaceChildren(fragment);
  }

  /**
   * Calculates transparent low and high estimates around the current result.
   * @param {Object} result - Current calculation result.
   * @returns {Object} Low and high values for owned car and selected alternative.
   */
  function calculateUncertaintyRange(result){
    var ownVariation = state.own.wartung * 0.25 + result.own.fuel * 0.1;
    var providerVariation = 0;
    if(result.cambio){
      providerVariation = result.cambio.total * 0.1;
    }
    return {
      ownLow: Math.max(result.own.total - ownVariation, 0),
      ownHigh: result.own.total + ownVariation,
      providerLow: Math.max(result.cambio.total - providerVariation, 0),
      providerHigh: result.cambio.total + providerVariation
    };
  }

  /**
   * Calculates the annual mileage at which owned car and selected alternative cost roughly the same.
   * @returns {number|null} Approximate break-even mileage or null outside the search range.
   */
  function calculateBreakEvenMileage(){
    var lowMileage = 0;
    var highMileage = 50000;
    var lowState = Object.assign({}, state, { usage: Object.assign({}, state.usage, { jahreskm: lowMileage }) });
    var highState = Object.assign({}, state, { usage: Object.assign({}, state.usage, { jahreskm: highMileage }) });
    var lowResult = calculateResultForState(lowState);
    var highResult = calculateResultForState(highState);
    if(!lowResult.cambio || !highResult.cambio){
      return null;
    }
    var lowDifference = lowResult.own.total - lowResult.cambio.total;
    var highDifference = highResult.own.total - highResult.cambio.total;
    if(lowDifference === 0){
      return 0;
    }
    if(lowDifference * highDifference > 0){
      return null;
    }
    for(var iteration = 0; iteration < 18; iteration += 1){
      var middleMileage = (lowMileage + highMileage) / 2;
      var middleState = Object.assign({}, state, { usage: Object.assign({}, state.usage, { jahreskm: middleMileage }) });
      var middleResult = calculateResultForState(middleState);
      var middleDifference = middleResult.own.total - middleResult.cambio.total;
      if(lowDifference * middleDifference <= 0){
        highMileage = middleMileage;
      } else {
        lowMileage = middleMileage;
        lowDifference = middleDifference;
      }
    }
    return Math.round((lowMileage + highMileage) / 200) * 100;
  }

  /**
   * Creates a concise explanation of the most important result drivers.
   * @param {Object} result - Current calculation result.
   * @returns {string} User-facing explanation.
   */
  function describeRecommendationReason(result){
    if(!result.cambio){
      return 'Sobald ein passender Tarif verfügbar ist, werden hier die entscheidenden Kostentreiber erklärt.';
    }
    var difference = result.own.total - result.cambio.total;
    var fixedDifference = result.own.fix - result.cambio.fix;
    var ownVariableCost = result.own.fuel;
    var providerVariableCost = result.cambio.fuel + result.cambio.km;
    var variableDifference = ownVariableCost - providerVariableCost;
    var reason = '';
    if(Math.abs(fixedDifference) >= Math.abs(variableDifference)){
      reason = 'Der stärkste Kostentreiber sind die Fixkosten: ' + fmtEUR(result.own.fix) + ' fürs eigene Auto gegenüber ' + fmtEUR(result.cambio.fix) + ' für die Alternative. ';
    } else {
      reason = 'Den größten Ausschlag geben die nutzungsabhängigen Kosten: ' + fmtEUR(ownVariableCost) + ' fürs eigene Auto gegenüber ' + fmtEUR(providerVariableCost) + ' für die Alternative. ';
    }
    if(difference >= 0){
      reason += result.providerName + ' liegt aktuell rund ' + fmtEUR(difference) + ' darunter.';
    } else {
      reason += 'Die gewählte Alternative liegt aktuell rund ' + fmtEUR(Math.abs(difference)) + ' darüber.';
    }
    if(state.usage.alltagsmodell === 'one-way'){
      reason += ' Deine Einwegfahrten begünstigen flexible Rückgabeformen.';
    }
    return reason;
  }

  /**
   * Renders uncertainty, break-even mileage and the recommendation explanation.
   * @param {Object} result - Current calculation result.
   * @returns {void}
   */
  function renderDecisionDetails(result){
    var ownRangeElement = document.getElementById('uncertainty-own');
    var alternativeRangeElement = document.getElementById('uncertainty-alternative');
    var breakEvenElement = document.getElementById('break-even-value');
    document.getElementById('recommendation-reason').textContent = describeRecommendationReason(result);
    if(!result.cambio){
      ownRangeElement.textContent = 'Noch kein Vergleich';
      alternativeRangeElement.textContent = 'Noch kein Vergleich';
      breakEvenElement.textContent = 'Nicht berechenbar';
      return;
    }
    var range = calculateUncertaintyRange(result);
    ownRangeElement.textContent = fmtEUR(range.ownLow) + '–' + fmtEUR(range.ownHigh);
    alternativeRangeElement.textContent = fmtEUR(range.providerLow) + '–' + fmtEUR(range.providerHigh);
    var breakEvenMileage = calculateBreakEvenMileage();
    if(breakEvenMileage === null){
      breakEvenElement.textContent = 'Außerhalb 0–50.000 km';
    } else {
      breakEvenElement.textContent = breakEvenMileage.toLocaleString('de-DE') + ' km/Jahr';
    }
  }

  /**
   * Recalculates and renders the complete comparison view.
   * @returns {void}
   */
  function render(){
    var r = calculateDisplayedResult();
    populateSelects(r);
    fillLocationInputs(r);

    var headline = document.getElementById('headline-figure');
    var sub = document.getElementById('headline-sub');

    if(r.cambio){
      var diff = r.own.total - r.cambio.total;
      headline.textContent = fmtEUR(Math.abs(diff)) + ' / Jahr';
      if(diff >= 0){
        headline.className = 'headline-figure win';
        sub.textContent = r.providerName + ' spart dir das gegenüber dem eigenen Auto.';
      } else {
        headline.className = 'headline-figure lose';
        sub.textContent = 'Das eigene Auto ist günstiger als ' + r.providerName + '.';
      }
    } else {
      headline.textContent = fmtEUR(r.own.total) + ' / Jahr';
      headline.className = 'headline-figure';
      if(r.recommendation && r.recommendation.unavailable){
        sub.textContent = 'Für die gewählte Fahrzeugklasse ist kein bestätigter Anbieter verfügbar.';
      } else {
        sub.textContent = 'Lege rechts einen Carsharing-Tarif an, um zu vergleichen.';
      }
    }

    var providerTotal = 0;
    if(r.cambio){
      providerTotal = r.cambio.total;
    }
    var maxVal = Math.max(r.own.total, providerTotal, 1);
    document.getElementById('bar-own-value').textContent = fmtEUR(r.own.total);
    document.getElementById('bar-own').style.width = (r.own.total / maxVal * 100) + '%';

    var cambioLabel = document.getElementById('bar-cambio-label');
    var cambioColHead = document.getElementById('cambio-col-head');
    cambioLabel.textContent = r.providerName;
    cambioColHead.textContent = r.providerName;

    if(r.cambio){
      document.getElementById('bar-cambio-value').textContent = fmtEUR(r.cambio.total);
      document.getElementById('bar-cambio').style.width = (r.cambio.total / maxVal * 100) + '%';
    } else {
      document.getElementById('bar-cambio-value').textContent = '–';
      document.getElementById('bar-cambio').style.width = '0%';
    }

    document.getElementById('row-fix-own').textContent = fmtEUR(r.own.fix);
    document.getElementById('row-fuel-own').textContent = fmtEUR(r.own.fuel);
    document.getElementById('row-km-own').textContent = 'in Kraftstoff enthalten';
    document.getElementById('row-perkm-own').textContent = fmtEURcents(r.own.perKm);
    document.getElementById('row-total-own').textContent = fmtEUR(r.own.total);

    if(r.cambio){
      document.getElementById('row-fix-cambio').textContent = fmtEUR(r.cambio.fix);
      document.getElementById('row-fuel-cambio').textContent = fmtEUR(r.cambio.fuel);
      document.getElementById('row-km-cambio').textContent = fmtEUR(r.cambio.km);
      document.getElementById('row-perkm-cambio').textContent = fmtEURcents(r.cambio.perKm);
      document.getElementById('row-total-cambio').textContent = fmtEUR(r.cambio.total);
    } else {
      ['row-fix-cambio','row-fuel-cambio','row-km-cambio','row-perkm-cambio','row-total-cambio'].forEach(function(id){
        document.getElementById(id).textContent = '–';
      });
    }

    renderUsageValidation(r);
    renderRecommendation(r);
    renderCostComposition(r);
    renderTripCostBreakdown(r);
    renderDecisionDetails(r);
    renderInsights(r);
  }

  /**
   * Copies owned-car form values into application state.
   * @returns {void}
   */
  function readOwnFromInputs(){
    state.own = {
      kaufpreis: +document.getElementById('own_kaufpreis').value || 0,
      haltedauer: +document.getElementById('own_haltedauer').value || 1,
      restwert: +document.getElementById('own_restwert').value || 0,
      wartung: +document.getElementById('own_wartung').value || 0,
      versicherung: +document.getElementById('own_versicherung').value || 0,
      sonstiges: +document.getElementById('own_sonstiges').value || 0,
      sonstigesExtra: +document.getElementById('own_sonstiges_extra').value || 0,
      verbrauch: +document.getElementById('own_verbrauch').value || 0,
      kraftstoffpreis: +document.getElementById('own_kraftstoffpreis').value || 0,
      stellplatz: +document.getElementById('own_stellplatz').value || 0,
      parkausweis: +document.getElementById('own_parkausweis').value || 0
    };
  }
  /**
   * Copies usage form values into application state.
   * @returns {void}
   */
  function readUsageFromInputs(){
    var flex = 'teilweise';
    var radios = document.getElementsByName('flex');
    for(var i=0;i<radios.length;i++){ if(radios[i].checked) flex = radios[i].value; }
    state.usage = {
      jahreskm: +document.getElementById('use_jahreskm').value || 0,
      vergleichsjahre: +document.getElementById('use_vergleichsjahre').value || 1,
      kurzfahrten: +document.getElementById('use_kurzfahrten').value || 0,
      stundenprofahrt: +document.getElementById('use_stundenprofahrt').value || 0,
      alltagsmodell: document.getElementById('use_booking_model').value,
      bringtageprowoche: +document.getElementById('use_bringtageprowoche').value || 0,
      bringwochenprojahr: +document.getElementById('use_bringwochenprojahr').value || 0,
      bringkmprotag: +document.getElementById('use_bringkmprotag').value || 0,
      bringbuchungenprotag: +document.getElementById('use_bringbuchungenprotag').value || 0,
      bringstundenprobuchung: +document.getElementById('use_bringstundenprobuchung').value || 0,
      bringseparatanteil: +document.getElementById('use_bringseparatanteil').value || 0,
      kindersitz: document.getElementById('use_kindersitz').checked,
      tagesausfluege: +document.getElementById('use_tagesausfluege').value || 0,
      stundenproausflug: +document.getElementById('use_stundenproausflug').value || 0,
      kmproausflug: +document.getElementById('use_kmproausflug').value || 0,
      mehrtagesfahrten: +document.getElementById('use_mehrtagesfahrten').value || 0,
      tageprofahrt: +document.getElementById('use_tageprofahrt').value || 0,
      kmprofahrt: +document.getElementById('use_kmprofahrt').value || 0,
      urlaubsfahrten: +document.getElementById('use_urlaubsfahrten').value || 0,
      tageprourlaub: +document.getElementById('use_tageprourlaub').value || 0,
      kmprourlaub: +document.getElementById('use_kmprourlaub').value || 0,
      freefloatingFit: document.getElementById('use_freefloating_fit').value,
      flex: flex,
      parkplatz: document.getElementById('use_parkplatz').checked
    };
  }

  /**
   * Binds comparison-form controls to state, rendering and persistence.
   * @returns {void}
   */
  function bindRechnerEvents(){
    var ownIds = ['own_kaufpreis','own_haltedauer','own_restwert','own_wartung','own_versicherung','own_sonstiges','own_sonstiges_extra','own_verbrauch','own_kraftstoffpreis','own_stellplatz','own_parkausweis'];
    var useIds = [
      'use_jahreskm','use_vergleichsjahre','use_kurzfahrten','use_stundenprofahrt',
      'use_bringtageprowoche','use_bringwochenprojahr','use_bringkmprotag','use_bringbuchungenprotag','use_bringstundenprobuchung','use_bringseparatanteil',
      'use_tagesausfluege','use_stundenproausflug','use_kmproausflug',
      'use_mehrtagesfahrten','use_tageprofahrt','use_kmprofahrt',
      'use_urlaubsfahrten','use_tageprourlaub','use_kmprourlaub'
    ];

    ownIds.forEach(function(id){
      document.getElementById(id).addEventListener('input', function(){ readOwnFromInputs(); render(); scheduleSave(); });
    });
    useIds.forEach(function(id){
      document.getElementById(id).addEventListener('input', function(){ readUsageFromInputs(); renderFreeFloatingFitHint(); render(); scheduleSave(); });
    });
    document.getElementsByName('flex').forEach(function(r){
      r.addEventListener('change', function(){ readUsageFromInputs(); render(); scheduleSave(); });
    });
    document.getElementById('use_parkplatz').addEventListener('change', function(){ readUsageFromInputs(); render(); scheduleSave(); });
    document.getElementById('use_kindersitz').addEventListener('change', function(){ readUsageFromInputs(); renderFreeFloatingFitHint(); render(); scheduleSave(); });
    document.getElementById('use_freefloating_fit').addEventListener('change', function(){ readUsageFromInputs(); renderFreeFloatingFitHint(); render(); scheduleSave(); });
    document.getElementById('use_booking_model').addEventListener('change', function(){ readUsageFromInputs(); render(); scheduleSave(); });
    document.getElementById('scenario-more-btn').addEventListener('click', toggleAdditionalUsageScenarios);
    document.getElementById('scenario-change-btn').addEventListener('click', reopenUsageScenarios);
    document.getElementById('scenario-values-btn').addEventListener('click', focusScenarioUsageValues);
    document.getElementById('scenario-undo-btn').addEventListener('click', restoreUsageBeforeScenario);

    document.getElementById('sel_provider').addEventListener('change', function(e){
      stationSearchGeneration += 1;
      if(e.target.value === MODE_SINGLE || e.target.value === MODE_MIX){
        state.selection.recommendationMode = e.target.value;
        document.getElementById('loc_status').textContent = '';
        render();
        scheduleSave();
        return;
      }
      state.selection.recommendationMode = MODE_MANUAL;
      state.selection.providerId = e.target.value;
      var p = findProvider(state.selection.providerId);
      state.selection.classId = p.classes[0].id;
      state.selection.tariffId = p.classes[0].tariffs[0].id;
      document.getElementById('loc_status').textContent = '';
      render(); scheduleSave();
    });
    document.getElementById('sel_class').addEventListener('change', function(e){
      state.selection.classId = e.target.value;
      if(state.selection.recommendationMode === MODE_MANUAL){
        var p = findProvider(state.selection.providerId);
        var c = findClass(p, state.selection.classId);
        state.selection.tariffId = c.tariffs[0].id;
      }
      render(); scheduleSave();
    });
    document.getElementById('sel_tariff').addEventListener('change', function(e){
      if(state.selection.recommendationMode !== MODE_MANUAL){
        return;
      }
      state.selection.tariffId = e.target.value;
      render(); scheduleSave();
    });

    document.getElementById('reset-btn').addEventListener('click', function(){
      state.own = defaultOwn();
      state.usage = defaultUsage();
      scenarioUndoUsage = null;
      activeScenarioTitle = '';
      scenarioPickerCollapsed = false;
      renderUsageScenarios();
      fillOwnInputs(); fillUsageInputs(); render(); scheduleSave();
    });

    document.getElementById('loc-search-btn').addEventListener('click', searchStations);
    document.getElementById('loc_count').addEventListener('input', function(){ readLocationFromInputs(); render(); scheduleSave(); });
    document.getElementById('loc_walk').addEventListener('input', function(){ readLocationFromInputs(); render(); scheduleSave(); });
    document.getElementById('loc_freefloating').addEventListener('change', function(){ readFreeFloatingLocationFromInput(); render(); scheduleSave(); });
    document.getElementById('loc_address').addEventListener('input', function(){ readAddressFromInput(); scheduleSave(); });
    document.getElementById('share-btn').addEventListener('click', shareCurrentState);
    document.getElementById('share-image-btn').addEventListener('click', shareResultImage);
  }

  // ---------- Rendering: Tarife tab ----------

  /**
   * Enables only price fields that participate in the selected billing model.
   * @param {HTMLElement} row - Tariff value row.
   * @param {string} billingMode - Selected billing-model identifier.
   * @returns {void}
   */
  function updateTariffRowControls(row, billingMode){
    var timeInput = row.querySelector('[data-field="zeitpreis"]');
    var firstKmInput = row.querySelector('[data-field="kmBis100"]');
    var laterKmInput = row.querySelector('[data-field="kmAb100"]');
    timeInput.disabled = billingMode === BILLING_DISTANCE_WITH_PACKAGES;
    var distanceIncluded = billingMode === BILLING_TIME_WITH_INCLUDED_DISTANCE;
    firstKmInput.disabled = distanceIncluded;
    laterKmInput.disabled = distanceIncluded;
  }

  /**
   * Updates a tariff source link while allowing only HTTP and HTTPS URLs.
   * @param {HTMLAnchorElement} link - Source link to update.
   * @param {string} sourceUrl - User-entered source URL.
   * @returns {void}
   */
  function updateTariffSourceLink(link, sourceUrl){
    link.hidden = true;
    link.removeAttribute('href');
    if(!sourceUrl){
      return;
    }
    try{
      var parsedUrl = new URL(sourceUrl);
      if(parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:'){
        link.href = parsedUrl.toString();
        link.hidden = false;
      }
    }catch(error){
      // Invalid URLs remain editable but are not exposed as clickable links.
    }
  }

  /**
   * Copies tariff metadata into the public provider JSON format.
   * @param {Object} metadata - Internal tariff metadata.
   * @returns {Object} Independent metadata values for serialization.
   */
  function copyProviderMetadata(metadata){
    return {
      sourceUrl: metadata.sourceUrl || '',
      region: metadata.region || '',
      lastVerifiedAt: metadata.lastVerifiedAt || ''
    };
  }

  /**
   * Converts one editable provider into the versioned project JSON format.
   * @param {Object} provider - Provider from the current application state.
   * @returns {Object} Versioned, lossless provider export.
   */
  function buildProviderExport(provider){
    var commonMetadata = { sourceUrl: '', region: '', lastVerifiedAt: '' };
    if(provider.classes.length > 0 && provider.classes[0].tariffs.length > 0){
      commonMetadata = copyProviderMetadata(provider.classes[0].tariffs[0].v.meta);
    }
    var providerDefinition = {
      id: provider.id,
      name: provider.name,
      operationMode: provider.operationMode,
      meta: commonMetadata,
      classes: []
    };
    provider.classes.forEach(function(providerClass){
      var classDefinition = { id: providerClass.id, name: providerClass.name, tariffs: [] };
      providerClass.tariffs.forEach(function(selectedTariff){
        var values = selectedTariff.v;
        var tariffDefinition = {
          id: selectedTariff.id,
          name: selectedTariff.name,
          billingMode: values.billingMode,
          grundgebuehr: values.grundgebuehr,
          zeitpreis: values.zeitpreis,
          tagespreis: values.tagespreis,
          wochenpreis: values.wochenpreis,
          kmBis100: values.kmBis100,
          kmAb100: values.kmAb100,
          anmeldegebuehr: values.anmeldegebuehr
        };
        var tariffMetadata = copyProviderMetadata(values.meta);
        if(JSON.stringify(tariffMetadata) !== JSON.stringify(commonMetadata)){
          tariffDefinition.meta = tariffMetadata;
        }
        classDefinition.tariffs.push(tariffDefinition);
      });
      providerDefinition.classes.push(classDefinition);
    });
    return { formatVersion: 1, provider: providerDefinition };
  }

  /**
   * Starts a browser download for a serializable JSON value.
   * @param {string} filename - Suggested download filename.
   * @param {Object} value - JSON-compatible value to download.
   * @returns {void}
   */
  function downloadJsonFile(filename, value){
    var content = JSON.stringify(value, null, 2) + '\n';
    var blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 0);
  }

  /**
   * Exports one provider exactly as currently shown in the tariff editor.
   * @param {Object} provider - Provider to serialize and download.
   * @returns {void}
   */
  function exportProvider(provider){
    var safeId = provider.id.replace(/[^a-z0-9_-]/gi, '-');
    downloadJsonFile(safeId + '.json', buildProviderExport(provider));
  }

  /**
   * Adds an editable vehicle class with one starter tariff to a provider.
   * @param {Object} provider - Provider receiving the class.
   * @returns {void}
   */
  function addProviderClass(provider){
    provider.classes.push({
      id: uid('klasse'), name: 'Neue Fahrzeugklasse', tariffs: [
        { id: uid('tarif'), name: 'Standard', v: tariff(0, 2, 25, 0.25, 0.18, 0) }
      ]
    });
    renderProviders();
    render();
    scheduleSave();
  }

  /**
   * Adds a starter tariff to an existing vehicle class.
   * @param {Object} providerClass - Vehicle class receiving the tariff.
   * @returns {void}
   */
  function addClassTariff(providerClass){
    providerClass.tariffs.push({ id: uid('tarif'), name: 'Neuer Tarif', v: tariff(0, 2, 25, 0.25, 0.18, 0) });
    renderProviders();
    render();
    scheduleSave();
  }

  /**
   * Removes one tariff while keeping every class calculable.
   * @param {Object} providerClass - Vehicle class containing the tariff.
   * @param {Object} selectedTariff - Tariff to remove.
   * @returns {void}
   */
  function removeClassTariff(providerClass, selectedTariff){
    if(providerClass.tariffs.length <= 1){
      return;
    }
    providerClass.tariffs = providerClass.tariffs.filter(function(candidate){ return candidate.id !== selectedTariff.id; });
    renderProviders();
    render();
    scheduleSave();
  }

  /**
   * Removes one vehicle class while keeping every provider calculable.
   * @param {Object} provider - Provider containing the class.
   * @param {Object} providerClass - Vehicle class to remove.
   * @returns {void}
   */
  function removeProviderClass(provider, providerClass){
    if(provider.classes.length <= 1){
      return;
    }
    provider.classes = provider.classes.filter(function(candidate){ return candidate.id !== providerClass.id; });
    renderProviders();
    render();
    scheduleSave();
  }

  /**
   * Renders editable providers and tariff rows from reusable templates.
   * @returns {void}
   */
  function renderProviders(){
    var list = document.getElementById('providers-list');
    var providerTemplate = document.getElementById('provider-block-template');
    var tariffRowTemplate = document.getElementById('tariff-row-template');
    var classActionsTemplate = document.getElementById('tariff-class-actions-template');
    var providerFragment = document.createDocumentFragment();
    var priceLabels = {
      grundgebuehr: 'Grundgebühr pro Monat', zeitpreis: 'Zeitpreis pro Stunde',
      tagespreis: 'Tagespreis', wochenpreis: 'Wochenpreis', kmBis100: 'Kilometerpreis bis 100 Kilometer',
      kmAb100: 'Kilometerpreis ab 101 Kilometer', anmeldegebuehr: 'Anmeldegebühr'
    };
    state.providers.forEach(function(provider){
      var block = providerTemplate.content.firstElementChild.cloneNode(true);
      var nameInput = block.querySelector('.provider-name');
      nameInput.value = provider.name;
      nameInput.setAttribute('aria-label', 'Name des Anbieters ' + provider.name);
      nameInput.addEventListener('input', function(){ provider.name = nameInput.value; scheduleSave(); render(); });

      var operationSelect = block.querySelector('.provider-operation-mode');
      operationSelect.value = provider.operationMode;
      operationSelect.setAttribute('aria-label', 'Betriebsart von ' + provider.name);
      operationSelect.addEventListener('change', function(){ provider.operationMode = operationSelect.value; render(); scheduleSave(); });

      var exportBtn = block.querySelector('.export-provider-btn');
      exportBtn.setAttribute('aria-label', 'Tarife von ' + provider.name + ' als JSON exportieren');
      exportBtn.addEventListener('click', function(){ exportProvider(provider); });

      var removeBtn = block.querySelector('.remove-btn');
      removeBtn.setAttribute('aria-label', 'Anbieter ' + provider.name + ' entfernen');
      if(state.providers.length > 1){
        removeBtn.addEventListener('click', function(){
          state.providers = state.providers.filter(function(p){ return p.id !== provider.id; });
          renderProviders(); render(); scheduleSave();
        });
      } else {
        removeBtn.remove();
      }

      var tbody = block.querySelector('tbody');

      provider.classes.forEach(function(cls){
        cls.tariffs.forEach(function(t, idx){
          var rowFragment = tariffRowTemplate.content.cloneNode(true);
          var tr = rowFragment.querySelector('.tariff-value-row');
          if(idx === 0){
            var classNameInput = document.createElement('input');
            classNameInput.type = 'text';
            classNameInput.className = 'class-name';
            classNameInput.value = cls.name;
            classNameInput.setAttribute('aria-label', 'Name der Fahrzeugklasse ' + cls.name);
            classNameInput.addEventListener('input', function(){ cls.name = classNameInput.value; render(); scheduleSave(); });
            tr.querySelector('[data-cell="class"]').appendChild(classNameInput);
          }
          var tariffNameInput = tr.querySelector('.tariff-name');
          tariffNameInput.value = t.name;
          tariffNameInput.setAttribute('aria-label', 'Name des Tarifs ' + t.name);
          tariffNameInput.addEventListener('input', function(){ t.name = tariffNameInput.value; render(); scheduleSave(); });
          var billingSelect = tr.querySelector('[data-field="billingMode"]');
          billingSelect.value = t.v.billingMode;
          billingSelect.setAttribute('aria-label', 'Abrechnungsart für ' + t.name);
          billingSelect.addEventListener('change', function(){
            t.v.billingMode = billingSelect.value;
            updateTariffRowControls(tr, t.v.billingMode);
            render();
            scheduleSave();
          });

          Array.prototype.forEach.call(tr.querySelectorAll('input[data-field]'), function(inp){
            var inputField = inp.getAttribute('data-field');
            inp.value = t.v[inputField];
            inp.setAttribute('aria-label', priceLabels[inputField] + ' für ' + t.name);
            inp.addEventListener('input', function(){
              var field = inp.getAttribute('data-field');
              t.v[field] = +inp.value || 0;
              render(); scheduleSave();
            });
          });
          updateTariffRowControls(tr, t.v.billingMode);

          var sourceLink = rowFragment.querySelector('.tariff-source-link');
          Array.prototype.forEach.call(rowFragment.querySelectorAll('[data-meta-field]'), function(metaInput){
            var metaField = metaInput.getAttribute('data-meta-field');
            metaInput.value = t.v.meta[metaField];
            metaInput.addEventListener('input', function(){
              t.v.meta[metaField] = metaInput.value;
              if(metaField === 'sourceUrl'){
                updateTariffSourceLink(sourceLink, metaInput.value);
              }
              scheduleSave();
            });
          });
          updateTariffSourceLink(sourceLink, t.v.meta.sourceUrl);
          var removeTariffButton = tr.querySelector('.remove-tariff-btn');
          removeTariffButton.setAttribute('aria-label', 'Tarif ' + t.name + ' entfernen');
          removeTariffButton.disabled = cls.tariffs.length <= 1;
          removeTariffButton.addEventListener('click', function(){ removeClassTariff(cls, t); });
          tbody.appendChild(rowFragment);
        });
        var classActions = classActionsTemplate.content.firstElementChild.cloneNode(true);
        classActions.querySelector('.add-tariff-btn').addEventListener('click', function(){ addClassTariff(cls); });
        var removeClassButton = classActions.querySelector('.remove-class-btn');
        removeClassButton.disabled = provider.classes.length <= 1;
        removeClassButton.addEventListener('click', function(){ removeProviderClass(provider, cls); });
        tbody.appendChild(classActions);
      });

      block.querySelector('.add-class-btn').addEventListener('click', function(){ addProviderClass(provider); });

      providerFragment.appendChild(block);
    });
    list.replaceChildren(providerFragment);
  }

  /**
   * Adds a provider with one editable default tariff.
   * @returns {void}
   */
  function addProvider(){
    var id = uid('anbieter');
    state.providers.push({
      id: id, name: 'Neuer Anbieter', operationMode: 'station-based',
      classes: [
        { id: uid('klasse'), name: 'Kleinwagen', tariffs: [
          { id: uid('tarif'), name: 'Standard', v: tariff(10, 2.00, 25.00, 0.25, 0.18, 0) }
        ]}
      ]
    });
    renderProviders(); render(); scheduleSave();
  }

  /**
   * Imports one versioned provider JSON file after showing a concrete preview.
   * @param {File} file - JSON file selected by the user.
   * @returns {Promise<void>} Resolves after import or error reporting.
   */
  async function importProviderFile(file){
    try{
      var wrapper = JSON.parse(await file.text());
      if(!isObject(wrapper) || wrapper.formatVersion !== 1 || !isObject(wrapper.provider)){
        throw new Error('format');
      }
      var importedProvider = providerData.providerDefinitionToRuntime(wrapper.provider);
      if(!hasValidProviders([importedProvider])){
        throw new Error('provider');
      }
      var tariffCount = 0;
      importedProvider.classes.forEach(function(providerClass){ tariffCount += providerClass.tariffs.length; });
      var confirmed = window.confirm('„' + importedProvider.name + '“ mit ' + importedProvider.classes.length + ' Fahrzeugklassen und ' + tariffCount + ' Tarifen importieren?');
      if(!confirmed){
        return;
      }
      var existingIndex = state.providers.findIndex(function(provider){ return provider.id === importedProvider.id; });
      if(existingIndex >= 0){
        state.providers[existingIndex] = importedProvider;
      } else {
        state.providers.push(importedProvider);
      }
      if(!state.location.byProvider[importedProvider.id]){
        state.location.byProvider[importedProvider.id] = defaultLocationForProvider(importedProvider.id);
      }
      renderProviders();
      render();
      scheduleSave();
    }catch(error){
      window.alert('Die JSON-Datei ist ungültig oder unvollständig. Bitte verwende das Exportformat der Anwendung.');
    }
  }

  /**
   * Restores built-in tariffs after explicit confirmation.
   * @returns {void}
   */
  function resetTariffs(){
    var confirmed = window.confirm('Alle Tarifänderungen und selbst angelegten Anbieter werden entfernt. Standardtarife wiederherstellen?');
    if(!confirmed){
      return;
    }
    state.providers = defaultProviders();
    state.selection = { providerId: 'cambio', classId: 'klein', tariffId: 'aktiv', recommendationMode: MODE_MANUAL };
    var standardLocations = defaultLocation().byProvider;
    Object.keys(standardLocations).forEach(function(providerId){
      if(state.location.byProvider[providerId]){
        standardLocations[providerId] = state.location.byProvider[providerId];
      }
    });
    state.location.byProvider = standardLocations;
    renderProviders();
    fillLocationInputs();
    render();
    scheduleSave();
  }

  /**
   * Binds controls belonging to the tariff editor.
   * @returns {void}
   */
  function bindTariffEvents(){
    document.getElementById('add-provider-btn').addEventListener('click', addProvider);
    var importInput = document.getElementById('import-provider-file');
    document.getElementById('import-provider-btn').addEventListener('click', function(){ importInput.click(); });
    importInput.addEventListener('change', function(){
      if(importInput.files && importInput.files[0]){
        importProviderFile(importInput.files[0]);
      }
      importInput.value = '';
    });
    document.getElementById('reset-tariffs-btn').addEventListener('click', resetTariffs);
  }

  // ---------- Tabs ----------

  /**
   * Activates one tab button and its associated panel.
   * @param {NodeListOf<HTMLButtonElement>} buttons - All tab buttons.
   * @param {HTMLButtonElement} activeButton - Button to activate.
   * @returns {void}
   */
  function activateTab(buttons, activeButton){
    buttons.forEach(function(button){
      button.classList.remove('active');
      button.setAttribute('aria-selected', 'false');
      button.setAttribute('tabindex', '-1');
    });
    activeButton.classList.add('active');
    activeButton.setAttribute('aria-selected', 'true');
    activeButton.setAttribute('tabindex', '0');
    var tab = activeButton.getAttribute('data-tab');
    document.getElementById('tab-rechner').hidden = true;
    document.getElementById('tab-tarife').hidden = true;
    if(tab === 'rechner'){
      document.getElementById('tab-rechner').hidden = false;
    } else if(tab === 'tarife'){
      document.getElementById('tab-tarife').hidden = false;
    }
  }

  /**
   * Binds the navigation buttons for the calculator and tariff editor.
   * @returns {void}
   */
  function bindTabs(){
    var buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(function(btn, index){
      btn.addEventListener('click', function(){
        activateTab(buttons, btn);
      });
      btn.addEventListener('keydown', function(event){
        var nextIndex = index;
        if(event.key === 'ArrowRight'){
          nextIndex = (index + 1) % buttons.length;
        } else if(event.key === 'ArrowLeft'){
          nextIndex = (index - 1 + buttons.length) % buttons.length;
        } else if(event.key === 'Home'){
          nextIndex = 0;
        } else if(event.key === 'End'){
          nextIndex = buttons.length - 1;
        } else {
          return;
        }
        event.preventDefault();
        activateTab(buttons, buttons[nextIndex]);
        buttons[nextIndex].focus();
      });
    });
  }

  // ---------- Init ----------

  /**
   * Loads persisted state, initializes controls and performs the first render.
   * @returns {Promise<void>} Resolves when initialization has completed.
   */
  async function init(){
    await loadState();
    var sharedStateResult = await loadSharedState();
    fillOwnInputs();
    fillUsageInputs();
    fillLocationInputs();
    renderUsageScenarios();
    bindRechnerEvents();
    renderProviders();
    bindTariffEvents();
    bindTabs();
    render();
    if(sharedStateResult.found){
      document.getElementById('share-status').textContent = sharedStateResult.message;
    }
  }

  init();

})();
