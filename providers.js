(function(global){
  'use strict';

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

  /**
   * Checks whether a billing-model identifier is supported.
   * @param {string} billingMode - Billing-model identifier.
   * @returns {boolean} True for a supported billing model.
   */
  function isKnownBillingMode(billingMode){
    return billingMode === BILLING_TIME_AND_DISTANCE || billingMode === BILLING_DISTANCE_WITH_PACKAGES || billingMode === BILLING_TIME_WITH_INCLUDED_DISTANCE;
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
      wartung: 600, versicherung: 700, sonstiges: 400,
      verbrauch: 6.5, kraftstoffpreis: 2.20, stellplatz: 0, parkausweis: 30
    };
  }
  /**
   * Creates the default annual usage profile.
   * @returns {Object} Default usage values.
   */
  function defaultUsage(){
    return {
      jahreskm: 6000, vergleichsjahre: 6, kurzfahrten: 6, stundenprofahrt: 2,
      bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12,
      bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100,
      kindersitz: false,
      tagesausfluege: 0, stundenproausflug: 8, kmproausflug: 120,
      mehrtagesfahrten: 3, tageprofahrt: 3, kmprofahrt: 250,
      urlaubsfahrten: 0, tageprourlaub: 7, kmprourlaub: 900,
      flex: 'teilweise', freefloatingFit: 'auto', parkplatz: false
    };
  }
  /**
   * Creates a normalized tariff value object.
   * @param {number} grundgebuehr - Monthly base fee in euros.
   * @param {number} zeit - Hourly price in euros.
   * @param {number} tag - Daily price in euros.
   * @param {number} kmBis100 - Price per kilometer up to 100 kilometers.
   * @param {number} kmAb100 - Price per kilometer after 100 kilometers.
   * @param {number} anmeldegebuehr - One-time registration fee in euros.
   * @returns {Object} Tariff values including the derived weekly price.
   */
  function tariff(grundgebuehr, zeit, tag, kmBis100, kmAb100, anmeldegebuehr){
    var woche = tag * 5; // Näherung, falls kein separater Wochenpreis bekannt ist
    return { grundgebuehr: grundgebuehr, zeitpreis: zeit, tagespreis: tag, wochenpreis: woche,
             kmBis100: kmBis100, kmAb100: kmAb100, anmeldegebuehr: anmeldegebuehr,
             billingMode: inferBillingMode(zeit, kmBis100, kmAb100),
             meta: { sourceUrl: '', region: '', lastVerifiedAt: '' } };
  }
  /**
   * Creates the built-in provider, vehicle-class and tariff data.
   * @returns {Array<Object>} Default provider data.
   */
  function defaultProviders(){
    var providers = [
      {
        id: 'cambio', name: 'Cambio', operationMode: 'station-based',
        classes: [
          { id: 'klein', name: 'Kleinwagen', tariffs: [
              { id: 'aktiv', name: 'Aktiv (mit Grundgebühr)', v: tariff(10, 1.70, 21.00, 0.23, 0.16, 30) },
              { id: 'basis', name: 'Basis (ohne Grundgebühr)', v: tariff(0, 3.00, 30.00, 0.24, 0.18, 30) }
          ]},
          { id: 'kombi', name: 'Kombi', tariffs: [
              { id: 'aktiv', name: 'Aktiv (mit Grundgebühr)', v: tariff(10, 2.20, 29.00, 0.25, 0.16, 30) },
              { id: 'basis', name: 'Basis (ohne Grundgebühr)', v: tariff(0, 4.00, 40.00, 0.24, 0.18, 30) }
          ]},
          { id: 'transporter', name: 'Transporter', tariffs: [
              { id: 'aktiv', name: 'Aktiv (mit Grundgebühr)', v: tariff(10, 4.90, 49.00, 0.36, 0.21, 30) },
              { id: 'basis', name: 'Basis (ohne Grundgebühr)', v: tariff(0, 7.00, 70.00, 0.24, 0.18, 30) }
          ]}
        ]
      },
      {
        // Reiner Kilometertarif, kein Zeitpreis: "zeitpreis" bleibt 0, Tagespreis gilt als Paketpreis für Mehrtagesfahrten
        id: 'miles', name: 'Miles', operationMode: 'free-floating',
        classes: [
          { id: 'klein', name: 'Kleinwagen (S)', tariffs: [
              { id: 'km', name: 'Kilometertarif', v: tariff(0, 0, 45.00, 0.99, 0.19, 0) }
          ]},
          { id: 'kombi', name: 'Kombi (M)', tariffs: [
              { id: 'km', name: 'Kilometertarif', v: tariff(0, 0, 49.00, 1.09, 0.19, 0) }
          ]},
          { id: 'transporter', name: 'Transporter (L)', tariffs: [
              { id: 'km', name: 'Kilometertarif', v: tariff(0, 0, 99.00, 1.29, 0.39, 0) }
          ]}
        ]
      },
      {
        // Reiner Zeittarif (Minuten/Stunden/Tag), Kilometer weitgehend im Paket inklusive
        id: 'free2move', name: 'Free2move (vormals Share Now)', operationMode: 'free-floating',
        classes: [
          { id: 'klein', name: 'Kleinwagen', tariffs: [
              { id: 'zeit', name: 'Minuten-/Stunden-/Tagestarif', v: tariff(0, 7.00, 20.50, 0, 0, 0) }
          ]},
          { id: 'kombi', name: 'Kombi', tariffs: [
              { id: 'zeit', name: 'Minuten-/Stunden-/Tagestarif', v: tariff(0, 9.00, 28.00, 0, 0, 0) }
          ]}
        ]
      },
      {
        id: 'flinkster', name: 'Flinkster', operationMode: 'station-based',
        classes: [
          { id: 'klein', name: 'Kleinwagen (Mini)', tariffs: [
              { id: 'bundesweit', name: 'Bundesweiter Tarif (ohne Grundgebühr)', v: tariff(0, 2.30, 39.00, 0.18, 0.18, 0) }
          ]},
          { id: 'kombi', name: 'Kombi (Mittelklasse)', tariffs: [
              { id: 'bundesweit', name: 'Bundesweiter Tarif (ohne Grundgebühr)', v: tariff(0, 4.00, 55.00, 0.19, 0.19, 0) }
          ]},
          { id: 'transporter', name: 'Transporter', tariffs: [
              { id: 'bundesweit', name: 'Bundesweiter Tarif (ohne Grundgebühr)', v: tariff(0, 8.00, 80.00, 0.20, 0.20, 0) }
          ]}
        ]
      },
      {
        // Stationsbasiert wie Cambio/Flinkster, regional unterschiedliche Gesellschaften (hier: bundesweiter Richtwert)
        id: 'stadtmobil', name: 'Stadtmobil', operationMode: 'station-based',
        classes: [
          { id: 'klein', name: 'Kleinwagen', tariffs: [
              { id: 'vorteil', name: 'Vorteil (mit Grundgebühr)', v: tariff(10, 1.80, 22.00, 0.22, 0.18, 30) },
              { id: 'classic', name: 'Classic (ohne Grundgebühr)', v: tariff(0, 2.40, 29.00, 0.28, 0.25, 30) }
          ]},
          { id: 'kombi', name: 'Kombi (Mittelklasse)', tariffs: [
              { id: 'vorteil', name: 'Vorteil (mit Grundgebühr)', v: tariff(10, 2.20, 27.00, 0.25, 0.21, 30) },
              { id: 'classic', name: 'Classic (ohne Grundgebühr)', v: tariff(0, 2.80, 34.00, 0.31, 0.28, 30) }
          ]},
          { id: 'transporter', name: 'Transporter', tariffs: [
              { id: 'vorteil', name: 'Vorteil (mit Grundgebühr)', v: tariff(10, 3.50, 43.00, 0.35, 0.30, 30) },
              { id: 'classic', name: 'Classic (ohne Grundgebühr)', v: tariff(0, 4.40, 53.00, 0.43, 0.40, 30) }
          ]}
        ]
      },
      {
        // Freefloating wie Miles/Free2move: Minuten-/Stunden-/Tagespreis, Kilometer weitgehend inklusive
        id: 'sixtshare', name: 'Sixt Share', operationMode: 'free-floating',
        classes: [
          { id: 'klein', name: 'Kleinwagen', tariffs: [
              { id: 'zeit', name: 'Minuten-/Stunden-/Tagestarif', v: tariff(0, 8.00, 29.00, 0, 0, 0) }
          ]},
          { id: 'kombi', name: 'Kombi / SUV', tariffs: [
              { id: 'zeit', name: 'Minuten-/Stunden-/Tagestarif', v: tariff(0, 11.00, 39.00, 0, 0, 0) }
          ]}
        ]
      }
    ];
    var metadataByProvider = {
      cambio: { sourceUrl: 'https://www.cambio-carsharing.de', region: 'Regional unterschiedlich', lastVerifiedAt: '' },
      miles: { sourceUrl: 'https://www.miles-mobility.com', region: 'Geschäftsgebiet des Anbieters', lastVerifiedAt: '' },
      free2move: { sourceUrl: 'https://www.free2move.com', region: 'Geschäftsgebiet des Anbieters', lastVerifiedAt: '' },
      flinkster: { sourceUrl: 'https://www.flinkster.de', region: 'Deutschland, regional unterschiedlich', lastVerifiedAt: '' },
      stadtmobil: { sourceUrl: 'https://www.stadtmobil.de', region: 'Regionalgesellschaft prüfen', lastVerifiedAt: '' },
      sixtshare: { sourceUrl: 'https://www.sixt.de/share', region: 'Geschäftsgebiet des Anbieters', lastVerifiedAt: '' }
    };
    providers.forEach(function(provider){
      var metadata = metadataByProvider[provider.id];
      provider.classes.forEach(function(cls){
        cls.tariffs.forEach(function(selectedTariff){
          selectedTariff.v.meta = Object.assign({}, metadata);
        });
      });
    });
    return providers;
  }

  /**
   * Adds billing models, weekly prices and source metadata missing from older tariff data.
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
            var defaultClass = defaultProvider.classes.find(function(candidate){ return candidate.id === cls.id; });
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
    isKnownBillingMode: isKnownBillingMode,
    defaultOwn: defaultOwn,
    defaultUsage: defaultUsage,
    tariff: tariff,
    defaultProviders: defaultProviders,
    normalizeTariffData: normalizeTariffData
  };
})(window);
