(function(global){
  'use strict';

  var profiles = [
    {
      id: "city",
      title: "Kleiner Stadtwagen",
      annualWorkshopCost: 1038,
      annualInsuranceCost: 1090,
      annualTaxCost: 43,
      annualInspectionCost: 82,
      reference: "Aygo 1.0 x-style / up! ACTIVE",
      sourceIds: [311520,318838],
      monthlyWorkshopCosts: [80,93]
    },
    {
      id: "small",
      title: "Kleinwagen",
      annualWorkshopCost: 1242,
      annualInsuranceCost: 1260,
      annualTaxCost: 75,
      annualInspectionCost: 82,
      reference: "Polo MPI Comfortline / Corsa 1.2 Edition",
      sourceIds: [314121,316975],
      monthlyWorkshopCosts: [94,113]
    },
    {
      id: "compact",
      title: "Kompaktwagen",
      annualWorkshopCost: 1422,
      annualInsuranceCost: 1275,
      annualTaxCost: 81,
      annualInspectionCost: 82,
      reference: "Golf TSI UNITED / Astra 1.2 Turbo",
      sourceIds: [313516,309151],
      monthlyWorkshopCosts: [113,124]
    },
    {
      id: "estate",
      title: "Familienkombi",
      annualWorkshopCost: 1518,
      annualInsuranceCost: 1177,
      annualTaxCost: 120,
      annualInspectionCost: 82,
      reference: "Octavia Combi TSI Style / Passat TSI Business DSG",
      sourceIds: [310057,315523],
      monthlyWorkshopCosts: [123,130]
    },
    {
      id: "suv",
      title: "Kompakt-SUV",
      annualWorkshopCost: 1488,
      annualInsuranceCost: 1366,
      annualTaxCost: 155,
      annualInspectionCost: 82,
      reference: "Tiguan TSI UNITED DSG / Tucson T-GDI Select",
      sourceIds: [314141,318463],
      monthlyWorkshopCosts: [126,122]
    },
    {
      id: "van",
      title: "Van / großer Familienwagen",
      annualWorkshopCost: 1650,
      annualInsuranceCost: 1406,
      annualTaxCost: 254,
      annualInspectionCost: 82,
      reference: "Touran TSI Highline DSG / S-MAX EcoBlue ST-Line Allrad",
      sourceIds: [314766,316515],
      monthlyWorkshopCosts: [119,156]
    }
  ];

  /**
   * Applies workshop, insurance and tax/inspection estimates to a copy of owned-car settings.
   * @param {Object} own - Current owned-car costs.
   * @param {string} profileId - Selected reference profile identifier.
   * @returns {Object|null} Updated independent settings or null for an unknown profile.
   */
  function applyProfile(own, profileId){
    var profile = profiles.find(function(candidate){ return candidate.id === profileId; });
    if(!profile){
      return null;
    }
    return Object.assign({}, own, {
      wartung: profile.annualWorkshopCost,
      versicherung: profile.annualInsuranceCost,
      sonstiges: profile.annualTaxCost + profile.annualInspectionCost
    });
  }

  var api = { profiles: profiles, applyProfile: applyProfile };
  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }
  global.CarshareOwnProfiles = api;
})(globalThis);
