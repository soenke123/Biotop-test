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
    for (var k = 0; k < cfg.settlers; k++) {
      this.people.push({
        id: this.nextId++, house: house,
        x: c.x, y: c.y, px: c.x, py: c.y, heading: 0,
        tx: site.x + this.rng.range(-20, 20), ty: site.y + this.rng.range(-20, 20),
        wait: 0, inside: false
      });
    }
  };

  Humans.prototype.addHouse = function (x, y) {
    var h = { id: this.nextId++, x: x, y: y, kind: this.houses.length % 3, day: this.sim.day };
    this.houses.push(h);
    this.updateDisturbance();
    return h;
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
    return null;
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  BT.Humans = Humans;
})(typeof window !== 'undefined' ? window : globalThis);
