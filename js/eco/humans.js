/**
 * Die Menschen: Schiffe, Haeuser, Siedler und die Stoerung, die von ihnen
 * ausgeht (docs/MENSCH.md).
 *
 * Gespielt wird mit Karten (eco/cards.js) ueber sim.play(). Bis zur Landung
 * gibt es keine Menschen, und nichts hier veraendert den Ablauf: Die Menschen
 * haben ihren eigenen Zufallsgenerator, das Stoerungsfeld ist ueberall 0.
 *
 * Stoerung: ein Wert 0..1 je Weidezelle. Um jedes Haus faellt sie von 1 auf 0
 * im Abstand HUMANS.disturb.radius ab. Wie stark eine Art sie meidet, steht
 * in spec.scheu (0..1); gemieden wird, wo Stoerung * scheu ueber
 * HUMANS.disturb.avoid liegt (siehe eco/behavior.js).
 *
 * Schafe und Hunde: Auf der Weide und im Dorf gehoeren sie den Menschen und
 * sind keine Tiere der Simulation (sie fressen aber das Gras der Weide).
 * Etwa 4 Jahre nach jeder Weide bzw. den ersten Huetehunden und danach immer
 * wieder bricht eine kleine Gruppe aus und wird zur eingeschleppten Art
 * (BT.SPECIES.schaf, BT.SPECIES.hund): Folgekarten "Schafe brechen aus" und
 * "Hunde verwildern". Die Ausreisser laufen erst weit weg (g.runaway).
 *
 * Zaun: Die Weiden sind eingezaeunt (this.fence, ein Wert je Rasterzelle).
 * Hinein duerfen nur fliegende Tiere und jagende Raeuber (barrier).
 *
 * Jaeger (this.hunters): Wolfsjaeger und Wildjaeger ziehen auf Jagdzuege und
 * erlegen Tiere (Todesursache "jagd"). Hungrige Woelfe greifen sie an; wer
 * gewinnt, haengt davon ab, ob es Wolfsjaeger sind (siehe "Jagd" unten).
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});

  BT.HUMANS = {
    landing: {
      settlers: 5,
      searchRadius: 150,      // so weit darf der Klick von der Kueste entfernt sein
      shipDistance: 320,      // hier taucht das Schiff auf
      shipDays: 4,            // so lange faehrt es bis zur Kueste
      stayDays: 3,            // so lange liegt es vor Anker
      inland: 4               // das Haus steht so viele Rasterzellen hinter der Kueste
    },
    disturb: {
      radius: 260,            // Weltunits um jedes Haus
      avoid: 0.3,             // Stoerung * scheu darueber: die Gegend wird gemieden
      night: 0.4              // nachts sind die Siedler im Haus: so viel Stoerung bleibt
    },
    field: {                  // Karte "Acker anlegen"
      radius: 55,             // Groesse eines Ackers (unregelmaessig)
      distMin: 150,           // Abstand der Ackermitte vom Dorf
      distMax: 270,
      harvestSeason: 2,       // geerntet wird am ersten Tag des Herbstes
      workers: 0.5            // Anteil der Siedler, die tagsueber auf dem Acker arbeiten
    },
    settler: {
      speed: 3,               // Weltunits je Tick
      roam: 110,              // so weit gehen sie vom Haus weg
      size: 13
    },
    pasture: {                // Karte "Schafweide"
      radius: 60,             // eingezaeunte Weide (unregelmaessig)
      distMin: 130,           // Abstand der Weidemitte vom Dorf
      distMax: 280,
      sheep: 12,              // Schafe je Weide
      speed: 1.6,             // Weltunits je Tick
      bite: 0.25,             // Gras je Tick und Schaf (tagsueber)
      escapeYears: 4,         // so lange nach jeder neuen Weide brechen dort einmal Schafe aus (± escapeJitter)
      escapeJitter: 0.3,
      escape: [2, 6],         // so viele Schafe (Haelfte Weibchen)
      runaway: [350, 600]     // so weit vom Dorf laufen sie, bevor sie sich eine Weide suchen
    },
    dogs: {                   // Karte "Huetehunde"
      perCard: 3,
      speed: 3.5,
      disturb: 200,           // Hunde an der Weide: Stoerung in diesem Umkreis (statt nur ums Haus)
      houseBonus: 1.2,        // ... und das Dorf wirkt weiter (Radius mal diesem Faktor)
      escapeYears: 4,         // so lange nach jeder Karte "Huetehunde" verwildern einmal Hunde
      escape: [2, 3],         // so viele Hunde (Weibchen, Maennchen, ...)
      runaway: [400, 700],    // so weit vom Dorf laufen sie, bevor sie ein Revier suchen
      join: 700               // ein wildes Rudel so nah am Dorf: die Ausreisser schliessen sich ihm an
    },
    hunt: {                   // Karten "Woelfe jagen" und "Wild jagen"
      perCard: 2,             // Jaeger je Karte
      speed: 30,              // Weltunits je Tick auf dem Weg (nachts lagern sie draussen)
      stalk: 14,              // ... und beim Anschleichen (naeher als 150 an der Beute)
      range: 1000,            // so weit vom Dorf ziehen sie auf die Jagd (jede weitere Karte + rangePlus)
      rangePlus: 0.3,
      tripDays: 12,           // laengstens so lange dauert ein Jagdzug
      restDays: [2, 4],       // danach so lange im Dorf
      shot: 90,               // Schussweite
      // Beute (Gewicht bei der Wahl) und Trefferchance je Schuss (mal 1 - Deckung * 0,5;
      // scheue Tiere (scheu >= flee) bemerken die Jaeger und fliehen: Treffer mal shy).
      // Wildjaeger tragen ein Tier heim, Wolfsjaeger jagen weiter, bis der Jagdzug um ist (stay)
      wolf: { prey: { inselwolf: 1, hund: 1 }, hit: 0.7, stay: true },
      wild: { prey: { zwerghirsch: 1, laufvogel: 1, schaf: 1 }, hit: 0.5, stay: false },
      sight: 160,             // Beute, die ein Jaeger unterwegs naeher sieht als sein Ziel, wird das neue Ziel ...
      out: [0, 500],          // ... aber erst so weit vom Dorf (je Jagdzug neu gewuerfelt: mal nah, mal weit draussen)
      flee: 0.5,              // ab dieser scheu fliehen Tiere vor Jaegern (Laufvogel nicht)
      notice: 0.4,            // ... wenn ein Jaeger naeher ist als vision * notice (Hirsch 72)
      shy: 0.6,
      offal: 0.25,            // Anteil der Beute, der als Aas liegen bleibt (Aufbruch)
      // Hungrige Woelfe (und Hunde) greifen Jaeger an, die ihnen zu nahe kommen
      attackers: { inselwolf: 1, hund: 1 },
      attackRange: 50,
      attack: 0.08,           // Chance je Tick, mal 2, wenn der Jaeger Beute traegt
      // Ausgang eines Angriffs: Wolfsjaeger rechnen damit, Wildjaeger nicht
      outcome: { wolf: { hunter: 0.05, wolf: 0.85 }, wild: { hunter: 0.3, wolf: 0.4 }, sammel: { hunter: 0.4, wolf: 0.05 } }
    },
    gather: {                 // Karte "Sammeln" (nach dem Prinzip der Jagd, Werte, die fehlen, aus hunt)
      perCard: 2,             // Sammler je Karte
      speed: 30,              // Weltunits je Tick auf dem Weg
      out: [0, 500],          // so weit vom Dorf fangen sie an zu sammeln (je Gang neu gewuerfelt) ...
      ring: 250,              // ... das Ziel liegt out bis out + ring vom Dorf
      min: 0.5,               // gesammelt wird, wo eine Weidezelle so viele Fruechte traegt (Busch voll: 3,3)
      bite: 3,                // Fruechte je Tick
      load: 60,               // so viel tragen sie heim (3 Koerbe), dann geht es heim
      basket: 20,             // ein Korb (fuer die Sammelbilanz)
      tripDays: 10,
      restDays: [1, 2]
    },
    village: {                // Karte "Dorf vergroessern"
      houses: 2,              // neue Haeuser je Karte
      settlersPerHouse: 2,
      clearRadius: 75,        // Rodung: Radius der (unregelmaessigen) Flaeche
      clearMin: 70,           // ... deren Mitte so weit vom Dorf entfernt liegt
      clearMax: 300,
      yard: 24,               // um jedes Haus wird das Land zu Dorf
      spacing: 34             // Mindestabstand zwischen Haeusern
    }
  };

  function Humans(sim) {
    this.sim = sim;
    this.world = sim.world;
    this.rng = new BT.Rng(sim.world.seed).fork('menschen');
    this.ships = [];
    this.houses = [];
    this.people = [];
    this.nextId = 1;
    this.active = false;            // gibt es ueberhaupt Stoerung?
    this.night = false;             // nachts weniger Stoerung (Siedler im Haus)
    this.fields = [];               // Aecker: { x, y, cells, day }
    this.cropMark = 0;              // Getreide, das die Tiere bis zur letzten Ernte gefressen hatten
    this.harvests = [];             // je Ernte: { day, harvested, eaten }
    this.pastures = [];             // Weiden: { x, y, r, shape, sheep: [...], day }
    this.dogs = [];                 // Huetehunde: { x, y, ... }
    this.dogsKept = 0;              // so viele Huetehunde halten die Siedler
    this.sheepDay = null;           // Tag der ersten Weide
    this.dogDay = null;             // Tag der ersten Huetehunde
    this.dogEscapes = [];           // Tage, an denen Hunde verwildern (einer je Karte "Huetehunde")
    this.escaped = {};              // { schaf: Tag, hund: Tag } des ersten Ausbruchs
    this.fence = null;              // Weidezaeune: 1 je Rasterzelle innerhalb einer Weide
    this.waterDist = null;          // Abstand zum Suesswasser um die Zaeune herum (Zellen), sonst null
    this.hunters = [];              // Jaeger: { kind: 'wolf'|'wild', state, target, carry, ... }
    this.huntersKept = { wolf: 0, wild: 0, sammel: 0 };
    this.gathered = 0;              // Fruechte, die die Sammler heimgebracht haben (Einheiten)
    this.gatheredYear = 0;
    this.bag = {};                  // erlegt seit der Landung, je Art
    this.bagYear = {};              // ... im laufenden Jahr (Jagdbilanz in der Chronik)
    this.attacks = { total: 0, hunters: 0, wolves: 0, year: {}, yearDead: {} };   // year, yearDead: je Art der Menschen
    var f = sim.fields;
    this.disturb = new Float32Array(f.cols * f.rows);
  }

  // ------------------------------------------------------------ Abfragen

  Humans.prototype.disturbanceAt = function (x, y) {
    if (!this.active) return 0;
    var i = this.sim.fields.index(x, y);
    return i < 0 ? 0 : this.disturb[i] * (this.night ? BT.HUMANS.disturb.night : 1);
  };

  /** Stoerung, wie sie eine Art empfindet (mal scheu). */
  Humans.prototype.felt = function (spec, x, y) {
    return this.active && spec.scheu ? this.disturbanceAt(x, y) * spec.scheu : 0;
  };

  /** Meidet diese Art den Punkt? */
  Humans.prototype.avoids = function (spec, x, y) {
    return this.felt(spec, x, y) >= BT.HUMANS.disturb.avoid;
  };

  /** Liegt der Punkt in einer eingezaeunten Weide? */
  Humans.prototype.fenced = function (x, y) {
    if (!this.fence) return false;
    var i = this.world.query.index(x, y);
    return i >= 0 && this.fence[i] === 1;
  };

  /**
   * Zaun fuer eine Gruppe, die bei (x, y) steht: eine Sperre fuer
   * BT.Move.stepToward oder null. Durch den Zaun kommen nur fliegende Tiere
   * und Raeuber auf der Jagd. Wer schon drinnen steht, darf hinaus.
   */
  Humans.prototype.barrier = function (g, x, y) {
    if (!this.fence || g.spec.flies || (g.spec.role === 'predator' && g.state === 'jagen') || this.fenced(x, y)) return null;
    var self = this;
    return function (px, py) { return self.fenced(px, py); };
  };

  /** Naechstes Haus (fuer die Richtung, in die Tiere ausweichen). */
  Humans.prototype.nearestHouse = function (x, y) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < this.houses.length; i++) {
      var h = this.houses[i];
      var d = (h.x - x) * (h.x - x) + (h.y - y) * (h.y - y);
      if (d < bestD) { bestD = d; best = h; }
    }
    return best;
  };

  /** Laeuft gerade etwas, das man in Ruhe sehen soll (Schiff unterwegs)? */
  Humans.prototype.busy = function () {
    for (var i = 0; i < this.ships.length; i++) if (this.ships[i].phase !== 'liegt') return true;
    return false;
  };

  // ------------------------------------------------------------ Landung

  function isSea(b) { return b === BT.BIOME.DEEP || b === BT.BIOME.SHALLOW; }

  /**
   * Landepunkt nahe (x, y): die naechste Landzelle direkt an der Kueste.
   * null, wenn im Umkreis keine Kueste liegt.
   */
  Humans.prototype.findCoast = function (x, y) {
    var w = this.world, cell = w.cellSize, distSea = w.fields.distSea;
    var R = BT.HUMANS.landing.searchRadius, rc = Math.ceil(R / cell);
    var cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    var best = null, bestD = R * R;
    for (var gy = cy - rc; gy <= cy + rc; gy++) {
      for (var gx = cx - rc; gx <= cx + rc; gx++) {
        if (gx < 0 || gy < 0 || gx >= w.cols || gy >= w.rows) continue;
        var i = gy * w.cols + gx, b = w.biome.data[i];
        if (!BT.BIOME_INFO[b].land || distSea[i] > 1.5) continue;
        var px = (gx + 0.5) * cell, py = (gy + 0.5) * cell;
        var d = (px - x) * (px - x) + (py - y) * (py - y);
        if (d < bestD) { bestD = d; best = { x: px, y: py }; }
      }
    }
    return best;
  };

  /**
   * Richtung aufs offene Meer: von 24 Richtungen die, in der es am laengsten
   * nur Wasser gibt (bei gleichem Ergebnis die erste).
   */
  Humans.prototype.seaDirection = function (p) {
    var w = this.world, L = BT.HUMANS.landing.shipDistance;
    var best = 0, bestRun = -1;
    for (var k = 0; k < 24; k++) {
      var a = k / 24 * Math.PI * 2, dx = BT.M.cos(a), dy = BT.M.sin(a);
      var run = 0;
      for (var s = 24; s <= L; s += 12) {
        if (!isSea(w.query.biomeAt(p.x + dx * s, p.y + dy * s))) break;
        run++;
      }
      if (run > bestRun) { bestRun = run; best = a; }
    }
    return { x: BT.M.cos(best), y: BT.M.sin(best) };
  };

  /** Pruefung vor dem Spielen der Karte: Fehlertext oder null. */
  Humans.prototype.checkLanding = function (params) {
    if (!params || !this.findCoast(params.x, params.y)) return 'Hier ist keine Küste. Klicke näher an den Strand.';
    return null;
  };

  Humans.prototype.land = function (params) {
    var cfg = BT.HUMANS.landing, w = this.world;
    var coast = this.findCoast(params.x, params.y);
    var dir = this.seaDirection(coast);
    // Ankerplatz: das erste Wasser vor der Kueste
    var anchor = { x: coast.x + dir.x * 18, y: coast.y + dir.y * 18 };
    for (var s = 6; s <= 60; s += 6) {
      if (isSea(w.query.biomeAt(coast.x + dir.x * s, coast.y + dir.y * s))) { anchor = { x: coast.x + dir.x * (s + 10), y: coast.y + dir.y * (s + 10) }; break; }
    }
    var sx = clamp(coast.x + dir.x * cfg.shipDistance, 10, w.width - 10);
    var sy = clamp(coast.y + dir.y * cfg.shipDistance, 10, w.height - 10);
    var ticks = cfg.shipDays * this.sim.ticksPerDay;
    this.ships.push({
      id: this.nextId++, x: sx, y: sy, px: sx, py: sy,
      from: { x: sx, y: sy }, anchor: anchor, coast: coast, dir: dir,
      heading: BT.M.atan2(anchor.y - sy, anchor.x - sx),
      phase: 'anfahrt', t: 0, ticks: ticks
    });
    return coast;
  };

  /** Das Schiff ist angekommen: erstes Haus hinter der Kueste, Siedler gehen an Land. */
  Humans.prototype.settle = function (ship) {
    var cfg = BT.HUMANS.landing, w = this.world, cell = w.cellSize;
    var c = ship.coast, d = ship.dir;
    var site = { x: c.x, y: c.y };
    // landeinwaerts gehen, bis die Kueste weit genug hinter uns liegt
    for (var s = cell; s <= cell * 20; s += cell) {
      var px = c.x - d.x * s, py = c.y - d.y * s;
      if (BT.Move.blockedAt(w, null, px, py)) break;
      site = { x: px, y: py };
      var i = w.query.index(px, py);
      if (w.fields.distSea[i] >= cfg.inland && w.query.biomeAt(px, py) !== BT.BIOME.BEACH) break;
    }
    var house = this.addHouse(site.x, site.y);
    for (var k = 0; k < cfg.settlers; k++) this.addSettler(house, c.x, c.y);
  };

  Humans.prototype.addHouse = function (x, y) {
    var h = { id: this.nextId++, x: x, y: y, kind: this.houses.length % 3, day: this.sim.day };
    this.houses.push(h);
    this.sim.landuse.build(x, y, BT.HUMANS.village.yard);
    this.updateDisturbance();
    return h;
  };

  Humans.prototype.addSettler = function (house, x, y) {
    this.people.push({
      id: this.nextId++, house: house,
      x: x, y: y, px: x, py: y, heading: 0,
      tx: house.x + this.rng.range(-20, 20), ty: house.y + this.rng.range(-20, 20),
      wait: 0, inside: false
    });
  };

  Humans.prototype.center = function () {
    var x = 0, y = 0, n = this.houses.length;
    for (var i = 0; i < n; i++) { x += this.houses[i].x; y += this.houses[i].y; }
    return { x: x / n, y: y / n };
  };

  /**
   * Dorf vergroessern: Neben dem Dorf wird ein Stueck Wald gerodet (dort, wo
   * nah am Dorf am meisten Wald steht), am Rand der Rodung zum Dorf hin
   * entstehen neue Haeuser, neue Siedler ziehen ein.
   */
  Humans.prototype.expand = function () {
    var cfg = BT.HUMANS.village, lu = this.sim.landuse, w = this.world;
    var c = this.center();
    // Ort der Rodung: einige Kandidaten, der mit dem meisten Wald nah am Dorf gewinnt
    var best = null, bestScore = 0;
    for (var t = 0; t < 24; t++) {
      var a = this.rng.range(0, Math.PI * 2), r = this.rng.range(cfg.clearMin, cfg.clearMax);
      var px = c.x + BT.M.cos(a) * r, py = c.y + BT.M.sin(a) * r;
      if (BT.Move.blockedAt(w, null, px, py)) continue;
      var score = lu.woodyAround(px, py, cfg.clearRadius) - r * 0.15;
      if (score > bestScore) { bestScore = score; best = { x: px, y: py }; }
    }
    var cleared = 0;
    if (best) {
      var shape = [this.rng.range(0.08, 0.2), this.rng.range(0, 6.28), this.rng.range(0.04, 0.12), this.rng.range(0, 6.28)];
      cleared = lu.clear(best.x, best.y, cfg.clearRadius, shape);
    }
    // Neue Haeuser: zwischen Dorf und Rodung, mit Abstand zu den anderen
    var grow = best ? { x: c.x + (best.x - c.x) * 0.6, y: c.y + (best.y - c.y) * 0.6 } : c;
    var built = 0;
    for (var k = 0; k < cfg.houses; k++) {
      var site = this.houseSite(grow, c);
      if (!site) continue;
      var h = this.addHouse(site.x, site.y);
      for (var s = 0; s < cfg.settlersPerHouse; s++) this.addSettler(h, c.x, c.y);
      built++;
    }
    return { x: grow.x, y: grow.y, houses: built, cleared: cleared };
  };

  /** Bauplatz nahe `near`: an Land, nicht im Wasser, mit Abstand zu allen Haeusern. */
  Humans.prototype.houseSite = function (near, center) {
    var cfg = BT.HUMANS.village, w = this.world;
    var best = null, bestD = Infinity;
    for (var t = 0; t < 40; t++) {
      var a = this.rng.range(0, Math.PI * 2), r = this.rng.range(0, 90);
      var px = near.x + BT.M.cos(a) * r, py = near.y + BT.M.sin(a) * r;
      var b = w.query.biomeAt(px, py);
      if (!BT.BIOME_INFO[b].land || b === BT.BIOME.PEAK || BT.Move.blockedAt(w, null, px, py)) continue;
      // nicht direkt am Wasser bauen
      if (w.query.freshWaterDistance(px, py) < 12 || w.fields.distSea[w.query.index(px, py)] < 2) continue;
      var free = true;
      for (var i = 0; i < this.houses.length && free; i++) {
        var o = this.houses[i];
        if ((o.x - px) * (o.x - px) + (o.y - py) * (o.y - py) < cfg.spacing * cfg.spacing) free = false;
      }
      if (!free) continue;
      // moeglichst nah am Dorf bleiben
      var d = (px - near.x) * (px - near.x) + (py - near.y) * (py - near.y) +
        0.3 * ((px - center.x) * (px - center.x) + (py - center.y) * (py - center.y));
      if (d < bestD) { bestD = d; best = { x: px, y: py }; }
    }
    return best;
  };

  /** Stoerungsfeld neu berechnen (nach jedem neuen Haus). */
  Humans.prototype.updateDisturbance = function () {
    var f = this.sim.fields, R = BT.HUMANS.disturb.radius;
    // Mit Huetehunden reicht die Stoerung weiter, und auch die Weiden werden bewacht
    var dogs = this.dogs.length > 0;
    if (dogs) R *= BT.HUMANS.dogs.houseBonus;
    var DR = BT.HUMANS.dogs.disturb;
    this.disturb.fill(0);
    for (var i = 0; i < this.disturb.length; i++) {
      var c = f.center(i), v = 0, k, dx, dy, t;
      for (k = 0; k < this.houses.length; k++) {
        var h = this.houses[k];
        dx = c.x - h.x; dy = c.y - h.y;
        t = 1 - Math.sqrt(dx * dx + dy * dy) / R;
        if (t > v) v = t;
      }
      for (k = 0; dogs && k < this.pastures.length; k++) {
        var p = this.pastures[k];
        dx = c.x - p.x; dy = c.y - p.y;
        t = 1 - Math.sqrt(dx * dx + dy * dy) / DR;
        if (t > v) v = t;
      }
      this.disturb[i] = v;
    }
    this.active = this.houses.length > 0;
  };

  // ------------------------------------------------------------ Ablauf

  Humans.prototype.step = function () {
    var tod = this.sim.tick % this.sim.ticksPerDay;
    this.night = tod === 0 || tod === this.sim.ticksPerDay - 1;
    this.moveShips();
    this.movePeople();
    if (this.pastures.length) this.moveSheep();
    if (this.dogs.length) this.moveDogs();
    if (this.hunters.length) this.moveHunters();
  };

  // ------------------------------------------------------------ Acker

  /**
   * Acker anlegen: Von einigen Orten 150 bis 270 vom Dorf gewinnt der mit dem
   * meisten offenen Land (Wald zaehlt halb, er muss erst gerodet werden). Ein
   * Acker direkt neben einem bestehenden vergroessert diesen.
   */
  Humans.prototype.addField = function () {
    var cfg = BT.HUMANS.field, lu = this.sim.landuse, w = this.world;
    var c = this.center(), R = cfg.radius;
    var best = null, bestScore = 0;
    for (var t = 0; t < 30; t++) {
      var a = this.rng.range(0, Math.PI * 2), r = this.rng.range(cfg.distMin, cfg.distMax);
      var px = c.x + BT.M.cos(a) * r, py = c.y + BT.M.sin(a) * r;
      if (BT.Move.blockedAt(w, null, px, py)) continue;
      var f = lu.fieldAround(px, py, R);
      // neben bestehenden Aeckern liegt man gut, auf ihnen nicht
      var score = f.ok - f.woody * 0.5 - f.field * 2 + (f.field > 0 && f.field < f.ok ? 15 : 0);
      if (score > bestScore) { bestScore = score; best = { x: px, y: py }; }
    }
    if (!best) return null;
    var before = lu.counts.gerodet;
    var shape = [this.rng.range(0.04, 0.1), this.rng.range(0, 6.28), this.rng.range(0.02, 0.06), this.rng.range(0, 6.28)];
    var cells = lu.plow(best.x, best.y, R, shape);
    var field = { x: best.x, y: best.y, cells: cells, day: this.sim.day, angle: this.rng.range(0, Math.PI) };
    this.fields.push(field);
    return { x: best.x, y: best.y, cells: cells, cleared: lu.counts.gerodet - before };
  };

  /**
   * Einmal am Tag. Zu Beginn des Herbstes wird geerntet: was auf den Aeckern
   * steht, holen die Siedler ein; was die Tiere seit der letzten Ernte
   * gefressen haben, fehlt (Bilanz in this.harvests und in der Chronik).
   */
  Humans.prototype.newDay = function () {
    this.checkEscape();
    this.spring();
    if (this.hunters.length || this.huntersKept.wolf || this.huntersKept.wild || this.huntersKept.sammel) this.huntDay();
    if (!this.fields.length) return;
    var cal = this.sim.calendar, cfg = BT.HUMANS.field;
    if (cal.season !== cfg.harvestSeason || cal.dayOfSeason !== 1) return;
    var f = this.sim.fields, v = f.value.korn, cap = f.capacity.korn, got = 0;
    for (var i = 0; i < v.length; i++) {
      if (cap[i] <= 0) continue;
      got += v[i];
      v[i] = 0;
    }
    var eaten = f.eaten.korn - this.cropMark;
    this.cropMark = f.eaten.korn;
    var total = got + eaten;
    var share = total > 0 ? eaten / total : 0;
    var h = { day: this.sim.day, harvested: got, eaten: eaten, share: share };
    this.harvests.push(h);
    this.sim.events.push({
      day: this.sim.day, tick: this.sim.tick, card: share >= 0.25 ? 'wildschaden' : 'ernte', params: {},
      at: { text: Math.round((1 - share) * 100) + ' % eingebracht, ' + Math.round(share * 100) + ' % von Tieren gefressen' }
    });
  };

  Humans.prototype.moveShips = function () {
    var cfg = BT.HUMANS.landing;
    for (var i = this.ships.length - 1; i >= 0; i--) {
      var s = this.ships[i];
      s.px = s.x; s.py = s.y;
      s.t++;
      if (s.phase === 'anfahrt') {
        var k = Math.min(1, s.t / s.ticks);
        // sanft abbremsen vor der Kueste
        var e = 1 - (1 - k) * (1 - k);
        s.x = s.from.x + (s.anchor.x - s.from.x) * e;
        s.y = s.from.y + (s.anchor.y - s.from.y) * e;
        if (k >= 1) { s.phase = 'liegt'; s.t = 0; this.settle(s); }
      } else if (s.phase === 'liegt') {
        if (s.t >= cfg.stayDays * this.sim.ticksPerDay) {
          s.phase = 'abfahrt'; s.t = 0;
          s.heading = BT.M.atan2(s.from.y - s.anchor.y, s.from.x - s.anchor.x);
        }
      } else {
        k = Math.min(1, s.t / s.ticks);
        e = k * k;
        s.x = s.anchor.x + (s.from.x - s.anchor.x) * e;
        s.y = s.anchor.y + (s.from.y - s.anchor.y) * e;
        if (k >= 1) this.ships.splice(i, 1);
      }
    }
  };

  /**
   * Siedler: tagsueber unterwegs rund ums Haus (ein Ziel, dort eine Weile
   * arbeiten, dann das naechste), nachts im Haus.
   */
  Humans.prototype.movePeople = function () {
    var cfg = BT.HUMANS.settler, w = this.world;
    var tod = this.sim.tick % this.sim.ticksPerDay;
    var night = tod === 0 || tod === this.sim.ticksPerDay - 1;
    for (var i = 0; i < this.people.length; i++) {
      var p = this.people[i];
      p.px = p.x; p.py = p.y;
      var h = p.house;
      if (night) { p.tx = h.x; p.ty = h.y + 4; }
      else if (p.inside || (p.wait <= 0 && Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y) < 4)) {
        p.inside = false;
        var a = this.rng.range(0, Math.PI * 2), r = cfg.roam * Math.sqrt(this.rng.next());
        var tx = h.x + BT.M.cos(a) * r, ty = h.y + BT.M.sin(a) * r;
        // ein Teil arbeitet auf dem Acker (Fruehling bis zur Ernte)
        if (this.fields.length && this.sim.calendar.season < 2 && this.rng.chance(BT.HUMANS.field.workers)) {
          var fl = this.fields[this.rng.int(0, this.fields.length - 1)];
          r = BT.HUMANS.field.radius * 0.8 * Math.sqrt(this.rng.next());
          tx = fl.x + BT.M.cos(a) * r; ty = fl.y + BT.M.sin(a) * r;
        }
        if (!BT.Move.blockedAt(w, null, tx, ty)) { p.tx = tx; p.ty = ty; }
        p.wait = this.rng.int(1, 3);
      }
      var dx = p.tx - p.x, dy = p.ty - p.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.5) {
        BT.Move.stepToward(w, null, p, p.tx, p.ty, cfg.speed);
      } else {
        if (night) p.inside = true;
        else p.wait--;
      }
      p.working = !night && d <= 0.5;
    }
  };

  // ------------------------------------------------------------ Schafe und Hunde

  /** Punkt in einer Weide (unregelmaessiger Rand wie beim Zaun). */
  Humans.prototype.pastureRadius = function (p, a) {
    var s = p.shape;
    return p.r * (1 + s[0] * BT.M.sin(3 * a + s[1]) + s[2] * BT.M.sin(5 * a + s[3]));
  };

  Humans.prototype.pointInPasture = function (p, k) {
    var a = this.rng.range(0, Math.PI * 2);
    var r = this.pastureRadius(p, a) * k * Math.sqrt(this.rng.next());
    return { x: p.x + BT.M.cos(a) * r, y: p.y + BT.M.sin(a) * r };
  };

  /**
   * Schafweide: Von einigen Orten nahe am Dorf gewinnt der mit dem meisten
   * Grasland. Die Weide wird eingezaeunt, das Land bleibt, wie es ist.
   */
  Humans.prototype.addPasture = function () {
    var cfg = BT.HUMANS.pasture, w = this.world, g = this.sim.landuse.ground;
    var c = this.center(), R = cfg.radius, self = this;
    var best = null, bestScore = 0;
    for (var t = 0; t < 30; t++) {
      var a = this.rng.range(0, Math.PI * 2), r = this.rng.range(cfg.distMin, cfg.distMax);
      var px = c.x + BT.M.cos(a) * r, py = c.y + BT.M.sin(a) * r;
      if (BT.Move.blockedAt(w, null, px, py)) continue;
      // nicht auf eine andere Weide
      var free = this.pastures.every(function (o) { return BT.M.hypot(o.x - px, o.y - py) > o.r + R; });
      if (!free) continue;
      var score = 0;
      BT.Landuse.eachCell(w, px, py, R, null, function (i) {
        var b = g[i];
        if (b === BT.BIOME.TUSSOCK || b === BT.BIOME.MEADOW) score += 1;
        else if (b === BT.BIOME.SCRUB || b === BT.BIOME.BEACH) score += 0.3;
        else if (b === BT.BIOME.VILLAGE || b === BT.BIOME.FIELD || BT.isBlocked(b, null)) score -= 1;
      });
      score -= r * 0.05;
      if (score > bestScore) { bestScore = score; best = { x: px, y: py }; }
    }
    if (!best) return null;
    var p = {
      id: this.nextId++, x: best.x, y: best.y, r: R, day: this.sim.day, sheep: [],
      shape: [this.rng.range(0.04, 0.1), this.rng.range(0, 6.28), this.rng.range(0.02, 0.05), this.rng.range(0, 6.28)]
    };
    for (var k = 0; k < cfg.sheep; k++) this.addSheep(p, k >= cfg.sheep - 2);
    p.nextEscape = this.sim.day + BT.Time.years(cfg.escapeYears + this.rng.range(-cfg.escapeJitter, cfg.escapeJitter));
    this.pastures.push(p);
    this.buildFence(p);
    this.buildWaterDist();
    if (this.sheepDay === null) this.sheepDay = this.sim.day;
    if (this.dogs.length) this.updateDisturbance();
    return { x: p.x, y: p.y, sheep: p.sheep.length };
  };

  /**
   * Abstand zum Suesswasser, wenn die Weiden eingezaeunt sind: Wasser in einer
   * Weide zaehlt nicht, und der Weg fuehrt um die Zaeune herum (Chamfer wie
   * world.fields.distFresh, wiederholt, bis sich nichts mehr aendert).
   */
  Humans.prototype.buildWaterDist = function () {
    var w = this.world, cols = w.cols, rows = w.rows, fresh = w.fields.distFresh, fence = this.fence;
    var INF = 1e9, d = new Float32Array(cols * rows), D = 1.4142;
    for (var i = 0; i < d.length; i++) d[i] = fence[i] ? INF : fresh[i] === 0 ? 0 : INF;
    for (var pass = 0, changed = true; changed && pass < 40; pass++) {
      changed = false;
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
        i = y * cols + x;
        if (fence[i] || d[i] === 0) continue;
        var v = d[i];
        if (x > 0) v = Math.min(v, d[i - 1] + 1);
        if (y > 0) v = Math.min(v, d[i - cols] + 1);
        if (x > 0 && y > 0) v = Math.min(v, d[i - cols - 1] + D);
        if (x < cols - 1 && y > 0) v = Math.min(v, d[i - cols + 1] + D);
        if (v < d[i]) { d[i] = v; changed = true; }
      }
      for (y = rows - 1; y >= 0; y--) for (x = cols - 1; x >= 0; x--) {
        i = y * cols + x;
        if (fence[i] || d[i] === 0) continue;
        v = d[i];
        if (x < cols - 1) v = Math.min(v, d[i + 1] + 1);
        if (y < rows - 1) v = Math.min(v, d[i + cols] + 1);
        if (x < cols - 1 && y < rows - 1) v = Math.min(v, d[i + cols + 1] + D);
        if (x > 0 && y < rows - 1) v = Math.min(v, d[i + cols - 1] + D);
        if (v < d[i]) { d[i] = v; changed = true; }
      }
    }
    this.waterDist = d;
  };

  /** Zaun: alle Rasterzellen der Weide markieren. */
  Humans.prototype.buildFence = function (p) {
    var w = this.world, cell = w.cellSize;
    if (!this.fence) this.fence = new Uint8Array(w.cols * w.rows);
    var R = p.r * 1.3, x0 = Math.max(0, Math.floor((p.x - R) / cell)), x1 = Math.min(w.cols - 1, Math.floor((p.x + R) / cell));
    var y0 = Math.max(0, Math.floor((p.y - R) / cell)), y1 = Math.min(w.rows - 1, Math.floor((p.y + R) / cell));
    for (var gy = y0; gy <= y1; gy++) {
      for (var gx = x0; gx <= x1; gx++) {
        var dx = (gx + 0.5) * cell - p.x, dy = (gy + 0.5) * cell - p.y;
        if (Math.sqrt(dx * dx + dy * dy) <= this.pastureRadius(p, BT.M.atan2(dy, dx))) this.fence[gy * w.cols + gx] = 1;
      }
    }
  };

  Humans.prototype.addSheep = function (p, young) {
    var q = this.pointInPasture(p, 0.8);
    p.sheep.push({
      id: this.nextId++, sex: this.rng.chance(0.5) ? 'm' : 'f', young: young,
      x: q.x, y: q.y, px: q.x, py: q.y, tx: q.x, ty: q.y, heading: this.rng.range(0, Math.PI * 2), wait: 0, eating: false
    });
  };

  /**
   * Im Fruehling: Lammzeit und Welpen. Die Siedler halten ihre Herden und Hunde
   * auf dem alten Stand (ausgebrochene Tiere werden ersetzt), die Laemmer des
   * Vorjahrs sind erwachsen.
   */
  Humans.prototype.spring = function () {
    var cal = this.sim.calendar;
    if (cal.season !== 0 || cal.dayOfSeason !== BT.SPECIES.schaf.breed.day) return;
    for (var k = 0; k < this.pastures.length; k++) {
      var p = this.pastures[k];
      for (var i = 0; i < p.sheep.length; i++) p.sheep[i].young = false;
      while (p.sheep.length < BT.HUMANS.pasture.sheep) this.addSheep(p, true);
    }
    if (this.dogs.length < this.dogsKept) {
      var c = this.center();
      while (this.dogs.length < this.dogsKept) this.addDog(c);
      this.updateDisturbance();
    }
    // Fuer jeden toten Jaeger kommt ein neuer
    for (var kind in this.huntersKept) {
      var have = this.hunters.filter(function (h) { return h.kind === kind; }).length;
      for (; have < this.huntersKept[kind]; have++) this.addHunter(kind);
    }
  };

  /** Schafe auf der Weide: ziehen langsam umher und fressen tagsueber das Gras. */
  Humans.prototype.moveSheep = function () {
    var cfg = BT.HUMANS.pasture, w = this.world, f = this.sim.fields;
    var diet = { gras: 1 };
    for (var k = 0; k < this.pastures.length; k++) {
      var p = this.pastures[k];
      for (var i = 0; i < p.sheep.length; i++) {
        var s = p.sheep[i];
        s.px = s.x; s.py = s.y;
        if (s.wait > 0) s.wait--;
        else if (Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) < 3) {
          var q = this.pointInPasture(p, 0.85);
          if (!BT.Move.blockedAt(w, null, q.x, q.y)) { s.tx = q.x; s.ty = q.y; }
          s.wait = this.rng.int(1, 4);
        }
        var dx = s.tx - s.x, dy = s.ty - s.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.5) BT.Move.stepToward(w, null, s, s.tx, s.ty, cfg.speed);
        s.eating = !this.night && s.wait > 0;
        if (s.eating) f.eat(f.index(s.x, s.y), diet, cfg.bite);
      }
    }
  };

  /** Huetehunde: einige Hunde, die zwischen Dorf und Weiden umherlaufen. */
  Humans.prototype.addDogs = function () {
    var cfg = BT.HUMANS.dogs, c = this.center();
    for (var k = 0; k < cfg.perCard; k++) this.addDog(c);
    this.dogsKept += cfg.perCard;
    if (this.dogDay === null) this.dogDay = this.sim.day;
    this.dogEscapes.push(this.sim.day + BT.Time.years(cfg.escapeYears));
    this.updateDisturbance();
    return { x: c.x, y: c.y, dogs: this.dogs.length };
  };

  Humans.prototype.addDog = function (c) {
    var x = c.x + this.rng.range(-20, 20), y = c.y + this.rng.range(-20, 20);
    this.dogs.push({ id: this.nextId++, sex: this.rng.chance(0.5) ? 'm' : 'f', x: x, y: y, px: x, py: y, tx: x, ty: y, heading: 0, wait: 0 });
  };

  Humans.prototype.moveDogs = function () {
    var cfg = BT.HUMANS.dogs, w = this.world;
    for (var i = 0; i < this.dogs.length; i++) {
      var d = this.dogs[i];
      d.px = d.x; d.py = d.y;
      if (d.wait > 0) d.wait--;
      else if (Math.abs(d.tx - d.x) + Math.abs(d.ty - d.y) < 4) {
        // Mal zu einer Weide, mal zu einem Haus, nachts ins Dorf
        var q;
        if (!this.night && this.pastures.length && this.rng.chance(0.6)) {
          q = this.pointInPasture(this.pastures[this.rng.int(0, this.pastures.length - 1)], 1.15);
        } else {
          var h = this.houses[this.rng.int(0, this.houses.length - 1)];
          q = { x: h.x + this.rng.range(-30, 30), y: h.y + this.rng.range(-30, 30) };
        }
        if (!BT.Move.blockedAt(w, null, q.x, q.y)) { d.tx = q.x; d.ty = q.y; }
        d.wait = this.rng.int(0, 2);
      }
      if (Math.abs(d.tx - d.x) + Math.abs(d.ty - d.y) > 0.5) BT.Move.stepToward(w, null, d, d.tx, d.ty, cfg.speed);
    }
  };

  /**
   * Einmal am Tag: Etwa 4 Jahre nach jeder Weide brechen dort einmal Schafe
   * aus, 4 Jahre nach jeder Karte "Huetehunde" verwildern einmal Hunde. Die
   * Ausreisser laufen erst weit weg und leben dann als eigene Art; Hunde
   * schliessen sich einem wilden Rudel an, wenn eines nah ist.
   */
  Humans.prototype.checkEscape = function () {
    var day = this.sim.day, P = BT.HUMANS.pasture, D = BT.HUMANS.dogs, c, n, at;
    for (var k = 0; k < this.pastures.length; k++) {
      var p = this.pastures[k];
      if (p.nextEscape == null || day < p.nextEscape || p.sheep.length < 2) continue;
      n = Math.min(this.rng.intIn(P.escape), p.sheep.length);
      c = this.center();
      // ueber den Zaun auf der dem Dorf abgewandten Seite
      var a = BT.M.atan2(p.y - c.y, p.x - c.x) + this.rng.range(-0.8, 0.8);
      var gate = { x: p.x + BT.M.cos(a) * (this.pastureRadius(p, a) + 15), y: p.y + BT.M.sin(a) * (this.pastureRadius(p, a) + 15) };
      at = this.release(BT.SPECIES.schaf, gate, n, P.runaway, null);
      p.sheep.splice(0, n);
      p.nextEscape = null;          // jede Weide nur einmal
      if (this.escaped.schaf == null) this.escaped.schaf = day;
      this.sim.events.push({ day: day, tick: this.sim.tick, card: 'schafeAus', params: {},
        at: { x: at.x, y: at.y, text: n + ' Schafe sind ausgebüchst' } });
    }
    if (this.dogEscapes.length && day >= this.dogEscapes[0] && this.dogs.length) {
      this.dogEscapes.shift();
      c = this.center();
      var first = this.escaped.hund == null;
      n = Math.min(this.rng.intIn(D.escape), this.dogs.length);
      var pack = this.sim.nearestGroupOf(BT.SPECIES.hund, c, D.join, function (o) {
        return o.members.length < o.spec.group.max;
      });
      var start = { x: this.dogs[0].x, y: this.dogs[0].y };
      at = this.release(BT.SPECIES.hund, start, n, D.runaway, pack);
      this.dogs.splice(0, n);
      if (first) this.escaped.hund = day;
      this.updateDisturbance();
      this.sim.events.push({ day: day, tick: this.sim.tick, card: 'hundeWild', params: {},
        at: { x: at.x, y: at.y, text: n + (n === 1 ? ' Hund ist' : ' Hunde sind') + ' verwildert' + (pack ? ' und schließen sich einem wilden Rudel an' : '') } });
    }
  };

  /**
   * Eine Gruppe der Art bei `from` frei lassen (Weibchen zuerst, alle
   * erwachsen, satt und ohne Durst: sie kommen ja aus der Obhut der Menschen).
   * Sie laufen erst dist[0]..dist[1] vom Dorf weg bzw. zur Gruppe `join`.
   */
  Humans.prototype.release = function (spec, from, n, dist, join) {
    var sim = this.sim, pt = { x: from.x, y: from.y };
    if (BT.Move.blockedAt(this.world, spec, pt.x, pt.y)) pt = this.center();
    var g = sim.makeGroup(spec, pt.x, pt.y);
    if (spec.role === 'predator') g.state = 'wandern';
    for (var k = 0; k < n; k++) {
      var age = Math.round(this.rng.range(spec.maturity, spec.maxAge * 0.5));
      var an = sim.makeAnimal(spec, pt.x, pt.y, age, k % 2 ? 'm' : 'f', 1);
      an.thirst = 0;
      sim.addToGroup(g, an);
      an.x = pt.x + an.ox; an.y = pt.y + an.oy; an.px = an.x; an.py = an.y;
    }
    var to = join ? null : BT.Behavior.farPoint(sim, spec, this.center(), dist[0], dist[1]);
    if (join || to) {
      g.runaway = { x: to ? to.x : join.x, y: to ? to.y : join.y, join: join, state: 'ausgebuechst', ticks: sim.ticksPerDay * 8 };
      g.state = 'ausgebuechst';
    }
    return pt;
  };

  // ------------------------------------------------------------ Jagd

  /**
   * Jaeger (Karten "Woelfe jagen" und "Wild jagen"): Sie ziehen fuer einige
   * Tage los (nachts lagern sie draussen), suchen sich eine Gruppe ihrer Beute
   * bis HUMANS.hunt.range vom Dorf, schleichen sich an und schiessen aus
   * HUMANS.hunt.shot. Wildjaeger bringen ein Tier heim, der Aufbruch bleibt als
   * Aas liegen. Woelfe, die beschossen werden, fliehen weit weg.
   *
   * Hungrige Woelfe greifen Jaeger an, die ihnen zu nahe kommen, erst recht,
   * wenn sie Beute tragen. Wolfsjaeger rechnen damit und toeten meist den
   * Wolf, Wildjaeger sterben oefter selbst (HUMANS.hunt.outcome). Tote Jaeger
   * werden im naechsten Fruehling ersetzt.
   */
  Humans.prototype.addHunters = function (kind) {
    var n = (kind === 'sammel' ? BT.HUMANS.gather : BT.HUMANS.hunt).perCard;
    for (var k = 0; k < n; k++) this.addHunter(kind);
    this.huntersKept[kind] += n;
    var c = this.center();
    return { x: c.x, y: c.y, hunters: this.hunters.filter(function (h) { return h.kind === kind; }).length };
  };

  Humans.prototype.addHunter = function (kind) {
    var house = this.houses[this.rng.int(0, this.houses.length - 1)];
    var x = house.x + this.rng.range(-15, 15), y = house.y + this.rng.range(-15, 15);
    this.hunters.push({
      id: this.nextId++, kind: kind, house: house, x: x, y: y, px: x, py: y, heading: 0,
      state: 'daheim', rest: this.rng.int(0, 2), target: null, carry: null, trip: 0, reload: 0, load: 0
    });
  };

  /** Beutegruppe fuer einen Jaeger: nah beim Jaeger, hoechstens range vom Dorf, nach Gewicht. */
  Humans.prototype.huntTarget = function (h) {
    var cfg = BT.HUMANS.hunt, prey = cfg[h.kind].prey, c = this.center(), sim = this.sim;
    var range = cfg.range * (1 + cfg.rangePlus * (this.huntersKept[h.kind] / cfg.perCard - 1));
    var list = h.kind === 'wolf' ? sim.predatorGroups : sim.herbivoreGroups;
    var best = null, bestScore = 0;
    for (var i = 0; i < list.length; i++) {
      var g = list[i], w = prey[g.spec.id];
      if (!w || !g.members.length) continue;
      var dc = BT.M.hypot(g.x - c.x, g.y - c.y);
      if (dc > range) continue;
      var near = dc < (h.out || 0);                  // naeher am Dorf, als der Jaeger heute will
      var d = BT.M.hypot(g.x - h.x, g.y - h.y);
      var score = w * (1 - d / (range * 1.5)) * (0.8 + 0.4 * this.rng.next());
      if (near) score -= 10;                         // nur, wenn draussen nichts ist
      if (!best || score > bestScore) { bestScore = score; best = g; }
    }
    return best;
  };

  /** Naechste Beutegruppe in Sichtweite, die naeher ist als das bisherige Ziel g, sonst null. */
  Humans.prototype.preyInSight = function (h, g) {
    var cfg = BT.HUMANS.hunt, prey = cfg[h.kind].prey;
    var list = h.kind === 'wolf' ? this.sim.predatorGroups : this.sim.herbivoreGroups;
    var best = null, bestD = Math.min(cfg.sight, BT.M.hypot(g.x - h.x, g.y - h.y));
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === g || !prey[o.spec.id] || !o.members.length) continue;
      var d = BT.M.hypot(o.x - h.x, o.y - h.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  };

  Humans.prototype.moveHunters = function () {
    var cfg = BT.HUMANS.hunt, w = this.world, sim = this.sim;
    for (var i = this.hunters.length - 1; i >= 0; i--) {
      var h = this.hunters[i];
      h.px = h.x; h.py = h.y;
      if (h.state === 'daheim') {
        if (h.rest > 0 || this.night) continue;
        var gather = h.kind === 'sammel';
        var out = gather ? BT.HUMANS.gather.out : cfg.out;
        h.out = this.rng.range(out[0], out[1]);
        h.target = gather ? this.fruitTarget(h, false) : this.huntTarget(h);
        if (!h.target) { h.rest = 1; continue; }
        h.state = 'unterwegs'; h.trip = 0; h.trail = []; h.stuck = 0; h.useTrail = false;
      }
      if (this.hunterAttacked(h)) { if (!h.alive) this.hunters.splice(i, 1); continue; }
      if (this.night) continue;                         // nachts lagern sie
      if (h.state === 'unterwegs' && h.kind === 'sammel') { this.gatherStep(h); if (h.state === 'unterwegs') continue; }
      if (h.state === 'unterwegs') {
        h.trip++;
        if (h.reload > 0) h.reload--;
        if (h.trip > cfg.tripDays * (sim.ticksPerDay - 2)) { h.state = 'heim'; h.target = null; }
        else {
          var g = h.target;
          if (!g || !g.members.length) g = h.target = this.huntTarget(h);
          // Was zuerst in Sicht kommt, wird gejagt (Hirsch oder Laufvogel)
          var c = this.center();
          var seen = g && BT.M.hypot(h.x - c.x, h.y - c.y) >= h.out && this.preyInSight(h, g);
          if (seen) g = h.target = seen;
          if (!g) { h.state = 'heim'; }
          else {
            var d = BT.M.hypot(g.x - h.x, g.y - h.y);
            if (d > cfg.shot * 0.6) {
              var x0 = h.x, y0 = h.y;
              BT.Move.stepToward(w, null, h, g.x, g.y, Math.min(d > 150 ? cfg.speed : cfg.stalk, d - cfg.shot * 0.5));
              // Spur fuer den Heimweg; wer nicht weiterkommt (Wasser, Fels), kehrt um
              var last = h.trail[h.trail.length - 1] || h.house;
              if (BT.M.hypot(h.x - last.x, h.y - last.y) > 30) h.trail.push({ x: h.x, y: h.y });
              h.stuck = BT.M.hypot(h.x - x0, h.y - y0) < 1 ? h.stuck + 1 : 0;
              if (h.stuck > 8) { h.state = 'heim'; h.target = null; }
            }
            if (d <= cfg.shot && !h.reload) this.shoot(h, g);
            continue;
          }
        }
      }
      // heim: geradewegs zum Haus; wer dabei haengen bleibt, geht auf der eigenen Spur zurueck
      var tr = h.trail;
      var hx = h.house.x, hy = h.house.y + 6;
      if (BT.M.hypot(hx - h.x, hy - h.y) <= 4) { this.homeFromHunt(h); continue; }
      if (!h.useTrail) {
        var x1 = h.x, y1 = h.y;
        BT.Move.stepToward(w, null, h, hx, hy, Math.min(h.kind === 'sammel' ? BT.HUMANS.gather.speed : cfg.speed, BT.M.hypot(hx - h.x, hy - h.y)));
        if (BT.M.hypot(h.x - x1, h.y - y1) >= 1) continue;
        h.useTrail = true;
      }
      var p = tr.length ? tr[tr.length - 1] : { x: h.house.x, y: h.house.y + 6 };
      var dh = BT.M.hypot(p.x - h.x, p.y - h.y);
      var hs = h.kind === 'sammel' ? BT.HUMANS.gather.speed : cfg.speed;
      if (dh > 4) BT.Move.stepToward(w, null, h, p.x, p.y, Math.min(hs, dh));
      if (dh <= hs) { if (tr.length) tr.pop(); else if (dh <= 4) this.homeFromHunt(h); }
    }
  };

  /**
   * Sammler (Karte "Sammeln"): wie die Jaeger, aber ihr Ziel sind Fruechte und
   * Samen. Je Gang wird gewuerfelt, wie weit sie hinausgehen; ab dort sammeln
   * sie, wo sie zuerst genug Fruechte finden, bis der Korb voll ist. Die
   * Fruechte fehlen dann den Laufvoegeln. Hungrige Woelfe greifen auch Sammler
   * an, und die haben keine Waffen.
   */
  Humans.prototype.fruitTarget = function (h, near) {
    var G = BT.HUMANS.gather, f = this.sim.fields, w = this.world, c = this.center();
    var best = null, bestV = G.min;
    for (var t = 0; t < 24; t++) {
      var a = this.rng.range(0, Math.PI * 2), r, px, py;
      if (near) { r = 70 * Math.sqrt(this.rng.next()); px = h.x + BT.M.cos(a) * r; py = h.y + BT.M.sin(a) * r; }
      else { r = h.out + this.rng.range(0, G.ring); px = c.x + BT.M.cos(a) * r; py = c.y + BT.M.sin(a) * r; }
      if (BT.Move.blockedAt(w, null, px, py) || this.fenced(px, py)) continue;
      var i = f.index(px, py);
      if (i < 0) continue;
      var v = f.value.frucht[i];
      if (v > bestV) { bestV = v; best = { x: px, y: py }; }
    }
    return best;
  };

  /** Beste Weidezelle mit Fruechten im Umkreis von zwei Zellen, sonst null. */
  Humans.prototype.fruitNextTo = function (h) {
    var f = this.sim.fields, G = BT.HUMANS.gather, v = f.value.frucht, best = null, bestV = G.min;
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        var px = h.x + dx * f.size, py = h.y + dy * f.size, i = f.index(px, py);
        if (i < 0 || v[i] <= bestV) continue;
        var c = f.center(i);
        if (BT.Move.blockedAt(this.world, null, c.x, c.y) || this.fenced(c.x, c.y)) continue;
        bestV = v[i]; best = c;
      }
    }
    return best;
  };

  /** Ein Tick eines Sammlers unterwegs: hingehen, sammeln, mit vollem Korb heim. */
  Humans.prototype.gatherStep = function (h) {
    var G = BT.HUMANS.gather, f = this.sim.fields, w = this.world, c = this.center();
    h.trip++;
    if (h.trip > G.tripDays * (this.sim.ticksPerDay - 2) || h.load >= G.load) { h.state = 'heim'; h.target = null; h.gathering = false; return; }
    var i = f.index(h.x, h.y);
    var here = i >= 0 ? f.value.frucht[i] : 0;
    // Was sie zuerst finden: unterwegs, sobald sie weit genug draussen sind
    if (here >= G.min && (h.gathering || BT.M.hypot(h.x - c.x, h.y - c.y) >= h.out)) {
      h.gathering = true;
      // Eine Gruppe Sammler: Sie pfluecken hier und in den Nachbarzellen
      var want = Math.min(G.bite, G.load - h.load), got = 0;
      for (var dy = -1; dy <= 1 && got < want; dy++) {
        for (var dx = -1; dx <= 1 && got < want; dx++) {
          var j = f.index(h.x + dx * f.size, h.y + dy * f.size);
          if (j >= 0 && !this.fenced(f.center(j).x, f.center(j).y)) got += f.eat(j, { frucht: 1 }, want - got);
        }
      }
      h.load += got;
      this.gathered += got; this.gatheredYear += got;
      return;
    }
    if (h.gathering || !h.target) {
      // Hier ist nichts mehr: in den Nachbarzellen, sonst etwas weiter weitersuchen
      h.target = this.fruitNextTo(h) || this.fruitTarget(h, true);
      h.gathering = false;
      if (!h.target) { h.state = 'heim'; return; }
    }
    var t = h.target, d = BT.M.hypot(t.x - h.x, t.y - h.y);
    if (d < 6) { h.target = null; return; }
    var x0 = h.x, y0 = h.y;
    BT.Move.stepToward(w, null, h, t.x, t.y, Math.min(G.speed, d));
    var last = h.trail[h.trail.length - 1] || h.house;
    if (BT.M.hypot(h.x - last.x, h.y - last.y) > 30) h.trail.push({ x: h.x, y: h.y });
    h.stuck = BT.M.hypot(h.x - x0, h.y - y0) < 1 ? h.stuck + 1 : 0;
    if (h.stuck > 8) h.target = null;
  };

  /** Ein Schuss auf die Gruppe g. */
  Humans.prototype.shoot = function (h, g) {
    var cfg = BT.HUMANS.hunt, sim = this.sim, spec = g.spec;
    var p = cfg[h.kind].hit * (1 - BT.Behavior.COVER[sim.biomeAt(g.x, g.y)] * 0.5);
    if (spec.scheu >= cfg.flee) p *= cfg.shy;
    h.reload = 2;
    if (this.rng.chance(p)) {
      var victim = g.members[this.rng.int(0, g.members.length - 1)];
      var meat = spec.meat * (victim.age < spec.maturity ? 0.5 : 1);
      sim.kill(victim, 'jagd');
      this.bag[spec.id] = (this.bag[spec.id] || 0) + 1;
      this.bagYear[spec.id] = (this.bagYear[spec.id] || 0) + 1;
      sim.addCarcass(victim.x, victim.y, meat * cfg.offal);
      if (!cfg[h.kind].stay) { h.carry = { id: spec.id, meat: meat * (1 - cfg.offal) }; h.state = 'heim'; h.target = null; }
    }
    // Beschossene Raeuber fliehen weit weg (scheue Pflanzenfresser fliehen von selbst)
    if (spec.role === 'predator' && g.members.length) this.scare(g, h);
  };

  /** Raeubergruppe flieht vor dem Menschen bei `from` (ein, zwei Tage weit weg). */
  Humans.prototype.scare = function (g, from) {
    var dx = g.x - from.x, dy = g.y - from.y, d = Math.max(1, BT.M.hypot(dx, dy));
    var tx = g.x + dx / d * 300, ty = g.y + dy / d * 300;
    if (BT.Move.blockedAt(this.world, g.spec, tx, ty)) { tx = g.x + dx / d * 120; ty = g.y + dy / d * 120; }
    g.runaway = { x: tx, y: ty, state: 'fliehen', ticks: this.sim.ticksPerDay * 2 };
    g.prey = null; g.tx = null;
  };

  /**
   * Greifen hungrige Woelfe den Jaeger an? Ausgang nach HUMANS.hunt.outcome:
   * der Jaeger stirbt, ein Wolf stirbt, oder beide gehen auseinander (dann
   * nehmen die Woelfe die Beute mit). true, wenn es einen Angriff gab.
   */
  Humans.prototype.hunterAttacked = function (h) {
    var cfg = BT.HUMANS.hunt, sim = this.sim, preds = sim.predatorGroups;
    for (var i = 0; i < preds.length; i++) {
      var g = preds[i], spec = g.spec;
      if (!cfg.attackers[spec.id] || !g.members.length || g.runaway) continue;
      if (BT.M.hypot(g.x - h.x, g.y - h.y) > cfg.attackRange) continue;
      var e = 0;
      for (var m = 0; m < g.members.length; m++) e += g.members[m].energy;
      if (e / g.members.length >= spec.hungry) continue;
      if (!this.rng.chance(cfg.attack * (h.carry ? 2 : 1))) continue;
      var out = cfg.outcome[h.kind], r = this.rng.next(), text;
      var A = this.attacks;
      A.total++; A.year[h.kind] = (A.year[h.kind] || 0) + 1;
      if (r < out.hunter) {
        h.alive = false;
        A.hunters++; A.yearDead[h.kind] = (A.yearDead[h.kind] || 0) + 1;
        if (h.carry) sim.feed(g, h.carry.meat);
        text = HUNTER_NAME[h.kind] + ' wurde von ' + spec.plural + 'n getötet';
        sim.events.push({ day: sim.day, tick: sim.tick, card: 'jaegerTot', params: {}, at: { x: h.x, y: h.y, text: text } });
        return true;
      }
      if (r < out.hunter + out.wolf) {
        var a = g.members[this.rng.int(0, g.members.length - 1)];
        sim.kill(a, 'jagd');
        this.attacks.wolves++;
        this.bag[spec.id] = (this.bag[spec.id] || 0) + 1;
        this.bagYear[spec.id] = (this.bagYear[spec.id] || 0) + 1;
      } else if (h.carry) {
        sim.feed(g, h.carry.meat);
        h.carry = null;
      }
      if (g.members.length) this.scare(g, h);
      return true;
    }
    return false;
  };

  var HUNTER_NAME = { wolf: 'Ein Wolfsjäger', wild: 'Ein Jäger', sammel: 'Ein Sammler' };

  Humans.prototype.homeFromHunt = function (h) {
    var R = (h.kind === 'sammel' ? BT.HUMANS.gather : BT.HUMANS.hunt).restDays;
    h.state = 'daheim'; h.carry = null; h.target = null; h.load = 0; h.gathering = false;
    h.rest = this.rng.int(R[0], R[1]);
  };

  /** Einmal am Tag: Ruhetage zaehlen, zu Jahresbeginn Jagd- und Sammelbilanz in die Chronik. */
  Humans.prototype.huntDay = function () {
    for (var i = 0; i < this.hunters.length; i++) if (this.hunters[i].rest > 0) this.hunters[i].rest--;
    if (this.sim.calendar.dayOfYear !== 0) return;
    var sim = this.sim, A = this.attacks, K = this.huntersKept;
    function attacks(kinds, who) {
      var n = 0, dead = 0;
      for (var k = 0; k < kinds.length; k++) { n += A.year[kinds[k]] || 0; dead += A.yearDead[kinds[k]] || 0; }
      return n ? n + (n === 1 ? ' Angriff' : ' Angriffe') + ' von Wölfen auf ' + who + (dead ? ' (' + dead + ' tot)' : '') : null;
    }
    if (K.wolf || K.wild) {
      var parts = [];
      for (var k = 0; k < BT.SPECIES_ORDER.length; k++) {
        var id = BT.SPECIES_ORDER[k], n = this.bagYear[id];
        if (n) parts.push(n + ' ' + (n === 1 ? BT.SPECIES[id].name : BT.SPECIES[id].plural));
      }
      var at = attacks(['wolf', 'wild'], 'Jäger');
      sim.events.push({ day: sim.day, tick: sim.tick, card: 'jagdbilanz', params: {},
        at: { text: (parts.length ? 'Im letzten Jahr erlegt: ' + parts.join(', ') : 'Im letzten Jahr nichts erlegt') + (at ? '; ' + at : '') } });
    }
    if (K.sammel) {
      var as = attacks(['sammel'], 'Sammler');
      sim.events.push({ day: sim.day, tick: sim.tick, card: 'sammelbilanz', params: {},
        at: { text: 'Im letzten Jahr gesammelt: ' + Math.round(this.gatheredYear / BT.HUMANS.gather.basket) + ' Körbe Früchte und Samen' + (as ? '; ' + as : '') } });
    }
    this.bagYear = {};
    this.gatheredYear = 0;
    A.year = {}; A.yearDead = {};
  };

  /** Karte ausfuehren (aus Simulation.step, zwischen zwei Ticks). */
  Humans.prototype.apply = function (card, params) {
    if (card === 'landung') {
      var c = this.land(params);
      return { x: c.x, y: c.y };
    }
    if (card === 'acker') {
      var fr = this.addField();
      if (!fr) return { text: 'kein Platz für einen Acker' };
      fr.text = fr.cells + ' Zellen Acker' + (fr.cleared ? ', davon ' + fr.cleared + ' Wald gerodet' : '');
      return fr;
    }
    if (card === 'schafe') {
      var pr = this.addPasture();
      if (!pr) return { text: 'kein Platz für eine Weide' };
      pr.text = pr.sheep + ' Schafe auf der Weide';
      return pr;
    }
    if (card === 'hunde') {
      var dr = this.addDogs();
      dr.text = dr.dogs + ' Hütehunde im Dorf';
      return dr;
    }
    if (card === 'sammeln') {
      var sr = this.addHunters('sammel');
      sr.text = sr.hunters + ' Sammler im Dorf';
      return sr;
    }
    if (card === 'woelfeJagen' || card === 'wildJagen') {
      var kind = card === 'woelfeJagen' ? 'wolf' : 'wild';
      var hr = this.addHunters(kind);
      hr.text = hr.hunters + (kind === 'wolf' ? ' Wolfsjäger' : ' Jäger') + ' im Dorf';
      return hr;
    }
    if (card === 'dorf') {
      var r = this.expand();
      r.text = r.houses + (r.houses === 1 ? ' Haus' : ' Häuser') + (r.cleared ? ', ' + r.cleared + ' Zellen Wald gerodet' : ', kein Wald in der Nähe');
      return r;
    }
    return null;
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  BT.Humans = Humans;
})(typeof window !== 'undefined' ? window : globalThis);
