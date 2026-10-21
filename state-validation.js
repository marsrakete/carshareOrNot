(function(){
  'use strict';

  var providerData = window.CarshareData;
  var identifiers = window.CarshareIdentifiers;
  var limits = window.CarshareLimits;
  var isKnownBillingMode = providerData.isKnownBillingMode;
  var isKnownChildSeatAvailability = providerData.isKnownChildSeatAvailability;
  var defaultUsage = providerData.defaultUsage;
  var defaultProviders = providerData.defaultProviders;
  var recommendationData = window.CarshareRecommendations;
  var MODE_MANUAL = recommendationData.MODE_MANUAL;

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
    var byProvider = Object.create(null);
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
    return typeof value === 'number' && isFinite(value) && value >= 0 && value <= limits.MAX_NUMERIC_VALUE;
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
   * Migrates saved usage values to the age-specific child-seat model.
   * @param {Object} usage - Persisted usage values from local storage.
   * @returns {Object} Complete usage values with bounded child-seat counts.
   */
  function normalizeStoredUsage(usage){
    var normalized = Object.assign(defaultUsage(), usage);
    var hasInfantCount = typeof usage.childSeatInfantCount === 'number';
    var hasBoosterCount = typeof usage.childSeatBoosterCount === 'number';
    normalized.childSeatInfantCount = Math.min(4, Math.max(0, Math.floor(Number(normalized.childSeatInfantCount) || 0)));
    normalized.childSeatBoosterCount = Math.min(4, Math.max(0, Math.floor(Number(normalized.childSeatBoosterCount) || 0)));
    normalized.childSeatNeedsReview = normalized.childSeatNeedsReview === true;
    if(!hasInfantCount && !hasBoosterCount && usage.kindersitz === true){
      normalized.childSeatNeedsReview = true;
    }
    delete normalized.kindersitz;
    return normalized;
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
      return typeof value[field] === 'number' && isFinite(value[field]) && value[field] >= 0 && value[field] <= limits.MAX_NUMERIC_VALUE;
    });
  }

  /**
   * Validates one vehicle class's child-seat information.
   * @param {Object} childSeats - Availability data for infant and booster seats.
   * @returns {boolean} True when the availability data is complete and bounded.
   */
  function hasValidChildSeats(childSeats){
    if(!isObject(childSeats) || !isKnownChildSeatAvailability(childSeats.infant) || !isKnownChildSeatAvailability(childSeats.booster)){
      return false;
    }
    if(typeof childSeats.boosterCount !== 'number' || !isFinite(childSeats.boosterCount) || childSeats.boosterCount < 0 || childSeats.boosterCount > 4 || Math.floor(childSeats.boosterCount) !== childSeats.boosterCount){
      return false;
    }
    if(childSeats.booster === providerData.CHILD_SEAT_INCLUDED){
      return childSeats.boosterCount > 0;
    }
    return childSeats.boosterCount === 0;
  }

  /**
   * Validates provider, class and tariff structures received through a share link.
   * @param {Array<Object>} providers - Provider collection to validate.
   * @returns {boolean} True when the complete provider hierarchy is usable.
   */
  function hasValidProviders(providers){
    if(!identifiers.hasValidProviderIdentifiers(providers)){
      return false;
    }
    if(!limits.hasLimitedProviderStructure(providers)){
      return false;
    }
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
        if(!hasValidChildSeats(cls.childSeats)){
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
      'urlaubsfahrten','tageprourlaub','kmprourlaub',
      'childSeatInfantCount','childSeatBoosterCount'
    ];
    if(!isObject(snapshot) || !hasValidNumbers(snapshot.own, ownFields) || !hasValidNumbers(snapshot.usage, usageFields)){
      return false;
    }
    if(snapshot.usage.childSeatInfantCount > 4 || snapshot.usage.childSeatBoosterCount > 4 || Math.floor(snapshot.usage.childSeatInfantCount) !== snapshot.usage.childSeatInfantCount || Math.floor(snapshot.usage.childSeatBoosterCount) !== snapshot.usage.childSeatBoosterCount){
      return false;
    }
    if(typeof snapshot.usage.flex !== 'string' || !recommendationData.isKnownFreeFloatingFit(snapshot.usage.freefloatingFit) || typeof snapshot.usage.parkplatz !== 'boolean' || typeof snapshot.usage.childSeatNeedsReview !== 'boolean'){
      return false;
    }
    if(snapshot.usage.alltagsmodell !== 'continuous' && snapshot.usage.alltagsmodell !== 'split-return' && snapshot.usage.alltagsmodell !== 'one-way'){
      return false;
    }
    if(!isObject(snapshot.location) || !limits.isTextWithinLimit(snapshot.location.address, limits.MAX_ADDRESS_LENGTH) || !isObject(snapshot.location.byProvider)){
      return false;
    }
    var locationProviderIds = Object.keys(snapshot.location.byProvider);
    if(locationProviderIds.length > limits.MAX_PROVIDERS){
      return false;
    }
    var validLocations = locationProviderIds.every(function(providerId){
      if(!identifiers.isValidProviderId(providerId)){
        return false;
      }
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
    var providerIds = snapshot.providers.map(function(provider){ return provider.id; });
    if(!locationProviderIds.every(function(providerId){ return providerIds.indexOf(providerId) >= 0; })){
      return false;
    }
    if(!identifiers.isValidProviderId(snapshot.selection.providerId) || !identifiers.isValidIdentifier(snapshot.selection.classId) || !identifiers.isValidIdentifier(snapshot.selection.tariffId)){
      return false;
    }
    return typeof snapshot.selection.providerId === 'string' &&
      typeof snapshot.selection.classId === 'string' &&
      typeof snapshot.selection.tariffId === 'string' &&
      recommendationData.isKnownMode(snapshot.selection.recommendationMode);
  }

  /**
   * Copies only location entries belonging to providers in the current state.
   * @param {Object} byProvider - Existing provider-location map, possibly containing orphan entries.
   * @param {Array<Object>} providers - Actual providers, including user-defined providers.
   * @returns {Object} New map without orphan entries; does not modify the input map.
   */
  function filterProviderLocations(byProvider, providers){
    var filtered = Object.create(null);
    providers.forEach(function(provider){
      if(Object.prototype.hasOwnProperty.call(byProvider, provider.id)){
        filtered[provider.id] = byProvider[provider.id];
      }
    });
    return filtered;
  }

  window.CarshareStateValidation = {
    filterProviderLocations: filterProviderLocations,
    defaultLocationForProvider: defaultLocationForProvider,
    defaultLocation: defaultLocation,
    normalizeLocationEntry: normalizeLocationEntry,
    isObject: isObject,
    isNullableNumber: isNullableNumber,
    isNullableBoolean: isNullableBoolean,
    normalizeSelection: normalizeSelection,
    normalizeStoredUsage: normalizeStoredUsage,
    hasValidNumbers: hasValidNumbers,
    hasValidChildSeats: hasValidChildSeats,
    hasValidProviders: hasValidProviders,
    isValidSharedState: isValidSharedState
  };
})();
