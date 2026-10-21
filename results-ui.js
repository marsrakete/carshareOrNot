(function(){
  'use strict';

  /**
   * Creates the results-ui controller without starting UI or network work.
   * @param {Object} dependencies - Explicit controller dependencies.
   * @param {Object} dependencies.state - Shared state container; its sections may be replaced.
   * @param {Function} dependencies.getProviderLocation - Application callback getProviderLocation; called only after initialization.
   * @param {Function} dependencies.findProvider - Application callback findProvider; called only after initialization.
   * @param {Function} dependencies.calculateResultForState - Application callback calculateResultForState; called only after initialization.
   * @param {Function} dependencies.calculateDisplayedResult - Application callback calculateDisplayedResult; called only after initialization.
   * @param {Function} dependencies.fmtEUR - Application callback fmtEUR; called only after initialization.
   * @param {Function} dependencies.fmtEURcents - Application callback fmtEURcents; called only after initialization.
   * @param {Function} dependencies.populateSelects - Application callback populateSelects; called only after initialization.
   * @param {Function} dependencies.fillLocationInputs - Application callback fillLocationInputs; called only after initialization.
   * @param {Function} dependencies.renderUsageValidation - Application callback renderUsageValidation; called only after initialization.
   * @param {Function} dependencies.findClass - Finds a vehicle class in a provider.
   * @returns {Object} Functions owned by this controller.
   */
  function create(dependencies){
    var recommendationData = window.CarshareRecommendations;
    var MODE_SINGLE = recommendationData.MODE_SINGLE;
    var describeChildSeatAvailability = recommendationData.describeChildSeatAvailability;
    var state = dependencies.state;
    var getProviderLocation = dependencies.getProviderLocation;
    var findProvider = dependencies.findProvider;
    var findClass = dependencies.findClass;
    var calculateResultForState = dependencies.calculateResultForState;
    var calculateDisplayedResult = dependencies.calculateDisplayedResult;
    var fmtEUR = dependencies.fmtEUR;
    var fmtEURcents = dependencies.fmtEURcents;
    var populateSelects = dependencies.populateSelects;
    var fillLocationInputs = dependencies.fillLocationInputs;
    var renderUsageValidation = dependencies.renderUsageValidation;

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
          text: 'Nach Fahrzeugklasse, Standort und Alltagseignung bleibt kein passender Anbieter für diesen Empfehlungsmodus übrig.' });
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

      if(!r.recommendation && (u.childSeatInfantCount > 0 || u.childSeatBoosterCount > 0 || u.childSeatNeedsReview)){
        var selectedProvider = findProvider(state.selection.providerId);
        var selectedClass = null;
        if(selectedProvider){
          selectedClass = findClass(selectedProvider, state.selection.classId);
        }
        if(selectedClass){
          cards.push({ tone: 'mid', title: 'Kindersitze in der gewählten Fahrzeugklasse',
            text: describeChildSeatAvailability(u, selectedClass.childSeats) + '. Bitte die Ausstattung vor der Buchung prüfen.' });
        }
      }

      if(r.alternative && u.bringtageprowoche > 0 && u.bringwochenprojahr > 0){
        var schoolRunTone = 'good';
        var schoolRunTitle = 'Bring- und Abholfahrten sind eingerechnet';
        var schoolRunNotes = [];
        var schoolRunDays = Math.round(u.bringtageprowoche * u.bringwochenprojahr);
        var schoolRunBookings = Math.round(r.alternative.schoolRunTrips);
        if(loc.source === 'unknown' || loc.source === 'legacy' || loc.stationCount === null || loc.walkMinutes === null){
          schoolRunTone = 'mid';
          schoolRunTitle = 'Zeitkritische Bringfahrten brauchen Planung';
          schoolRunNotes.push('Prüfe die Fahrzeugverfügbarkeit zu den festen Bring- und Abholzeiten.');
        } else if(loc.stationCount === 0 || loc.walkMinutes > 10){
          schoolRunTone = 'mid';
          schoolRunTitle = 'Der Stationsweg erschwert regelmäßige Bringfahrten';
          schoolRunNotes.push('Der Weg zur Station kommt bei jeder einzelnen Buchung zur Fahrzeit hinzu.');
        }
        if(r.recommendation && (u.childSeatInfantCount > 0 || u.childSeatBoosterCount > 0 || u.childSeatNeedsReview)){
          schoolRunTone = 'mid';
          schoolRunTitle = 'Kindersitz und Verfügbarkeit vorher klären';
          schoolRunNotes.push('Je nach Anbieter, Fahrzeugklasse und Sitzart ist ein eigener Sitz nötig oder die Ausstattung muss vor der Buchung geprüft werden.');
        }
        if(u.bringseparatanteil < 100){
          schoolRunNotes.push('Der kombinierte Anteil wird anderen ohnehin stattfindenden Wegen zugerechnet.');
        }
        cards.push({
          tone: schoolRunTone,
          title: schoolRunTitle,
          text: schoolRunDays + ' Bring-/Abholtage ergeben rund ' + schoolRunBookings + ' eigenständige Buchungen und ' + fmtEUR(r.alternative.schoolRunCost) + ' Fahrtkosten pro Jahr. ' + schoolRunNotes.join(' ')
        });
      }

      // Wochenend-/Mehrtagesfahrten: Kostenanteil vs. Kilometeranteil
      if(r.alternative && u.mehrtagesfahrten > 0 && u.jahreskm > 0){
        var kmShare = r.alternative.multiKm / u.jahreskm;
        var costShare = 0;
        if(r.alternative.total > 0){
          costShare = r.alternative.multiCost / r.alternative.total;
        }
        var kmPct = Math.round(kmShare * 100), costPct = Math.round(costShare * 100);
        if(costShare - kmShare > 0.15 || costShare > 0.4){
          cards.push({ tone: 'mid', title: 'Wochenend- und Mehrtagesfahrten sind teuer',
            text: 'Deine ' + u.mehrtagesfahrten + ' Mehrtagesfahrten pro Jahr machen ' + kmPct + '\u00A0% deiner Kilometer aus, aber ' + costPct + '\u00A0% der Kosten bei ' + r.providerName +
                  ' (' + fmtEUR(r.alternative.multiCost) + '/Jahr). Für solche Fahrten kann sich ein klassischer Mietwagen oder ein eigenes Auto eher lohnen.' });
        } else {
          cards.push({ tone: 'good', title: 'Mehrtagesfahrten fallen nicht überproportional ins Gewicht',
            text: 'Deine ' + u.mehrtagesfahrten + ' Mehrtagesfahrten pro Jahr verursachen ' + costPct + '\u00A0% der Kosten bei ' + r.providerName + ' \u2013 das entspricht in etwa ihrem Kilometeranteil.' });
        }
      }

      if(r.alternative && u.urlaubsfahrten > 0 && u.jahreskm > 0){
        var vacationKmShare = r.alternative.vacationKm / u.jahreskm;
        var vacationCostShare = 0;
        if(r.alternative.total > 0){
          vacationCostShare = r.alternative.vacationCost / r.alternative.total;
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
          text: 'Deine ' + u.urlaubsfahrten + ' ' + vacationTripLabel + ' ' + vacationVerb + ' ' + vacationKmPct + '\u00A0% der Kilometer und ' + vacationCostPct + '\u00A0% der Kosten bei ' + r.providerName + ' (' + fmtEUR(r.alternative.vacationCost) + '/Jahr). ' + vacationAdvice
        });
      }

      // Parkplatzsuche ohne garantierten Platz: Nachteil beim eigenen Auto benennen
      if(!u.parkplatz && r.alternative){
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
        if(result.alternative && result.alternative.tripCategories[row.key]){
          value = result.alternative.tripCategories[row.key].total;
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
      if(result.alternative){
        rows.push({ name: result.providerName, values: result.alternative });
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
        basis = 'Nach Fahrzeugklasse, Standort und Alltagseignung bleibt kein passender Anbieter für diesen Empfehlungsmodus übrig.';
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
        if(row.childSeatNote){
          if(detail){
            detail += ' · ';
          }
          detail += row.childSeatNote;
        }
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
      if(result.alternative){
        providerVariation = result.alternative.total * 0.1;
      }
      return {
        ownLow: Math.max(result.own.total - ownVariation, 0),
        ownHigh: result.own.total + ownVariation,
        providerLow: Math.max(result.alternative.total - providerVariation, 0),
        providerHigh: result.alternative.total + providerVariation
      };
    }

    /**
     * Calculates the annual mileage at which owned car and selected alternative cost roughly the same.
     * @returns {number|null} Approximate break-even mileage or null without a match up to 50,000 kilometers.
     */
    function calculateBreakEvenMileage(){
      var lowMileage = 0;
      var highMileage = 50000;
      var lowState = Object.assign({}, state, { usage: Object.assign({}, state.usage, { jahreskm: lowMileage }) });
      var highState = Object.assign({}, state, { usage: Object.assign({}, state.usage, { jahreskm: highMileage }) });
      var lowResult = calculateResultForState(lowState);
      var highResult = calculateResultForState(highState);
      if(!lowResult.alternative || !highResult.alternative){
        return null;
      }
      var lowDifference = lowResult.own.total - lowResult.alternative.total;
      var highDifference = highResult.own.total - highResult.alternative.total;
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
        var middleDifference = middleResult.own.total - middleResult.alternative.total;
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
      if(!result.alternative){
        return 'Sobald ein passender Tarif verfügbar ist, werden hier die entscheidenden Kostentreiber erklärt.';
      }
      var difference = result.own.total - result.alternative.total;
      var fixedDifference = result.own.fix - result.alternative.fix;
      var ownVariableCost = result.own.fuel;
      var providerVariableCost = result.alternative.fuel + result.alternative.km;
      var variableDifference = ownVariableCost - providerVariableCost;
      var reason = '';
      if(Math.abs(fixedDifference) >= Math.abs(variableDifference)){
        reason = 'Der stärkste Kostentreiber sind die Fixkosten: ' + fmtEUR(result.own.fix) + ' fürs eigene Auto gegenüber ' + fmtEUR(result.alternative.fix) + ' für die Alternative. ';
      } else {
        reason = 'Den größten Ausschlag geben die nutzungsabhängigen Kosten: ' + fmtEUR(ownVariableCost) + ' fürs eigene Auto gegenüber ' + fmtEUR(providerVariableCost) + ' für die Alternative. ';
      }
      if(difference >= 0){
        reason += 'Unter Berücksichtigung aller Kosten liegt ' + result.providerName + ' aktuell rund ' + fmtEUR(difference) + ' unter dem eigenen Auto.';
      } else {
        reason += 'Unter Berücksichtigung aller Kosten liegt die gewählte Alternative aktuell rund ' + fmtEUR(Math.abs(difference)) + ' über dem eigenen Auto.';
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
      if(!result.alternative){
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
        breakEvenElement.textContent = 'Bis 50.000 km/Jahr kein Kostengleichstand';
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

      if(r.alternative){
        var diff = r.own.total - r.alternative.total;
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
          sub.textContent = 'Für Fahrzeugklasse, Standort und Alltagseignung ist keine passende Empfehlung verfügbar.';
        } else {
          sub.textContent = 'Lege rechts einen Carsharing-Tarif an, um zu vergleichen.';
        }
      }

      var providerTotal = 0;
      if(r.alternative){
        providerTotal = r.alternative.total;
      }
      var maxVal = Math.max(r.own.total, providerTotal, 1);
      document.getElementById('bar-own-value').textContent = fmtEUR(r.own.total);
      document.getElementById('bar-own').style.width = (r.own.total / maxVal * 100) + '%';

      var alternativeLabel = document.getElementById('bar-cambio-label');
      var alternativeColHead = document.getElementById('cambio-col-head');
      alternativeLabel.textContent = r.providerName;
      alternativeColHead.textContent = r.providerName;

      if(r.alternative){
        document.getElementById('bar-cambio-value').textContent = fmtEUR(r.alternative.total);
        document.getElementById('bar-cambio').style.width = (r.alternative.total / maxVal * 100) + '%';
      } else {
        document.getElementById('bar-cambio-value').textContent = '–';
        document.getElementById('bar-cambio').style.width = '0%';
      }

      document.getElementById('row-fix-own').textContent = fmtEUR(r.own.fix);
      document.getElementById('row-fuel-own').textContent = fmtEUR(r.own.fuel);
      document.getElementById('row-km-own').textContent = 'in Kraftstoff enthalten';
      document.getElementById('row-perkm-own').textContent = fmtEURcents(r.own.perKm);
      document.getElementById('row-total-own').textContent = fmtEUR(r.own.total);

      if(r.alternative){
        document.getElementById('row-fix-cambio').textContent = fmtEUR(r.alternative.fix);
        document.getElementById('row-fuel-cambio').textContent = fmtEUR(r.alternative.fuel);
        document.getElementById('row-km-cambio').textContent = fmtEUR(r.alternative.km);
        document.getElementById('row-perkm-cambio').textContent = fmtEURcents(r.alternative.perKm);
        document.getElementById('row-total-cambio').textContent = fmtEUR(r.alternative.total);
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

    return {
      describeRecommendationReason: describeRecommendationReason,
      render: render
    };
  }

  window.CarshareResultsUI = { create: create };
})();
