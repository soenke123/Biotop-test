/**
 * Die Simulation: Zustand und Ablauf.
 *
 * Pro Tick:   jede Gruppe entscheidet (eco/behavior.js), die Tiere folgen ihrer
 *             Gruppe, fressen, verbrauchen Energie, werden durstig.
 * Pro Tag:    Pflanzen wachsen, Alter, Geburten, Nester, Abwanderung,
 *             Teilen und Zusammenlegen von Gruppen, Statistik.
 *
 * Deterministisch: aller Zufall kommt aus einem RNG, der aus dem Seed der
 * Welt abgeleitet ist. Gleicher Seed + gleiche Startwerte = gleicher Verlauf,
 * egal wie schnell gerechnet oder gezeichnet wird.
 *
 * Todesursachen werden festgehalten: hunger, durst, alter, oder die id der Art,
 * die das Tier gerissen hat.
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});
  var T = BT.Time;

  function Simulation(world, options) {
    var opts = options || {};
    this.world = world;
    this.fields = new BT.Fields(world);
    this.rng = new BT.Rng(world.seed).fork('sim' + (opts.variant || ''));
    this.ticksPerDay = T.TICKS_PER_DAY;
    this.tick = 0;
    this.day = 0;
    this.calendar = T.calendar(0);
    this.groups = [];
    this.carcasses = [];            // Aas: { x, y, meat, day }
    this.herbivoreGroups = [];
    this.predatorGroups = [];
    this.nextId = 1;
    this.startCounts = {};
    var defaults = Simulation.defaultStart(world);
    for (var k = 0; k < BT.SPECIES_ORDER.length; k++) {
      var id = BT.SPECIES_ORDER[k];
      this.startCounts[id] = opts.start && opts.start[id] != null ? opts.start[id] : defaults[id];
    }
    this.stats = new BT.Stats(this);
    this.populate();
    this.stats.record();
  }

  // ------------------------------------------------------------ Tiere und Gruppen

  Simulation.prototype.makeAnimal = function (spec, x, y, age, sex, energy) {
    return {
      id: this.nextId++,
      spec: spec,
      sex: sex,
      age: age,
      energy: energy,
      thirst: this.rng.range(0, 0.3),
      x: x, y: y, px: x, py: y,
      heading: this.rng.range(0, Math.PI * 2),
      ox: 0, oy: 0,
      group: null,
      alive: true
    };
  };

  Simulation.prototype.makeGroup = function (spec, x, y) {
    var g = {
      id: this.nextId++,
      spec: spec,
      members: [],
      x: x, y: y,
      heading: 0,
      state: spec.role === 'predator' ? 'streifen' : 'fressen',
      stateTicks: 0,
      tx: null, ty: null,
      home: null,
      prey: null,
      cooldown: 0,
      nest: null,
      speedNow: 0,
      grazing: false
    };
    this.groups.push(g);
    (spec.role === 'predator' ? this.predatorGroups : this.herbivoreGroups).push(g);
    return g;
  };

  Simulation.prototype.addToGroup = function (g, a) {
    a.group = g;
    var r = g.spec.group.spread * Math.sqrt(this.rng.next());
    var ang = this.rng.range(0, Math.PI * 2);
    a.ox = BT.M.cos(ang) * r; a.oy = BT.M.sin(ang) * r;
    g.members.push(a);
  };

  Simulation.prototype.removeFromGroup = function (a) {
    var g = a.group;
    if (!g) return;
    var i = g.members.indexOf(a);
    if (i >= 0) g.members.splice(i, 1);
    a.group = null;
  };

  Simulation.prototype.kill = function (a, cause) {
    if (!a.alive) return;
    a.alive = false;
    this.removeFromGroup(a);
    this.stats.death(a.spec.id, cause);
    // Wer verhungert, verdurstet oder an Altersschwaeche stirbt, bleibt als Aas liegen
    if (cause === 'hunger' || cause === 'durst' || cause === 'alter') {
      this.addCarcass(a.x, a.y, a.spec.meat * (a.age < a.spec.maturity ? 0.4 : 0.7));
    }
  };

  Simulation.prototype.addCarcass = function (x, y, meat) {
    if (meat < 0.05) return;
    this.carcasses.push({ x: x, y: y, meat: meat, day: this.day });
  };

  /** Beute unter den Gruppenmitgliedern aufteilen, die Hungrigsten zuerst. */
  /** Liefert, was uebrig bleibt (wird zu Aas). */
  Simulation.prototype.feed = function (g, energy) {
    var ms = g.members.slice().sort(function (a, b) { return a.energy - b.energy; });
    var share = energy / Math.max(1, ms.length);
    var rest = energy;
    for (var pass = 0; pass < 2 && rest > 0.001; pass++) {
      for (var i = 0; i < ms.length && rest > 0.001; i++) {
        var take = Math.min(1 - ms[i].energy, pass === 0 ? share : rest);
        if (take <= 0) continue;
        ms[i].energy += take;
        ms[i].thirst = Math.max(0, ms[i].thirst - take * 0.5);   // Fleisch enthaelt Wasser
        rest -= take;
      }
    }
    return rest;
  };

  // ------------------------------------------------------------ Start

  Simulation.prototype.randomHabitatPoint = function (spec, minPref) {
    var w = this.world;
    for (var t = 0; t < 400; t++) {
      var x = this.rng.range(0, w.width), y = this.rng.range(0, w.height);
      var b = w.query.biomeAt(x, y);
      if (BT.isBlocked(b, null)) continue;
      if (spec.habitat[b] >= (minPref || 0.7)) return { x: x, y: y };
    }
    return null;
  };

  Simulation.prototype.homeIsFree = function (spec, x, y) {
    for (var i = 0; i < this.predatorGroups.length; i++) {
      var o = this.predatorGroups[i];
      if (o.spec !== spec || !o.home || !o.members.length) continue;
      if (BT.M.hypot(o.home.x - x, o.home.y - y) < spec.territory * 1.1) return false;
    }
    return true;
  };

  Simulation.prototype.populate = function () {
    for (var k = 0; k < BT.SPECIES_ORDER.length; k++) {
      var spec = BT.SPECIES[BT.SPECIES_ORDER[k]];
      var left = this.startCounts[spec.id];
      var guard = 0;
      while (left > 0 && guard++ < 500) {
        var p = null;
        for (var t = 0; t < 40; t++) {
          var cand = this.randomHabitatPoint(spec, 0.7);
          if (!cand) break;
          if (spec.role !== 'predator' || this.homeIsFree(spec, cand.x, cand.y) || t > 30) { p = cand; break; }
        }
        if (!p) break;
        var size = Math.min(left, this.rng.intIn(spec.group.start));
        var g = this.makeGroup(spec, p.x, p.y);
        if (spec.role === 'predator') g.home = { x: p.x, y: p.y };
        for (var i = 0; i < size; i++) {
          // ueberwiegend Erwachsene, ausgeglichene Geschlechter
          var adult = i < 2 || this.rng.chance(0.75);
          var age = adult ? this.rng.range(spec.maturity, spec.maxAge * 0.6) : this.rng.range(0, spec.maturity);
          var sex = i % 2 === 0 ? 'f' : 'm';
          var a = this.makeAnimal(spec, p.x, p.y, Math.round(age), sex, this.rng.range(0.7, 0.95));
          this.addToGroup(g, a);
          a.x = p.x + a.ox; a.y = p.y + a.oy; a.px = a.x; a.py = a.y;
        }
        left -= size;
      }
    }
  };

  // ------------------------------------------------------------ Ablauf

  Simulation.prototype.step = function () {
    var groups = this.groups;
    var winter = this.calendar.season === 3;
    var perTick = 1 / this.ticksPerDay;

    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (!g.members.length) continue;
      g.grazing = false;
      if (g.spec.role === 'predator') BT.Behavior.predator(this, g);
      else BT.Behavior.herbivore(this, g);
    }

    for (i = 0; i < groups.length; i++) {
      g = groups[i];
      if (!g.members.length) continue;
      this.moveMembers(g);
      var spec = g.spec;
      // Wer am Wasser vorbeikommt, trinkt
      var drinks = spec.thirstDays && BT.Move.atWater(this.world, g.x, g.y);
      var onThermal = this.world.query.biomeAt(g.x, g.y) === BT.BIOME.THERMAL;
      var cost = (spec.costPerDay + (winter ? spec.winterCost * (onThermal ? 0.3 : 1) : 0)) * perTick;
      var thirst = spec.thirstDays ? perTick / spec.thirstDays : 0;
      // Rueckwaerts, weil Tiere dabei sterben koennen
      for (var m = g.members.length - 1; m >= 0; m--) {
        var a = g.members[m];
        if (g.grazing && a.energy < 0.98) {
          var gain = this.fields.eat(this.fields.index(a.x, a.y), spec.diet, spec.bite);
          a.energy = Math.min(1, a.energy + gain);
          a.thirst = Math.max(0, a.thirst - this.fields.lastWater);
        }
        a.energy -= cost;
        a.thirst = drinks ? 0 : a.thirst + thirst;
        if (a.energy <= 0) this.kill(a, 'hunger');
        else if (a.thirst >= 1) this.kill(a, 'durst');
      }
    }

    this.tick++;
    if (this.tick % this.ticksPerDay === 0) this.newDay();
  };

  /** Die Tiere folgen dem Anker ihrer Gruppe, jedes mit eigenem, langsam wanderndem Versatz. */
  Simulation.prototype.moveMembers = function (g) {
    var spread = g.spec.group.spread * (g.state === 'fliehen' || g.state === 'jagen' ? 0.6 : 1);
    var maxStep = Math.max(g.speedNow * 1.4, g.spec.speed * 0.6);
    for (var i = 0; i < g.members.length; i++) {
      var a = g.members[i];
      a.px = a.x; a.py = a.y;
      a.ox += this.rng.range(-2, 2); a.oy += this.rng.range(-2, 2);
      var r = BT.M.hypot(a.ox, a.oy);
      if (r > spread) { a.ox *= spread / r; a.oy *= spread / r; }
      var tx = g.x + a.ox, ty = g.y + a.oy;
      if (BT.Move.blockedAt(this.world, g.spec, tx, ty)) { tx = g.x; ty = g.y; }
      var dx = tx - a.x, dy = ty - a.y, d = BT.M.hypot(dx, dy);
      if (d > 0.01) {
        var s = Math.min(maxStep, d);
        var nx = a.x + dx / d * s, ny = a.y + dy / d * s;
        if (!BT.Move.blockedAt(this.world, g.spec, nx, ny)) { a.x = nx; a.y = ny; }
        else { a.x = g.x; a.y = g.y; }
        if (s > 0.3) a.heading = BT.M.atan2(dy, dx);
      }
    }
  };

  Simulation.prototype.newDay = function () {
    this.day++;
    this.calendar = T.calendar(this.day);
    var cal = this.calendar;
    this.fields.grow(cal.season);
    // Aas verwest
    for (var c = this.carcasses.length - 1; c >= 0; c--) {
      var cc = this.carcasses[c];
      cc.meat -= 0.12;
      if (cc.meat <= 0 || this.day - cc.day > 10) this.carcasses.splice(c, 1);
    }

    // Reihenfolge der Gruppen einmal am Tag mischen - sonst haetten immer
    // dieselben Gruppen den ersten Zugriff aufs Futter
    shuffle(this.groups, this.rng);

    var groups = this.groups.slice();
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (!g.members.length) continue;
      this.ageGroup(g);
      if (!g.members.length) continue;
      this.breed(g, cal);
      this.hatch(g);
      this.disperse(g, cal);
    }
    this.reorganize();
    this.cleanup();
    this.stats.record();
  };

  Simulation.prototype.ageGroup = function (g) {
    for (var m = g.members.length - 1; m >= 0; m--) {
      var a = g.members[m];
      a.age++;
      var max = a.spec.maxAge;
      if (a.age > max * 0.75) {
        // Alterssterblichkeit steigt gegen Lebensende steil an
        var t = (a.age - max * 0.75) / (max * 0.25);
        if (a.age >= max * 1.15 || this.rng.chance(0.02 * t * t)) this.kill(a, 'alter');
      }
    }
  };

  function adults(g, sex) {
    var n = 0;
    for (var i = 0; i < g.members.length; i++) {
      var a = g.members[i];
      if (a.sex === sex && a.age >= a.spec.maturity) n++;
    }
    return n;
  }

  Simulation.prototype.birth = function (g, mother) {
    var spec = g.spec;
    var b = spec.breed;
    var n = this.rng.intIn(b.litter);
    for (var k = 0; k < n; k++) {
      var c = this.makeAnimal(spec, mother.x, mother.y, 0, this.rng.chance(0.5) ? 'f' : 'm', spec.newbornEnergy);
      this.addToGroup(g, c);
      this.stats.birth(spec.id);
    }
    mother.energy -= b.cost;
  };

  Simulation.prototype.breed = function (g, cal) {
    var spec = g.spec, b = spec.breed;
    if (cal.season !== b.season || cal.dayOfSeason !== b.day) return;
    var males = adults(g, 'm');
    if (!males) return;
    var mothers = g.members.filter(function (a) {
      return a.sex === 'f' && a.age >= spec.maturity && a.energy >= b.minEnergy;
    });
    if (!mothers.length) return;

    if (b.kind === 'each-female') {
      for (var i = 0; i < mothers.length; i++) if (this.rng.chance(b.chance)) this.birth(g, mothers[i]);
    } else if (b.kind === 'group-pair') {
      // Nur das ranghoechste (aelteste) Paar pflanzt sich fort
      mothers.sort(function (x, y) { return y.age - x.age; });
      if (this.rng.chance(b.chance)) this.birth(g, mothers[0]);
    } else if (b.kind === 'pair') {
      // Bodenbrueter: ein gemeinsames Nest, Kueken schluepfen spaeter
      var pairs = Math.min(mothers.length, males);
      var eggs = 0;
      for (i = 0; i < pairs; i++) {
        if (!this.rng.chance(b.chance)) continue;
        eggs += this.rng.intIn(b.litter);
        mothers[i].energy -= b.cost;
      }
      if (eggs) {
        g.nest = { x: g.x, y: g.y, eggs: eggs, hatchDay: this.day + b.incubation };
        this.stats.nest(spec.id, eggs);
      }
    }
  };

  Simulation.prototype.hatch = function (g) {
    var nest = g.nest;
    if (!nest || this.day < nest.hatchDay) return;
    for (var k = 0; k < nest.eggs; k++) {
      var c = this.makeAnimal(g.spec, nest.x, nest.y, 0, this.rng.chance(0.5) ? 'f' : 'm', g.spec.newbornEnergy);
      this.addToGroup(g, c);
      this.stats.birth(g.spec.id);
    }
    g.nest = null;
  };

  /** Junge Raeuber verlassen im Herbst das Rudel bzw. die Eltern. */
  Simulation.prototype.disperse = function (g, cal) {
    var d = g.spec.disperse;
    if (!d || cal.season !== d.season || cal.dayOfSeason !== 1) return;
    if (g.members.length < d.minGroup) return;
    var oldest = g.members.slice().sort(function (a, b) { return b.age - a.age; });
    var breeders = [];
    var f = null, m = null;
    for (var i = 0; i < oldest.length; i++) {
      if (!f && oldest[i].sex === 'f') f = oldest[i];
      if (!m && oldest[i].sex === 'm') m = oldest[i];
    }
    if (f) breeders.push(f);
    if (m) breeders.push(m);
    var leaving = g.members.filter(function (a) {
      return breeders.indexOf(a) < 0 && a.age >= d.minAge;
    });
    var self = this;
    leaving = leaving.filter(function () { return self.rng.chance(d.chance); });
    if (!leaving.length) return;
    var ng = this.makeGroup(g.spec, g.x, g.y);
    for (i = 0; i < leaving.length; i++) {
      this.removeFromGroup(leaving[i]);
      this.addToGroup(ng, leaving[i]);
    }
    ng.state = 'wandern';
  };

  /** Herden teilen, Einzelgaenger zusammenlegen, wandernde Raeuber sesshaft machen. */
  Simulation.prototype.reorganize = function () {
    var groups = this.groups.slice();
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (!g.members.length) continue;
      var spec = g.spec;

      // Zu gross -> teilen
      if (g.members.length > spec.group.max && spec.group.kind !== 'pack' && spec.group.kind !== 'pair') {
        var half = g.members.slice(Math.floor(g.members.length / 2));
        var p = BT.Behavior.randomPointNear(this, spec, g.x, g.y, 120);
        var ng = this.makeGroup(spec, g.x, g.y);
        ng.tx = p.x; ng.ty = p.y;
        for (var k = 0; k < half.length; k++) { this.removeFromGroup(half[k]); this.addToGroup(ng, half[k]); }
        continue;
      }

      if (spec.role === 'predator') { this.reorganizePredator(g); continue; }

      // Zu klein -> Anschluss an eine nahe Gruppe derselben Art
      if (g.members.length < spec.group.min) {
        var other = this.nearestGroupOf(spec, g, 160);
        if (other && other.members.length + g.members.length <= spec.group.max && !g.nest && !other.nest) {
          var moving = g.members.slice();
          for (k = 0; k < moving.length; k++) { this.removeFromGroup(moving[k]); this.addToGroup(other, moving[k]); }
        }
      }
    }
  };

  /**
   * Raeuber: Ein Rudel ohne Brutpaar gibt sein Revier nach einem Jahr auf und
   * wird zum Wanderer. Wanderer schliessen sich Gruppen an, denen ein
   * Geschlecht fehlt, oder finden sich zu zweit zusammen. Mit Partner und
   * freiem Platz gruenden sie ein Revier.
   */
  Simulation.prototype.reorganizePredator = function (g) {
    var spec = g.spec;
    var f = adults(g, 'f'), m = adults(g, 'm');
    if (g.home) {
      g.lonelyDays = f && m ? 0 : (g.lonelyDays || 0) + 1;
      if (g.lonelyDays > T.DAYS_PER_YEAR) { g.home = null; g.lonelyDays = 0; }
      return;
    }
    var self = this;
    var other = this.nearestGroupOf(spec, g, 260, function (o) {
      if (o.members.length + g.members.length > spec.group.max) return false;
      var of = adults(o, 'f'), om = adults(o, 'm');
      var completes = (!of && adults(g, 'f')) || (!om && adults(g, 'm'));
      return completes || !o.home || o.members.length < 2;
    });
    if (other) {
      var moving = g.members.slice();
      for (var k = 0; k < moving.length; k++) { self.removeFromGroup(moving[k]); self.addToGroup(other, moving[k]); }
      return;
    }
    if (f && m && this.homeIsFree(spec, g.x, g.y)) {
      g.home = { x: g.x, y: g.y };
      g.state = 'streifen';
    }
  };

  Simulation.prototype.nearestGroupOf = function (spec, from, maxDist, filter) {
    var best = null, bestD = maxDist;
    var list = spec.role === 'predator' ? this.predatorGroups : this.herbivoreGroups;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === from || o.spec !== spec || !o.members.length) continue;
      if (filter && !filter(o)) continue;
      var d = BT.M.hypot(o.x - from.x, o.y - from.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  };

  Simulation.prototype.cleanup = function () {
    function alive(g) { return g.members.length > 0; }
    this.groups = this.groups.filter(alive);
    this.herbivoreGroups = this.herbivoreGroups.filter(alive);
    this.predatorGroups = this.predatorGroups.filter(alive);
    for (var i = 0; i < this.predatorGroups.length; i++) {
      var g = this.predatorGroups[i];
      if (g.prey && !g.prey.members.length) g.prey = null;
    }
  };

  /** Mehrere Tage am Stueck (fuer Vorspulen und Tests). */
  Simulation.prototype.runDays = function (days) {
    var target = this.tick + days * this.ticksPerDay;
    while (this.tick < target) this.step();
  };

  /**
   * Beutewechsel (Holling Typ III): Wird eine Beuteart selten, suchen die
   * Raeuber kaum noch gezielt nach ihr. Faktor 0..1 aus dem Bestand von gestern
   * relativ zum Startbestand.
   */
  Simulation.prototype.preyAvailability = function (id) {
    var row = this.stats.latest();
    var n = row ? row.count[id] : 0;
    var h = Math.max(10, this.startCounts[id] * 0.35);
    return n * n / (n * n + h * h);
  };

  Simulation.prototype.count = function (id) {
    var n = 0;
    for (var i = 0; i < this.groups.length; i++) if (this.groups[i].spec.id === id) n += this.groups[i].members.length;
    return n;
  };

  /**
   * Startbestaende passend zur Inselgroesse: die Werte in der Artentabelle
   * gelten fuer die mittlere Insel und werden mit der Landflaeche skaliert.
   */
  Simulation.defaultStart = function (world) {
    var ref = BT.ISLAND_SIZES.mittel;
    var factor = world.width * world.height / (ref.width * ref.height);
    var out = {};
    for (var k = 0; k < BT.SPECIES_ORDER.length; k++) {
      var id = BT.SPECIES_ORDER[k];
      out[id] = Math.max(2, Math.round(BT.SPECIES[id].start * factor));
    }
    return out;
  };

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng.next() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
  }

  BT.Simulation = Simulation;
})(typeof window !== 'undefined' ? window : globalThis);
