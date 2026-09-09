(function(global){
  'use strict';
  var limits = global.CarshareLimits;

  /**
   * Checks whether a value is a non-array object.
   * @param {*} value - Value to inspect.
   * @returns {boolean} True for non-null, non-array objects.
   */
  function isObject(value){
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  var BILLING_TIME_AND_DISTANCE = 'time-and-distance';
  var BILLING_DISTANCE_WITH_PACKAGES = 'distance-with-packages';
  var BILLING_TIME_WITH_INCLUDED_DISTANCE = 'time-with-included-distance';
  var CHILD_SEAT_BRING_OWN = 'bring-own';
  var CHILD_SEAT_CHECK = 'check';
  var CHILD_SEAT_INCLUDED = 'included';

  /**
   * Checks whether a billing-model identifier is supported.
   * @param {string} billingMode - Billing-model identifier.
   * @returns {boolean} True for a supported billing model.
   */
  function isKnownBillingMode(billingMode){
    if(billingMode === BILLING_TIME_AND_DISTANCE){
      return true;
    }
    if(billingMode === BILLING_DISTANCE_WITH_PACKAGES){
      return true;
    }
    if(billingMode === BILLING_TIME_WITH_INCLUDED_DISTANCE){
      return true;
    }
    return false;
  }

  /**
   * Infers the initial billing model for legacy tariff values.
   * @param {number} zeit - Hourly price in euros.
   * @param {number} kmBis100 - Price per kilometer up to 100 kilometers.
   * @param {number} kmAb100 - Price per kilometer after 100 kilometers.
   * @returns {string} Billing-model identifier.
   */
  function inferBillingMode(zeit, kmBis100, kmAb100){
    if(zeit === 0 && (kmBis100 > 0 || kmAb100 > 0)){
      return BILLING_DISTANCE_WITH_PACKAGES;
    }
    if(kmBis100 === 0 && kmAb100 === 0){
      return BILLING_TIME_WITH_INCLUDED_DISTANCE;
    }
    return BILLING_TIME_AND_DISTANCE;
  }

  /**
   * Creates the default cost values for an owned car.
   * @returns {Object} Default owned-car values.
   */
  function defaultOwn(){
    return {
      kaufpreis: 9000, haltedauer: 6, restwert: 2000,
      wartung: 600, versicherung: 700, sonstiges: 400, sonstigesExtra: 0,
      verbrauch: 6.5, kraftstoffpreis: 2.20, stellplatz: 0, parkausweis: 30
    };
  }

  /**
   * Normalizes owned-car inputs to finite, non-negative values.
   * @param {Object} values - Entered or stored owned-car settings.
   * @returns {Object} Independent settings with at least one year of ownership.
   */
  function normalizeOwn(values){
    var normalized = defaultOwn();
    Object.keys(normalized).forEach(function(field){
      var value = values[field];
      if(typeof value === 'number' && isFinite(value)){
        normalized[field] = limits.clampNumber(value, normalized[field]);
      }
    });
    normalized.haltedauer = Math.max(normalized.haltedauer, 1);
    return normalized;
  }

  /**
   * Creates the default annual usage profile.
   * @returns {Object} Default usage values.
   */
  function defaultUsage(){
    return {
      jahreskm: 6000, vergleichsjahre: 6, kurzfahrten: 6, stundenprofahrt: 2, alltagsmodell: 'continuous',
      bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12,
      bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100,
      childSeatInfantCount: 0, childSeatBoosterCount: 0, childSeatNeedsReview: false,
      tagesausfluege: 0, stundenproausflug: 8, kmproausflug: 120,
      mehrtagesfahrten: 3, tageprofahrt: 3, kmprofahrt: 250,
      urlaubsfahrten: 0, tageprourlaub: 7, kmprourlaub: 900,
      flex: 'teilweise', freefloatingFit: 'auto', parkplatz: false
    };
  }

  /**
   * Checks whether a child-seat availability value is supported.
   * @param {*} availability - Availability value stored for one vehicle class.
   * @returns {boolean} True when the availability can be shown to users.
   */
  function isKnownChildSeatAvailability(availability){
    return availability === CHILD_SEAT_BRING_OWN || availability === CHILD_SEAT_CHECK || availability === CHILD_SEAT_INCLUDED;
  }

  /**
   * Normalizes child-seat details for one vehicle class.
   * @param {*} childSeats - Source or persisted child-seat details.
   * @returns {Object} Availability for infant seats and booster seats plus included count.
   */
  function normalizeChildSeats(childSeats){
    var normalized = { infant: CHILD_SEAT_BRING_OWN, booster: CHILD_SEAT_BRING_OWN, boosterCount: 0 };
    if(!isObject(childSeats)){
      return normalized;
    }
    if(isKnownChildSeatAvailability(childSeats.infant)){
      normalized.infant = childSeats.infant;
    }
    if(isKnownChildSeatAvailability(childSeats.booster)){
      normalized.booster = childSeats.booster;
    }
    if(normalized.booster === CHILD_SEAT_INCLUDED && typeof childSeats.boosterCount === 'number' && isFinite(childSeats.boosterCount)){
      normalized.boosterCount = Math.min(Math.max(Math.floor(childSeats.boosterCount), 1), 4);
    }
    return normalized;
  }

  /**
   * Checks whether stored availability is the former generic fallback without provider-specific data.
   * @param {Object} childSeats - Normalized vehicle-class seat availability.
   * @returns {boolean} True when both seat types still use the old bring-your-own fallback.
   */
  function isGenericChildSeatFallback(childSeats){
    return childSeats.infant === CHILD_SEAT_BRING_OWN && childSeats.booster === CHILD_SEAT_BRING_OWN && childSeats.boosterCount === 0;
  }

  /**
   * Creates a normalized tariff value object for custom providers.
   * @param {number} grundgebuehr - Monthly base fee in euros.
   * @param {number} zeit - Hourly price in euros.
   * @param {number} tag - Daily price in euros.
   * @param {number} kmBis100 - Price per kilometer up to 100 kilometers.
   * @param {number} kmAb100 - Price per kilometer after 100 kilometers.
   * @param {number} anmeldegebuehr - One-time registration fee in euros.
   * @returns {Object} Tariff values including a derived weekly price.
   */
  function tariff(grundgebuehr, zeit, tag, kmBis100, kmAb100, anmeldegebuehr){
    var woche = tag * 5;
    return {
      grundgebuehr: grundgebuehr, zeitpreis: zeit, tagespreis: tag, wochenpreis: woche,
      kmBis100: kmBis100, kmAb100: kmAb100, anmeldegebuehr: anmeldegebuehr,
      billingMode: inferBillingMode(zeit, kmBis100, kmAb100),
      meta: { sourceUrl: '', region: '', lastVerifiedAt: '' }
    };
  }

  /**
   * Converts one generated JSON definition into the internal calculator structure.
   * @param {Object} definition - Provider definition generated from a JSON source file.
   * @returns {Object} Independent provider object used by the application state.
   */
  function providerDefinitionToRuntime(definition){
    var provider = { id: definition.id, name: definition.name, operationMode: definition.operationMode, classes: [] };
    definition.classes.forEach(function(classDefinition){
      var providerClass = { id: classDefinition.id, name: classDefinition.name, childSeats: normalizeChildSeats(classDefinition.childSeats), tariffs: [] };
      classDefinition.tariffs.forEach(function(tariffDefinition){
        providerClass.tariffs.push({
          id: tariffDefinition.id,
          name: tariffDefinition.name,
          v: {
            grundgebuehr: tariffDefinition.grundgebuehr,
            zeitpreis: tariffDefinition.zeitpreis,
            tagespreis: tariffDefinition.tagespreis,
            wochenpreis: tariffDefinition.wochenpreis,
            kmBis100: tariffDefinition.kmBis100,
            kmAb100: tariffDefinition.kmAb100,
            anmeldegebuehr: tariffDefinition.anmeldegebuehr,
            billingMode: tariffDefinition.billingMode,
            meta: Object.assign({ sourceUrl: '', region: '', lastVerifiedAt: '' }, definition.meta, tariffDefinition.meta)
          }
        });
      });
      provider.classes.push(providerClass);
    });
    return provider;
  }

  /**
   * Creates independent copies of all built-in provider definitions.
   * @returns {Array<Object>} Default provider data.
   */
  function defaultProviders(){
    var definitions = global.CarshareProviderDefinitions;
    if(!Array.isArray(definitions)){
      throw new Error('Die erzeugten Anbieterdaten fehlen. Bitte npm run build:providers ausführen.');
    }
    return definitions.map(providerDefinitionToRuntime);
  }

  /**
   * Adds billing models, weekly prices, source metadata and vehicle-class seat data missing from older tariff data.
   * @param {Array<Object>} providers - Provider collection to normalize in place.
   * @returns {Array<Object>} The normalized provider collection.
   */
  function normalizeTariffData(providers){
    var defaults = defaultProviders();
    providers.forEach(function(provider){
      var defaultProvider = defaults.find(function(candidate){ return candidate.id === provider.id; });
      if(provider.operationMode !== 'station-based' && provider.operationMode !== 'free-floating'){
        provider.operationMode = 'station-based';
        if(defaultProvider){
          provider.operationMode = defaultProvider.operationMode;
        }
      }
      provider.classes.forEach(function(cls){
        var defaultClass = null;
        if(defaultProvider){
          defaultClass = defaultProvider.classes.find(function(candidate){ return candidate.id === cls.id; });
        }
        var normalizedChildSeats = normalizeChildSeats(cls.childSeats);
        if(defaultClass && isGenericChildSeatFallback(normalizedChildSeats) && !isGenericChildSeatFallback(defaultClass.childSeats)){
          cls.childSeats = defaultClass.childSeats;
        } else {
          cls.childSeats = normalizedChildSeats;
        }
        cls.tariffs.forEach(function(selectedTariff){
          var values = selectedTariff.v;
          var hadStoredMetadata = isObject(values.meta);
          if(typeof values.wochenpreis !== 'number' || !isFinite(values.wochenpreis)){
            values.wochenpreis = values.tagespreis * 5;
          }
          if(!isKnownBillingMode(values.billingMode)){
            values.billingMode = inferBillingMode(values.zeitpreis, values.kmBis100, values.kmAb100);
          }
          if(!isObject(values.meta)){
            values.meta = { sourceUrl: '', region: '', lastVerifiedAt: '' };
          } else {
            values.meta = Object.assign({ sourceUrl: '', region: '', lastVerifiedAt: '' }, values.meta);
          }
          if(defaultProvider){
            var defaultTariff = null;
            if(defaultClass){
              defaultTariff = defaultClass.tariffs.find(function(candidate){ return candidate.id === selectedTariff.id; });
            }
            if(defaultTariff){
              if(hadStoredMetadata){
                values.meta = Object.assign({}, defaultTariff.v.meta, values.meta);
              } else {
                values.meta = Object.assign({}, defaultTariff.v.meta);
              }
              if(values.meta.sourceUrl === ''){
                values.meta.sourceUrl = defaultTariff.v.meta.sourceUrl;
              }
              if(values.meta.region === ''){
                values.meta.region = defaultTariff.v.meta.region;
              }
              if(values.meta.lastVerifiedAt === ''){
                values.meta.lastVerifiedAt = defaultTariff.v.meta.lastVerifiedAt;
              }
            }
          }
        });
      });
    });
    return providers;
  }

  global.CarshareData = {
    BILLING_TIME_AND_DISTANCE: BILLING_TIME_AND_DISTANCE,
    BILLING_DISTANCE_WITH_PACKAGES: BILLING_DISTANCE_WITH_PACKAGES,
    BILLING_TIME_WITH_INCLUDED_DISTANCE: BILLING_TIME_WITH_INCLUDED_DISTANCE,
    CHILD_SEAT_BRING_OWN: CHILD_SEAT_BRING_OWN,
    CHILD_SEAT_CHECK: CHILD_SEAT_CHECK,
    CHILD_SEAT_INCLUDED: CHILD_SEAT_INCLUDED,
    isKnownBillingMode: isKnownBillingMode,
    isKnownChildSeatAvailability: isKnownChildSeatAvailability,
    normalizeChildSeats: normalizeChildSeats,
    defaultOwn: defaultOwn,
    normalizeOwn: normalizeOwn,
    defaultUsage: defaultUsage,
    tariff: tariff,
    defaultProviders: defaultProviders,
    normalizeTariffData: normalizeTariffData,
    providerDefinitionToRuntime: providerDefinitionToRuntime
  };
})(window);
