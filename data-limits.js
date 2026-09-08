(function(root){
  'use strict';

  var MAX_SHARE_PAYLOAD_CHARACTERS = 16384;
  var MAX_SHARE_ENCODED_BYTES = 12288;
  var MAX_SHARE_DECOMPRESSED_BYTES = 98304;
  var MAX_IMPORT_BYTES = 131072;
  var MAX_NUMERIC_VALUE = 1000000000;
  var MAX_PROVIDERS = 20;
  var MAX_CLASSES_PER_PROVIDER = 20;
  var MAX_TARIFFS_PER_CLASS = 20;
  var MAX_PROVIDER_NAME_LENGTH = 120;
  var MAX_CLASS_NAME_LENGTH = 120;
  var MAX_TARIFF_NAME_LENGTH = 120;
  var MAX_REGION_LENGTH = 160;
  var MAX_SOURCE_URL_LENGTH = 2048;
  var MAX_ADDRESS_LENGTH = 500;

  /**
   * Checks whether text is a string within a defined character limit.
   * @param {*} value - Text value to inspect.
   * @param {number} maximumLength - Largest permitted number of characters.
   * @returns {boolean} True when the text is within the limit.
   */
  function isTextWithinLimit(value, maximumLength){
    return typeof value === 'string' && value.length <= maximumLength;
  }

  /**
   * Clamps a numeric value to the finite non-negative range used by calculations.
   * @param {*} value - Candidate numeric value.
   * @param {number} fallback - Value used when the candidate is not finite.
   * @returns {number} Bounded finite non-negative number.
   */
  function clampNumber(value, fallback){
    if(typeof value !== 'number' || !isFinite(value)){
      return fallback;
    }
    return Math.min(Math.max(value, 0), MAX_NUMERIC_VALUE);
  }

  /**
   * Returns runtime tariff values or a JSON tariff definition.
   * @param {Object} tariff - Runtime or JSON tariff object.
   * @returns {Object|null} Values object, or null when the tariff is invalid.
   */
  function getTariffValues(tariff){
    if(!tariff || typeof tariff !== 'object'){
      return null;
    }
    if(tariff.v && typeof tariff.v === 'object'){
      return tariff.v;
    }
    return tariff;
  }

  /**
   * Checks optional tariff metadata for bounded text fields.
   * @param {*} metadata - Optional tariff metadata object.
   * @returns {boolean} True when metadata is absent or within all text limits.
   */
  function hasLimitedMetadata(metadata){
    if(typeof metadata === 'undefined'){
      return true;
    }
    if(!metadata || typeof metadata !== 'object' || Array.isArray(metadata)){
      return false;
    }
    return isTextWithinLimit(metadata.region, MAX_REGION_LENGTH) &&
      isTextWithinLimit(metadata.sourceUrl, MAX_SOURCE_URL_LENGTH) &&
      isTextWithinLimit(metadata.lastVerifiedAt, 32);
  }

  /**
   * Checks provider, class, tariff and metadata counts and text limits.
   * @param {*} providers - Runtime providers or JSON provider definitions.
   * @returns {boolean} True when the hierarchy stays within supported limits.
   */
  function hasLimitedProviderStructure(providers){
    if(!Array.isArray(providers) || providers.length === 0 || providers.length > MAX_PROVIDERS){
      return false;
    }
    return providers.every(function(provider){
      if(!provider || typeof provider !== 'object' || !isTextWithinLimit(provider.name, MAX_PROVIDER_NAME_LENGTH) || !hasLimitedMetadata(provider.meta) || !Array.isArray(provider.classes) || provider.classes.length === 0 || provider.classes.length > MAX_CLASSES_PER_PROVIDER){
        return false;
      }
      return provider.classes.every(function(providerClass){
        if(!providerClass || typeof providerClass !== 'object' || !isTextWithinLimit(providerClass.name, MAX_CLASS_NAME_LENGTH) || !Array.isArray(providerClass.tariffs) || providerClass.tariffs.length === 0 || providerClass.tariffs.length > MAX_TARIFFS_PER_CLASS){
          return false;
        }
        return providerClass.tariffs.every(function(tariff){
          var values = getTariffValues(tariff);
          if(!tariff || typeof tariff !== 'object' || !isTextWithinLimit(tariff.name, MAX_TARIFF_NAME_LENGTH) || values === null){
            return false;
          }
          return hasLimitedMetadata(values.meta);
        });
      });
    });
  }

  var api = {
    MAX_SHARE_PAYLOAD_CHARACTERS: MAX_SHARE_PAYLOAD_CHARACTERS,
    MAX_SHARE_ENCODED_BYTES: MAX_SHARE_ENCODED_BYTES,
    MAX_SHARE_DECOMPRESSED_BYTES: MAX_SHARE_DECOMPRESSED_BYTES,
    MAX_IMPORT_BYTES: MAX_IMPORT_BYTES,
    MAX_NUMERIC_VALUE: MAX_NUMERIC_VALUE,
    MAX_PROVIDERS: MAX_PROVIDERS,
    MAX_CLASSES_PER_PROVIDER: MAX_CLASSES_PER_PROVIDER,
    MAX_TARIFFS_PER_CLASS: MAX_TARIFFS_PER_CLASS,
    MAX_ADDRESS_LENGTH: MAX_ADDRESS_LENGTH,
    isTextWithinLimit: isTextWithinLimit,
    clampNumber: clampNumber,
    hasLimitedProviderStructure: hasLimitedProviderStructure
  };
  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  } else {
    root.CarshareLimits = api;
  }
})(globalThis);
