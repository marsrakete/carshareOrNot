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
  assert.match(html, /<template id="trip-cost-row-template">/);
  assert.doesNotMatch(application, /\.innerHTML\s*=/);
  assert.match(application, /\.textContent = card\.title/);
});

test('form controls and tabs expose accessible relationships', function(){
  const html = readProjectFile('index.html');
  const labelledControls = [
    'own_kaufpreis', 'own_haltedauer', 'own_restwert', 'own_wartung', 'own_versicherung',
    'own_sonstiges', 'own_verbrauch', 'own_kraftstoffpreis', 'own_stellplatz', 'own_parkausweis',
    'use_jahreskm', 'use_vergleichsjahre', 'use_kurzfahrten', 'use_stundenprofahrt',
    'use_bringtageprowoche', 'use_bringwochenprojahr', 'use_bringkmprotag',
    'use_bringbuchungenprotag', 'use_bringstundenprobuchung', 'use_bringseparatanteil',
    'use_tagesausfluege', 'use_stundenproausflug', 'use_kmproausflug',
    'use_mehrtagesfahrten', 'use_tageprofahrt', 'use_kmprofahrt',
    'use_urlaubsfahrten', 'use_tageprourlaub', 'use_kmprourlaub', 'loc_address', 'loc_count',
    'loc_walk', 'sel_provider', 'sel_class', 'sel_tariff'
  ];
  labelledControls.forEach(function(id){
    assert.match(html, new RegExp('<label[^>]*for="' + id + '"'));
  });
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tab" aria-selected="true" aria-controls="tab-rechner"/);
  assert.match(html, /role="tabpanel" aria-labelledby="tab-btn-rechner"/);
  assert.match(html, /id="use_parkplatz" aria-labelledby="parking-label"/);
  assert.match(html, /id="use_kindersitz" aria-labelledby="child-seat-label"/);
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

test('social preview and mobile icons are integrated', function(){
  const html = readProjectFile('index.html');
  const manifest = JSON.parse(readProjectFile('manifest.webmanifest'));
  const ogConfig = JSON.parse(readProjectFile('og-image.config.json'));
  assert.match(html, /property="og:image" content="https:\/\/marsrakete\.github\.io\/carshareOrNot\/icons\/carshare-or-not-og\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /rel="icon" href="icons\/icon\.svg"/);
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  assert.equal(manifest.icons[0].purpose, 'any');
  assert.equal(manifest.icons[1].purpose, 'maskable');
  assert.equal(ogConfig.render.width, 1200);
  assert.equal(ogConfig.render.height, 630);
  assert.ok(fs.existsSync(path.join(projectRoot, 'icons', 'carshare-or-not-og.png')));
  assert.ok(fs.existsSync(path.join(projectRoot, 'og-image.jpg')));
});

test('results reserve readable columns for annual totals', function(){
  const styles = readProjectFile('styles.css');
  assert.match(styles, /grid-template-columns: minmax\(0,1\.05fr\) minmax\(500px,\.95fr\)/);
  assert.match(styles, /\.kv-table th:nth-child\(3\), \.kv-table td:nth-child\(3\)\{ width: 24%; white-space: nowrap; \}/);
});
