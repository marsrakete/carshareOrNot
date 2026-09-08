(function(global){
  'use strict';

  var calculate = global.CarshareCalculator.calculate;
  var MODE_MANUAL = 'manual';
  var MODE_SINGLE = 'recommend-single';
  var MODE_MIX = 'recommend-mix';
  var FREE_FLOATING_AUTO = 'auto';
  var FREE_FLOATING_SUITABLE = 'suitable';
  var FREE_FLOATING_SUPPLEMENT = 'supplement';
  var FREE_FLOATING_UNSUITABLE = 'unsuitable';
  var CATEGORY_DEFINITIONS = [
    { key: 'everyday', label: 'Alltagsfahrten' },
    { key: 'schoolRuns', label: 'Bring- und Abholfahrten' },
    { key: 'dayTrips', label: 'Tagesausflüge' },
    { key: 'multiDay', label: 'Mehrtagesfahrten' },
    { key: 'vacations', label: 'Urlaubsfahrten' }
  ];

  /**
   * Prüft, ob ein Wert einen unterstützten Empfehlungsmodus bezeichnet.
   * @param {string} mode - Zu prüfender Auswahlmodus.
   * @returns {boolean} True für manuelle Auswahl oder einen Empfehlungsmodus.
   */
  function isKnownMode(mode){
    if(mode === MODE_MANUAL){
      return true;
    }
    if(mode === MODE_SINGLE){
      return true;
    }
    if(mode === MODE_MIX){
      return true;
    }
    return false;
  }

  /**
   * Prüft, ob eine Auswahl zur Free-Floating-Praxistauglichkeit unterstützt wird.
   * @param {string} fit - Zu prüfende Auswahl.
   * @returns {boolean} True für einen bekannten Wert.
   */
  function isKnownFreeFloatingFit(fit){
    if(fit === FREE_FLOATING_AUTO){
      return true;
    }
    if(fit === FREE_FLOATING_SUITABLE){
      return true;
    }
    if(fit === FREE_FLOATING_SUPPLEMENT){
      return true;
    }
    if(fit === FREE_FLOATING_UNSUITABLE){
      return true;
    }
    return false;
  }

  /**
   * Leitet die wirksame Free-Floating-Eignung aus Auswahl und Familienprofil ab.
   * @param {Object} state - Vollständiger Anwendungszustand.
   * @returns {Object} Wirksame Stufe, Gewichtungsfaktor und verständliche Begründung.
   */
  function resolveFreeFloatingFit(state){
    var selectedFit = state.usage.freefloatingFit;
    if(!isKnownFreeFloatingFit(selectedFit)){
      selectedFit = FREE_FLOATING_AUTO;
    }
    var effectiveFit = selectedFit;
    var reason = '';
    if(selectedFit === FREE_FLOATING_AUTO){
      var hasSchoolRuns = state.usage.bringtageprowoche > 0 && state.usage.bringwochenprojahr > 0 && state.usage.bringseparatanteil > 0;
      if(state.usage.kindersitz || hasSchoolRuns){
        effectiveFit = FREE_FLOATING_UNSUITABLE;
        if(state.usage.kindersitz && hasSchoolRuns){
          reason = 'automatisch herabgestuft: Kindersitz und regelmäßige Bringfahrten';
        } else if(state.usage.kindersitz){
          reason = 'automatisch herabgestuft: Kindersitz benötigt';
        } else {
          reason = 'automatisch herabgestuft: regelmäßige Bringfahrten';
        }
      } else {
        effectiveFit = FREE_FLOATING_SUITABLE;
        reason = 'automatisch als grundsätzlich geeignet bewertet';
      }
    } else if(selectedFit === FREE_FLOATING_SUITABLE){
      reason = 'von dir als gut geeignet bewertet';
    } else if(selectedFit === FREE_FLOATING_SUPPLEMENT){
      reason = 'von dir nur als Ergänzung bewertet';
    } else {
      reason = 'von dir als eher ungeeignet bewertet';
    }

    var factor = 1;
    if(effectiveFit === FREE_FLOATING_SUPPLEMENT){
      factor = 1.25;
    } else if(effectiveFit === FREE_FLOATING_UNSUITABLE){
      factor = 1.75;
    }
    return { selected: selectedFit, effective: effectiveFit, factor: factor, reason: reason };
  }

  /**
   * Berechnet einen reinen Rangwert, ohne die angezeigten Kosten zu verändern.
   * @param {Object} state - Vollständiger Anwendungszustand.
   * @param {Object} provider - Anbieter des Kandidaten.
   * @param {number} cost - Tatsächliche Kosten, die gewichtet werden.
   * @returns {Object} Rangwert und optionaler Praxishinweis.
   */
  function calculateRankingValue(state, provider, cost){
    if(provider.operationMode !== 'free-floating'){
      if(provider.operationMode === 'station-based' && state.usage.alltagsmodell === 'one-way'){
        return { value: cost * 1.5, note: 'Stationsbasiert: für Einwegfahrten deutlich weniger geeignet' };
      }
      return { value: cost, note: '' };
    }
    var fit = resolveFreeFloatingFit(state);
    return { value: cost * fit.factor, note: 'Free-Floating: ' + fit.reason };
  }

  /**
   * Describes how current a tariff source is according to its metadata.
   * @param {Object} metadata - Tariff source metadata.
   * @returns {string} German freshness note.
   */
  function describeTariffFreshness(metadata){
    if(!metadata || !metadata.lastVerifiedAt){
      return 'Tarifstand nicht dokumentiert';
    }
    var verifiedAt = new Date(metadata.lastVerifiedAt + 'T00:00:00');
    var ageInDays = (Date.now() - verifiedAt.getTime()) / 86400000;
    if(!isFinite(ageInDays)){
      return 'Tarifstand bitte prüfen';
    }
    if(ageInDays > 180){
      return 'Tarifstand älter als 6 Monate';
    }
    return 'Tarifstand ' + metadata.lastVerifiedAt;
  }

  /**
   * Prüft, ob ein Anbieter am gespeicherten Standort sicher ausgeschlossen ist.
   * @param {Object} state - Vollständiger Anwendungszustand.
   * @param {string} providerId - Kennung des Anbieters.
   * @returns {boolean} True bei bestätigten null Stationen.
   */
  function isProviderUnavailable(state, providerId){
    var provider = state.providers.find(function(candidate){ return candidate.id === providerId; });
    var location = state.location.byProvider[providerId];
    if(!location){
      return false;
    }
    if(provider && provider.operationMode === 'free-floating'){
      return location.serviceAvailable === false;
    }
    var confirmed = location.source === 'manual' || location.source === 'search';
    return confirmed && location.stationCount === 0;
  }

  /**
   * Prüft, ob für einen Anbieter belastbare Stations- und Gehzeitwerte vorliegen.
   * @param {Object} state - Vollständiger Anwendungszustand.
   * @param {string} providerId - Kennung des Anbieters.
   * @returns {boolean} True bei vollständigen bestätigten Standortwerten.
   */
  function hasKnownLocation(state, providerId){
    var provider = state.providers.find(function(candidate){ return candidate.id === providerId; });
    var location = state.location.byProvider[providerId];
    if(!location){
      return false;
    }
    if(provider && provider.operationMode === 'free-floating'){
      return typeof location.serviceAvailable === 'boolean';
    }
    var confirmed = location.source === 'manual' || location.source === 'search';
    return confirmed && typeof location.stationCount === 'number' && typeof location.walkMinutes === 'number';
  }

  /**
   * Berechnet den vollständigen Zustand für eine konkrete Anbieter-Tarif-Auswahl.
   * @param {Object} state - Vollständiger Anwendungszustand.
   * @param {string} providerId - Kennung des Anbieters.
   * @param {string} classId - Kennung der Fahrzeugklasse.
   * @param {string} tariffId - Kennung des Tarifs.
   * @returns {Object} Ergebnis der Kostenberechnung.
   */
  function calculateCandidate(state, providerId, classId, tariffId){
    var candidateState = {
      own: state.own,
      usage: state.usage,
      location: state.location,
      providers: state.providers,
      selection: { providerId: providerId, classId: classId, tariffId: tariffId }
    };
    return calculate(candidateState);
  }

  /**
   * Erzeugt alle verfügbaren Tarifkandidaten einer Fahrzeugklasse.
   * @param {Object} state - Vollständiger Anwendungszustand.
   * @param {string} classId - Gewünschte Fahrzeugklasse.
   * @returns {Array<Object>} Berechnete und am Standort nicht ausgeschlossene Tarife.
   */
  function buildCandidates(state, classId){
    var candidates = [];
    for(var providerIndex = 0; providerIndex < state.providers.length; providerIndex += 1){
      var provider = state.providers[providerIndex];
      if(isProviderUnavailable(state, provider.id)){
        continue;
      }
      var selectedClass = null;
      for(var classIndex = 0; classIndex < provider.classes.length; classIndex += 1){
        if(provider.classes[classIndex].id === classId){
          selectedClass = provider.classes[classIndex];
          break;
        }
      }
      if(!selectedClass){
        continue;
      }
      for(var tariffIndex = 0; tariffIndex < selectedClass.tariffs.length; tariffIndex += 1){
        var selectedTariff = selectedClass.tariffs[tariffIndex];
        var result = calculateCandidate(state, provider.id, selectedClass.id, selectedTariff.id);
        var ranking = calculateRankingValue(state, provider, result.cambio.total);
        candidates.push({
          id: provider.id + '::' + selectedClass.id + '::' + selectedTariff.id,
          providerId: provider.id,
          providerName: provider.name,
          classId: selectedClass.id,
          className: selectedClass.name,
          tariffId: selectedTariff.id,
          tariffName: selectedTariff.name,
          operationMode: provider.operationMode,
          rankingScore: ranking.value,
          fitNote: ranking.note,
          freshnessNote: describeTariffFreshness(selectedTariff.v.meta),
          result: result
        });
      }
    }
    return candidates;
  }

  /**
   * Sortiert Tarifkandidaten nach ihren gesamten jährlichen Kosten.
   * @param {Object} left - Linker Tarifkandidat.
   * @param {Object} right - Rechter Tarifkandidat.
   * @returns {number} Numerische Sortierreihenfolge.
   */
  function compareCandidateTotals(left, right){
    if(left.rankingScore !== right.rankingScore){
      return left.rankingScore - right.rankingScore;
    }
    return left.result.cambio.total - right.result.cambio.total;
  }

  /**
   * Markiert ein Ergebnis als Empfehlung für einen einzigen Anbieter.
   * @param {Object} state - Vollständiger Anwendungszustand.
   * @param {Array<Object>} candidates - Berechnete Tarifkandidaten.
   * @returns {Object|null} Günstigstes Ergebnis oder null ohne Kandidaten.
   */
  function recommendSingleProvider(state, candidates){
    if(candidates.length === 0){
      return null;
    }
    var ranking = candidates.slice().sort(compareCandidateTotals);
    var best = ranking[0];
    var rankingRows = [];
    for(var index = 0; index < Math.min(3, ranking.length); index += 1){
      var candidate = ranking[index];
      rankingRows.push({
        label: candidate.providerName + ' · ' + candidate.tariffName,
        detail: candidate.fitNote,
        freshnessNote: candidate.freshnessNote,
        cost: candidate.result.cambio.total,
        providerId: candidate.providerId,
        tariffId: candidate.tariffId
      });
    }
    best.result.recommendation = {
      mode: MODE_SINGLE,
      title: 'Empfehlung – ein Anbieter',
      primaryProviderId: best.providerId,
      primaryTariffId: best.tariffId,
      providerIds: [best.providerId],
      rows: rankingRows,
      locationKnown: hasKnownLocation(state, best.providerId),
      fitSummary: resolveFreeFloatingFit(state).reason
    };
    return best.result;
  }

  /**
   * Prüft, ob eine Fahrtart tatsächlich Buchungen, Kilometer oder Kosten enthält.
   * @param {Object} category - Berechnete Kosten einer Fahrtart.
   * @returns {boolean} True für eine aktive Fahrtart.
   */
  function isActiveCategory(category){
    return category.trips > 0 || category.km > 0 || category.total > 0;
  }

  /**
   * Erzeugt einen stabilen Schlüssel für die in einem Portfolio gewählten Tarife.
   * @param {Object} selectedByProvider - Tarifkennungen nach Anbieter.
   * @returns {string} Sortierter Portfolio-Schlüssel.
   */
  function createPortfolioKey(selectedByProvider){
    var providerIds = Object.keys(selectedByProvider).sort();
    var parts = [];
    for(var index = 0; index < providerIds.length; index += 1){
      var providerId = providerIds[index];
      parts.push(providerId + '=' + selectedByProvider[providerId]);
    }
    return parts.join('|');
  }

  /**
   * Fügt einem Portfolio eine Fahrtart hinzu, sofern dessen Tarifwahl kompatibel ist.
   * @param {Object} portfolio - Bisher optimiertes Portfolio.
   * @param {Object} candidate - Tarif für die nächste Fahrtart.
   * @param {Object} categoryDefinition - Schlüssel und Bezeichnung der Fahrtart.
   * @returns {Object|null} Erweitertes Portfolio oder null bei Tarifkonflikt.
   */
  function extendPortfolio(portfolio, candidate, categoryDefinition){
    if(Array.isArray(candidate.allowedCategories) && candidate.allowedCategories.indexOf(categoryDefinition.key) === -1){
      return null;
    }
    var selectedByProvider = Object.assign(Object.create(null), portfolio.selectedByProvider);
    var existingTariff = selectedByProvider[candidate.providerId];
    if(existingTariff && existingTariff !== candidate.id){
      return null;
    }

    var fixedCost = portfolio.fixedCost;
    if(!existingTariff){
      selectedByProvider[candidate.providerId] = candidate.id;
      fixedCost += candidate.result.cambio.fix;
    }

    var category = candidate.result.cambio.tripCategories[categoryDefinition.key];
    var ranking = calculateRankingValue(portfolio.state, candidate, category.total);
    var assignments = portfolio.assignments.slice();
    assignments.push({ definition: categoryDefinition, candidate: candidate, category: category });
    return {
      selectedByProvider: selectedByProvider,
      fixedCost: fixedCost,
      variableCost: portfolio.variableCost + category.total,
      score: portfolio.score + ranking.value,
      state: portfolio.state,
      assignments: assignments
    };
  }

  /**
   * Creates a calculated category for a supplementary mobility option.
   * @param {Object} source - Reference category containing trips and kilometers.
   * @param {number} bookingPrice - Fixed price per booking.
   * @param {number} kilometerPrice - Price per kilometer.
   * @returns {Object} Category cost in the calculator result format.
   */
  function createSupplementCategory(source, bookingPrice, kilometerPrice){
    var timeCost = source.trips * bookingPrice;
    var kmCost = source.km * kilometerPrice;
    return { trips: source.trips, km: source.km, timeCost: timeCost, kmCost: kmCost, total: timeCost + kmCost };
  }

  /**
   * Builds transparent taxi, rental-car and public-transport assumptions for the mobility mix.
   * @param {Object} state - Complete calculator state.
   * @param {Object} referenceResult - A calculated carsharing result supplying trip quantities.
   * @returns {Array<Object>} Supplementary candidates used only by the mobility mix.
   */
  function buildSupplementCandidates(state, referenceResult){
    var source = referenceResult.cambio.tripCategories;
    var zero = { trips: 0, km: 0, timeCost: 0, kmCost: 0, total: 0 };
    var taxiCategories = {
      everyday: createSupplementCategory(source.everyday, 4, 2.2),
      schoolRuns: createSupplementCategory(source.schoolRuns, 4, 2.2),
      dayTrips: zero, multiDay: zero, vacations: zero
    };
    var rentalCategories = {
      everyday: zero, schoolRuns: zero,
      dayTrips: createSupplementCategory(source.dayTrips, 55, 0.18),
      multiDay: createSupplementCategory(source.multiDay, Math.max(state.usage.tageprofahrt, 1) * 55, 0.18),
      vacations: createSupplementCategory(source.vacations, Math.max(state.usage.tageprourlaub, 1) * 55, 0.18)
    };
    var transitCategories = {
      everyday: createSupplementCategory(source.everyday, 0, 0),
      schoolRuns: createSupplementCategory(source.schoolRuns, 0, 0),
      dayTrips: zero, multiDay: zero, vacations: zero
    };
    return [
      {
        id: 'supplement::taxi', providerId: 'supplement-taxi', providerName: 'Taxi / Ridehailing', tariffId: 'estimate', tariffName: '4 € Start + 2,20 €/km', operationMode: 'supplement',
        rankingScore: 0, fitNote: 'Rechenannahme, lokal prüfen', freshnessNote: 'Kein Live-Preis', allowedCategories: ['everyday', 'schoolRuns'], requiresLocation: false,
        result: { cambio: { fix: 0, tripCategories: taxiCategories } }
      },
      {
        id: 'supplement::rental', providerId: 'supplement-rental', providerName: 'Mietwagen', tariffId: 'estimate', tariffName: '55 €/Tag + 0,18 €/km', operationMode: 'supplement',
        rankingScore: 0, fitNote: 'Rechenannahme, lokal prüfen', freshnessNote: 'Kein Live-Preis', allowedCategories: ['dayTrips', 'multiDay', 'vacations'], requiresLocation: false,
        result: { cambio: { fix: 0, tripCategories: rentalCategories } }
      },
      {
        id: 'supplement::transit', providerId: 'supplement-transit', providerName: 'ÖPNV', tariffId: 'estimate', tariffName: '58 €/Monat', operationMode: 'supplement',
        rankingScore: 0, fitNote: 'Pauschale Rechenannahme', freshnessNote: 'Kein Live-Preis', allowedCategories: ['everyday', 'schoolRuns'], requiresLocation: false,
        result: { cambio: { fix: 58 * 12, tripCategories: transitCategories } }
      }
    ];
  }

  /**
   * Behält für einen Portfolio-Schlüssel ausschließlich die günstigste Belegung.
   * @param {Map<string,Object>} portfolios - Zielmenge optimierter Portfolios.
   * @param {Object} candidatePortfolio - Neu berechnetes Portfolio.
   * @returns {void} Keine Rückgabe.
   */
  function keepCheapestPortfolio(portfolios, candidatePortfolio){
    var key = createPortfolioKey(candidatePortfolio.selectedByProvider);
    var existing = portfolios.get(key);
    var candidateTotal = candidatePortfolio.fixedCost + candidatePortfolio.score;
    if(!existing || candidateTotal < existing.fixedCost + existing.score){
      portfolios.set(key, candidatePortfolio);
    }
  }

  /**
   * Vergleicht zwei Portfolios nach gesamten jährlichen Kosten.
   * @param {Object} left - Linkes Portfolio.
   * @param {Object} right - Rechtes Portfolio.
   * @returns {number} Numerische Sortierreihenfolge.
   */
  function comparePortfolioTotals(left, right){
    return left.fixedCost + left.score - right.fixedCost - right.score;
  }

  /**
   * Formt das günstigste Portfolio in das gemeinsame Ergebnisformat um.
   * @param {Object} state - Vollständiger Anwendungszustand.
   * @param {Object} portfolio - Günstigstes Portfolio.
   * @param {Object} referenceResult - Ergebnis für gemeinsame Vergleichsdaten.
   * @returns {Object} Aggregiertes Ergebnis des Mobilitätsmixes.
   */
  function createMixResult(state, portfolio, referenceResult){
    var tripCategories = {};
    var timeCost = 0;
    var kmCost = 0;
    var rows = [];
    var selectedProviderIds = [];
    var locationProviderIds = [];
    var displayedFixedProviderIds = [];
    for(var index = 0; index < portfolio.assignments.length; index += 1){
      var assignment = portfolio.assignments[index];
      tripCategories[assignment.definition.key] = assignment.category;
      timeCost += assignment.category.timeCost;
      kmCost += assignment.category.kmCost;
      var assignmentDetail = assignment.candidate.providerName + ' · ' + assignment.candidate.tariffName;
      if(assignment.candidate.fitNote){
        assignmentDetail += ' · ' + assignment.candidate.fitNote;
      }
      var rowCost = assignment.category.total;
      if(displayedFixedProviderIds.indexOf(assignment.candidate.providerId) === -1){
        rowCost += assignment.candidate.result.cambio.fix;
        displayedFixedProviderIds.push(assignment.candidate.providerId);
      }
      rows.push({
        label: assignment.definition.label,
        detail: assignmentDetail,
        freshnessNote: assignment.candidate.freshnessNote || '',
        cost: rowCost,
        providerId: assignment.candidate.providerId,
        tariffId: assignment.candidate.tariffId
      });
      if(selectedProviderIds.indexOf(assignment.candidate.providerId) === -1){
        selectedProviderIds.push(assignment.candidate.providerId);
      }
      if(assignment.candidate.requiresLocation !== false && locationProviderIds.indexOf(assignment.candidate.providerId) === -1){
        locationProviderIds.push(assignment.candidate.providerId);
      }
    }

    for(var definitionIndex = 0; definitionIndex < CATEGORY_DEFINITIONS.length; definitionIndex += 1){
      var definition = CATEGORY_DEFINITIONS[definitionIndex];
      if(!tripCategories[definition.key]){
        tripCategories[definition.key] = { trips: 0, km: 0, timeCost: 0, kmCost: 0, total: 0 };
      }
    }

    var total = portfolio.fixedCost + timeCost + kmCost;
    var perKm = 0;
    if(state.usage.jahreskm > 0){
      perKm = total / state.usage.jahreskm;
    }
    var allLocationsKnown = true;
    for(var providerIndex = 0; providerIndex < locationProviderIds.length; providerIndex += 1){
      if(!hasKnownLocation(state, locationProviderIds[providerIndex])){
        allLocationsKnown = false;
      }
    }

    return {
      own: referenceResult.own,
      providerName: 'Mobilitätsmix',
      cambio: {
        fix: portfolio.fixedCost,
        fuel: timeCost,
        km: kmCost,
        total: total,
        perKm: perKm,
        tariffName: 'Mehrere Tarife',
        className: referenceResult.cambio.className,
        multiTrips: tripCategories.multiDay.trips,
        multiKm: tripCategories.multiDay.km,
        multiCost: tripCategories.multiDay.total,
        schoolRunTrips: tripCategories.schoolRuns.trips,
        schoolRunKm: tripCategories.schoolRuns.km,
        schoolRunCost: tripCategories.schoolRuns.total,
        dayTripCost: tripCategories.dayTrips.total,
        vacationTrips: tripCategories.vacations.trips,
        vacationKm: tripCategories.vacations.km,
        vacationCost: tripCategories.vacations.total,
        tripCategories: tripCategories,
        mileageAdjusted: referenceResult.cambio.mileageAdjusted,
        implicitShortTrip: referenceResult.cambio.implicitShortTrip,
        billingMode: 'mixed'
      },
      recommendation: {
        mode: MODE_MIX,
        title: 'Empfehlung – Mobilitätsmix',
        primaryProviderId: selectedProviderIds[0] || '',
        primaryTariffId: '',
        providerIds: selectedProviderIds,
        rows: rows,
        locationKnown: allLocationsKnown,
        fitSummary: resolveFreeFloatingFit(state).reason
      }
    };
  }

  /**
   * Ermittelt den günstigsten Tarifmix über alle aktiven Fahrtarten.
   * @param {Object} state - Vollständiger Anwendungszustand.
   * @param {Array<Object>} candidates - Berechnete Tarifkandidaten.
   * @returns {Object|null} Aggregiertes Mixergebnis oder null ohne Kandidaten.
   */
  function recommendProviderMix(state, candidates){
    if(candidates.length === 0){
      return null;
    }
    var referenceResult = candidates[0].result;
    candidates = candidates.concat(buildSupplementCandidates(state, referenceResult));
    var activeDefinitions = [];
    for(var index = 0; index < CATEGORY_DEFINITIONS.length; index += 1){
      var definition = CATEGORY_DEFINITIONS[index];
      var referenceCategory = referenceResult.cambio.tripCategories[definition.key];
      if(isActiveCategory(referenceCategory)){
        activeDefinitions.push(definition);
      }
    }

    var portfolios = new Map();
    portfolios.set('', { selectedByProvider: Object.create(null), fixedCost: 0, variableCost: 0, score: 0, state: state, assignments: [] });
    for(var categoryIndex = 0; categoryIndex < activeDefinitions.length; categoryIndex += 1){
      var nextPortfolios = new Map();
      var categoryDefinition = activeDefinitions[categoryIndex];
      portfolios.forEach(function(portfolio){
        for(var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1){
          var extended = extendPortfolio(portfolio, candidates[candidateIndex], categoryDefinition);
          if(extended){
            keepCheapestPortfolio(nextPortfolios, extended);
          }
        }
      });
      portfolios = nextPortfolios;
    }

    var rankedPortfolios = Array.from(portfolios.values()).sort(comparePortfolioTotals);
    if(rankedPortfolios.length === 0){
      return null;
    }
    return createMixResult(state, rankedPortfolios[0], referenceResult);
  }

  /**
   * Berechnet den gewählten Empfehlungsmodus für die aktuelle Fahrzeugklasse.
   * @param {Object} state - Vollständiger Anwendungszustand.
   * @returns {Object|null} Empfohlenes Ergebnis oder null ohne passende Tarife.
   */
  function calculateRecommendation(state){
    var candidates = buildCandidates(state, state.selection.classId);
    if(state.selection.recommendationMode === MODE_SINGLE){
      return recommendSingleProvider(state, candidates);
    }
    if(state.selection.recommendationMode === MODE_MIX){
      return recommendProviderMix(state, candidates);
    }
    return null;
  }

  global.CarshareRecommendations = {
    MODE_MANUAL: MODE_MANUAL,
    MODE_SINGLE: MODE_SINGLE,
    MODE_MIX: MODE_MIX,
    FREE_FLOATING_AUTO: FREE_FLOATING_AUTO,
    FREE_FLOATING_SUITABLE: FREE_FLOATING_SUITABLE,
    FREE_FLOATING_SUPPLEMENT: FREE_FLOATING_SUPPLEMENT,
    FREE_FLOATING_UNSUITABLE: FREE_FLOATING_UNSUITABLE,
    isKnownMode: isKnownMode,
    isKnownFreeFloatingFit: isKnownFreeFloatingFit,
    resolveFreeFloatingFit: resolveFreeFloatingFit,
    calculateRecommendation: calculateRecommendation
  };
})(window);
