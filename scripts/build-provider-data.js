'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const identifiers = require('../identifier-validation.js');
const limits = require('../data-limits.js');

const projectRoot = path.join(__dirname, '..');
const providerDirectory = path.join(projectRoot, 'data', 'providers');
const outputPath = path.join(projectRoot, 'provider-data.generated.js');
const providerOrder = ['cambio', 'miles', 'free2move', 'flinkster', 'stadtmobil', 'sixtshare'];

/**
 * Verifies the required top-level fields of one provider source.
 * @param {Object} wrapper - Parsed provider file including its format version.
 * @param {string} filename - Source filename used in error messages.
 * @returns {Object} Validated provider definition.
 */
function validateProviderSource(wrapper, filename){
  if(!wrapper || wrapper.formatVersion !== 1 || !wrapper.provider){
    throw new Error(filename + ': formatVersion 1 und provider werden erwartet.');
  }
  const provider = wrapper.provider;
  if(typeof provider.id !== 'string' || typeof provider.name !== 'string' || !Array.isArray(provider.classes)){
    throw new Error(filename + ': Anbieterkennung, Name oder Klassen fehlen.');
  }
  if(provider.operationMode !== 'station-based' && provider.operationMode !== 'free-floating'){
    throw new Error(filename + ': operationMode ist ungültig.');
  }
  return provider;
}

/**
 * Reads all provider JSON files in stable filename order.
 * @returns {Array<Object>} Validated provider definitions.
 */
function readProviderDefinitions(){
  const filenames = fs.readdirSync(providerDirectory)
    .filter(function(filename){ return filename.endsWith('.json'); })
    .sort();
  const definitions = filenames.map(function(filename){
    const sourcePath = path.join(providerDirectory, filename);
    const wrapper = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    return validateProviderSource(wrapper, filename);
  });
  if(!identifiers.hasValidProviderIdentifiers(definitions)){
    throw new Error('Ungültige, reservierte oder doppelte Anbieter-, Klassen- oder Tarifkennung.');
  }
  if(!limits.hasLimitedProviderStructure(definitions)){
    throw new Error('Anbieterdaten überschreiten die unterstützten Größen- oder Textgrenzen.');
  }
  definitions.sort(function(firstProvider, secondProvider){
    const firstIndex = providerOrder.indexOf(firstProvider.id);
    const secondIndex = providerOrder.indexOf(secondProvider.id);
    if(firstIndex === -1 && secondIndex === -1){
      return firstProvider.id.localeCompare(secondProvider.id);
    }
    if(firstIndex === -1){
      return 1;
    }
    if(secondIndex === -1){
      return -1;
    }
    return firstIndex - secondIndex;
  });
  return definitions;
}

/**
 * Creates the classic browser script containing all provider definitions.
 * @param {Array<Object>} definitions - Provider definitions read from JSON.
 * @returns {string} Complete generated JavaScript source.
 */
function createBrowserSource(definitions){
  return '// Automatisch aus data/providers/*.json erzeugt. Nicht von Hand bearbeiten.\n' +
    '(function(global){\n' +
    "  'use strict';\n" +
    '  global.CarshareProviderDefinitions = ' + JSON.stringify(definitions, null, 2) + ';\n' +
    '})(window);\n';
}

/**
 * Reads provider definitions from an existing generated browser script.
 * @returns {Array<Object>} Definitions assigned by the generated script.
 */
function readGeneratedDefinitions(){
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(outputPath, 'utf8'), context);
  return JSON.parse(JSON.stringify(context.window.CarshareProviderDefinitions));
}

/**
 * Builds the browser file or checks that it matches the JSON sources.
 * @returns {void}
 */
function main(){
  const definitions = readProviderDefinitions();
  if(process.argv.includes('--check')){
    const generatedDefinitions = readGeneratedDefinitions();
    if(JSON.stringify(generatedDefinitions) !== JSON.stringify(definitions)){
      throw new Error('provider-data.generated.js ist veraltet. Bitte npm run build:providers ausführen.');
    }
    process.stdout.write('Anbieterdaten sind aktuell (' + definitions.length + ' Dateien).\n');
    return;
  }
  fs.writeFileSync(outputPath, createBrowserSource(definitions), 'utf8');
  process.stdout.write('provider-data.generated.js aus ' + definitions.length + ' JSON-Dateien erzeugt.\n');
}

main();
