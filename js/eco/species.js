/**
 * Artentabelle - die fachliche Wahrheit der Simulation steht in Daten, nicht
 * im Code. Eine neue (oder eingeschleppte) Art ist ein neuer Eintrag; das
 * Verhalten in eco/behavior.js ist fuer alle Arten dasselbe.
 *
 * Alle Zahlen sind Startwerte fuer die Abstimmung (tools/balance.js), keine
 * biologisch kalibrierten Daten. Zeiten in Jahren werden mit BT.Time.years()
 * in Tage umgerechnet.
 *
 * Einheiten:
 *   energy     0..1, Anteil der vollen Reserve
 *   speed      Weltunits pro Tick
 *   range      Weltunits
 *   costPerDay Energieverbrauch pro Tag (Anteil der Reserve)
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});
  var B = BT.BIOME;

  // ------------------------------------------------------------ Nahrungsschichten
  /**
   * Pflanzen und Insekten sind Felder (ein Wert je Weidezelle), keine Tiere.
   * capacity: maximale Menge je Weidezelle und Lebensraum
   * growth:   Nachwuchsrate pro Tag (Anteil des fehlenden Bestands)
   * season:   Wachstumsfaktor je Jahreszeit [Fruehling, Sommer, Herbst, Winter]
   * water:    so viel Durst loescht eine gefressene Einheit (Pflanzen enthalten Wasser,
   *           Fruechte und Insekten mehr als Gras) - Trinken bleibt trotzdem noetig
   */
  BT.FOOD = {
    gras: {
      name: 'Gras und Kräuter',
      water: 0.04,
      growth: 0.035,
      season: [1.5, 1.0, 0.7, 0.3],
      capacity: cap({ TUSSOCK: 5.5, SCRUB: 2.75, SWAMP: 3.3, BEACH: 0.83, FERN: 0.83, MOSS: 0.55, THERMAL: 0.83, ROCK: 0.55 })
    },
    laub: {
      name: 'Triebe und Laub',
      water: 0.06,
      growth: 0.025,
      season: [1.4, 1.0, 0.6, 0.25],
      capacity: cap({ FERN: 4.4, MOSS: 3.3, SCRUB: 3.85, SWAMP: 1.1, TUSSOCK: 0.55 })
    },
    frucht: {
      name: 'Früchte und Samen',
      water: 0.16,
      growth: 0.05,
      season: [0.2, 1.0, 1.6, 0.0],
      capacity: cap({ SCRUB: 3.3, FERN: 2.2, MOSS: 1.65, TUSSOCK: 1.1, SWAMP: 1.1 })
    },
    insekten: {
      name: 'Insekten',
      water: 0.14,
      growth: 0.08,
      season: [1.3, 1.5, 0.7, 0.05],
      capacity: cap({ SWAMP: 3.85, FERN: 2.2, MOSS: 1.65, TUSSOCK: 1.65, SCRUB: 1.65, BEACH: 0.55 })
    }
  };
  BT.FOOD_ORDER = ['gras', 'laub', 'frucht', 'insekten'];

  function cap(byName) {
    var arr = new Array(BT.BIOME_INFO.length).fill(0);
    for (var k in byName) arr[B[k]] = byName[k];
    return arr;
  }

  // ------------------------------------------------------------ Arten
  var Y = function (y) { return BT.Time.years(y); };

  BT.SPECIES = {
    zwerghirsch: {
      id: 'zwerghirsch',
      name: 'Zwerghirsch',
      plural: 'Zwerghirsche',
      role: 'herbivore',
      sprite: 'assets/zwerghirsch.png',
      size: 24,                       // Weltunits (Darstellung)
      color: '#c9874a',
      group: { kind: 'herd', min: 2, max: 16, spread: 26, start: [5, 10] },
      start: 160,                     // Tiere zu Beginn
      // Nahrung: Energie je verzehrter Einheit
      diet: { gras: 0.11, laub: 0.09 },
      bite: 0.38,                     // Einheiten je Fressschritt und Tier
      costPerDay: 0.05,
      winterCost: 0.015,              // zusaetzlich im Winter
      thirstDays: 14,                 // so lange ohne Wasser, dann Tod
      speed: 4.5, fleeSpeed: 13, sprintTicks: 4,
      vision: 180,                    // erkennt Raeuber
      searchRadius: 260,              // sucht Futter
      habitat: pref({ TUSSOCK: 1.0, SCRUB: 1.0, FERN: 0.8, SWAMP: 0.5, MOSS: 0.5, BEACH: 0.3, THERMAL: 0.3, ROCK: 0.15, PEAK: 0 }),
      maturity: Y(1), maxAge: Y(8),
      breed: { kind: 'each-female', season: 0, day: 4, chance: 0.85, litter: [1, 2], minEnergy: 0.4, cost: 0.15 },
      newbornEnergy: 0.6,
      meat: 2.2                       // Energie, die ein erlegtes Tier liefert
    },

    laufvogel: {
      id: 'laufvogel',
      name: 'Laufvogel',
      plural: 'Laufvögel',
      role: 'herbivore',
      sprite: 'assets/laufvogel.png',
      size: 18,
      color: '#5d8fc9',
      group: { kind: 'flock', min: 1, max: 6, spread: 16, start: [2, 4] },
      start: 160,                     // Tiere zu Beginn
      diet: { gras: 0.04, frucht: 0.1, insekten: 0.11 },
      bite: 0.32,
      costPerDay: 0.055,
      winterCost: 0.015,
      thirstDays: 14,
      speed: 3.2, fleeSpeed: 11, sprintTicks: 3,
      vision: 120,
      searchRadius: 200,
      habitat: pref({ SCRUB: 1.0, FERN: 1.0, MOSS: 0.8, SWAMP: 0.9, TUSSOCK: 0.7, BEACH: 0.4, THERMAL: 0.3, ROCK: 0.1, PEAK: 0 }),
      maturity: Y(1), maxAge: Y(7),
      // Bodenbrueter: Gelege im Fruehling, Kueken schluepfen nach einigen Tagen
      breed: { kind: 'pair', season: 0, day: 2, chance: 0.85, litter: [2, 4], minEnergy: 0.35, cost: 0.15, incubation: 8 },
      newbornEnergy: 0.55,
      meat: 0.7
    },

    inselwolf: {
      id: 'inselwolf',
      name: 'Inselwolf',
      plural: 'Inselwölfe',
      role: 'predator',
      sprite: 'assets/inselwolf.png',
      size: 22,
      color: '#7c7c86',
      group: { kind: 'pack', min: 1, max: 8, spread: 18, start: [3, 5] },
      start: 20,                      // Tiere, verteilt auf Rudel
      prey: { zwerghirsch: 1.0, laufvogel: 0.8 },
      costPerDay: 0.045,
      winterCost: 0.015,
      thirstDays: 10,
      speed: 6, chaseSpeed: 19,
      vision: 230,
      huntChance: 0.22,               // je Angriff und Jaeger, steigt mit der Rudelgroesse
      maxChaseTicks: 12,
      territory: 320,                 // Radius des Reviers
      hungry: 0.65,                   // jagt, wenn Energie darunter
      habitat: pref({ TUSSOCK: 1, SCRUB: 1, FERN: 1, MOSS: 1, SWAMP: 0.7, BEACH: 0.6, THERMAL: 0.6, ROCK: 0.6, PEAK: 0.1 }),
      maturity: Y(1.5), maxAge: Y(9),
      breed: { kind: 'group-pair', season: 0, day: 6, chance: 0.85, litter: [2, 4], minEnergy: 0.6, cost: 0.15 },
      newbornEnergy: 0.6,
      disperse: { season: 2, minAge: Y(1.5), minGroup: 5, chance: 0.35 },
      meat: 1.2
    },

    inseladler: {
      id: 'inseladler',
      name: 'Inseladler',
      plural: 'Inseladler',
      role: 'predator',
      sprite: 'assets/inseladler.png',
      size: 22,
      color: '#b0703a',
      flies: true,
      group: { kind: 'pair', min: 1, max: 3, spread: 30, start: [2, 2] },
      start: 12,                      // Tiere, verteilt auf Paare
      // Greift Jungtiere des Hirschs und Laufvoegel an, sieht nicht unter Baeume
      prey: { laufvogel: 1.0, zwerghirsch: 0.6 },
      preyMaxAge: { zwerghirsch: Y(0.5) },
      costPerDay: 0.036,
      winterCost: 0.005,
      thirstDays: 0,                  // trinkt nicht (Wasser aus der Beute)
      speed: 8, chaseSpeed: 22,
      vision: 300,
      huntChance: 0.16,
      maxChaseTicks: 6,
      territory: 330,
      hungry: 0.6,
      habitat: pref({ TUSSOCK: 1, SCRUB: 1, FERN: 1, MOSS: 1, SWAMP: 1, BEACH: 1, THERMAL: 1, ROCK: 1, PEAK: 1 }),
      maturity: Y(2), maxAge: Y(14),
      breed: { kind: 'group-pair', season: 0, day: 8, chance: 0.75, litter: [1, 2], minEnergy: 0.45, cost: 0.15 },
      newbornEnergy: 0.6,
      disperse: { season: 2, minAge: Y(1), minGroup: 3, chance: 1 },
      meat: 0.8
    }
  };

  BT.SPECIES_ORDER = ['zwerghirsch', 'laufvogel', 'inselwolf', 'inseladler'];

  function pref(byName) {
    var arr = new Array(BT.BIOME_INFO.length).fill(0);
    for (var k in byName) arr[B[k]] = byName[k];
    return arr;
  }

  /** Lebensraeume, durch die eine Art sich am Boden nicht bewegen kann. */
  BT.isBlocked = function (biome, spec) {
    if (spec && spec.flies) return false;
    return biome === B.DEEP || biome === B.SHALLOW || biome === B.LAKE;
  };
})(typeof window !== 'undefined' ? window : globalThis);
