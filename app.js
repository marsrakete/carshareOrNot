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
  /**
   * Creates the default location estimate for one provider.
   * @param {string} providerId - Provider identifier.
   * @returns {Object} Station count and walking-time estimate.
   */
  function defaultLocationForProvider(providerId){
    return { stationCount: null, walkMinutes: null, source: 'unknown' };
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
      return { stationCount: null, walkMinutes: null, source: 'unknown' };
    }
    var source = entry.source;
    if(source !== 'manual' && source !== 'search' && source !== 'unknown'){
      if(entry.stationCount === null && entry.walkMinutes === null){
        source = 'unknown';
      } else {
        source = 'legacy';
      }
    }
    return { stationCount: entry.stationCount, walkMinutes: entry.walkMinutes, source: source };
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
    selection: { providerId: 'cambio', classId: 'klein', tariffId: 'aktiv' }
  };

  var STORAGE_KEY = 'carsharing-rechner:v1';
  var SHARE_FORMAT_VERSION = 1;
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
    var ownFields = ['kaufpreis','haltedauer','restwert','wartung','versicherung','sonstiges','verbrauch','kraftstoffpreis','stellplatz','parkausweis'];
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
    if(typeof snapshot.usage.flex !== 'string' || typeof snapshot.usage.parkplatz !== 'boolean' || typeof snapshot.usage.kindersitz !== 'boolean'){
      return false;
    }
    if(!isObject(snapshot.location) || typeof snapshot.location.address !== 'string' || !isObject(snapshot.location.byProvider)){
      return false;
    }
    var validLocations = Object.keys(snapshot.location.byProvider).every(function(providerId){
      var locationEntry = snapshot.location.byProvider[providerId];
      return isObject(locationEntry) && isNullableNumber(locationEntry.stationCount) && isNullableNumber(locationEntry.walkMinutes);
    });
    if(!validLocations || !hasValidProviders(snapshot.providers) || !isObject(snapshot.selection)){
      return false;
    }
    return typeof snapshot.selection.providerId === 'string' && typeof snapshot.selection.classId === 'string' && typeof snapshot.selection.tariffId === 'string';
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
    state.selection = snapshot.selection;
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
      if(isObject(wrapper) && isObject(wrapper.state) && isObject(wrapper.state.usage)){
        var sharedUsage = Object.assign(defaultUsage(), wrapper.state.usage);
        if(typeof wrapper.state.usage.vergleichsjahre !== 'number' && isObject(wrapper.state.own) && typeof wrapper.state.own.haltedauer === 'number'){
          sharedUsage.vergleichsjahre = Math.max(wrapper.state.own.haltedauer, 1);
        }
        wrapper.state.usage = sharedUsage;
      }
      if(!isObject(wrapper) || wrapper.version !== SHARE_FORMAT_VERSION || !isValidSharedState(wrapper.state)){
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
    var payload = await encodeSharePayload(state);
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
        if(parsed.selection) state.selection = parsed.selection;
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
    document.getElementById('own_verbrauch').value = o.verbrauch;
    document.getElementById('own_kraftstoffpreis').value = o.kraftstoffpreis;
    document.getElementById('own_stellplatz').value = o.stellplatz;
    document.getElementById('own_parkausweis').value = o.parkausweis;
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
    document.getElementById('use_parkplatz').checked = !!u.parkplatz;
    var radios = document.getElementsByName('flex');
    for(var i=0;i<radios.length;i++){ radios[i].checked = (radios[i].value === u.flex); }
    updateStellplatzState(u.parkplatz);
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
   * Copies location values for the selected provider into the form.
   * @returns {void}
   */
  function fillLocationInputs(){
    document.getElementById('loc_address').value = state.location.address;
    var provider = findProvider(state.selection.providerId) || state.providers[0];
    var pl = getProviderLocation(provider.id);
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
    var provider = findProvider(state.selection.providerId) || state.providers[0];
    state.location.byProvider[provider.id] = {
      stationCount: readNullableNumberInput('loc_count'),
      walkMinutes: readNullableNumberInput('loc_walk'),
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
    return generation === stationSearchGeneration && providerId === state.selection.providerId;
  }

  /**
   * Geocodes the entered address and looks up verified stations for the selected provider.
   * @returns {Promise<void>} Resolves after the search result or error has been displayed.
   */
  async function searchStations(){
    var address = document.getElementById('loc_address').value.trim();
    var statusEl = document.getElementById('loc_status');
    var btn = document.getElementById('loc-search-btn');
    var provider = findProvider(state.selection.providerId) || state.providers[0];
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
        state.location.byProvider[providerId] = { stationCount: 0, walkMinutes: 0, source: 'search' };
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
        state.location.byProvider[providerId] = { stationCount: stations.length, walkMinutes: walkMin, source: 'search' };
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
   * Rebuilds provider, vehicle-class and tariff selects from current state.
   * @returns {void}
   */
  function populateSelects(){
    var provSel = document.getElementById('sel_provider');
    var classSel = document.getElementById('sel_class');
    var tariffSel = document.getElementById('sel_tariff');

    provSel.replaceChildren();
    state.providers.forEach(function(p){
      var opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name;
      provSel.appendChild(opt);
    });
    document.getElementById('provider-select-row').style.display = 'none';
    if(state.providers.length > 1){
      document.getElementById('provider-select-row').style.display = 'grid';
    }

    if(!findProvider(state.selection.providerId)) state.selection.providerId = state.providers[0].id;
    provSel.value = state.selection.providerId;

    var provider = findProvider(state.selection.providerId);
    classSel.replaceChildren();
    provider.classes.forEach(function(c){
      var opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name;
      classSel.appendChild(opt);
    });
    if(!findClass(provider, state.selection.classId)) state.selection.classId = provider.classes[0].id;
    classSel.value = state.selection.classId;

    var cls = findClass(provider, state.selection.classId);
    tariffSel.replaceChildren();
    cls.tariffs.forEach(function(t){
      var opt = document.createElement('option'); opt.value = t.id; opt.textContent = t.name;
      tariffSel.appendChild(opt);
    });
    if(!findTariff(cls, state.selection.tariffId)) state.selection.tariffId = cls.tariffs[0].id;
    tariffSel.value = state.selection.tariffId;
  }

  /**
   * Derives explanatory cards from costs, availability and usage preferences.
   * @param {Object} r - Current cost calculation result.
   * @returns {Array<Object>} Insight cards with tone, title and text.
   */
  function computeInsights(r){
    var loc = getProviderLocation(state.selection.providerId), u = state.usage;
    var cards = [];

    // Flexibilität anhand Stationsdichte und Gehzeit
    var flexHint = {
      spontan: ' Da du oft spontan losfährst, wirkt sich die Stationsnähe hier besonders stark aus.',
      teilweise: '',
      planbar: ' Da deine Fahrten meist planbar sind, lässt sich das per Vorausbuchung gut ausgleichen.'
    }[u.flex] || '';

    if(loc.source === 'unknown'){
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
    if(!u.parkplatz){
      var parkingPermitText = '';
      if(state.own.parkausweis > 0){
        parkingPermitText = 'Der Anwohnerparkausweis (' + fmtEUR(state.own.parkausweis) + '/Jahr) ist bereits in den Autokosten eingerechnet, der Zeitaufwand selbst aber nicht. ';
      }
      cards.push({ tone: 'mid', title: 'Parkplatzsuche als Nachteil beim eigenen Auto',
        text: 'Ohne garantierten Platz kostet die tägliche Parkplatzsuche auf öffentlichem Grund Zeit und Nerven, gerade abends in dicht bebauten Vierteln. ' +
              parkingPermitText +
              'Bei ' + r.providerName + ' entfällt das für dich: Der Anbieter kümmert sich um den Abstellplatz, du musst selbst keinen Parkplatz suchen.' });
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
   * Recalculates and renders the complete comparison view.
   * @returns {void}
   */
  function render(){
    populateSelects();
    var r = calculate(state);

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
      sub.textContent = 'Lege rechts einen Carsharing-Tarif an, um zu vergleichen.';
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
    renderTripCostBreakdown(r);
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
      flex: flex,
      parkplatz: document.getElementById('use_parkplatz').checked
    };
  }

  /**
   * Binds comparison-form controls to state, rendering and persistence.
   * @returns {void}
   */
  function bindRechnerEvents(){
    var ownIds = ['own_kaufpreis','own_haltedauer','own_restwert','own_wartung','own_versicherung','own_sonstiges','own_verbrauch','own_kraftstoffpreis','own_stellplatz','own_parkausweis'];
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
      document.getElementById(id).addEventListener('input', function(){ readUsageFromInputs(); render(); scheduleSave(); });
    });
    document.getElementsByName('flex').forEach(function(r){
      r.addEventListener('change', function(){ readUsageFromInputs(); render(); scheduleSave(); });
    });
    document.getElementById('use_parkplatz').addEventListener('change', function(){ readUsageFromInputs(); render(); scheduleSave(); });
    document.getElementById('use_kindersitz').addEventListener('change', function(){ readUsageFromInputs(); render(); scheduleSave(); });

    document.getElementById('sel_provider').addEventListener('change', function(e){
      stationSearchGeneration += 1;
      state.selection.providerId = e.target.value;
      var p = findProvider(state.selection.providerId);
      state.selection.classId = p.classes[0].id;
      state.selection.tariffId = p.classes[0].tariffs[0].id;
      fillLocationInputs();
      document.getElementById('loc_status').textContent = '';
      render(); scheduleSave();
    });
    document.getElementById('sel_class').addEventListener('change', function(e){
      state.selection.classId = e.target.value;
      var p = findProvider(state.selection.providerId);
      var c = findClass(p, state.selection.classId);
      state.selection.tariffId = c.tariffs[0].id;
      render(); scheduleSave();
    });
    document.getElementById('sel_tariff').addEventListener('change', function(e){
      state.selection.tariffId = e.target.value;
      render(); scheduleSave();
    });

    document.getElementById('reset-btn').addEventListener('click', function(){
      state.own = defaultOwn();
      state.usage = defaultUsage();
      fillOwnInputs(); fillUsageInputs(); render(); scheduleSave();
    });

    document.getElementById('loc-search-btn').addEventListener('click', searchStations);
    document.getElementById('loc_count').addEventListener('input', function(){ readLocationFromInputs(); render(); scheduleSave(); });
    document.getElementById('loc_walk').addEventListener('input', function(){ readLocationFromInputs(); render(); scheduleSave(); });
    document.getElementById('loc_address').addEventListener('input', function(){ readAddressFromInput(); scheduleSave(); });
    document.getElementById('share-btn').addEventListener('click', shareCurrentState);
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
   * Renders editable providers and tariff rows from reusable templates.
   * @returns {void}
   */
  function renderProviders(){
    var list = document.getElementById('providers-list');
    var providerTemplate = document.getElementById('provider-block-template');
    var tariffRowTemplate = document.getElementById('tariff-row-template');
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
            tr.querySelector('[data-cell="class"]').textContent = cls.name;
          }
          tr.querySelector('[data-cell="tariff"]').textContent = t.name;
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
          tbody.appendChild(rowFragment);
        });
      });

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
      id: id, name: 'Neuer Anbieter',
      classes: [
        { id: uid('klasse'), name: 'Kleinwagen', tariffs: [
          { id: uid('tarif'), name: 'Standard', v: tariff(10, 2.00, 25.00, 0.25, 0.18, 0) }
        ]}
      ]
    });
    renderProviders(); render(); scheduleSave();
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
    state.selection = { providerId: 'cambio', classId: 'klein', tariffId: 'aktiv' };
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
