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
 * Einige Jahre nach der ersten Karte bricht einmal eine kleine Gruppe aus und
 * wird zur eingeschleppten Art (BT.SPECIES.schaf, BT.SPECIES.hund): Folgekarten
 * "Schafe brechen aus" und "Hunde verwildern".
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
      escapeYears: 4,         // so lange nach der ersten Weide brechen Schafe aus ...
      escape: 8               // ... so viele (Haelfte Weibchen)
    },
    dogs: {                   // Karte "Huetehunde"
      perCard: 3,
      speed: 3.5,
      disturb: 200,           // Hunde an der Weide: Stoerung in diesem Umkreis (statt nur ums Haus)
      houseBonus: 1.2,        // ... und das Dorf wirkt weiter (Radius mal diesem Faktor)
      escapeYears: 4,         // so lange nach den ersten Hunden verwildert ein Rudel ...
      escape: 3               // ... aus so vielen Hunden (Paar und ein drittes Tier)
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
    this.escaped = {};              // { schaf: Tag, hund: Tag }
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
    this.pastures.push(p);
    if (this.sheepDay === null) this.sheepDay = this.sim.day;
    if (this.dogs.length) this.updateDisturbance();
    return { x: p.x, y: p.y, sheep: p.sheep.length };
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
   * Einmal am Tag: Einige Jahre nach der ersten Weide brechen Schafe aus,
   * einige Jahre nach den ersten Huetehunden verwildert ein kleines Rudel.
   * Beides geschieht einmal; danach vermehren sie sich als eigene Art.
   */
  Humans.prototype.checkEscape = function () {
    var day = this.sim.day, P = BT.HUMANS.pasture, D = BT.HUMANS.dogs;
    if (this.sheepDay !== null && this.escaped.schaf == null && day >= this.sheepDay + BT.Time.years(P.escapeYears)) {
      var p = this.pastures[0];
      var n = Math.min(P.escape, p.sheep.length);
      var at = this.release(BT.SPECIES.schaf, p, p.r + 25, n);
      p.sheep.splice(0, n);
      this.escaped.schaf = day;
      this.sim.events.push({ day: day, tick: this.sim.tick, card: 'schafeAus', params: {},
        at: { x: at.x, y: at.y, text: n + ' Schafe sind ausgebüchst' } });
    }
    if (this.dogDay !== null && this.escaped.hund == null && day >= this.dogDay + BT.Time.years(D.escapeYears)) {
      var c = this.center();
      var m = Math.min(D.escape, this.dogs.length);
      var at2 = this.release(BT.SPECIES.hund, c, 220, m);
      this.dogs.splice(0, m);
      this.escaped.hund = day;
      this.updateDisturbance();
      this.sim.events.push({ day: day, tick: this.sim.tick, card: 'hundeWild', params: {},
        at: { x: at2.x, y: at2.y, text: m + ' Hunde sind verwildert' } });
    }
  };

  /** Eine Gruppe der Art frei lassen, `dist` vom Ort entfernt (Weibchen zuerst, alle erwachsen). */
  Humans.prototype.release = function (spec, from, dist, n) {
    var sim = this.sim, w = this.world, pt = { x: from.x, y: from.y };
    for (var t = 0; t < 12; t++) {
      var a = this.rng.range(0, Math.PI * 2);
      var x = from.x + BT.M.cos(a) * dist, y = from.y + BT.M.sin(a) * dist;
      if (!BT.Move.blockedAt(w, spec, x, y) && spec.habitat[sim.biomeAt(x, y)] > 0) { pt = { x: x, y: y }; break; }
    }
    var g = sim.makeGroup(spec, pt.x, pt.y);
    if (spec.role === 'predator') g.state = 'wandern';
    for (var k = 0; k < n; k++) {
      var age = Math.round(this.rng.range(spec.maturity, spec.maxAge * 0.5));
      var an = sim.makeAnimal(spec, pt.x, pt.y, age, k % 2 ? 'm' : 'f', 0.85);
      sim.addToGroup(g, an);
      an.x = pt.x + an.ox; an.y = pt.y + an.oy; an.px = an.x; an.py = an.y;
    }
    return pt;
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
