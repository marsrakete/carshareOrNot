# carshareOrNot
Vergleiche die jährlichen Kosten eines eigenen Gebrauchtwagens mit denen von Carsharing-Tarifen – auf Basis deiner tatsächlichen Fahrgewohnheiten

## Teilen

Der Button „Teilen“ öffnet auf unterstützten Geräten das native Teilen-Menü. Andernfalls wird der Link in die Zwischenablage kopiert oder zum manuellen Kopieren angezeigt.

Der Link enthält den vollständigen Rechnerzustand, einschließlich der eingegebenen Adresse, Standortwerte und angepassten Tarife. Die Daten stehen komprimiert im URL-Hash und werden deshalb beim Aufruf nicht als Teil der HTTP-Anfrage an den Webserver übertragen. Jeder Empfänger des Links kann die enthaltenen Einstellungen laden und lesen.

## Projektstruktur

- `index.html` enthält die semantische Seitenstruktur und wiederverwendbare Templates.
- `styles.css` enthält Layout, Komponentenstile und responsive Regeln.
- `providers.js` enthält Standardwerte, Tarifarten, Anbieter und Tarif-Migrationen.
- `calculator.js` enthält die zustandslose Kostenberechnung.
- `app.js` enthält Zustand, Speicherung, Stationssuche und Rendering.
- `tests/calculation.test.js` prüft Rechenmodelle, Grenzfälle und geteilte Zustände.

Mit `npm run check` werden die automatisierten Prüfungen ausgeführt.

## Rechenmodell und Daten

- Standortwerte sind zunächst unbekannt. Eine Verfügbarkeitsbewertung erscheint erst nach manueller Eingabe oder erfolgreicher Anbietersuche.
- Mehrtageskilometer werden zuerst von der Jahresfahrleistung abgezogen. Die restlichen Kilometer werden gleichmäßig auf die angegebenen Alltagsfahrten verteilt, damit Kilometerstaffeln pro Buchung greifen.
- Tarife verwenden ausdrücklich eine der Abrechnungsarten „Zeit + Kilometer“, „Kilometer + Tagespakete“ oder „Zeit, Kilometer inklusive“.
- Der Betrachtungszeitraum bestimmt, über wie viele Jahre einmalige Anmeldegebühren verteilt werden.
- Jeder Tarif kann Region, Quellen-URL und Datum der letzten Prüfung enthalten. Die Standardtarife lassen sich im Tarifeditor wiederherstellen; eigene Tarifänderungen und Anbieter werden dabei nach Bestätigung entfernt.
