(function(){
  'use strict';

  /**
   * Creates the profiles-ui controller without starting UI or network work.
   * @param {Object} dependencies - Explicit controller dependencies.
   * @param {Object} dependencies.state - Shared state container; its sections may be replaced.
   * @param {Function} dependencies.fillOwnInputs - Application callback fillOwnInputs; called only after initialization.
   * @param {Function} dependencies.fillUsageInputs - Application callback fillUsageInputs; called only after initialization.
   * @param {Function} dependencies.render - Application callback render; called only after initialization.
   * @param {Function} dependencies.scheduleSave - Application callback scheduleSave; called only after initialization.
   * @param {Function} dependencies.fmtEUR - Application callback fmtEUR; called only after initialization.
   * @param {Function} dependencies.revealField - Opens the disclosure containing a field and returns that field.
   * @returns {Object} Functions owned by this controller.
   */
  function create(dependencies){
    var providerData = window.CarshareData;
    var defaultOwn = providerData.defaultOwn;
    var defaultUsage = providerData.defaultUsage;
    var revealField = dependencies.revealField;
    var state = dependencies.state;
    var fillOwnInputs = dependencies.fillOwnInputs;
    var fillUsageInputs = dependencies.fillUsageInputs;
    var render = dependencies.render;
    var scheduleSave = dependencies.scheduleSave;
    var fmtEUR = dependencies.fmtEUR;

    var usageScenarios = window.CarshareUsageScenarios;

    var showAllUsageScenarios = false;
    var scenarioUndoUsage = null;
    var activeScenarioTitle = '';
    var scenarioPickerCollapsed = false;

    /**
     * Renders annual workshop, insurance and tax/inspection estimates using the owned-car profile template.
     * @returns {void}
     */
    function renderOwnProfiles(){
      var template = document.getElementById('own-profile-card-template');
      var fragment = document.createDocumentFragment();
      window.CarshareOwnProfiles.profiles.forEach(function(profile){
        var card = template.content.firstElementChild.cloneNode(true);
        card.querySelector('.scenario-icon-use').setAttribute('href', '#scenario-icon-commute');
        card.querySelector('.scenario-title').textContent = profile.title;
        card.querySelector('.scenario-summary').textContent = profile.reference;
        card.querySelector('[data-profile-cost="workshop"]').textContent = fmtEUR(profile.annualWorkshopCost);
        card.querySelector('[data-profile-cost="insurance"]').textContent = fmtEUR(profile.annualInsuranceCost);
        card.querySelector('[data-profile-cost="tax-inspection"]').textContent = fmtEUR(profile.annualTaxCost + profile.annualInspectionCost);
        var button = card.querySelector('.scenario-apply');
        button.setAttribute('aria-label', profile.title + ': ' + button.textContent);
        button.addEventListener('click', function(){ applyOwnProfile(profile.id); });
        fragment.appendChild(card);
      });
      document.getElementById('own-profile-list').replaceChildren(fragment);
    }

    /**
     * Applies all three annual reference costs and refreshes calculation and storage.
     * @param {string} profileId - Reference profile identifier.
     * @returns {void}
     */
    function applyOwnProfile(profileId){
      var own = window.CarshareOwnProfiles.applyProfile(state.own, profileId);
      if(!own){
        return;
      }
      state.own = own;
      fillOwnInputs();
      var statusTemplate = document.getElementById('own-profile-status-template');
      var status = statusTemplate.content.cloneNode(true);
      status.querySelectorAll('[data-own-cost]').forEach(function(output){
        output.textContent = fmtEUR(own[output.dataset.ownCost]);
      });
      document.getElementById('own-profile-status').replaceChildren(status);
      render();
      scheduleSave();
    }

    /**
     * Restores owned-car defaults and its parking choice without replacing the driving profile.
     * @returns {void}
     */
    function resetOwnCar(){
      state.own = defaultOwn();
      state.usage.parkplatz = defaultUsage().parkplatz;
      fillOwnInputs();
      document.getElementById('use_parkplatz').checked = state.usage.parkplatz;
      document.getElementById('own-profile-status').textContent = 'Autodaten auf Beispielvorgaben zurückgesetzt. Bitte prüfe die Jahreskosten einschließlich Reifen.';
      render();
      scheduleSave();
    }

    /**
     * Findet eine Nutzungsvorlage anhand ihrer Kennung.
     * @param {string} scenarioId - Kennung der gesuchten Vorlage.
     * @returns {Object|undefined} Passende Nutzungsvorlage.
     */
    function findUsageScenario(scenarioId){
      return usageScenarios.find(function(scenario){ return scenario.id === scenarioId; });
    }

    /**
     * Rendert die sichtbaren Nutzungsvorlagen aus dem wiederverwendbaren Karten-Template.
     * @returns {void}
     */
    function renderUsageScenarios(){
      var browser = document.getElementById('scenario-browser');
      var status = document.getElementById('scenario-status');
      browser.hidden = scenarioPickerCollapsed;
      status.hidden = !scenarioPickerCollapsed;
      if(scenarioPickerCollapsed){
        document.getElementById('scenario-status-text').textContent = 'Vorlage „' + activeScenarioTitle + '“ übernommen.';
        return;
      }

      var visibleCount = 4;
      if(showAllUsageScenarios){
        visibleCount = usageScenarios.length;
      }
      var template = document.getElementById('scenario-card-template');
      var fragment = document.createDocumentFragment();
      for(var index = 0; index < visibleCount; index += 1){
        var scenario = usageScenarios[index];
        var card = template.content.firstElementChild.cloneNode(true);
        card.querySelector('.scenario-icon-use').setAttribute('href', '#' + scenario.iconId);
        card.querySelector('.scenario-title').textContent = scenario.title;
        card.querySelector('.scenario-summary').textContent = scenario.summary;
        var applyButton = card.querySelector('.scenario-apply');
        applyButton.setAttribute('data-scenario-id', scenario.id);
        applyButton.setAttribute('aria-label', 'Vorlage ' + scenario.title + ' übernehmen');
        applyButton.addEventListener('click', function(event){
          applyUsageScenario(event.currentTarget.getAttribute('data-scenario-id'));
        });
        fragment.appendChild(card);
      }
      var scenarioList = document.getElementById('scenario-list');
      scenarioList.replaceChildren(fragment);
      scenarioList.classList.toggle('is-expanded', showAllUsageScenarios);
      var moreButton = document.getElementById('scenario-more-btn');
      moreButton.setAttribute('aria-expanded', String(showAllUsageScenarios));
      moreButton.textContent = 'Alle ' + usageScenarios.length + ' Szenarien anzeigen';
      if(showAllUsageScenarios){
        moreButton.textContent = 'Weniger Szenarien anzeigen';
      }
    }

    /**
     * Übernimmt die Fahrdaten einer Vorlage und bewahrt unabhängige Nutzereinstellungen.
     * @param {string} scenarioId - Kennung der anzuwendenden Vorlage.
     * @returns {void}
     */
    function applyUsageScenario(scenarioId){
      var scenario = findUsageScenario(scenarioId);
      if(!scenario){
        return;
      }
      scenarioUndoUsage = Object.assign({}, state.usage);
      var comparisonYears = state.usage.vergleichsjahre;
      var parkingRequired = state.usage.parkplatz;
      state.usage = Object.assign(defaultUsage(), scenario.values);
      state.usage.vergleichsjahre = comparisonYears;
      state.usage.parkplatz = parkingRequired;
      activeScenarioTitle = scenario.title;
      scenarioPickerCollapsed = true;
      fillUsageInputs();
      renderUsageScenarios();
      render();
      scheduleSave();
    }

    /**
     * Stellt die Nutzungseingaben vom Zeitpunkt vor der letzten Vorlagenwahl wieder her.
     * @returns {void}
     */
    function restoreUsageBeforeScenario(){
      if(!scenarioUndoUsage){
        return;
      }
      state.usage = scenarioUndoUsage;
      scenarioUndoUsage = null;
      activeScenarioTitle = '';
      scenarioPickerCollapsed = false;
      fillUsageInputs();
      renderUsageScenarios();
      render();
      scheduleSave();
    }

    /**
     * Öffnet die Vorlagenauswahl, damit eine andere Ausgangslage gewählt werden kann.
     * @returns {void}
     */
    function reopenUsageScenarios(){
      scenarioPickerCollapsed = false;
      renderUsageScenarios();
    }

    /**
     * Setzt den Fokus auf das erste von einer Vorlage ausgefüllte Nutzungsfeld.
     * @returns {void}
     */
    function focusScenarioUsageValues(){
      var annualMileage = revealField('use_jahreskm');
      annualMileage.focus();
      annualMileage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /**
     * Klappt die zusätzlichen Nutzungsvorlagen ein oder aus.
     * @returns {void}
     */
    function toggleAdditionalUsageScenarios(){
      showAllUsageScenarios = !showAllUsageScenarios;
      renderUsageScenarios();
    }

    /**
     * Clears the previous scenario selection after resetting the usage form.
     * @returns {void}
     */
    function resetUsageScenarios(){
      scenarioUndoUsage = null;
      activeScenarioTitle = '';
      scenarioPickerCollapsed = false;
      renderUsageScenarios();
    }

    return {
      renderOwnProfiles: renderOwnProfiles,
      resetOwnCar: resetOwnCar,
      renderUsageScenarios: renderUsageScenarios,
      restoreUsageBeforeScenario: restoreUsageBeforeScenario,
      reopenUsageScenarios: reopenUsageScenarios,
      focusScenarioUsageValues: focusScenarioUsageValues,
      toggleAdditionalUsageScenarios: toggleAdditionalUsageScenarios,
      resetUsageScenarios: resetUsageScenarios
    };
  }

  window.CarshareProfilesUI = { create: create };
})();
