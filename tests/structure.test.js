'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..');

/**
 * Reads a UTF-8 project file for structural assertions.
 * @param {string} relativePath - Path relative to the project root.
 * @returns {string} File contents.
 */
function readProjectFile(relativePath){
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('HTML loads separated assets in dependency order', function(){
  const html = readProjectFile('index.html');
  assert.match(html, /<link rel="stylesheet" href="styles\.css">/);
  assert.ok(html.indexOf('src="providers.js"') < html.indexOf('src="calculator.js"'));
  assert.ok(html.indexOf('src="calculator.js"') < html.indexOf('src="app.js"'));
  assert.doesNotMatch(html, /<style>/);
  assert.doesNotMatch(html, /<script>([\s\S]*?)<\/script>/);
  assert.doesNotMatch(html, /\sstyle="/);
});

test('repeated interfaces use templates and safe rendering', function(){
  const html = readProjectFile('index.html');
  const application = readProjectFile('app.js');
  assert.match(html, /<template id="insight-card-template">/);
  assert.match(html, /<template id="provider-block-template">/);
  assert.match(html, /<template id="tariff-row-template">/);
  assert.doesNotMatch(application, /\.innerHTML\s*=/);
  assert.match(application, /\.textContent = card\.title/);
});

test('form controls and tabs expose accessible relationships', function(){
  const html = readProjectFile('index.html');
  const labelledControls = [
    'own_kaufpreis', 'own_haltedauer', 'own_restwert', 'own_wartung', 'own_versicherung',
    'own_sonstiges', 'own_verbrauch', 'own_kraftstoffpreis', 'own_stellplatz', 'own_parkausweis',
    'use_jahreskm', 'use_vergleichsjahre', 'use_kurzfahrten', 'use_stundenprofahrt',
    'use_mehrtagesfahrten', 'use_tageprofahrt', 'use_kmprofahrt', 'loc_address', 'loc_count',
    'loc_walk', 'sel_provider', 'sel_class', 'sel_tariff'
  ];
  labelledControls.forEach(function(id){
    assert.match(html, new RegExp('<label[^>]*for="' + id + '"'));
  });
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tab" aria-selected="true" aria-controls="tab-rechner"/);
  assert.match(html, /role="tabpanel" aria-labelledby="tab-btn-rechner"/);
  assert.match(html, /id="use_parkplatz" aria-labelledby="parking-label"/);
});

test('tariffs contain billing and source metadata controls', function(){
  const html = readProjectFile('index.html');
  const providers = readProjectFile('providers.js');
  assert.match(html, /data-field="billingMode"/);
  assert.match(html, /data-field="wochenpreis"/);
  assert.match(html, /data-meta-field="region"/);
  assert.match(html, /data-meta-field="lastVerifiedAt"/);
  assert.match(html, /data-meta-field="sourceUrl"/);
  assert.match(providers, /lastVerifiedAt/);
});

test('tariff table remains reachable on narrow screens', function(){
  const styles = readProjectFile('styles.css');
  assert.match(styles, /\.tariff-table-scroll\{[^}]*overflow-x: auto;/);
});
