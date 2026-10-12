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
   * growth:   Wachstumsrate pro Tag. Pflanzen wachsen aus ihrer Blattmasse: halb
   *           abgefressen waechst am schnellsten nach, kahl gefressen nur sehr
   *           langsam (aus dem Rest `seed`, Wurzeln und Samenbank).
   * seed:     Rest, aus dem auch eine kahle Flaeche nachwaechst (Anteil von capacity)
   * season:   Wachstumsfaktor je Jahreszeit [Fruehling, Sommer, Herbst, Winter]
   * water:    so viel Durst loescht eine gefressene Einheit (Pflanzen enthalten Wasser,
   *           Fruechte und Insekten mehr als Gras) - Trinken bleibt trotzdem noetig
   * damage:   Ueberweidung. Wird eine Weidezelle immer wieder unter `below` (Anteil der
   *           Kapazitaet) abgefressen, sinkt ihr Pflanzenzustand um `loss` je Tag: die
   *           Pflanzen sterben ab, es waechst weniger nach. Erst nach `rest` Tagen ohne
   *           Ueberweidung erholt sich der Zustand, um `recover` je Tag (mal Jahreszeit,
   *           mal 0,2 + 0,8 * Zustand: kahler Boden braucht am laengsten). Voellig
   *           ueberweidet traegt die Zelle nur noch `dead` (Anteil der Kapazitaet).
   *           area: statt der einzelnen Zelle zaehlt die Umgebung (so viele Weidezellen
   *           im Umkreis, gemessen an einer gesunden Gegend) - fuer Nahrung, die ein
   *           Trupp im Vorbeiziehen abfrisst. season: Jahreszeiten, in denen Schaden
   *           entsteht (sonst jede mit kraeftigem Wachstum).
   * healthOf: diese Schicht haengt am Zustand einer anderen (Fruechte an den Bueschen)
   * decay:    Schwund pro Tag je Jahreszeit (Fruechte verrotten, Insekten sterben im Winter)
   * mast:     in einem Mastjahr steigt die Kapazitaet um diesen Faktor (Sommer/Herbst)
   */
  BT.FOOD = {
    gras: {
      name: 'Gras und Kräuter',
      water: 0.04,
      growth: 0.13, seed: 0.05,
      season: [1.5, 1.0, 0.7, 0.3],
      damage: { below: 0.25, loss: 0.05, recover: 0.006, rest: 60, dead: 0.02 },
      capacity: cap({ TUSSOCK: 5.5, SCRUB: 2.75, SWAMP: 3.3, BEACH: 0.83, FERN: 0.83, MOSS: 0.55, THERMAL: 0.83, ROCK: 0.55 })
    },
    laub: {
      name: 'Triebe und Laub',
      water: 0.06,
      growth: 0.1, seed: 0.05,
      season: [1.4, 1.0, 0.6, 0.25],
      damage: { below: 0.3, loss: 0.03, recover: 0.004, rest: 60, dead: 0.02 },
      capacity: cap({ FERN: 4.4, MOSS: 3.3, SCRUB: 3.85, SWAMP: 1.1, TUSSOCK: 0.55 })
    },
    frucht: {
      name: 'Früchte und Samen',
      water: 0.16,
      growth: 0.18, seed: 0.05,
      season: [0.2, 1.0, 1.6, 0.0],
      decay: [0, 0, 0.015, 0.07],
      mast: 2.4,
      healthOf: 'laub',
      capacity: cap({ SCRUB: 3.3, FERN: 2.2, MOSS: 1.65, TUSSOCK: 1.1, SWAMP: 1.1 })
    },
    insekten: {
      name: 'Insekten',
      water: 0.14,
      growth: 0.3, seed: 0.35,          // Eier und Larven ueberwintern
      season: [1.3, 1.5, 0.7, 0.05],
      decay: [0, 0, 0.03, 0.12],
      // Zu viele Laufvoegel scharren ganze Gegenden leer: Larven und Puppen
      // fehlen, im naechsten Jahr schluepfen weniger Insekten
      damage: { below: 0.3, area: 2, season: [0, 1, 1, 0], loss: 0.1, recover: 0.006, rest: 120, dead: 0.03 },
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
      scarce: 0.8,                    // Beutewechsel: als Beute halb so gefragt bei diesem Anteil des Startbestands
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
      breed: { kind: 'each-female', season: 0, day: 4, chance: 0.85, litter: [1, 1], minEnergy: 0.4, cost: 0.15 },
      newbornEnergy: 0.6,
      meat: 1.5                       // Energie, die ein erlegtes Tier liefert
    },

    laufvogel: {
      id: 'laufvogel',
      name: 'Laufvogel',
      plural: 'Laufvögel',
      role: 'herbivore',
      sprite: 'assets/laufvogel.png',
      size: 18,
      color: '#5d8fc9',
      group: { kind: 'flock', min: 2, max: 6, spread: 16, start: [2, 4] },
      start: 160,                     // Tiere zu Beginn
      scarce: 0.8,
      diet: { frucht: 0.1, insekten: 0.11 },   // kein Gras: das Gras haengt allein an den Hirschen
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
      meat: 0.6
    },

    inselwolf: {
      id: 'inselwolf',
      name: 'Inselwolf',
      plural: 'Inselwölfe',
      role: 'predator',
      sprite: 'assets/inselwolf.png',
      size: 22,
      color: '#7c7c86',
      group: { kind: 'pack', min: 1, max: 6, spread: 18, start: [3, 5] },
      start: 20,                      // Tiere, verteilt auf Rudel
      prey: { zwerghirsch: 1.0, laufvogel: 0.15 },
      // Wie sein Vorbild frisst er nebenher Insekten und Fruechte - das traegt
      // ihn durch Zeiten mit wenig Beute, reicht aber nicht fuer Nachwuchs
      diet: { frucht: 0.06, insekten: 0.06 },
      bite: 0.15,
      costPerDay: 0.042,
      winterCost: 0.015,
      thirstDays: 10,
      speed: 6, chaseSpeed: 19,
      vision: 230,
      huntChance: 0.32,               // je Angriff und Jaeger, steigt mit der Rudelgroesse
      maxChaseTicks: 12,
      territory: 380,                 // Radius des Reviers
      hungry: 0.7,                    // jagt, wenn Energie darunter
      habitat: pref({ TUSSOCK: 1, SCRUB: 1, FERN: 1, MOSS: 1, SWAMP: 0.7, BEACH: 0.6, THERMAL: 0.6, ROCK: 0.6, PEAK: 0.1 }),
      maturity: Y(1.5), maxAge: Y(9),
      breed: { kind: 'group-pair', season: 0, day: 6, chance: 0.85, litter: [2, 4], minEnergy: 0.5, cost: 0.15 },
      newbornEnergy: 0.6,
      // Mehr Jagd mit Welpen (rearing: { age: Y(0.5), hungry: 0.76 }) wurde
      // getestet: die Woelfe ueberjagen dann die Hirsche und sterben haeufiger aus
      disperse: { season: 2, minAge: Y(1.5), minGroup: 4, chance: 0.6 },
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
      costPerDay: 0.03,
      winterCost: 0.005,
      thirstDays: 0,                  // trinkt nicht (Wasser aus der Beute)
      speed: 8, chaseSpeed: 22,
      vision: 300,
      huntChance: 0.3,
      maxChaseTicks: 6,
      territory: 330,
      // Junge Adler ohne Revier (Floater) werden geduldet: sie jagen ueberall,
      // nur nicht naeher als `core` am Horst eines Paares, und sind bis zum
      // Erwachsenenalter ungeuebt (Jagderfolg mal `skill`)
      floater: { core: 150, skill: 0.6 },
      // Je mehr andere Adler im Umkreis jagen, desto seltener gelingt ein Angriff
      crowding: { radius: 250, k: 0.4 },
      hungry: 0.65,
      habitat: pref({ TUSSOCK: 1, SCRUB: 1, FERN: 1, MOSS: 1, SWAMP: 1, BEACH: 1, THERMAL: 1, ROCK: 1, PEAK: 1 }),
      maturity: Y(2), maxAge: Y(14),
      // Horst: Ein Paar mit Revier legt im Fruehling 2-3 Eier. Brut: einer sitzt,
      // der andere jagt, bei jeder Beute wird gewechselt. Nestlinge: beide jagen
      // und fuettern. Flugge Junge verlassen den Horst und suchen sich ein Revier.
      breed: { kind: 'horst', season: 0, day: 1, chance: 0.85, litter: [2, 3], minEnergy: 0.55, cost: 0.1 },
      horst: {
        incubation: 10,               // Tage Brut
        nestling: 15,                 // Tage, bis die Kueken fluegge sind
        radius: 300,                  // gejagt wird in diesem Umkreis um den Horst
        hungry: 0.95,                 // jagt fast ununterbrochen
        huntBonus: 1.3,               // kennt die Umgebung des Horsts genau
        abandon: 0.25,                // sinkt die Energie des Brutvogels (oder beider Eltern) darunter, wird die Brut aufgegeben
        chickCost: 0.045,              // Kueken wachsen: zusaetzlicher Verbrauch je Tag
        selfFirst: 0.4,               // so weit fressen die Eltern sich zuerst satt                 // sinkt die Energie des Brutvogels darunter, gibt er das Gelege auf
        sites: pref({ FERN: 1, MOSS: 1, ROCK: 1, PEAK: 0.8, SCRUB: 0.5 })   // Baeume und Felsen
      },
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
