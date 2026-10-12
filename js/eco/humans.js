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
      avoid: 0.3              // Stoerung * scheu darueber: die Gegend wird gemieden
    },
    settler: {
      speed: 3,               // Weltunits je Tick
      roam: 110,              // so weit gehen sie vom Haus weg
      size: 13
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
    var f = sim.fields;
    this.disturb = new Float32Array(f.cols * f.rows);
  }

  // ------------------------------------------------------------ Abfragen

  Humans.prototype.disturbanceAt = function (x, y) {
    if (!this.active) return 0;
    var i = this.sim.fields.index(x, y);
    return i < 0 ? 0 : this.disturb[i];
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
    this.disturb.fill(0);
    for (var i = 0; i < this.disturb.length; i++) {
      var c = f.center(i), v = 0;
      for (var k = 0; k < this.houses.length; k++) {
        var h = this.houses[k];
        var dx = c.x - h.x, dy = c.y - h.y;
        var t = 1 - Math.sqrt(dx * dx + dy * dy) / R;
        if (t > v) v = t;
      }
      this.disturb[i] = v;
    }
    this.active = this.houses.length > 0;
  };

  // ------------------------------------------------------------ Ablauf

  Humans.prototype.step = function () {
    this.moveShips();
    this.movePeople();
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

  /** Karte ausfuehren (aus Simulation.step, zwischen zwei Ticks). */
  Humans.prototype.apply = function (card, params) {
    if (card === 'landung') {
      var c = this.land(params);
      return { x: c.x, y: c.y };
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
