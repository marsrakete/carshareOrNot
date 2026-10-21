(function(){
  'use strict';

  // ---------- Defaults ----------

  var providerData = window.CarshareData;
  var limits = window.CarshareLimits;
  var defaultOwn = providerData.defaultOwn;
  var defaultUsage = providerData.defaultUsage;
  var tariff = providerData.tariff;
  var defaultProviders = providerData.defaultProviders;
  var normalizeTariffData = providerData.normalizeTariffData;
  var recommendationData = window.CarshareRecommendations;
  var MODE_MANUAL = recommendationData.MODE_MANUAL;
  var MODE_SINGLE = recommendationData.MODE_SINGLE;
  var MODE_MIX = recommendationData.MODE_MIX;

  var defaultLocationForProvider = window.CarshareStateValidation.defaultLocationForProvider;
  var defaultLocation = window.CarshareStateValidation.defaultLocation;
  var normalizeSelection = window.CarshareStateValidation.normalizeSelection;
  var isValidSharedState = window.CarshareStateValidation.isValidSharedState;

  var state = {
    own: defaultOwn(),
    usage: defaultUsage(),
    location: defaultLocation(),
    providers: defaultProviders(),
    selection: { providerId: 'cambio', classId: 'klein', tariffId: 'aktiv', recommendationMode: MODE_MANUAL }
  };

  /**
   * Refreshes the result view through its controller after initialization.
   * @returns {void}
   */
  function render(){
    updateStellplatzState(state.usage.parkplatz);
    resultsUI.render();
    inputGroupsUI.updateSummaries();
  }

  /**
   * Provides the current result explanation to the sharing controller.
   * @param {Object} result - Current calculation result.
   * @returns {string} Explanation of the cost difference.
   */
  function describeRecommendationReason(result){
    return resultsUI.describeRecommendationReason(result);
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
   * @param {Object} currentState - Vollständiger zu berechnender Rechnerzustand.
   * @returns {Object} Vollständiges Ergebnis für die aktuelle Darstellung.
   */
  function calculateResultForState(currentState){
    if(currentState.selection.recommendationMode === MODE_SINGLE || currentState.selection.recommendationMode === MODE_MIX){
      var recommendedResult = recommendationData.calculateRecommendation(currentState);
      if(recommendedResult){
        return recommendedResult;
      }
      var unavailableResult = calculate(currentState);
      unavailableResult.alternative = null;
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
    document.getElementById('use_child_seat_infant_count').value = u.childSeatInfantCount;
    document.getElementById('use_child_seat_booster_count').value = u.childSeatBoosterCount;
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
    var effect = 'Free-Floating wird normal berücksichtigt.';
    if(fit.effective === recommendationData.FREE_FLOATING_UNSUITABLE){
      effect = 'Free-Floating ist aus automatischen Empfehlungen ausgeschlossen.';
    } else if(fit.effective === recommendationData.FREE_FLOATING_SUPPLEMENT){
      effect = 'Free-Floating wird ausschließlich im Mobilitätsmix berücksichtigt.';
    }
    document.getElementById('freefloating-fit-hint').textContent = prefix + fit.reason + '. ' + effect + ' Eine manuelle Anbieterwahl bleibt möglich.';
  }

  /**
   * Shows whether detailed trip mileage conflicts with the annual mileage.
   * @param {Object} result - Current calculation result.
   * @returns {void}
   */
  function renderUsageValidation(result){
    var validation = document.getElementById('usage-km-validation');
    var messages = [];
    if(result.alternative && result.alternative.mileageAdjusted){
      messages.push('Bring- und Abholfahrten, Tagesausflüge, Mehrtages- und Urlaubsfahrten ergeben zusammen mehr Kilometer als die gesamte Fahrleistung. Für die Berechnung werden diese Strecken anteilig auf die jährliche Fahrleistung begrenzt.');
    }
    if(result.alternative && result.alternative.implicitShortTrip){
      messages.push('Nach Abzug der einzeln erfassten Fahrten bleiben Kilometer übrig, obwohl keine Alltagsfahrten angegeben sind. Diese Strecke wird für die Berechnung als eine Fahrt behandelt.');
    }
    validation.textContent = messages.join(' ');
  }

  /**
   * Updates the guaranteed-space explanation while keeping both independently counted parking inputs editable.
   * @param {boolean} active - Whether a guaranteed space is available for the parking-search guidance.
   * @returns {void} Preserves both entered amounts when the parking mode changes.
   */
  function updateStellplatzState(active){
    document.getElementById('own_stellplatz').disabled = false;
    document.getElementById('own_parkausweis').disabled = false;
    var mode = 'public';
    if(active){
      mode = 'guaranteed';
    }
    var template = document.getElementById('parking-hint-template');
    var message = template.content.querySelector('[data-parking-mode="' + mode + '"]');
    document.getElementById('stellplatz-hint').textContent = message.textContent;
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
      if(result.alternative){
        recommendedTariffLabel = result.providerName + ' · ' + result.alternative.tariffName;
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
    state.own = providerData.normalizeOwn(state.own);
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
      childSeatInfantCount: +document.getElementById('use_child_seat_infant_count').value || 0,
      childSeatBoosterCount: +document.getElementById('use_child_seat_booster_count').value || 0,
      childSeatNeedsReview: false,
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
    document.getElementById('own-reset-btn').addEventListener('click', resetOwnCar);
    var ownIds = ['own_kaufpreis','own_haltedauer','own_restwert','own_wartung','own_versicherung','own_sonstiges','own_sonstiges_extra','own_verbrauch','own_kraftstoffpreis','own_stellplatz','own_parkausweis'];
    var useIds = [
      'use_jahreskm','use_vergleichsjahre','use_kurzfahrten','use_stundenprofahrt',
      'use_bringtageprowoche','use_bringwochenprojahr','use_bringkmprotag','use_bringbuchungenprotag','use_bringstundenprobuchung','use_bringseparatanteil',
      'use_tagesausfluege','use_stundenproausflug','use_kmproausflug',
      'use_mehrtagesfahrten','use_tageprofahrt','use_kmprofahrt',
      'use_urlaubsfahrten','use_tageprourlaub','use_kmprourlaub'
    ];

    ownIds.forEach(function(id){
      document.getElementById(id).addEventListener('input', function(){
        readOwnFromInputs();
        render();
        scheduleSave();
      });
    });
    useIds.forEach(function(id){
      document.getElementById(id).addEventListener('input', function(){ readUsageFromInputs(); renderFreeFloatingFitHint(); render(); scheduleSave(); });
    });
    document.getElementsByName('flex').forEach(function(r){
      r.addEventListener('change', function(){ readUsageFromInputs(); render(); scheduleSave(); });
    });
    document.getElementById('use_parkplatz').addEventListener('change', function(){ readUsageFromInputs(); render(); scheduleSave(); });
    document.getElementById('use_child_seat_infant_count').addEventListener('input', function(){ readUsageFromInputs(); renderFreeFloatingFitHint(); render(); scheduleSave(); });
    document.getElementById('use_child_seat_booster_count').addEventListener('input', function(){ readUsageFromInputs(); renderFreeFloatingFitHint(); render(); scheduleSave(); });
    document.getElementById('use_freefloating_fit').addEventListener('change', function(){ readUsageFromInputs(); renderFreeFloatingFitHint(); render(); scheduleSave(); });
    document.getElementById('use_booking_model').addEventListener('change', function(){ readUsageFromInputs(); render(); scheduleSave(); });
    document.getElementById('scenario-more-btn').addEventListener('click', toggleAdditionalUsageScenarios);
    document.getElementById('scenario-change-btn').addEventListener('click', reopenUsageScenarios);
    document.getElementById('scenario-values-btn').addEventListener('click', focusScenarioUsageValues);
    document.getElementById('scenario-undo-btn').addEventListener('click', restoreUsageBeforeScenario);

    document.getElementById('loc_provider').addEventListener('change', function(e){
      locationUI.selectProvider(e.target.value);
    });
    document.getElementById('sel_provider').addEventListener('change', function(e){
      locationUI.invalidateProvider();
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
      profilesUI.resetUsageScenarios();
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
   * Blocks minus signs typed or pasted into numeric controls, including dynamic tariff rows.
   * @param {Event} event - Keyboard, insertion, paste or drop event.
   * @returns {void} Cancels an insertion containing a minus sign.
   */
  function preventNegativeNumberEntry(event){
    if(!event.target || event.target.type !== 'number'){
      return;
    }
    var text = event.key || event.data || '';
    if(event.clipboardData){
      text = event.clipboardData.getData('text');
    } else if(event.dataTransfer){
      text = event.dataTransfer.getData('text');
    }
    if(/[-−]/.test(text)){
      event.preventDefault();
    }
  }

  /**
   * Enforces numeric bounds before field handlers calculate or save an entered value.
   * @param {Event} event - Input or change event from a numeric control.
   * @returns {void} Corrects out-of-range numbers while preserving intentionally empty fields.
   */
  function validateNumberEntry(event){
    var input = event.target;
    if(!input || input.type !== 'number'){
      return;
    }
    var minimum = 0;
    if(input.min !== ''){
      minimum = Math.max(Number(input.min), 0);
    }
    if(input.validity && input.validity.badInput){
      input.value = String(minimum);
      return;
    }
    if(input.value === ''){
      return;
    }
    var value = Number(input.value);
    if(!isFinite(value) || value < minimum){
      input.value = String(minimum);
    } else if(value > limits.MAX_NUMERIC_VALUE){
      input.value = String(limits.MAX_NUMERIC_VALUE);
    } else if(input.max !== '' && value > Number(input.max)){
      input.value = input.max;
    }
  }

  /**
   * Installs capture handlers so validation precedes all calculator and tariff listeners.
   * @returns {void} Applies to existing controls and subsequently cloned templates.
   */
  function bindNumberValidation(){
    ['keydown', 'beforeinput', 'paste', 'drop'].forEach(function(eventName){
      document.addEventListener(eventName, preventNegativeNumberEntry, true);
    });
    ['input', 'change'].forEach(function(eventName){
      document.addEventListener(eventName, validateNumberEntry, true);
    });
  }

  /**
   * Loads persisted state, initializes controls and performs the first render.
   * @returns {Promise<void>} Resolves when initialization has completed.
   */
  async function init(){
    inputGroupsUI.mount();
    bindNumberValidation();
    await loadState();
    var sharedStateResult = await loadSharedState();
    fillOwnInputs();
    fillUsageInputs();
    fillLocationInputs();
    renderUsageScenarios();
    renderOwnProfiles();
    bindRechnerEvents();
    renderProviders();
    bindTariffEvents();
    bindTabs();
    render();
    if(sharedStateResult.found){
      document.getElementById('share-status').textContent = sharedStateResult.message;
    }
  }

  var inputGroupsUI = window.CarshareInputGroupsUI.create();

  var storage = window.CarshareStateStorage.create({
    state: state
  });
  var scheduleSave = storage.scheduleSave;
  var loadState = storage.loadState;
  var sharing = window.CarshareSharing.create({
    state: state,
    calculateDisplayedResult: calculateDisplayedResult,
    fmtEUR: fmtEUR,
    describeRecommendationReason: describeRecommendationReason
  });
  var encodeSharePayload = sharing.encodeSharePayload;
  var decodeSharePayload = sharing.decodeSharePayload;
  var createCompactShareState = sharing.createCompactShareState;
  var expandCompactShareState = sharing.expandCompactShareState;
  var loadSharedState = sharing.loadSharedState;
  var shareCurrentState = sharing.shareCurrentState;
  var shareResultImage = sharing.shareResultImage;
  var profilesUI = window.CarshareProfilesUI.create({
    revealField: inputGroupsUI.revealField,
    state: state,
    fillOwnInputs: fillOwnInputs,
    fillUsageInputs: fillUsageInputs,
    render: render,
    scheduleSave: scheduleSave,
    fmtEUR: fmtEUR
  });
  var renderOwnProfiles = profilesUI.renderOwnProfiles;
  var resetOwnCar = profilesUI.resetOwnCar;
  var renderUsageScenarios = profilesUI.renderUsageScenarios;
  var restoreUsageBeforeScenario = profilesUI.restoreUsageBeforeScenario;
  var reopenUsageScenarios = profilesUI.reopenUsageScenarios;
  var focusScenarioUsageValues = profilesUI.focusScenarioUsageValues;
  var toggleAdditionalUsageScenarios = profilesUI.toggleAdditionalUsageScenarios;
  var locationUI = window.CarshareLocationUI.create({
    state: state,
    calculateDisplayedResult: calculateDisplayedResult,
    findProvider: findProvider,
    appendSelectOption: appendSelectOption,
    render: render,
    scheduleSave: scheduleSave
  });
  var getProviderLocation = locationUI.getProviderLocation;
  var getLocationProvider = locationUI.getLocationProvider;
  var fillLocationInputs = locationUI.fillLocationInputs;
  var readLocationFromInputs = locationUI.readLocationFromInputs;
  var readFreeFloatingLocationFromInput = locationUI.readFreeFloatingLocationFromInput;
  var readAddressFromInput = locationUI.readAddressFromInput;
  var searchStations = locationUI.searchStations;
  var resultsUI = window.CarshareResultsUI.create({
    state: state,
    getProviderLocation: getProviderLocation,
    findProvider: findProvider,
    findClass: findClass,
    calculateResultForState: calculateResultForState,
    calculateDisplayedResult: calculateDisplayedResult,
    fmtEUR: fmtEUR,
    fmtEURcents: fmtEURcents,
    populateSelects: populateSelects,
    fillLocationInputs: fillLocationInputs,
    renderUsageValidation: renderUsageValidation
  });
  var tariffEditor = window.CarshareTariffEditor.create({
    state: state,
    render: render,
    scheduleSave: scheduleSave,
    fillLocationInputs: fillLocationInputs,
    uid: uid
  });
  var buildProviderExport = tariffEditor.buildProviderExport;
  var renderProviders = tariffEditor.renderProviders;
  var importProviderFile = tariffEditor.importProviderFile;
  var bindTariffEvents = tariffEditor.bindTariffEvents;

  init();

})();
