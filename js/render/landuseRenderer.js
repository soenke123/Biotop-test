/**
 * Nutzung auf der Karte: gerodete Erde (mit Baumstuempfen), Dorfplatz und die
 * Wiese, die auf gerodetem Land nachwaechst.
 *
 * Das Gelaende im Bildpuffer bleibt die Natur. Die Nutzung liegt als eigene
 * Schicht darueber: geglaettete Umrisse aus dem Raster (wie die Lebensraeume,
 * core/contour.js), neu gebaut nur, wenn sich die Nutzung aendert
 * (sim.landuse.version). Reine Darstellung.
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});
  var B = BT.BIOME;

  // Reihenfolge = Zeichenreihenfolge
  var LAYERS = [
    { code: B.MEADOW, key: 'wiese' },
    { code: B.SOIL, key: 'erde' },
    { code: B.VILLAGE, key: 'dorf' }
  ];

  var cache = null;

  function build(sim) {
    var world = sim.world, lu = sim.landuse, g = lu.ground, nat = world.biome.data;
    var n = g.length, cols = world.cols, rows = world.rows, cell = world.cellSize;
    var noise = new BT.Noise(new BT.Rng(world.seed).fork('nutzung').seed);
    var layers = [], stumps = [], tufts = [];
    for (var k = 0; k < LAYERS.length; k++) {
      var mask = new Uint8Array(n), any = false;
      for (var i = 0; i < n; i++) {
        if (g[i] === LAYERS[k].code && g[i] !== nat[i]) { mask[i] = 1; any = true; }
      }
      if (!any) continue;
      var polys = BT.Contour.polygonsFromMask(mask, cols, rows, {
        cellSize: cell, smoothing: 3, minArea: cell * cell * 2,
        noise: noise, noiseAmp: cell * 0.5, noiseScale: 0.03
      });
      layers.push({ key: LAYERS[k].key, path: BT.Contour.toPath(polys) });
    }
    // Streudetails mit festem Hash je Zelle: Stuempfe auf der Erde, Grasbueschel auf der Wiese
    for (i = 0; i < n; i++) {
      if (g[i] === nat[i]) continue;
      var h = Math.imul(i ^ (i >>> 9), 2246822519) >>> 0;
      var x = (i % cols + 0.2 + (h & 255) / 255 * 0.6) * cell;
      var y = (Math.floor(i / cols) + 0.2 + ((h >>> 8) & 255) / 255 * 0.6) * cell;
      if (g[i] === B.SOIL && BT.LANDUSE.woody.indexOf(nat[i]) >= 0 && h % 7 === 0) stumps.push({ x: x, y: y, r: 1.6 + (h >>> 16) % 3 * 0.5 });
      else if (g[i] === B.MEADOW && h % 4 === 0) tufts.push({ x: x, y: y });
    }
    return { sim: sim, version: lu.version, layers: layers, stumps: stumps, tufts: tufts };
  }

  /** @param ctx  auf Weltkoordinaten transformiert */
  function draw(ctx, sim, view, scale) {
    if (!sim || !sim.landuse.version || typeof Path2D === 'undefined') return;
    if (!cache || cache.sim !== sim || cache.version !== sim.landuse.version) cache = build(sim);
    var P = BT.PALETTE;
    for (var k = 0; k < cache.layers.length; k++) {
      var l = cache.layers[k], c = P[l.key];
      ctx.fillStyle = c.base;
      ctx.fill(l.path, 'evenodd');
      // dunkler Saum innen am Rand
      ctx.save();
      ctx.clip(l.path, 'evenodd');
      ctx.strokeStyle = c.band;
      ctx.lineWidth = 10;
      ctx.stroke(l.path);
      ctx.restore();
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = Math.max(1, 1.2 / scale);
      ctx.stroke(l.path);
    }
    if (scale < 0.3) return;
    var pad = 10;
    ctx.fillStyle = P.wiese.tuft;
    for (var i = 0; i < cache.tufts.length; i++) {
      var t = cache.tufts[i];
      if (!BT.TerrainRenderer.inView(t, view, pad)) continue;
      ctx.fillRect(t.x - 1.5, t.y - 0.6, 3, 1.2);
      ctx.fillRect(t.x - 0.6, t.y - 1.8, 1.2, 2.4);
    }
    for (i = 0; i < cache.stumps.length; i++) {
      var s = cache.stumps[i];
      if (!BT.TerrainRenderer.inView(s, view, pad)) continue;
      ctx.fillStyle = P.erde.stump;
      ctx.beginPath(); ctx.arc(s.x, s.y + 0.5, s.r * 1.15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.erde.stumpTop;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.75, 0, Math.PI * 2); ctx.fill();
    }
  }

  BT.LanduseRenderer = { draw: draw };
})(typeof window !== 'undefined' ? window : globalThis);
