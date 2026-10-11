/**
 * Verhalten, einmal pro Tick und Gruppe.
 *
 * Entschieden wird auf Ebene der Gruppe (Herde, Schwarm, Rudel, Paar): wohin,
 * fliehen, trinken, fressen, jagen. Die einzelnen Tiere folgen dem Anker der
 * Gruppe mit eigenem Versatz (siehe Simulation.moveMembers). Das ist
 * realistischer als lauter Einzelgaenger und guenstig zu rechnen.
 *
 * Ein Verhalten fuer alle Arten - die Unterschiede stehen in BT.SPECIES.
 *
 * Zustaende:
 *   Pflanzenfresser  fressen · fliehen · trinken · brueten
 *   Raeuber          streifen · jagen · ruhen · trinken · wandern (ohne Revier)
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});
  var B = BT.BIOME;

  // Deckung: so viel schlechter werden Beutetiere hier entdeckt und erwischt
  var COVER = new Array(13).fill(0);
  COVER[B.FERN] = 0.5; COVER[B.MOSS] = 0.6; COVER[B.SCRUB] = 0.35; COVER[B.SWAMP] = 0.25;

  function dist(a, b) { return BT.M.hypot(a.x - b.x, a.y - b.y); }

  function avg(members, key) {
    var s = 0;
    for (var i = 0; i < members.length; i++) s += members[i][key];
    return members.length ? s / members.length : 0;
  }

  function maxOf(members, key) {
    var m = 0;
    for (var i = 0; i < members.length; i++) if (members[i][key] > m) m = members[i][key];
    return m;
  }

  // ------------------------------------------------------------ gemeinsame Teile

  /** Durst: zum Wasser gehen, am Wasser trinken. true, solange damit beschaeftigt. */
  function handleThirst(sim, g, speed) {
    var spec = g.spec;
    if (!spec.thirstDays) return false;
    if (g.state !== 'trinken' && maxOf(g.members, 'thirst') < 0.45) return false;
    g.state = 'trinken';
    if (BT.Move.atWater(sim.world, g.x, g.y)) {
      for (var i = 0; i < g.members.length; i++) g.members[i].thirst = 0;
      g.state = spec.role === 'predator' ? 'streifen' : 'fressen';
      g.tx = null;
      return false;
    }
    var wp = BT.Move.waterWaypoint(sim.world, g.x, g.y, 10);
    if (!wp) { for (i = 0; i < g.members.length; i++) g.members[i].thirst = 0; return false; }
    BT.Move.stepToward(sim.world, spec, g, wp.x, wp.y, speed * 2.5);
    return true;
  }

  /** Zufaelliger erreichbarer Punkt im Umkreis. */
  function randomPointNear(sim, spec, x, y, radius) {
    for (var t = 0; t < 12; t++) {
      var a = sim.rng.range(0, Math.PI * 2);
      var r = radius * Math.sqrt(sim.rng.next());
      var px = x + BT.M.cos(a) * r, py = y + BT.M.sin(a) * r;
      if (!BT.Move.blockedAt(sim.world, spec, px, py)) return { x: px, y: py };
    }
    return { x: x, y: y };
  }

  // ------------------------------------------------------------ Pflanzenfresser

  function nearestThreat(sim, g) {
    var spec = g.spec;
    // Mehr Augen sehen mehr: Wachsamkeit waechst mit der Gruppe
    var vision = spec.vision * Math.min(1.5, 1 + 0.05 * (g.members.length - 1));
    var best = null, bestD = vision;
    var preds = sim.predatorGroups;
    for (var i = 0; i < preds.length; i++) {
      var p = preds[i];
      if (!p.members.length || !p.spec.prey[spec.id]) continue;
      var d = dist(g, p);
      // Geflohen wird vor einem Raeuber, der genau diese Gruppe jagt, und vor
      // streifenden Landraeubern aus kurzer Distanz. Ruhende und
      // kreisende Greifvoegel ohne Jagdabsicht werden geduldet.
      var hunting = p.state === 'jagen' && p.prey === g;
      if (!hunting && (p.spec.flies || p.state === 'ruhen' || d > vision * 0.3)) continue;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function chooseForageTarget(sim, g, cx, cy, radius) {
    var spec = g.spec, f = sim.fields, w = sim.world;
    var winter = sim.calendar.season === 3;
    var best = null, bestScore = -Infinity;
    for (var t = 0; t < 10; t++) {
      var a = sim.rng.range(0, Math.PI * 2);
      var r = radius * Math.sqrt(sim.rng.next());
      var px = cx + BT.M.cos(a) * r, py = cy + BT.M.sin(a) * r;
      if (BT.Move.blockedAt(w, spec, px, py)) continue;
      var b = w.query.biomeAt(px, py);
      var pref = spec.habitat[b];
      if (pref <= 0) continue;
      var food = f.energyAt(f.index(px, py), spec.diet);
      var score = food * pref - BT.M.hypot(px - g.x, py - g.y) * 0.0015;
      // Im Winter sind die Thermalfelder warm: dort kostet die Kaelte weniger
      if (winter && b === B.THERMAL) score += 0.25;
      if (score > bestScore) { bestScore = score; best = { x: px, y: py }; }
    }
    return best;
  }

  function herbivore(sim, g) {
    var spec = g.spec;

    // 1. Gefahr
    var threat = nearestThreat(sim, g);
    if (threat) {
      if (g.state !== 'fliehen') g.fleeTicks = 0;
      g.state = 'fliehen';
      g.fleeFrom = { x: threat.x, y: threat.y };
      g.stateTicks = 4;
    }
    if (g.state === 'fliehen') {
      if (g.stateTicks-- <= 0) { g.state = 'fressen'; g.tx = null; g.fleeTicks = 0; }
      else {
        // Ausdauer: nach einem kurzen Sprint nur noch Trab
        g.fleeTicks = (g.fleeTicks || 0) + 1;
        var fs = g.fleeTicks <= spec.sprintTicks ? spec.fleeSpeed : spec.fleeSpeed * 0.55;
        BT.Move.stepAway(sim.world, spec, g, g.fleeFrom.x, g.fleeFrom.y, fs);
        g.speedNow = fs;
        return;
      }
    }

    // 2. Durst
    if (handleThirst(sim, g, spec.speed)) { g.speedNow = spec.speed * 2.5; return; }

    // 3. Fressen (beim Brueten nur rund ums Nest)
    g.state = g.nest ? 'brueten' : 'fressen';
    var cx = g.nest ? g.nest.x : g.x, cy = g.nest ? g.nest.y : g.y;
    var radius = g.nest ? 50 : spec.searchRadius;
    var here = sim.fields.energyAt(sim.fields.index(g.x, g.y), spec.diet);
    var reached = g.tx !== null && BT.M.hypot(g.tx - g.x, g.ty - g.y) < 12;
    if (g.tx === null || (reached && here < 0.4) || g.stateTicks-- <= 0) {
      var target = chooseForageTarget(sim, g, cx, cy, radius);
      if (target) { g.tx = target.x; g.ty = target.y; }
      else { g.tx = g.x; g.ty = g.y; }
      g.stateTicks = 18;
    }
    // Auf abgeweideter Flaeche zuegig weiterziehen, am Futterplatz langsam grasen
    var sp = here < 0.4 && !g.nest ? spec.speed * 2.5 : spec.speed;
    BT.Move.stepToward(sim.world, spec, g, g.tx, g.ty, sp);
    g.speedNow = sp;
    g.grazing = true;
  }

  // ------------------------------------------------------------ Raeuber

  function eligibleVictims(pred, preyGroup) {
    var maxAge = pred.spec.preyMaxAge && pred.spec.preyMaxAge[preyGroup.spec.id];
    if (!maxAge) return preyGroup.members;
    return preyGroup.members.filter(function (m) { return m.age <= maxAge; });
  }

  function insideForeignTerritory(sim, g, x, y) {
    for (var i = 0; i < sim.predatorGroups.length; i++) {
      var o = sim.predatorGroups[i];
      if (o === g || o.spec !== g.spec || !o.home || !o.members.length) continue;
      if (BT.M.hypot(o.home.x - x, o.home.y - y) < g.spec.territory) return true;
    }
    return false;
  }

  function findPrey(sim, g) {
    var spec = g.spec, w = sim.world;
    var best = null, bestScore = 0, bestWeight = 0;
    var groups = sim.herbivoreGroups;
    for (var i = 0; i < groups.length; i++) {
      var p = groups[i];
      var weight = spec.prey[p.spec.id];
      if (!weight || !p.members.length) continue;
      weight *= sim.preyAvailability(p.spec.id);
      if (weight < 0.12) continue;      // sehr seltene Beute lohnt die Suche nicht
      var cover = COVER[w.query.biomeAt(p.x, p.y)];
      var vision = spec.vision * (1 - cover * (spec.flies ? 1.3 : 0.6));
      if (vision <= 0) continue;
      var d = dist(g, p);
      if (d > vision) continue;
      // Der Revierbesitzer jagt im eigenen Revier; Wanderer ohne Revier werden
      // aus fremden Revieren vertrieben und jagen nur dazwischen
      if (g.home && BT.M.hypot(p.x - g.home.x, p.y - g.home.y) > spec.territory * 1.4) continue;
      if (!g.home && insideForeignTerritory(sim, g, p.x, p.y)) continue;
      if (!eligibleVictims(g, p).length) continue;
      var score = weight * (1 - d / vision);
      if (score > bestScore) { bestScore = score; best = p; bestWeight = weight; }
    }
    // Seltene Beute wird nicht nur seltener gewaehlt, sondern auch seltener
    // verfolgt (Holling Typ III): die Raeuber hungern, bevor die Beute verschwindet
    if (best && !sim.rng.chance(Math.min(1, bestWeight / spec.prey[best.spec.id]))) return null;
    return best;
  }

  function attack(sim, g, prey) {
    var spec = g.spec;
    var victims = eligibleVictims(g, prey);
    if (!victims.length) return false;
    var hunters = 0;
    for (var i = 0; i < g.members.length; i++) if (g.members[i].age >= spec.maturity * 0.6) hunters++;
    hunters = Math.max(1, Math.min(hunters, 5));
    var p = 1 - BT.M.pow(1 - spec.huntChance, hunters);
    p *= 1 - COVER[sim.world.query.biomeAt(prey.x, prey.y)] * (spec.flies ? 0.9 : 0.4);
    p /= 1 + 0.03 * (prey.members.length - 1);           // Wachsamkeit der Gruppe
    // Gut genaehrte Beute entkommt leichter, ausgehungerte kaum: Raeuber
    // haben es leicht, wenn die Pflanzenfresser ihre Weiden kahl gefressen haben
    p *= 1.1 - 0.3 * avg(victims, 'energy');
    if (!sim.rng.chance(p)) return false;

    // Opfer: bevorzugt Jungtiere und geschwaechte Tiere
    var totalW = 0, weights = [];
    for (i = 0; i < victims.length; i++) {
      var v = victims[i];
      var wgt = (v.age < v.spec.maturity ? 3 : 1) * (v.energy < 0.3 ? 2 : 1) * (v.age > v.spec.maxAge * 0.8 ? 2 : 1);
      weights.push(wgt); totalW += wgt;
    }
    var pick = sim.rng.next() * totalW, victim = victims[victims.length - 1];
    for (i = 0; i < victims.length; i++) { pick -= weights[i]; if (pick <= 0) { victim = victims[i]; break; } }

    var meat = victim.spec.meat * (victim.age < victim.spec.maturity ? 0.5 : 1);
    var vx = victim.x, vy = victim.y;
    sim.kill(victim, spec.id);
    var rest = sim.feed(g, meat);
    sim.addCarcass(vx, vy, rest * 0.8);     // Reste fuer Aasfresser
    return true;
  }

  /**
   * Revierkenntnis: hungrige Raeuber ziehen dorthin, wo sich Beute aufhaelt
   * (einige Kandidaten im Revier, der mit der meisten Beute in der Naehe gewinnt).
   */
  function preyRichPoint(sim, g, c, r) {
    var spec = g.spec;
    var best = null, bestScore = -1;
    for (var t = 0; t < 6; t++) {
      var p = randomPointNear(sim, spec, c.x, c.y, r);
      var score = sim.rng.next() * 0.5;
      for (var i = 0; i < sim.herbivoreGroups.length; i++) {
        var h = sim.herbivoreGroups[i];
        var w = spec.prey[h.spec.id];
        if (!w || !h.members.length) continue;
        var d = BT.M.hypot(h.x - p.x, h.y - p.y);
        if (d < 220) score += w * h.members.length * (1 - d / 220);
      }
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  }

  /**
   * Wanderer ohne Revier suchen Artgenossen: Ziel ist die naechste Gruppe der
   * eigenen Art, der ein Geschlecht fehlt, oder ein anderer Wanderer.
   */
  function mateSearchPoint(sim, g) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < sim.predatorGroups.length; i++) {
      var o = sim.predatorGroups[i];
      if (o === g || o.spec !== g.spec || !o.members.length) continue;
      var lacks = !o.home || o.members.length < 2 || o.members.every(function (a) { return a.sex === o.members[0].sex; });
      if (!lacks) continue;
      var d = BT.M.hypot(o.x - g.x, o.y - g.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  /** Zum naechsten Aas gehen und fressen. true, solange damit beschaeftigt. */
  function scavenge(sim, g) {
    var spec = g.spec;
    var best = null, bestD = spec.vision * 0.7;
    for (var i = 0; i < sim.carcasses.length; i++) {
      var c = sim.carcasses[i];
      if (c.meat < 0.25 && BT.M.hypot(c.x - g.x, c.y - g.y) > 40) continue;   // lohnt den Weg nicht
      var d = BT.M.hypot(c.x - g.x, c.y - g.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (!best) return false;
    g.state = 'aas';
    if (bestD < 20) {
      var before = best.meat;
      best.meat = sim.feed(g, Math.min(best.meat, 0.6));
      best.meat += before - Math.min(before, 0.6);
      g.speedNow = 0;
      if (best.meat < 0.05) sim.carcasses.splice(sim.carcasses.indexOf(best), 1);
      return true;
    }
    BT.Move.stepToward(sim.world, spec, g, best.x, best.y, spec.speed * 1.3);
    g.speedNow = spec.speed * 1.3;
    return true;
  }

  function predator(sim, g) {
    var spec = g.spec;
    var energy = avg(g.members, 'energy');
    g.grazing = false;

    if (g.state === 'ruhen') {
      g.speedNow = 0;
      if (g.stateTicks-- > 0) return;
      g.state = 'streifen';
    }

    if (handleThirst(sim, g, spec.speed)) { g.speedNow = spec.speed * 2.5; return; }

    // Jagd laeuft
    if (g.state === 'jagen') {
      var prey = g.prey;
      if (!prey || !prey.members.length || g.stateTicks <= 0 || ++g.stalkTicks > 60) {
        g.state = 'streifen'; g.prey = null; g.cooldown = 6; g.tx = null;
      } else {
        // Anschleichen, solange die Beute noch nichts merkt, dann Sprint
        var close = dist(g, prey) < prey.spec.vision * 0.55 || prey.state === 'fliehen';
        var sp = close ? spec.chaseSpeed : spec.speed * 1.2;
        if (close) g.stateTicks--;
        else g.stateTicks++;           // Anschleichen verbraucht keine Sprintzeit
        BT.Move.stepToward(sim.world, spec, g, prey.x, prey.y, sp);
        g.speedNow = sp;
        if (dist(g, prey) < 30) {
          if (attack(sim, g, prey)) {
            // Satt wird geruht, sonst nach kurzem Fressen weitergejagt
            var full = avg(g.members, 'energy') >= spec.hungry;
            g.state = 'ruhen'; g.stateTicks = full ? sim.ticksPerDay * 2 : 2; g.prey = null; g.tx = null;
          } else {
            // Beute flieht, die Jagd geht weiter, bis die Zeit um ist
            prey.state = 'fliehen'; prey.fleeFrom = { x: g.x, y: g.y }; prey.stateTicks = 5;
          }
        }
        return;
      }
    }

    // Aas in der Naehe? Leichter als jagen.
    if (energy < spec.hungry && scavenge(sim, g)) return;

    // Hungrig? Beute suchen
    if (g.cooldown > 0) g.cooldown--;
    if (energy < spec.hungry && !g.cooldown) {
      var target = findPrey(sim, g);
      if (target) {
        g.state = 'jagen'; g.prey = target; g.stateTicks = spec.maxChaseTicks; g.stalkTicks = 0;
        return;
      }
    }

    // Streifen im Revier oder wandern auf der Suche nach einem. Wer auch
    // Pflanzliches oder Insekten frisst (spec.diet), sucht dabei nebenher Futter.
    g.state = g.home ? 'streifen' : 'wandern';
    if (spec.diet && energy < spec.hungry) g.grazing = true;
    if (g.tx === null || BT.M.hypot(g.tx - g.x, g.ty - g.y) < 20 || g.stateTicks-- <= 0) {
      var c = g.home || g;
      var r = g.home ? spec.territory : spec.territory * 2.5;
      var p;
      if (!g.home) p = mateSearchPoint(sim, g) || randomPointNear(sim, spec, c.x, c.y, r);
      else if (energy < spec.hungry * 1.15) p = preyRichPoint(sim, g, c, r);
      else p = randomPointNear(sim, spec, c.x, c.y, r);
      g.tx = p.x; g.ty = p.y;
      g.stateTicks = 40;
    }
    var sp = energy < spec.hungry ? spec.speed * 1.3 : spec.speed;
    BT.Move.stepToward(sim.world, spec, g, g.tx, g.ty, sp);
    g.speedNow = sp;
  }

  BT.Behavior = {
    herbivore: herbivore,
    predator: predator,
    randomPointNear: randomPointNear,
    COVER: COVER
  };
})(typeof window !== 'undefined' ? window : globalThis);
