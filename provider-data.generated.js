// Automatisch aus data/providers/*.json erzeugt. Nicht von Hand bearbeiten.
(function(global){
  'use strict';
  global.CarshareProviderDefinitions = [
  {
    "id": "cambio",
    "name": "Cambio",
    "operationMode": "station-based",
    "meta": {
      "sourceUrl": "https://www.cambio-carsharing.de",
      "region": "Regional unterschiedlich",
      "lastVerifiedAt": "2026-09-07"
    },
    "classes": [
      {
        "id": "klein",
        "name": "Kleinwagen",
        "childSeats": {
          "infant": "bring-own",
          "booster": "included",
          "boosterCount": 1
        },
        "tariffs": [
          {
            "id": "aktiv",
            "name": "Aktiv (mit Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 10,
            "zeitpreis": 1.7,
            "tagespreis": 21,
            "wochenpreis": 105,
            "kmBis100": 0.23,
            "kmAb100": 0.16,
            "anmeldegebuehr": 30
          },
          {
            "id": "basis",
            "name": "Basis (ohne Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 0,
            "zeitpreis": 3,
            "tagespreis": 30,
            "wochenpreis": 150,
            "kmBis100": 0.24,
            "kmAb100": 0.18,
            "anmeldegebuehr": 30
          }
        ]
      },
      {
        "id": "kombi",
        "name": "Kombi",
        "childSeats": {
          "infant": "bring-own",
          "booster": "included",
          "boosterCount": 1
        },
        "tariffs": [
          {
            "id": "aktiv",
            "name": "Aktiv (mit Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 10,
            "zeitpreis": 2.2,
            "tagespreis": 29,
            "wochenpreis": 145,
            "kmBis100": 0.25,
            "kmAb100": 0.16,
            "anmeldegebuehr": 30
          },
          {
            "id": "basis",
            "name": "Basis (ohne Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 0,
            "zeitpreis": 4,
            "tagespreis": 40,
            "wochenpreis": 200,
            "kmBis100": 0.24,
            "kmAb100": 0.18,
            "anmeldegebuehr": 30
          }
        ]
      },
      {
        "id": "transporter",
        "name": "Transporter",
        "childSeats": {
          "infant": "bring-own",
          "booster": "bring-own",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "aktiv",
            "name": "Aktiv (mit Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 10,
            "zeitpreis": 4.9,
            "tagespreis": 49,
            "wochenpreis": 245,
            "kmBis100": 0.36,
            "kmAb100": 0.21,
            "anmeldegebuehr": 30
          },
          {
            "id": "basis",
            "name": "Basis (ohne Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 0,
            "zeitpreis": 7,
            "tagespreis": 70,
            "wochenpreis": 350,
            "kmBis100": 0.24,
            "kmAb100": 0.18,
            "anmeldegebuehr": 30
          }
        ]
      }
    ]
  },
  {
    "id": "miles",
    "name": "Miles",
    "operationMode": "free-floating",
    "meta": {
      "sourceUrl": "https://www.miles-mobility.com",
      "region": "Geschäftsgebiet des Anbieters",
      "lastVerifiedAt": "2026-09-07"
    },
    "classes": [
      {
        "id": "klein",
        "name": "Kleinwagen (S)",
        "childSeats": {
          "infant": "bring-own",
          "booster": "bring-own",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "km",
            "name": "Kilometertarif",
            "billingMode": "distance-with-packages",
            "grundgebuehr": 0,
            "zeitpreis": 0,
            "tagespreis": 45,
            "wochenpreis": 225,
            "kmBis100": 0.99,
            "kmAb100": 0.19,
            "anmeldegebuehr": 0
          }
        ]
      },
      {
        "id": "kombi",
        "name": "Kombi (M)",
        "childSeats": {
          "infant": "bring-own",
          "booster": "bring-own",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "km",
            "name": "Kilometertarif",
            "billingMode": "distance-with-packages",
            "grundgebuehr": 0,
            "zeitpreis": 0,
            "tagespreis": 49,
            "wochenpreis": 245,
            "kmBis100": 1.09,
            "kmAb100": 0.19,
            "anmeldegebuehr": 0
          }
        ]
      },
      {
        "id": "transporter",
        "name": "Transporter (L)",
        "childSeats": {
          "infant": "bring-own",
          "booster": "bring-own",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "km",
            "name": "Kilometertarif",
            "billingMode": "distance-with-packages",
            "grundgebuehr": 0,
            "zeitpreis": 0,
            "tagespreis": 99,
            "wochenpreis": 495,
            "kmBis100": 1.29,
            "kmAb100": 0.39,
            "anmeldegebuehr": 0
          }
        ]
      }
    ]
  },
  {
    "id": "free2move",
    "name": "Free2move (vormals Share Now)",
    "operationMode": "free-floating",
    "meta": {
      "sourceUrl": "https://www.free2move.com",
      "region": "Geschäftsgebiet des Anbieters",
      "lastVerifiedAt": "2026-09-07"
    },
    "classes": [
      {
        "id": "klein",
        "name": "Kleinwagen",
        "childSeats": {
          "infant": "bring-own",
          "booster": "bring-own",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "zeit",
            "name": "Minuten-/Stunden-/Tagestarif",
            "billingMode": "time-with-included-distance",
            "grundgebuehr": 0,
            "zeitpreis": 7,
            "tagespreis": 20.5,
            "wochenpreis": 102.5,
            "kmBis100": 0,
            "kmAb100": 0,
            "anmeldegebuehr": 0
          }
        ]
      },
      {
        "id": "kombi",
        "name": "Kombi",
        "childSeats": {
          "infant": "bring-own",
          "booster": "bring-own",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "zeit",
            "name": "Minuten-/Stunden-/Tagestarif",
            "billingMode": "time-with-included-distance",
            "grundgebuehr": 0,
            "zeitpreis": 9,
            "tagespreis": 28,
            "wochenpreis": 140,
            "kmBis100": 0,
            "kmAb100": 0,
            "anmeldegebuehr": 0
          }
        ]
      }
    ]
  },
  {
    "id": "flinkster",
    "name": "Flinkster",
    "operationMode": "station-based",
    "meta": {
      "sourceUrl": "https://www.flinkster.de",
      "region": "Deutschland, regional unterschiedlich",
      "lastVerifiedAt": "2026-09-07"
    },
    "classes": [
      {
        "id": "klein",
        "name": "Kleinwagen (Mini)",
        "childSeats": {
          "infant": "bring-own",
          "booster": "check",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "bundesweit",
            "name": "Bundesweiter Tarif (ohne Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 0,
            "zeitpreis": 2.3,
            "tagespreis": 39,
            "wochenpreis": 195,
            "kmBis100": 0.18,
            "kmAb100": 0.18,
            "anmeldegebuehr": 0
          }
        ]
      },
      {
        "id": "kombi",
        "name": "Kombi (Mittelklasse)",
        "childSeats": {
          "infant": "bring-own",
          "booster": "check",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "bundesweit",
            "name": "Bundesweiter Tarif (ohne Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 0,
            "zeitpreis": 4,
            "tagespreis": 55,
            "wochenpreis": 275,
            "kmBis100": 0.19,
            "kmAb100": 0.19,
            "anmeldegebuehr": 0
          }
        ]
      },
      {
        "id": "transporter",
        "name": "Transporter",
        "childSeats": {
          "infant": "bring-own",
          "booster": "check",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "bundesweit",
            "name": "Bundesweiter Tarif (ohne Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 0,
            "zeitpreis": 8,
            "tagespreis": 80,
            "wochenpreis": 400,
            "kmBis100": 0.2,
            "kmAb100": 0.2,
            "anmeldegebuehr": 0
          }
        ]
      }
    ]
  },
  {
    "id": "stadtmobil",
    "name": "Stadtmobil",
    "operationMode": "station-based",
    "meta": {
      "sourceUrl": "https://www.stadtmobil.de",
      "region": "Regionalgesellschaft prüfen",
      "lastVerifiedAt": "2026-09-07"
    },
    "classes": [
      {
        "id": "klein",
        "name": "Kleinwagen",
        "childSeats": {
          "infant": "bring-own",
          "booster": "check",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "vorteil",
            "name": "Vorteil (mit Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 10,
            "zeitpreis": 1.8,
            "tagespreis": 22,
            "wochenpreis": 110,
            "kmBis100": 0.22,
            "kmAb100": 0.18,
            "anmeldegebuehr": 30
          },
          {
            "id": "classic",
            "name": "Classic (ohne Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 0,
            "zeitpreis": 2.4,
            "tagespreis": 29,
            "wochenpreis": 145,
            "kmBis100": 0.28,
            "kmAb100": 0.25,
            "anmeldegebuehr": 30
          }
        ]
      },
      {
        "id": "kombi",
        "name": "Kombi (Mittelklasse)",
        "childSeats": {
          "infant": "bring-own",
          "booster": "check",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "vorteil",
            "name": "Vorteil (mit Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 10,
            "zeitpreis": 2.2,
            "tagespreis": 27,
            "wochenpreis": 135,
            "kmBis100": 0.25,
            "kmAb100": 0.21,
            "anmeldegebuehr": 30
          },
          {
            "id": "classic",
            "name": "Classic (ohne Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 0,
            "zeitpreis": 2.8,
            "tagespreis": 34,
            "wochenpreis": 170,
            "kmBis100": 0.31,
            "kmAb100": 0.28,
            "anmeldegebuehr": 30
          }
        ]
      },
      {
        "id": "transporter",
        "name": "Transporter",
        "childSeats": {
          "infant": "bring-own",
          "booster": "check",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "vorteil",
            "name": "Vorteil (mit Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 10,
            "zeitpreis": 3.5,
            "tagespreis": 43,
            "wochenpreis": 215,
            "kmBis100": 0.35,
            "kmAb100": 0.3,
            "anmeldegebuehr": 30
          },
          {
            "id": "classic",
            "name": "Classic (ohne Grundgebühr)",
            "billingMode": "time-and-distance",
            "grundgebuehr": 0,
            "zeitpreis": 4.4,
            "tagespreis": 53,
            "wochenpreis": 265,
            "kmBis100": 0.43,
            "kmAb100": 0.4,
            "anmeldegebuehr": 30
          }
        ]
      }
    ]
  },
  {
    "id": "sixtshare",
    "name": "Sixt Share",
    "operationMode": "free-floating",
    "meta": {
      "sourceUrl": "https://www.sixt.de/share",
      "region": "Geschäftsgebiet des Anbieters",
      "lastVerifiedAt": "2026-09-07"
    },
    "classes": [
      {
        "id": "klein",
        "name": "Kleinwagen",
        "childSeats": {
          "infant": "bring-own",
          "booster": "check",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "zeit",
            "name": "Minuten-/Stunden-/Tagestarif",
            "billingMode": "time-with-included-distance",
            "grundgebuehr": 0,
            "zeitpreis": 8,
            "tagespreis": 29,
            "wochenpreis": 145,
            "kmBis100": 0,
            "kmAb100": 0,
            "anmeldegebuehr": 0
          }
        ]
      },
      {
        "id": "kombi",
        "name": "Kombi / SUV",
        "childSeats": {
          "infant": "bring-own",
          "booster": "check",
          "boosterCount": 0
        },
        "tariffs": [
          {
            "id": "zeit",
            "name": "Minuten-/Stunden-/Tagestarif",
            "billingMode": "time-with-included-distance",
            "grundgebuehr": 0,
            "zeitpreis": 11,
            "tagespreis": 39,
            "wochenpreis": 195,
            "kmBis100": 0,
            "kmAb100": 0,
            "anmeldegebuehr": 0
          }
        ]
      }
    ]
  }
];
})(window);
