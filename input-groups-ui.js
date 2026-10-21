(function(){
  'use strict';

  /**
   * Creates disclosure controls and live summaries without changing calculator data.
   * @returns {Object} Explicit mounting, summary refresh and field-reveal functions.
   */
  function create(){
    var groups = [];
    var integerFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
    var decimalFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
    var currencyFormat = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    var centsFormat = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

    /**
     * Reads and formats the current controls referenced by a summary value.
     * @param {HTMLElement} output - Summary span with source IDs and optional formatting.
     * @returns {string} Formatted value or the empty-state copy declared in the template.
     */
    function readSummaryValue(output){
      var ids = output.dataset.summaryFields.split(' ');
      var format = output.dataset.summaryFormat;
      var controls = ids.map(function(id){ return document.getElementById(id); });
      if(format === 'selection'){
        var select = controls[0];
        if(select && select.selectedOptions.length > 0){
          return select.selectedOptions[0].textContent;
        }
        return output.dataset.summaryEmpty || '';
      }
      var total = 0;
      var hasValue = false;
      controls.forEach(function(control){
        if(control && control.value !== '' && isFinite(Number(control.value))){
          total += Number(control.value);
          hasValue = true;
        }
      });
      if(!hasValue){
        return output.dataset.summaryEmpty || '';
      }
      if(format === 'currency'){
        return currencyFormat.format(total);
      } else if(format === 'currency-cents'){
        return centsFormat.format(total);
      } else if(format === 'decimal'){
        return decimalFormat.format(total);
      }
      return integerFormat.format(total);
    }

    /**
     * Refreshes summaries from current fields after edits, profile changes or state loading.
     * @returns {void} Leaves all values and disclosure states unchanged.
     */
    function updateSummaries(){
      groups.forEach(function(group){
        var summary = group.querySelector('.input-group-summary');
        summary.querySelectorAll('[data-summary-fields]').forEach(function(output){
          output.textContent = readSummaryValue(output);
        });
        summary.querySelectorAll('[data-summary-checked]').forEach(function(output){
          output.hidden = !document.getElementById(output.dataset.summaryChecked).checked;
        });
        summary.querySelectorAll('[data-summary-unchecked]').forEach(function(output){
          output.hidden = document.getElementById(output.dataset.summaryUnchecked).checked;
        });
        summary.querySelectorAll('[data-summary-visible-for]').forEach(function(output){
          output.hidden = document.getElementById(output.dataset.summaryVisibleFor).hidden;
        });
      });
    }

    /**
     * Opens enclosing disclosures so a field can receive programmatic focus.
     * @param {string} id - Identifier of the field to reveal.
     * @returns {HTMLElement|null} Revealed field, or null if it does not exist.
     */
    function revealField(id){
      var field = document.getElementById(id);
      if(!field){
        return null;
      }
      var ancestor = field.parentElement;
      while(ancestor){
        if(ancestor.tagName === 'DETAILS'){
          ancestor.open = true;
        }
        ancestor = ancestor.parentElement;
      }
      return field;
    }

    /**
     * Moves existing controls into cloned disclosure templates and binds summary updates once.
     * @returns {void} Preserves input IDs, current values and existing event handlers.
     */
    function mount(){
      if(groups.length > 0){
        return;
      }
      var template = document.getElementById('input-group-template');
      document.querySelectorAll('[data-input-group]').forEach(function(slot){
        var group = template.content.firstElementChild.cloneNode(true);
        group.id = 'input-group-' + slot.dataset.inputGroup;
        group.open = slot.hasAttribute('data-group-open');
        group.querySelector('.input-group-title').textContent = slot.dataset.groupTitle;
        group.querySelector('.input-group-icon use').setAttribute('href', '#' + slot.dataset.groupIcon);
        var summaryTemplate = slot.querySelector('.input-group-summary-template');
        group.querySelector('.input-group-summary').appendChild(summaryTemplate.content.cloneNode(true));
        summaryTemplate.remove();
        var body = group.querySelector('.input-group-body');
        while(slot.firstChild){
          body.appendChild(slot.firstChild);
        }
        slot.replaceWith(group);
        groups.push(group);
      });
      var panel = document.querySelector('section.panel');
      panel.addEventListener('input', updateSummaries);
      panel.addEventListener('change', updateSummaries);
      updateSummaries();
    }

    return { mount: mount, updateSummaries: updateSummaries, revealField: revealField };
  }

  window.CarshareInputGroupsUI = { create: create };
})();
