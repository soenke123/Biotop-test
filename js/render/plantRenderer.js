/**
 * Weidezustand auf der Karte: eine Schicht ueber dem Gelaende, die zeigt, wo
 * Pflanzen abgefressen sind und wo sie durch Ueberweidung abgestorben sind.
 *
 *   abgefressen   Gras und Laub unter ihrem Hoechststand -> strohfarben, trocken
 *   ueberweidet   Pflanzenzustand gesunken -> offener, brauner Boden
 *
 * Ein Bildpunkt je Weidezelle, weich vergroessert und auf die Insel
 * beschnitten. Neu berechnet wird nur, wenn ein neuer Tag beginnt.
 * Reine Darstellung - liest sim.fields, veraendert nichts.
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});

  var KEYS = ['gras', 'laub'];
  var DRY = [205, 178, 104];     // abgefressen: Stroh
  var BARE = [112, 74, 42];     // ueberweidet: offener Boden
  var FULL_CAP = 4;             // ab dieser Pflanzenmenge je Zelle volle Deckkraft

  var UP = 4;                   // Vergroesserung des weichgezeichneten Puffers

  function build(sim, cache) {
    var f = sim.fields, doc = global.document;
    var c = cache && cache.small, big = cache && cache.canvas;
    if (!c || c.width !== f.cols || c.height !== f.rows) {
      c = doc.createElement('canvas');
      c.width = f.cols; c.height = f.rows;
      big = doc.createElement('canvas');
      big.width = f.cols * UP; big.height = f.rows * UP;
    }
    var cx = c.getContext('2d');
    var img = cx.createImageData(f.cols, f.rows);
    var d = img.data, n = f.cols * f.rows;
    for (var i = 0; i < n; i++) {
      var cap = 0, val = 0, lost = 0;
      for (var k = 0; k < KEYS.length; k++) {
        var key = KEYS[k], K = f.capacity[key][i];
        if (K <= 0) continue;
        cap += K;
        val += f.value[key][i];
        var h = f.health[key];
        if (h) lost += K * (1 - h[i]);
      }
      if (cap < 0.3) continue;
      var eaten = Math.max(0, 1 - val / cap);   // 0 = voll, 1 = kahl
      var dead = lost / cap;                     // 0 = gesund, 1 = abgestorben
      var weight = Math.min(1, cap / FULL_CAP);
      // Abgefressen ist nur ein Hauch (im Winter ist ohnehin wenig da),
      // abgestorbene Pflanzen dagegen deutlich: offener Boden
      var e = Math.max(0, eaten - 0.5) / 0.5;
      var a = weight * Math.min(1, 0.4 * e + 1.6 * dead);
      if (a < 0.02) continue;
      var t = Math.min(1, 2.5 * dead / (2.5 * dead + 0.4 * e + 0.001));
      var o = i * 4;
      d[o] = Math.round(DRY[0] + (BARE[0] - DRY[0]) * t);
      d[o + 1] = Math.round(DRY[1] + (BARE[1] - DRY[1]) * t);
      d[o + 2] = Math.round(DRY[2] + (BARE[2] - DRY[2]) * t);
      d[o + 3] = Math.round(a * 255);
    }
    cx.putImageData(img, 0, 0);
    // Weich vergroessern, damit keine Weidezellen-Kanten zu sehen sind
    // (filter fehlt in manchen Browsern - dann bleibt es bei der Glaettung)
    var bx = big.getContext('2d');
    bx.clearRect(0, 0, big.width, big.height);
    bx.imageSmoothingEnabled = true;
    bx.filter = 'blur(' + UP * 0.6 + 'px)';
    bx.drawImage(c, 0, 0, big.width, big.height);
    bx.filter = 'none';
    return { small: c, canvas: big, day: sim.day, sim: sim };
  }

  var cache = null;

  /** @param ctx  auf Weltkoordinaten transformiert */
  function draw(ctx, world, sim) {
    if (!sim || typeof Path2D === 'undefined') return;
    if (!cache || cache.sim !== sim || cache.day !== sim.day) cache = build(sim, cache);
    var f = sim.fields;
    var island = BT.Shapes.build(world).island.path;
    ctx.save();
    if (island) ctx.clip(island, 'evenodd');
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(cache.canvas, 0, 0, f.cols * f.size, f.rows * f.size);
    ctx.restore();
  }

  BT.PlantRenderer = { draw: draw, DRY: DRY, BARE: BARE };
})(typeof window !== 'undefined' ? window : globalThis);
