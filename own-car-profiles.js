(function(global){
  'use strict';

  var profiles = [
    { id: 'city', title: 'Kleiner Stadtwagen', annualWorkshopCost: 1038, reference: 'Aygo 1.0 x-style / up! ACTIVE · 80 / 93 €/Monat', sourceIds: [311520, 318838] },
    { id: 'small', title: 'Kleinwagen', annualWorkshopCost: 1242, reference: 'Polo MPI Comfortline / Corsa 1.2 Edition · 94 / 113 €/Monat', sourceIds: [314121, 316975] },
    { id: 'compact', title: 'Kompaktwagen', annualWorkshopCost: 1422, reference: 'Golf TSI UNITED / Astra 1.2 Turbo · 113 / 124 €/Monat', sourceIds: [313516, 309151] },
    { id: 'estate', title: 'Familienkombi', annualWorkshopCost: 1518, reference: 'Octavia Combi TSI Style / Passat TSI Business DSG · 123 / 130 €/Monat', sourceIds: [310057, 315523] },
    { id: 'suv', title: 'Kompakt-SUV', annualWorkshopCost: 1488, reference: 'Tiguan TSI UNITED DSG / Tucson T-GDI Select · 126 / 122 €/Monat', sourceIds: [314141, 318463] },
    { id: 'van', title: 'Van / großer Familienwagen', annualWorkshopCost: 1650, reference: 'Touran TSI Highline DSG / S-MAX EcoBlue ST-Line Allrad · 119 / 156 €/Monat', sourceIds: [314766, 316515] }
  ];

  /**
   * Applies the workshop estimate of one profile to a copy of owned-car settings.
   * @param {Object} own - Current owned-car costs.
   * @param {string} profileId - Selected reference profile identifier.
   * @returns {Object|null} Updated independent settings or null for an unknown profile.
   */
  function applyProfile(own, profileId){
    var profile = profiles.find(function(candidate){ return candidate.id === profileId; });
    if(!profile){
      return null;
    }
    return Object.assign({}, own, { wartung: profile.annualWorkshopCost });
  }

  var api = { profiles: profiles, applyProfile: applyProfile };
  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }
  global.CarshareOwnProfiles = api;
})(globalThis);
