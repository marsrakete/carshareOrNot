(function(global){
  'use strict';

  var providerData = global.CarshareData;
  var BILLING_DISTANCE_WITH_PACKAGES = providerData.BILLING_DISTANCE_WITH_PACKAGES;
  var BILLING_TIME_WITH_INCLUDED_DISTANCE = providerData.BILLING_TIME_WITH_INCLUDED_DISTANCE;

  /**
   * Finds a provider in a supplied collection.
   * @param {Array<Object>} providers - Provider collection.
   * @param {string} id - Provider identifier.
   * @returns {Object|undefined} Matching provider when available.
   */
  function findProvider(providers, id){
    return providers.find(function(provider){ return provider.id === id; });
  }

  /**
   * Finds a vehicle class within a provider.
   * @param {Object} provider - Provider containing vehicle classes.
   * @param {string} id - Vehicle-class identifier.
   * @returns {Object|undefined} Matching vehicle class when available.
   */
  function findClass(provider, id){
    return provider.classes.find(function(cls){ return cls.id === id; });
  }

  /**
   * Finds a tariff within a vehicle class.
   * @param {Object} cls - Vehicle class containing tariffs.
   * @param {string} id - Tariff identifier.
   * @returns {Object|undefined} Matching tariff when available.
   */
  function findTariff(cls, id){
    return cls.tariffs.find(function(selectedTariff){ return selectedTariff.id === id; });
  }

  /**
   * Calculates annual owned-car and selected carsharing costs.
   * @param {Object} currentState - Complete calculator state.
   * @returns {Object} Cost comparison and calculation metadata.
   */
  function calculate(currentState){
    var o = currentState.own, u = currentState.usage;
    var years = Math.max(o.haltedauer, 1);
    var comparisonYears = Math.max(u.vergleichsjahre, 1);
    var jahreskm = Math.max(u.jahreskm, 0);

    var depreciation = Math.max(o.kaufpreis - o.restwert, 0) / years;
    var stellplatzAnnual = 0;
    var parkausweisAnnual = o.parkausweis;
    if(u.parkplatz){
      stellplatzAnnual = o.stellplatz * 12;
      parkausweisAnnual = 0;
    }
    var fixOwn = depreciation + o.wartung + o.versicherung + o.sonstiges + stellplatzAnnual + parkausweisAnnual;
    var fuelOwn = (jahreskm / 100) * o.verbrauch * o.kraftstoffpreis;
    var kmCostOwn = 0; // im Kraftstoffposten enthalten
    var totalOwn = fixOwn + fuelOwn;

    var provider = findProvider(currentState.providers, currentState.selection.providerId) || currentState.providers[0];
    var cls = null;
    if(provider){
      cls = findClass(provider, currentState.selection.classId);
    }
    if(provider && !cls) cls = provider.classes[0];
    var selectedTariff = null;
    if(cls){
      selectedTariff = findTariff(cls, currentState.selection.tariffId) || cls.tariffs[0];
    }

    var ownCostPerKm = 0;
    if(jahreskm > 0){
      ownCostPerKm = totalOwn / jahreskm;
    }
    var providerName = '–';
    if(provider){
      providerName = provider.name;
    }

    var result = {
      own: { fix: fixOwn, fuel: fuelOwn, km: kmCostOwn, total: totalOwn, perKm: ownCostPerKm },
      cambio: null, providerName: providerName
    };

    if(selectedTariff){
      var v = selectedTariff.v;
      var multiTrips = Math.max(u.mehrtagesfahrten, 0);
      var multiDays = Math.max(u.tageprofahrt, 0);
      var multiKmEach = Math.max(u.kmprofahrt, 0);

      /**
       * Calculates the time charge for one multi-day booking.
       * @param {number} days - Booking duration in days.
       * @returns {number} Time charge in euros.
       */
      function multiTimeCost(days){
        if(v.wochenpreis > 0){
          var weeks = Math.floor(days / 7);
          var remainingDays = days % 7;
          return weeks * v.wochenpreis + remainingDays * v.tagespreis;
        }
        return days * v.tagespreis;
      }
      /**
       * Calculates the tiered kilometer charge for one booking.
       * @param {number} km - Distance of the booking in kilometers.
       * @returns {number} Kilometer charge in euros.
       */
      function kmCost(km){
        if(km <= 100) return km * v.kmBis100;
        return 100 * v.kmBis100 + (km - 100) * v.kmAb100;
      }

      var shortTripsPerYear = Math.max(u.kurzfahrten, 0) * 12;
      var shortHours = Math.max(u.stundenprofahrt, 0);
      var shortTimeCostEach = shortHours * v.zeitpreis;
      if(v.tagespreis > 0){
        shortTimeCostEach = Math.min(shortTimeCostEach, v.tagespreis);
      }
      var chargesShortTime = v.billingMode !== BILLING_DISTANCE_WITH_PACKAGES;
      var chargesDistance = v.billingMode !== BILLING_TIME_WITH_INCLUDED_DISTANCE;
      var shortTimeCostTotal = 0;
      if(chargesShortTime){
        shortTimeCostTotal = shortTimeCostEach * shortTripsPerYear;
      }

      var multiTimeCostTotal = multiTrips * multiTimeCost(multiDays);
      var plannedMultiKmTotal = multiTrips * multiKmEach;
      var multiKmTotal = Math.min(plannedMultiKmTotal, jahreskm);
      var calculatedMultiKmEach = 0;
      if(multiTrips > 0){
        calculatedMultiKmEach = multiKmTotal / multiTrips;
      }
      var multiKmCostTotal = 0;
      if(chargesDistance){
        multiKmCostTotal = multiTrips * kmCost(calculatedMultiKmEach);
      }

      var shortKmTotal = Math.max(jahreskm - multiKmTotal, 0);
      var calculatedShortTrips = shortTripsPerYear;
      var implicitShortTrip = false;
      if(shortKmTotal > 0 && calculatedShortTrips === 0){
        calculatedShortTrips = 1;
        implicitShortTrip = true;
      }
      var shortKmCostTotal = 0;
      if(chargesDistance && calculatedShortTrips > 0){
        var shortKmEach = shortKmTotal / calculatedShortTrips;
        shortKmCostTotal = calculatedShortTrips * kmCost(shortKmEach);
      }

      var baseFeeAnnual = v.grundgebuehr * 12;
      var anmeldeAmortized = v.anmeldegebuehr / comparisonYears;

      var fixCambio = baseFeeAnnual + anmeldeAmortized;
      var timeCambio = shortTimeCostTotal + multiTimeCostTotal;
      var kmCambio = shortKmCostTotal + multiKmCostTotal;
      var totalCambio = fixCambio + timeCambio + kmCambio;
      var providerCostPerKm = 0;
      if(jahreskm > 0){
        providerCostPerKm = totalCambio / jahreskm;
      }

      result.cambio = {
        fix: fixCambio, fuel: timeCambio, km: kmCambio, total: totalCambio,
        perKm: providerCostPerKm,
        tariffName: selectedTariff.name, className: cls.name,
        multiTrips: multiTrips, multiKm: multiKmTotal,
        multiCost: multiTimeCostTotal + multiKmCostTotal,
        mileageAdjusted: plannedMultiKmTotal > jahreskm,
        implicitShortTrip: implicitShortTrip,
        billingMode: v.billingMode
      };
    }

    return result;
  }


  global.CarshareCalculator = { calculate: calculate };
})(window);
