(function(root){
  'use strict';

  /**
   * Checks a persisted identifier against the shared format and reserved names.
   * @param {*} id - Candidate identifier.
   * @returns {boolean} True for a safe identifier of at most 64 characters.
   */
  function isValidIdentifier(id){
    if(typeof id !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(id)){
      return false;
    }
    var reserved = Object.getOwnPropertyNames(Object.prototype);
    if(reserved.some(function(name){ return name.toLowerCase() === id; })){
      return false;
    }
    return id !== 'prototype';
  }

  /**
   * Excludes identifiers reserved for recommendation modes and mobility supplements.
   * @param {*} id - Candidate provider identifier.
   * @returns {boolean} True for a provider identifier usable by the application.
   */
  function isValidProviderId(id){
    if(!isValidIdentifier(id)){
      return false;
    }
    return id !== 'manual' && id !== 'recommend-single' && id !== 'recommend-mix' && id.indexOf('supplement-') !== 0;
  }

  /**
   * Checks identifiers and uniqueness within one collection.
   * @param {*} items - Objects containing identifiers.
   * @param {Function} validate - Predicate for an identifier.
   * @returns {boolean} True when every identifier is valid and unique.
   */
  function hasUniqueIdentifiers(items, validate){
    if(!Array.isArray(items)){
      return false;
    }
    var seen = new Set();
    return items.every(function(item){
      if(!item || !validate(item.id) || seen.has(item.id)){
        return false;
      }
      seen.add(item.id);
      return true;
    });
  }

  /**
   * Validates provider IDs globally, class IDs per provider and tariff IDs per class.
   * @param {*} providers - Runtime or JSON provider collection.
   * @returns {boolean} True when all identifier scopes are unambiguous.
   */
  function hasValidProviderIdentifiers(providers){
    if(!hasUniqueIdentifiers(providers, isValidProviderId)){
      return false;
    }
    return providers.every(function(provider){
      if(!hasUniqueIdentifiers(provider.classes, isValidIdentifier)){
        return false;
      }
      return provider.classes.every(function(providerClass){
        return hasUniqueIdentifiers(providerClass.tariffs, isValidIdentifier);
      });
    });
  }

  var api = { isValidIdentifier: isValidIdentifier, isValidProviderId: isValidProviderId, hasUniqueIdentifiers: hasUniqueIdentifiers, hasValidProviderIdentifiers: hasValidProviderIdentifiers };
  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  } else {
    root.CarshareIdentifiers = api;
  }
})(globalThis);
