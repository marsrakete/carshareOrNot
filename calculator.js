(function(global){
  'use strict';

  var providerData = global.CarshareData;
  var BILLING_DISTANCE_WITH_PACKAGES = providerData.BILLING_DISTANCE_WITH_PACKAGES;
  var BILLING_TIME_WITH_INCLUDED_DISTANCE = providerData.BILLING_TIME_WITH_INCLUDED_DISTANCE;
  var limits = global.CarshareLimits;

  /**
   * Creates a bounded copy of usage settings before arithmetic starts.
   * @param {Object} values - User or persisted usage settings.
   * @returns {Object} Usage settings with finite non-negative numeric fields.
   */
  function normalizeUsage(values){
    var normalized = providerData.defaultUsage();
    Object.keys(normalized).forEach(function(field){
      if(typeof normalized[field] === 'number'){
        normalized[field] = limits.clampNumber(values[field], normalized[field]);
      } else if(typeof values[field] !== 'undefined'){
        normalized[field] = values[field];
      }
    });
    return normalized;
  }

  /**
   * Creates a bounded copy of tariff prices before arithmetic starts.
   * @param {Object} values - Selected tariff values.
   * @returns {Object} Tariff values with finite non-negative numeric prices.
   */
  function normalizeTariffValues(values){
    var normalized = Object.assign({}, values);
    ['grundgebuehr', 'zeitpreis', 'tagespreis', 'wochenpreis', 'kmBis100', 'kmAb100', 'anmeldegebuehr'].forEach(function(field){
      normalized[field] = limits.clampNumber(values[field], 0);
    });
    return normalized;
  }

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
    var o = providerData.normalizeOwn(currentState.own), u = normalizeUsage(currentState.usage);
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
    var extraOwnCost = Math.max(o.sonstigesExtra || 0, 0);
    var fixOwn = depreciation + o.wartung + o.versicherung + o.sonstiges + extraOwnCost + stellplatzAnnual + parkausweisAnnual;
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
      var v = normalizeTariffValues(selectedTariff.v);

      /**
       * Calculates the time charge for one booking lasting one or more days.
       * @param {number} days - Booking duration in days.
       * @returns {number} Time charge in euros.
       */
      function packageTimeCost(days){
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

      var shortTripOccasionsPerYear = Math.max(u.kurzfahrten, 0) * 12;
      var shortTripsPerYear = shortTripOccasionsPerYear;
      var shortHours = Math.max(u.stundenprofahrt, 0);
      if(u.alltagsmodell === 'split-return'){
        shortTripsPerYear = shortTripOccasionsPerYear * 2;
        shortHours = shortHours / 2;
      }
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

      var bringDaysPerYear = Math.max(u.bringtageprowoche, 0) * Math.max(u.bringwochenprojahr, 0);
      var bringSeparateShare = Math.max(u.bringseparatanteil, 0);
      bringSeparateShare = Math.min(bringSeparateShare, 100) / 100;
      var bringTrips = bringDaysPerYear * Math.max(u.bringbuchungenprotag, 0) * bringSeparateShare;
      var bringPlannedKm = bringDaysPerYear * Math.max(u.bringkmprotag, 0) * bringSeparateShare;

      var tripCategories = [
        {
          key: 'schoolRuns',
          trips: bringTrips,
          hours: Math.max(u.bringstundenprobuchung, 0),
          days: 0,
          plannedKm: bringPlannedKm,
          usesDayPackages: false
        },
        {
          key: 'dayTrips',
          trips: Math.max(u.tagesausfluege, 0),
          hours: Math.max(u.stundenproausflug, 0),
          days: 0,
          plannedKm: Math.max(u.tagesausfluege, 0) * Math.max(u.kmproausflug, 0),
          usesDayPackages: false
        },
        {
          key: 'multiDay',
          trips: Math.max(u.mehrtagesfahrten, 0),
          hours: 0,
          days: Math.max(u.tageprofahrt, 0),
          plannedKm: Math.max(u.mehrtagesfahrten, 0) * Math.max(u.kmprofahrt, 0),
          usesDayPackages: true
        },
        {
          key: 'vacations',
          trips: Math.max(u.urlaubsfahrten, 0),
          hours: 0,
          days: Math.max(u.tageprourlaub, 0),
          plannedKm: Math.max(u.urlaubsfahrten, 0) * Math.max(u.kmprourlaub, 0),
          usesDayPackages: true
        }
      ];

      var plannedDetailedKm = 0;
      for(var categoryIndex = 0; categoryIndex < tripCategories.length; categoryIndex += 1){
        var plannedCategory = tripCategories[categoryIndex];
        plannedDetailedKm += plannedCategory.plannedKm;
      }

      var mileageScale = 1;
      if(plannedDetailedKm > jahreskm && plannedDetailedKm > 0){
        mileageScale = jahreskm / plannedDetailedKm;
      }

      var categoryCosts = {};
      var detailedKmTotal = 0;
      var detailedTimeCostTotal = 0;
      var detailedKmCostTotal = 0;
      for(var costIndex = 0; costIndex < tripCategories.length; costIndex += 1){
        var category = tripCategories[costIndex];
        var categoryKm = category.plannedKm * mileageScale;
        var categoryKmEach = 0;
        if(category.trips > 0){
          categoryKmEach = categoryKm / category.trips;
        }

        var categoryTimeCost = 0;
        if(category.usesDayPackages){
          categoryTimeCost = category.trips * packageTimeCost(category.days);
        } else if(chargesShortTime){
          var categoryTimeCostEach = category.hours * v.zeitpreis;
          if(v.tagespreis > 0){
            categoryTimeCostEach = Math.min(categoryTimeCostEach, v.tagespreis);
          }
          categoryTimeCost = category.trips * categoryTimeCostEach;
        }

        var categoryKmCost = 0;
        if(chargesDistance && category.trips > 0){
          categoryKmCost = category.trips * kmCost(categoryKmEach);
        }

        categoryCosts[category.key] = {
          trips: category.trips,
          km: categoryKm,
          timeCost: categoryTimeCost,
          kmCost: categoryKmCost,
          total: categoryTimeCost + categoryKmCost
        };
        detailedKmTotal += categoryKm;
        detailedTimeCostTotal += categoryTimeCost;
        detailedKmCostTotal += categoryKmCost;
      }

      var shortKmTotal = Math.max(jahreskm - detailedKmTotal, 0);
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
      categoryCosts.everyday = {
        trips: calculatedShortTrips,
        km: shortKmTotal,
        timeCost: shortTimeCostTotal,
        kmCost: shortKmCostTotal,
        total: shortTimeCostTotal + shortKmCostTotal
      };

      var baseFeeAnnual = v.grundgebuehr * 12;
      var anmeldeAmortized = v.anmeldegebuehr / comparisonYears;

      var fixCambio = baseFeeAnnual + anmeldeAmortized;
      var timeCambio = shortTimeCostTotal + detailedTimeCostTotal;
      var kmCambio = shortKmCostTotal + detailedKmCostTotal;
      var totalCambio = fixCambio + timeCambio + kmCambio;
      var providerCostPerKm = 0;
      if(jahreskm > 0){
        providerCostPerKm = totalCambio / jahreskm;
      }

      result.cambio = {
        fix: fixCambio, fuel: timeCambio, km: kmCambio, total: totalCambio,
        perKm: providerCostPerKm,
        tariffName: selectedTariff.name, className: cls.name,
        multiTrips: categoryCosts.multiDay.trips, multiKm: categoryCosts.multiDay.km,
        multiCost: categoryCosts.multiDay.total,
        schoolRunTrips: categoryCosts.schoolRuns.trips,
        schoolRunKm: categoryCosts.schoolRuns.km,
        schoolRunCost: categoryCosts.schoolRuns.total,
        dayTripCost: categoryCosts.dayTrips.total,
        vacationTrips: categoryCosts.vacations.trips,
        vacationKm: categoryCosts.vacations.km,
        vacationCost: categoryCosts.vacations.total,
        tripCategories: categoryCosts,
        mileageAdjusted: plannedDetailedKm > jahreskm,
        implicitShortTrip: implicitShortTrip,
        billingMode: v.billingMode,
        everydayBookingModel: u.alltagsmodell || 'continuous'
      };
    }

    return result;
  }


  global.CarshareCalculator = { calculate: calculate };
})(window);
