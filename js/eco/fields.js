/**
 * Nahrungsfelder: Gras, Laub, Fruechte, Insekten als Menge je Weidezelle.
 *
 * Eine Weidezelle fasst FIELD_CELLS x FIELD_CELLS Rasterzellen zusammen. Das
 * ist grob genug, um auch Jahrzehnte schnell zu rechnen, und fein genug, dass
 * abgeweidete Flaechen auf der Karte sichtbar werden.
 *
 * Wachstum pro Tag:  v += rate * jahreszeit * (v + seed * K) * (1 - v / K)
 * Pflanzen wachsen aus ihren Blaettern: Halb abgefressen waechst am meisten
 * nach, kahl gefressen fast nichts (nur aus Wurzeln und Samenbank, `seed`).
 *
 * Ueberweidung: Wird eine Zelle immer wieder kahl gefressen, sinkt ihr
 * Pflanzenzustand (health, 0..1). Abgestorbene Pflanzen tragen weniger:
 * K = Kapazitaet * (DEAD + (1 - DEAD) * health). Ohne Fraß erholt sich der
 * Zustand ueber Jahre. Ganz verschwinden kann eine Pflanzenschicht nicht.
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});

  var FIELD_CELLS = 4;
  var DEAD = 0.15;      // so viel traegt eine voellig ueberweidete Zelle noch

  function Fields(world) {
    this.world = world;
    this.step = FIELD_CELLS;
    this.size = world.cellSize * FIELD_CELLS;           // Weltunits je Weidezelle
    this.cols = Math.ceil(world.cols / FIELD_CELLS);
    this.rows = Math.ceil(world.rows / FIELD_CELLS);
    var n = this.cols * this.rows;
    this.capacity = {};
    this.value = {};
    this.health = {};     // Pflanzenzustand je Schicht mit Ueberweidung
    this.bitten = {};     // heute gefressen (fuer die Ueberweidung)
    for (var k = 0; k < BT.FOOD_ORDER.length; k++) {
      var key = BT.FOOD_ORDER[k];
      this.capacity[key] = new Float32Array(n);
      this.value[key] = new Float32Array(n);
      this.bitten[key] = new Float32Array(n);
      if (BT.FOOD[key].damage) this.health[key] = new Float32Array(n).fill(1);
    }
    this.rebuildCapacity();
    // Start: alles voll ausgewachsen
    for (k = 0; k < BT.FOOD_ORDER.length; k++) {
      key = BT.FOOD_ORDER[k];
      this.value[key].set(this.capacity[key]);
    }
  }

  /**
   * Kapazitaet aus den Lebensraeumen berechnen. Wird spaeter nach Rodung,
   * Acker usw. erneut aufgerufen - deshalb eine eigene Funktion.
   */
  Fields.prototype.rebuildCapacity = function () {
    var w = this.world, g = w.biome.data, s = this.step;
    for (var fy = 0; fy < this.rows; fy++) {
      for (var fx = 0; fx < this.cols; fx++) {
        var sums = {}, count = 0;
        for (var k = 0; k < BT.FOOD_ORDER.length; k++) sums[BT.FOOD_ORDER[k]] = 0;
        for (var y = fy * s; y < Math.min(w.rows, fy * s + s); y++) {
          for (var x = fx * s; x < Math.min(w.cols, fx * s + s); x++) {
            var b = g[y * w.cols + x];
            for (k = 0; k < BT.FOOD_ORDER.length; k++) {
              var key = BT.FOOD_ORDER[k];
              sums[key] += BT.FOOD[key].capacity[b];
            }
            count++;
          }
        }
        var i = fy * this.cols + fx;
        for (k = 0; k < BT.FOOD_ORDER.length; k++) {
          key = BT.FOOD_ORDER[k];
          this.capacity[key][i] = sums[key] / count;
          if (this.value[key][i] > this.capacity[key][i]) this.value[key][i] = this.capacity[key][i];
        }
      }
    }
  };

  Fields.prototype.index = function (x, y) {
    var fx = Math.floor(x / this.size), fy = Math.floor(y / this.size);
    if (fx < 0 || fy < 0 || fx >= this.cols || fy >= this.rows) return -1;
    return fy * this.cols + fx;
  };

  Fields.prototype.center = function (i) {
    var fx = i % this.cols, fy = (i - fx) / this.cols;
    return { x: (fx + 0.5) * this.size, y: (fy + 0.5) * this.size };
  };

  /** Zustand, der fuer diese Schicht gilt (eigener oder der einer anderen Schicht), oder null. */
  Fields.prototype.healthFor = function (key) {
    var def = BT.FOOD[key];
    return this.health[def.healthOf || key] || null;
  };

  /** Kapazitaet einer Zelle unter Beruecksichtigung des Pflanzenzustands. */
  Fields.prototype.carrying = function (key, i) {
    var h = this.healthFor(key);
    var K = this.capacity[key][i];
    return h ? K * (DEAD + (1 - DEAD) * h[i]) : K;
  };

  /** Ein Tag: Ueberweidung bzw. Erholung, dann Wachstum. */
  Fields.prototype.grow = function (season) {
    for (var k = 0; k < BT.FOOD_ORDER.length; k++) {
      var key = BT.FOOD_ORDER[k];
      var def = BT.FOOD[key];
      var v = this.value[key], cap = this.capacity[key], bit = this.bitten[key];
      var dmg = def.damage, h = this.health[key];
      if (dmg) {
        var rec = dmg.recover * def.season[season];
        for (var i = 0; i < v.length; i++) {
          if (cap[i] <= 0) continue;
          var Kh = cap[i] * (DEAD + (1 - DEAD) * h[i]);
          if (bit[i] > 0 && v[i] < dmg.below * Kh) h[i] = Math.max(0, h[i] - dmg.loss);
          else if (h[i] < 1) h[i] = Math.min(1, h[i] + rec);
        }
      }
      bit.fill(0);
      var r = def.growth * def.season[season];
      if (r <= 0) continue;
      var hh = this.healthFor(key), seed = def.seed;
      for (i = 0; i < v.length; i++) {
        if (cap[i] <= 0) continue;
        var K = hh ? cap[i] * (DEAD + (1 - DEAD) * hh[i]) : cap[i];
        // ueber der Kapazitaet (Zustand gesunken): Pflanzen sterben ab
        if (v[i] > K) v[i] -= (v[i] - K) * 0.1;
        else v[i] += r * (v[i] + seed * K) * (1 - v[i] / K);
      }
    }
  };

  /** Wie viel Energie bietet diese Zelle einer Art? (Summe ueber ihre Nahrung) */
  Fields.prototype.energyAt = function (i, diet) {
    if (i < 0) return 0;
    var e = 0;
    for (var key in diet) e += this.value[key][i] * diet[key];
    return e;
  };

  /**
   * Fressen: bis zu `amount` Einheiten, ergiebigste Nahrung zuerst.
   * Liefert die gewonnene Energie; das mitgefressene Wasser steht danach in
   * this.lastWater (wie viel Durst es loescht).
   */
  Fields.prototype.eat = function (i, diet, amount) {
    this.lastWater = 0;
    if (i < 0) return 0;
    var gained = 0;
    var keys = Object.keys(diet).sort(function (a, b) { return diet[b] - diet[a]; });
    for (var k = 0; k < keys.length && amount > 0; k++) {
      var v = this.value[keys[k]];
      var take = Math.min(amount, v[i]);
      v[i] -= take;
      this.bitten[keys[k]][i] += take;
      amount -= take;
      gained += take * diet[keys[k]];
      this.lastWater += take * BT.FOOD[keys[k]].water;
    }
    return gained;
  };

  /** Fuellstand je Nahrungsart in Prozent der Kapazitaet (fuer die Statistik). */
  Fields.prototype.levels = function () {
    var out = {};
    for (var k = 0; k < BT.FOOD_ORDER.length; k++) {
      var key = BT.FOOD_ORDER[k];
      var v = this.value[key], K = this.capacity[key], sv = 0, sk = 0;
      for (var i = 0; i < v.length; i++) { sv += v[i]; sk += K[i]; }
      out[key] = sk > 0 ? sv / sk : 0;
    }
    return out;
  };

  /** Mittlerer Pflanzenzustand je Schicht mit Ueberweidung, gewichtet mit der Kapazitaet. */
  Fields.prototype.healthLevels = function () {
    var out = {};
    for (var key in this.health) {
      var h = this.health[key], K = this.capacity[key], sh = 0, sk = 0;
      for (var i = 0; i < h.length; i++) { sh += h[i] * K[i]; sk += K[i]; }
      out[key] = sk > 0 ? sh / sk : 1;
    }
    return out;
  };

  Fields.DEAD = DEAD;
  BT.Fields = Fields;
})(typeof window !== 'undefined' ? window : globalThis);
