/**
 * Nutzung: was der Mensch aus dem Gelaende macht (docs/MENSCH.md).
 *
 * world.biome bleibt die Natur, wie sie generiert wurde (und fuer jeden
 * Neustart gleich). Die Simulation rechnet mit `ground`: einer Kopie davon,
 * in der gerodete, bebaute und nachgewachsene Zellen eigene Codes haben
 * (BT.BIOME.SOIL, VILLAGE, MEADOW). Lebensraum, Deckung und Nahrung kommen
 * aus `ground` (sim.biomeAt, Fields.ground).
 *
 * Rodung: Wald und Busch werden zu nackter Erde. Dort waechst nichts. Nach
 * einigen Jahren (je Zelle verschieden, damit es fleckig gruen wird) wird die
 * Erde zur Wiese. Wald kommt in der Zeit, die man beobachtet, nicht zurueck.
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});
  var B = BT.BIOME;

  BT.LANDUSE = {
    bareYears: 3,           // so lange bleibt gerodete Erde kahl (mindestens) ...
    bareSpread: 2,          // ... plus bis zu so viele Jahre, je Zelle verschieden
    woody: [B.FERN, B.MOSS, B.SCRUB]   // was gerodet wird
  };

  function Landuse(sim) {
    this.sim = sim;
    this.world = sim.world;
    this.ground = new Uint8Array(sim.world.biome.data);
    this.regrow = [];         // gerodete Zellen: { i, day } - wird zur Wiese an `day`
    this.version = 0;         // zaehlt Aenderungen (fuer die Darstellung)
    this.counts = { erde: 0, dorf: 0, wiese: 0, gerodet: 0 };
    var woody = 0, d = sim.world.biome.data;
    for (var i = 0; i < d.length; i++) if (BT.LANDUSE.woody.indexOf(d[i]) >= 0) woody++;
    this.woodyCells = woody;  // Wald und Busch zu Beginn
  }

  /** Lebensraum, mit dem die Tiere rechnen (Natur oder Nutzung). */
  Landuse.prototype.biomeAt = function (x, y) {
    var i = this.world.query.index(x, y);
    return i < 0 ? B.DEEP : this.ground[i];
  };

  /** Ist der Punkt (in Weltkoordinaten) gerodet, bebaut oder nachgewachsen? */
  Landuse.prototype.changed = function (i) { return this.ground[i] !== this.world.biome.data[i]; };

  /** Zellen im Umkreis, deren Mittelpunkt in der (unregelmaessigen) Form liegt. */
  function eachCell(world, cx, cy, radius, shape, fn) {
    var cell = world.cellSize, rc = Math.ceil(radius * 1.3 / cell);
    var gx0 = Math.floor(cx / cell), gy0 = Math.floor(cy / cell);
    for (var gy = gy0 - rc; gy <= gy0 + rc; gy++) {
      for (var gx = gx0 - rc; gx <= gx0 + rc; gx++) {
        if (gx < 0 || gy < 0 || gx >= world.cols || gy >= world.rows) continue;
        var px = (gx + 0.5) * cell - cx, py = (gy + 0.5) * cell - cy;
        var r = radius;
        if (shape) {
          var a = BT.M.atan2(py, px);
          r *= 1 + shape[0] * BT.M.sin(3 * a + shape[1]) + shape[2] * BT.M.sin(5 * a + shape[3]);
        }
        if (px * px + py * py <= r * r) fn(gy * world.cols + gx);
      }
    }
  }

  /** Wie viele Wald- und Buschzellen liegen im Umkreis? */
  Landuse.prototype.woodyAround = function (x, y, radius) {
    var n = 0, g = this.ground, woody = BT.LANDUSE.woody;
    eachCell(this.world, x, y, radius, null, function (i) { if (woody.indexOf(g[i]) >= 0) n++; });
    return n;
  };

  /**
   * Wald und Busch in einer unregelmaessigen Flaeche roden. shape: vier Zahlen
   * fuer die Form des Randes (aus dem Zufall der Menschen). Liefert die Zahl
   * der gerodeten Zellen.
   */
  Landuse.prototype.clear = function (x, y, radius, shape) {
    var self = this, cfg = BT.LANDUSE, day = this.sim.day, n = 0;
    eachCell(this.world, x, y, radius, shape, function (i) {
      if (cfg.woody.indexOf(self.ground[i]) < 0) return;
      self.ground[i] = B.SOIL;
      // je Zelle eine eigene Wartezeit (fester Hash, kein Zufall noetig)
      var h = Math.imul(i ^ (i >>> 7), 2654435761) >>> 0;
      var wait = BT.Time.years(cfg.bareYears) + h % (BT.Time.years(cfg.bareSpread) + 1);
      self.regrow.push({ i: i, day: day + wait });
      n++;
    });
    if (n) this.update();
    return n;
  };

  /** Bebauen: alles Land im Umkreis wird Dorf (Haeuser, Wege, Gaerten). */
  Landuse.prototype.build = function (x, y, radius) {
    var self = this, n = 0;
    eachCell(this.world, x, y, radius, null, function (i) {
      var b = self.ground[i];
      if (!BT.BIOME_INFO[b].land || b === B.VILLAGE) return;
      self.ground[i] = B.VILLAGE;
      n++;
    });
    if (n) {
      // bebaute Erde waechst nicht mehr nach
      var g = this.ground;
      this.regrow = this.regrow.filter(function (r) { return g[r.i] === B.SOIL; });
      this.update();
    }
    return n;
  };

  /** Einmal am Tag: gerodete Erde, deren Zeit gekommen ist, wird Wiese. */
  Landuse.prototype.newDay = function () {
    if (!this.regrow.length) return;
    var day = this.sim.day, g = this.ground, n = 0;
    for (var k = this.regrow.length - 1; k >= 0; k--) {
      var r = this.regrow[k];
      if (r.day > day) continue;
      if (g[r.i] === B.SOIL) { g[r.i] = B.MEADOW; n++; }
      this.regrow.splice(k, 1);
    }
    if (n) this.update();
  };

  /** Nach jeder Aenderung: Nahrung neu berechnen, Flaechen zaehlen. */
  Landuse.prototype.update = function () {
    this.sim.fields.rebuildCapacity();
    var c = { erde: 0, dorf: 0, wiese: 0, gerodet: 0 }, g = this.ground, nat = this.world.biome.data;
    var woody = BT.LANDUSE.woody;
    for (var i = 0; i < g.length; i++) {
      if (g[i] === nat[i]) continue;
      if (g[i] === B.SOIL) c.erde++;
      else if (g[i] === B.VILLAGE) c.dorf++;
      else if (g[i] === B.MEADOW) c.wiese++;
      if (woody.indexOf(nat[i]) >= 0) c.gerodet++;
    }
    this.counts = c;
    this.version++;
  };

  BT.Landuse = Landuse;
})(typeof window !== 'undefined' ? window : globalThis);
