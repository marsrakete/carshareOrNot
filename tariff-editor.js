(function(){
  'use strict';

  /**
   * Creates the tariff-editor controller without starting UI or network work.
   * @param {Object} dependencies - Explicit controller dependencies.
   * @param {Object} dependencies.state - Shared state container; its sections may be replaced.
   * @param {Function} dependencies.render - Application callback render; called only after initialization.
   * @param {Function} dependencies.scheduleSave - Application callback scheduleSave; called only after initialization.
   * @param {Function} dependencies.fillLocationInputs - Application callback fillLocationInputs; called only after initialization.
   * @param {Function} dependencies.uid - Application callback uid; called only after initialization.
   * @returns {Object} Functions owned by this controller.
   */
  function create(dependencies){
    var providerData = window.CarshareData;
    var identifiers = window.CarshareIdentifiers;
    var limits = window.CarshareLimits;
    var BILLING_DISTANCE_WITH_PACKAGES = providerData.BILLING_DISTANCE_WITH_PACKAGES;
    var BILLING_TIME_WITH_INCLUDED_DISTANCE = providerData.BILLING_TIME_WITH_INCLUDED_DISTANCE;
    var tariff = providerData.tariff;
    var defaultProviders = providerData.defaultProviders;
    var recommendationData = window.CarshareRecommendations;
    var MODE_MANUAL = recommendationData.MODE_MANUAL;
    var defaultLocationForProvider = window.CarshareStateValidation.defaultLocationForProvider;
    var defaultLocation = window.CarshareStateValidation.defaultLocation;
    var isObject = window.CarshareStateValidation.isObject;
    var hasValidProviders = window.CarshareStateValidation.hasValidProviders;
    var state = dependencies.state;
    var render = dependencies.render;
    var scheduleSave = dependencies.scheduleSave;
    var fillLocationInputs = dependencies.fillLocationInputs;
    var uid = dependencies.uid;

    /**
     * Enables only price fields that participate in the selected billing model.
     * @param {HTMLElement} row - Tariff value row.
     * @param {string} billingMode - Selected billing-model identifier.
     * @returns {void}
     */
    function updateTariffRowControls(row, billingMode){
      var timeInput = row.querySelector('[data-field="zeitpreis"]');
      var firstKmInput = row.querySelector('[data-field="kmBis100"]');
      var laterKmInput = row.querySelector('[data-field="kmAb100"]');
      timeInput.disabled = billingMode === BILLING_DISTANCE_WITH_PACKAGES;
      var distanceIncluded = billingMode === BILLING_TIME_WITH_INCLUDED_DISTANCE;
      firstKmInput.disabled = distanceIncluded;
      laterKmInput.disabled = distanceIncluded;
    }

    /**
     * Updates a tariff source link while allowing only HTTP and HTTPS URLs.
     * @param {HTMLAnchorElement} link - Source link to update.
     * @param {string} sourceUrl - User-entered source URL.
     * @returns {void}
     */
    function updateTariffSourceLink(link, sourceUrl){
      link.hidden = true;
      link.removeAttribute('href');
      if(!sourceUrl){
        return;
      }
      try{
        var parsedUrl = new URL(sourceUrl);
        if(parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:'){
          link.href = parsedUrl.toString();
          link.hidden = false;
        }
      }catch(error){
        // Invalid URLs remain editable but are not exposed as clickable links.
      }
    }

    /**
     * Copies tariff metadata into the public provider JSON format.
     * @param {Object} metadata - Internal tariff metadata.
     * @returns {Object} Independent metadata values for serialization.
     */
    function copyProviderMetadata(metadata){
      return {
        sourceUrl: metadata.sourceUrl || '',
        region: metadata.region || '',
        lastVerifiedAt: metadata.lastVerifiedAt || ''
      };
    }

    /**
     * Converts one editable provider into the versioned project JSON format.
     * @param {Object} provider - Provider from the current application state.
     * @returns {Object} Versioned, lossless provider export.
     */
    function buildProviderExport(provider){
      var commonMetadata = { sourceUrl: '', region: '', lastVerifiedAt: '' };
      if(provider.classes.length > 0 && provider.classes[0].tariffs.length > 0){
        commonMetadata = copyProviderMetadata(provider.classes[0].tariffs[0].v.meta);
      }
      var providerDefinition = {
        id: provider.id,
        name: provider.name,
        operationMode: provider.operationMode,
        meta: commonMetadata,
        classes: []
      };
      provider.classes.forEach(function(providerClass){
        var classDefinition = {
          id: providerClass.id,
          name: providerClass.name,
          childSeats: providerData.normalizeChildSeats(providerClass.childSeats),
          tariffs: []
        };
        providerClass.tariffs.forEach(function(selectedTariff){
          var values = selectedTariff.v;
          var tariffDefinition = {
            id: selectedTariff.id,
            name: selectedTariff.name,
            billingMode: values.billingMode,
            grundgebuehr: values.grundgebuehr,
            zeitpreis: values.zeitpreis,
            tagespreis: values.tagespreis,
            wochenpreis: values.wochenpreis,
            kmBis100: values.kmBis100,
            kmAb100: values.kmAb100,
            anmeldegebuehr: values.anmeldegebuehr
          };
          var tariffMetadata = copyProviderMetadata(values.meta);
          if(JSON.stringify(tariffMetadata) !== JSON.stringify(commonMetadata)){
            tariffDefinition.meta = tariffMetadata;
          }
          classDefinition.tariffs.push(tariffDefinition);
        });
        providerDefinition.classes.push(classDefinition);
      });
      return { formatVersion: 1, provider: providerDefinition };
    }

    /**
     * Starts a browser download for a serializable JSON value.
     * @param {string} filename - Suggested download filename.
     * @param {Object} value - JSON-compatible value to download.
     * @returns {void}
     */
    function downloadJsonFile(filename, value){
      var content = JSON.stringify(value, null, 2) + '\n';
      var blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 0);
    }

    /**
     * Exports one provider exactly as currently shown in the tariff editor.
     * @param {Object} provider - Provider to serialize and download.
     * @returns {void}
     */
    function exportProvider(provider){
      var safeId = provider.id.replace(/[^a-z0-9_-]/gi, '-');
      downloadJsonFile(safeId + '.json', buildProviderExport(provider));
    }

    /**
     * Adds an editable vehicle class with one starter tariff to a provider.
     * @param {Object} provider - Provider receiving the class.
     * @returns {void}
     */
    function addProviderClass(provider){
      provider.classes.push({
        id: uid('klasse'), name: 'Neue Fahrzeugklasse', childSeats: providerData.normalizeChildSeats(null), tariffs: [
          { id: uid('tarif'), name: 'Standard', v: tariff(0, 2, 25, 0.25, 0.18, 0) }
        ]
      });
      renderProviders();
      render();
      scheduleSave();
    }

    /**
     * Adds a starter tariff to an existing vehicle class.
     * @param {Object} providerClass - Vehicle class receiving the tariff.
     * @returns {void}
     */
    function addClassTariff(providerClass){
      providerClass.tariffs.push({ id: uid('tarif'), name: 'Neuer Tarif', v: tariff(0, 2, 25, 0.25, 0.18, 0) });
      renderProviders();
      render();
      scheduleSave();
    }

    /**
     * Removes one tariff while keeping every class calculable.
     * @param {Object} providerClass - Vehicle class containing the tariff.
     * @param {Object} selectedTariff - Tariff to remove.
     * @returns {void}
     */
    function removeClassTariff(providerClass, selectedTariff){
      if(providerClass.tariffs.length <= 1){
        return;
      }
      providerClass.tariffs = providerClass.tariffs.filter(function(candidate){ return candidate.id !== selectedTariff.id; });
      renderProviders();
      render();
      scheduleSave();
    }

    /**
     * Removes one vehicle class while keeping every provider calculable.
     * @param {Object} provider - Provider containing the class.
     * @param {Object} providerClass - Vehicle class to remove.
     * @returns {void}
     */
    function removeProviderClass(provider, providerClass){
      if(provider.classes.length <= 1){
        return;
      }
      provider.classes = provider.classes.filter(function(candidate){ return candidate.id !== providerClass.id; });
      renderProviders();
      render();
      scheduleSave();
    }

    /**
     * Renders editable providers and tariff rows from reusable templates.
     * @returns {void}
     */
    function renderProviders(){
      var list = document.getElementById('providers-list');
      var providerTemplate = document.getElementById('provider-block-template');
      var tariffRowTemplate = document.getElementById('tariff-row-template');
      var classActionsTemplate = document.getElementById('tariff-class-actions-template');
      var childSeatClassRowTemplate = document.getElementById('child-seat-class-row-template');
      var providerFragment = document.createDocumentFragment();
      var priceLabels = {
        grundgebuehr: 'Grundgebühr pro Monat', zeitpreis: 'Zeitpreis pro Stunde',
        tagespreis: 'Tagespreis', wochenpreis: 'Wochenpreis', kmBis100: 'Kilometerpreis bis 100 Kilometer',
        kmAb100: 'Kilometerpreis ab 101 Kilometer', anmeldegebuehr: 'Anmeldegebühr'
      };
      state.providers.forEach(function(provider){
        var block = providerTemplate.content.firstElementChild.cloneNode(true);
        var nameInput = block.querySelector('.provider-name');
        nameInput.value = provider.name;
        nameInput.setAttribute('aria-label', 'Name des Anbieters ' + provider.name);
        nameInput.addEventListener('input', function(){ provider.name = nameInput.value; scheduleSave(); render(); });

        var operationSelect = block.querySelector('.provider-operation-mode');
        operationSelect.value = provider.operationMode;
        operationSelect.setAttribute('aria-label', 'Betriebsart von ' + provider.name);
        operationSelect.addEventListener('change', function(){ provider.operationMode = operationSelect.value; render(); scheduleSave(); });

        var exportBtn = block.querySelector('.export-provider-btn');
        exportBtn.setAttribute('aria-label', 'Tarife von ' + provider.name + ' als JSON exportieren');
        exportBtn.addEventListener('click', function(){ exportProvider(provider); });

        var removeBtn = block.querySelector('.remove-btn');
        removeBtn.setAttribute('aria-label', 'Anbieter ' + provider.name + ' entfernen');
        if(state.providers.length > 1){
          removeBtn.addEventListener('click', function(){
            state.providers = state.providers.filter(function(p){ return p.id !== provider.id; });
            renderProviders(); render(); scheduleSave();
          });
        } else {
          removeBtn.remove();
        }

        var tbody = block.querySelector('tbody');

        provider.classes.forEach(function(cls){
          cls.childSeats = providerData.normalizeChildSeats(cls.childSeats);
          cls.tariffs.forEach(function(t, idx){
            var rowFragment = tariffRowTemplate.content.cloneNode(true);
            var tr = rowFragment.querySelector('.tariff-value-row');
            if(idx === 0){
              var classNameInput = document.createElement('input');
              classNameInput.type = 'text';
              classNameInput.className = 'class-name';
              classNameInput.value = cls.name;
              classNameInput.setAttribute('aria-label', 'Name der Fahrzeugklasse ' + cls.name);
              classNameInput.addEventListener('input', function(){ cls.name = classNameInput.value; render(); scheduleSave(); });
              tr.querySelector('[data-cell="class"]').appendChild(classNameInput);
            }
            var tariffNameInput = tr.querySelector('.tariff-name');
            tariffNameInput.value = t.name;
            tariffNameInput.setAttribute('aria-label', 'Name des Tarifs ' + t.name);
            tariffNameInput.addEventListener('input', function(){ t.name = tariffNameInput.value; render(); scheduleSave(); });
            var billingSelect = tr.querySelector('[data-field="billingMode"]');
            billingSelect.value = t.v.billingMode;
            billingSelect.setAttribute('aria-label', 'Abrechnungsart für ' + t.name);
            billingSelect.addEventListener('change', function(){
              t.v.billingMode = billingSelect.value;
              updateTariffRowControls(tr, t.v.billingMode);
              render();
              scheduleSave();
            });

            Array.prototype.forEach.call(tr.querySelectorAll('input[data-field]'), function(inp){
              var inputField = inp.getAttribute('data-field');
              inp.value = t.v[inputField];
              inp.setAttribute('aria-label', priceLabels[inputField] + ' für ' + t.name);
              inp.addEventListener('input', function(){
                var field = inp.getAttribute('data-field');
                t.v[field] = +inp.value || 0;
                render(); scheduleSave();
              });
            });
            updateTariffRowControls(tr, t.v.billingMode);

            var sourceLink = rowFragment.querySelector('.tariff-source-link');
            Array.prototype.forEach.call(rowFragment.querySelectorAll('[data-meta-field]'), function(metaInput){
              var metaField = metaInput.getAttribute('data-meta-field');
              metaInput.value = t.v.meta[metaField];
              metaInput.addEventListener('input', function(){
                t.v.meta[metaField] = metaInput.value;
                if(metaField === 'sourceUrl'){
                  updateTariffSourceLink(sourceLink, metaInput.value);
                }
                scheduleSave();
              });
            });
            updateTariffSourceLink(sourceLink, t.v.meta.sourceUrl);
            var removeTariffButton = tr.querySelector('.remove-tariff-btn');
            removeTariffButton.setAttribute('aria-label', 'Tarif ' + t.name + ' entfernen');
            removeTariffButton.disabled = cls.tariffs.length <= 1;
            removeTariffButton.addEventListener('click', function(){ removeClassTariff(cls, t); });
            tbody.appendChild(rowFragment);
          });
          var childSeatClassRow = childSeatClassRowTemplate.content.firstElementChild.cloneNode(true);
          Array.prototype.forEach.call(childSeatClassRow.querySelectorAll('[data-child-seat-field]'), function(input){
            var field = input.getAttribute('data-child-seat-field');
            input.value = cls.childSeats[field];
            if(field === 'boosterCount' && cls.childSeats.booster !== providerData.CHILD_SEAT_INCLUDED){
              input.disabled = true;
            }
            input.addEventListener('change', function(){
              if(field === 'boosterCount'){
                cls.childSeats.boosterCount = +input.value || 0;
              } else {
                cls.childSeats[field] = input.value;
              }
              cls.childSeats = providerData.normalizeChildSeats(cls.childSeats);
              renderProviders();
              render();
              scheduleSave();
            });
          });
          tbody.appendChild(childSeatClassRow);
          var classActions = classActionsTemplate.content.firstElementChild.cloneNode(true);
          classActions.querySelector('.add-tariff-btn').addEventListener('click', function(){ addClassTariff(cls); });
          var removeClassButton = classActions.querySelector('.remove-class-btn');
          removeClassButton.disabled = provider.classes.length <= 1;
          removeClassButton.addEventListener('click', function(){ removeProviderClass(provider, cls); });
          tbody.appendChild(classActions);
        });

        block.querySelector('.add-class-btn').addEventListener('click', function(){ addProviderClass(provider); });

        providerFragment.appendChild(block);
      });
      list.replaceChildren(providerFragment);
    }

    /**
     * Adds a provider with one editable default tariff.
     * @returns {void}
     */
    function addProvider(){
      if(state.providers.length >= limits.MAX_PROVIDERS){
        window.alert('Es können höchstens ' + limits.MAX_PROVIDERS + ' Anbieter verwaltet werden.');
        return;
      }
      var id = uid('anbieter');
      state.providers.push({
        id: id, name: 'Neuer Anbieter', operationMode: 'station-based',
        classes: [
          { id: uid('klasse'), name: 'Kleinwagen', tariffs: [
            { id: uid('tarif'), name: 'Standard', v: tariff(10, 2.00, 25.00, 0.25, 0.18, 0) }
          ]}
        ]
      });
      renderProviders(); render(); scheduleSave();
    }

    /**
     * Imports one versioned provider JSON file after showing a concrete preview.
     * @param {File} file - JSON file selected by the user.
     * @returns {Promise<void>} Resolves after import or error reporting.
     */
    async function importProviderFile(file){
      try{
        if(!file || typeof file.size !== 'number' || file.size > limits.MAX_IMPORT_BYTES){
          throw new Error('import-size');
        }
        var wrapper = JSON.parse(await file.text());
        if(!isObject(wrapper) || wrapper.formatVersion !== 1 || !isObject(wrapper.provider)){
          throw new Error('format');
        }
        if(!identifiers.hasValidProviderIdentifiers([wrapper.provider])){
          throw new Error('provider-identifiers');
        }
        if(!limits.hasLimitedProviderStructure([wrapper.provider])){
          throw new Error('provider-size');
        }
        var importedProvider = providerData.providerDefinitionToRuntime(wrapper.provider);
        if(!hasValidProviders([importedProvider])){
          throw new Error('provider');
        }
        var tariffCount = 0;
        importedProvider.classes.forEach(function(providerClass){ tariffCount += providerClass.tariffs.length; });
        var existingIndex = state.providers.findIndex(function(provider){ return provider.id === importedProvider.id; });
        if(existingIndex < 0 && state.providers.length >= limits.MAX_PROVIDERS){
          throw new Error('provider-size');
        }
        var preview = '„' + importedProvider.name + '“ mit ' + importedProvider.classes.length + ' Fahrzeugklassen und ' + tariffCount + ' Tarifen importieren?';
        if(existingIndex >= 0){
          preview += '\nDer vorhandene Anbieter „' + state.providers[existingIndex].name + '“ mit der Kennung ' + importedProvider.id + ' wird ersetzt.';
        }
        var confirmed = window.confirm(preview);
        if(!confirmed){
          return;
        }
        if(existingIndex >= 0){
          state.providers[existingIndex] = importedProvider;
        } else {
          state.providers.push(importedProvider);
        }
        if(!state.location.byProvider[importedProvider.id]){
          state.location.byProvider[importedProvider.id] = defaultLocationForProvider(importedProvider.id);
        }
        renderProviders();
        render();
        scheduleSave();
      }catch(error){
        if(error.message === 'import-size'){
          window.alert('Import abgelehnt: Die Datei ist größer als 128 KB.');
          return;
        }
        if(error.message === 'provider-size'){
          window.alert('Import abgelehnt: Es sind höchstens 20 Anbieter zulässig. Pro Anbieter sind höchstens 20 Fahrzeugklassen mit je 20 Tarifen erlaubt. Namen und Tarifmetadaten dürfen die unterstützte Länge nicht überschreiten.');
          return;
        }
        if(error.message === 'provider-identifiers'){
          window.alert('Import abgelehnt: Anbieter-, Klassen- oder Tarifkennungen sind ungültig, reserviert oder doppelt. Erlaubt sind maximal 64 Zeichen: Kleinbuchstaben, Ziffern, Bindestrich und Unterstrich, beginnend mit einem Buchstaben.');
          return;
        }
        window.alert('Import abgelehnt: Die JSON-Datei ist ungültig oder unvollständig. Preise und Gebühren müssen Zahlen ab 0 sein. Bitte verwende das Exportformat der Anwendung.');
      }
    }

    /**
     * Restores built-in tariffs after explicit confirmation.
     * @returns {void}
     */
    function resetTariffs(){
      var confirmed = window.confirm('Alle Tarifänderungen und selbst angelegten Anbieter werden entfernt. Standardtarife wiederherstellen?');
      if(!confirmed){
        return;
      }
      state.providers = defaultProviders();
      state.selection = { providerId: 'cambio', classId: 'klein', tariffId: 'aktiv', recommendationMode: MODE_MANUAL };
      var standardLocations = defaultLocation().byProvider;
      Object.keys(standardLocations).forEach(function(providerId){
        if(state.location.byProvider[providerId]){
          standardLocations[providerId] = state.location.byProvider[providerId];
        }
      });
      state.location.byProvider = standardLocations;
      renderProviders();
      fillLocationInputs();
      render();
      scheduleSave();
    }

    /**
     * Binds controls belonging to the tariff editor.
     * @returns {void}
     */
    function bindTariffEvents(){
      document.getElementById('add-provider-btn').addEventListener('click', addProvider);
      var importInput = document.getElementById('import-provider-file');
      document.getElementById('import-provider-btn').addEventListener('click', function(){ importInput.click(); });
      importInput.addEventListener('change', function(){
        if(importInput.files && importInput.files[0]){
          importProviderFile(importInput.files[0]);
        }
        importInput.value = '';
      });
      document.getElementById('reset-tariffs-btn').addEventListener('click', resetTariffs);
    }

    return {
      buildProviderExport: buildProviderExport,
      renderProviders: renderProviders,
      importProviderFile: importProviderFile,
      bindTariffEvents: bindTariffEvents
    };
  }

  window.CarshareTariffEditor = { create: create };
})();
