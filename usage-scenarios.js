(function(){
  'use strict';

  // Driving-profile reference values; UI behavior belongs to profiles-ui.js.
  window.CarshareUsageScenarios = [
    {
      id: 'family-commute', title: 'Familie, Pendler, 2 Kleinkinder', iconId: 'scenario-icon-family',
      summary: '12.000 km · 5 Kita-Tage/Woche · 2 Urlaube',
      values: { jahreskm: 12000, kurzfahrten: 20, stundenprofahrt: 1.5, bringtageprowoche: 5, bringwochenprojahr: 46, bringkmprotag: 16, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 60, childSeatInfantCount: 2, childSeatBoosterCount: 0, childSeatNeedsReview: false, tagesausfluege: 8, stundenproausflug: 8, kmproausflug: 100, mehrtagesfahrten: 4, tageprofahrt: 3, kmprofahrt: 300, urlaubsfahrten: 2, tageprourlaub: 7, kmprourlaub: 800, flex: 'teilweise', freefloatingFit: 'auto' }
    },
    {
      id: 'family-homeoffice', title: 'Familie, kein Pendeln, 2 Kleinkinder', iconId: 'scenario-icon-home',
      summary: '7.500 km · 5 Kita-Tage/Woche · mehr Ausflüge',
      values: { jahreskm: 7500, kurzfahrten: 8, stundenprofahrt: 2, bringtageprowoche: 5, bringwochenprojahr: 46, bringkmprotag: 16, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 60, childSeatInfantCount: 2, childSeatBoosterCount: 0, childSeatNeedsReview: false, tagesausfluege: 12, stundenproausflug: 8, kmproausflug: 100, mehrtagesfahrten: 5, tageprofahrt: 3, kmprofahrt: 250, urlaubsfahrten: 2, tageprourlaub: 7, kmprourlaub: 700, flex: 'teilweise', freefloatingFit: 'auto' }
    },
    {
      id: 'care-weekly', title: 'Pflegefahrten wöchentlich', iconId: 'scenario-icon-care',
      summary: '6.000 km · 2 flexible Fahrten/Woche · bis 50 km',
      values: { jahreskm: 6000, kurzfahrten: 9, stundenprofahrt: 3, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 0, stundenproausflug: 8, kmproausflug: 120, mehrtagesfahrten: 0, tageprofahrt: 3, kmprofahrt: 250, urlaubsfahrten: 0, tageprourlaub: 7, kmprourlaub: 900, flex: 'spontan', freefloatingFit: 'supplement' }
    },
    {
      id: 'single-commute', title: 'Single & Pendeln', iconId: 'scenario-icon-commute',
      summary: '10.000 km · 20 Arbeitstage/Monat · flexibel',
      values: { jahreskm: 10000, kurzfahrten: 20, stundenprofahrt: 9, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 3, stundenproausflug: 8, kmproausflug: 100, mehrtagesfahrten: 2, tageprofahrt: 2, kmprofahrt: 250, urlaubsfahrten: 1, tageprourlaub: 7, kmprourlaub: 700, flex: 'teilweise', freefloatingFit: 'suitable' }
    },
    {
      id: 'single-homeoffice-office', title: 'Single, Homeoffice & 2 Bürotage', iconId: 'scenario-icon-commute',
      summary: '13.440 km/Jahr · 140 km hin und zurück · 2×/Woche · 48 Wochen · 10 Std./Bürotag',
      values: {
        jahreskm: 13440, kurzfahrten: 8, stundenprofahrt: 10, alltagsmodell: 'continuous',
        bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12,
        bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100,
        childSeatInfantCount: 0, childSeatBoosterCount: 0, childSeatNeedsReview: false,
        tagesausfluege: 0, stundenproausflug: 8, kmproausflug: 100,
        mehrtagesfahrten: 0, tageprofahrt: 2, kmprofahrt: 250,
        urlaubsfahrten: 0, tageprourlaub: 7, kmprourlaub: 700,
        flex: 'planbar', freefloatingFit: 'auto'
      }
    },
    {
      id: 'care-frequent', title: 'Pflegefahrten häufig', iconId: 'scenario-icon-care',
      summary: '13.000 km · werktäglich flexibel · bis 50 km',
      values: { jahreskm: 13000, kurzfahrten: 22, stundenprofahrt: 3, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 0, stundenproausflug: 8, kmproausflug: 120, mehrtagesfahrten: 0, tageprofahrt: 3, kmprofahrt: 250, urlaubsfahrten: 0, tageprourlaub: 7, kmprourlaub: 900, flex: 'spontan', freefloatingFit: 'unsuitable' }
    },
    {
      id: 'single-parent-weekend', title: 'Alleinerziehend & Wochenendbeziehung', iconId: 'scenario-icon-family',
      summary: '7.000 km · 40 Wochenenden · je 100 km',
      values: { jahreskm: 7000, kurzfahrten: 6, stundenprofahrt: 2, bringtageprowoche: 2, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 50, childSeatInfantCount: 0, childSeatBoosterCount: 1, childSeatNeedsReview: false, tagesausfluege: 2, stundenproausflug: 8, kmproausflug: 100, mehrtagesfahrten: 40, tageprofahrt: 2, kmprofahrt: 100, urlaubsfahrten: 1, tageprourlaub: 7, kmprourlaub: 600, flex: 'teilweise', freefloatingFit: 'auto' }
    },
    {
      id: 'urban-couple', title: 'Paar, städtisch & Homeoffice', iconId: 'scenario-icon-home',
      summary: '4.500 km · Freizeit · gelegentliche Wochenenden',
      values: { jahreskm: 4500, kurzfahrten: 8, stundenprofahrt: 2, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 6, stundenproausflug: 8, kmproausflug: 100, mehrtagesfahrten: 4, tageprofahrt: 2, kmprofahrt: 200, urlaubsfahrten: 1, tageprourlaub: 7, kmprourlaub: 700, flex: 'teilweise', freefloatingFit: 'suitable' }
    },
    {
      id: 'retirement', title: 'Ruhestand mit Terminen', iconId: 'scenario-icon-care',
      summary: '5.000 km · Arzt und Einkauf · meist planbar',
      values: { jahreskm: 5000, kurzfahrten: 12, stundenprofahrt: 3, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 4, stundenproausflug: 7, kmproausflug: 80, mehrtagesfahrten: 2, tageprofahrt: 3, kmprofahrt: 200, urlaubsfahrten: 1, tageprourlaub: 7, kmprourlaub: 600, flex: 'planbar', freefloatingFit: 'supplement' }
    },
    {
      id: 'low-mileage', title: 'Wenigfahrer', iconId: 'scenario-icon-route',
      summary: '2.500 km · 3 Alltagsfahrten/Monat · 1 Urlaub',
      values: { jahreskm: 2500, kurzfahrten: 3, stundenprofahrt: 2, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 3, stundenproausflug: 8, kmproausflug: 100, mehrtagesfahrten: 2, tageprofahrt: 2, kmprofahrt: 200, urlaubsfahrten: 1, tageprourlaub: 7, kmprourlaub: 600, flex: 'planbar', freefloatingFit: 'supplement' }
    },
    {
      id: 'leisure', title: 'Freizeit & Ausflüge', iconId: 'scenario-icon-route',
      summary: '7.000 km · 18 Tagesausflüge · 8 Wochenenden',
      values: { jahreskm: 7000, kurzfahrten: 4, stundenprofahrt: 2, bringtageprowoche: 0, bringwochenprojahr: 40, bringkmprotag: 12, bringbuchungenprotag: 2, bringstundenprobuchung: 0.75, bringseparatanteil: 100, kindersitz: false, tagesausfluege: 18, stundenproausflug: 9, kmproausflug: 120, mehrtagesfahrten: 8, tageprofahrt: 2, kmprofahrt: 300, urlaubsfahrten: 1, tageprourlaub: 7, kmprourlaub: 800, flex: 'planbar', freefloatingFit: 'supplement' }
    }
  ];
})();
