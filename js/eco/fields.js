/**
 * Nahrungsfelder: Gras, Laub, Fruechte, Insekten als Menge je Weidezelle.
 *
 * Eine Weidezelle fasst FIELD_CELLS x FIELD_CELLS Rasterzellen zusammen. Das
 * ist grob genug, um auch Jahrzehnte schnell zu rechnen, und fein genug, dass
 * abgeweidete Flaechen auf der Karte sichtbar werden.
 *
 * Wachstum pro Tag:  v += rate * jahreszeit * (K - v)
 * Es waechst also immer etwas nach (Wurzeln, Samenbank), auch aus 0 - eine
 * Pflanzenschicht kann abgefressen, aber nicht ausgerottet werden.
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});

  var FIELD_CELLS = 4;

  function Fields(world) {
    this.world = world;
    this.step = FIELD_CELLS;
    this.size = world.cellSize * FIELD_CELLS;           // Weltunits je Weidezelle
    this.cols = Math.ceil(world.cols / FIELD_CELLS);
    this.rows = Math.ceil(world.rows / FIELD_CELLS);
    var n = this.cols * this.rows;
    this.capacity = {};
    this.value = {};
    for (var k = 0; k < BT.FOOD_ORDER.length; k++) {
      var key = BT.FOOD_ORDER[k];
      this.capacity[key] = new Float32Array(n);
      this.value[key] = new Float32Array(n);
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

  /**
   * Ein Tag Wachstum und Schwund, abhaengig von Jahreszeit und Jahreswetter.
   * weather: { growth, winter, mast } (siehe eco/weather.js)
   */
  Fields.prototype.grow = function (season, weather) {
    var w = weather || { growth: 1, winter: 1, mast: false };
    for (var k = 0; k < BT.FOOD_ORDER.length; k++) {
      var key = BT.FOOD_ORDER[k];
      var def = BT.FOOD[key];
      var r = def.growth * def.season[season] * w.growth;
      if (season === 3) r /= w.winter;
      var mult = w.mast && def.mast && (season === 1 || season === 2) ? def.mast : 1;
      var decay = def.decay ? def.decay[season] * (season === 3 ? w.winter : 1) : 0;
      var v = this.value[key], K = this.capacity[key];
      for (var i = 0; i < v.length; i++) {
        if (K[i] <= 0) continue;
        if (r > 0) {
          var target = K[i] * mult;
          if (v[i] < target) v[i] += r * (target - v[i]);
        }
        if (decay > 0) v[i] -= v[i] * decay;
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

  BT.Fields = Fields;
})(typeof window !== 'undefined' ? window : globalThis);
