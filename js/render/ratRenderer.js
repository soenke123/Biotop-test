/**
 * Zeichnet die Ratten (eco/rats.js). Ratten sind ein Feld (Anzahl je
 * Weidezelle), keine einzelnen Tiere: Je Zelle werden so viele Rattengruppen
 * (assets/ratten.png, drei Ratten im Bild) gestreut, wie es der Dichte
 * entspricht. Lage und Spiegelung haengen fest an Zelle und Nummer, dazu
 * wuseln die Gruppen ein wenig hin und her. Reine Darstellung, die Simulation
 * bleibt gleich.
 *
 * Aus der Ferne (kleiner Zoom) nur eine Gruppe je Zelle, sonst wird die Insel
 * zum Teppich. Hervorgehoben (opts.highlight === 'ratten') bekommen die Gruppen
 * einen farbigen Ring.
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});

  var SIZE = 10;        // Breite einer Rattengruppe in Weltunits
  var MIN_PX = 6;       // Mindestbreite auf dem Bildschirm
  var PER = 4;          // so viele Ratten je gezeichneter Gruppe
  var MAX = 4;          // hoechstens so viele Gruppen je Zelle
  var FAR = 0.9;        // unter diesem Zoom (Pixel je Weltunit) nur eine Gruppe je Zelle

  var img = null, loading = false;

  /** Das Bild der Rattengruppe (null, solange es laedt); onLoad wird gerufen, wenn es da ist. */
  function image(onLoad) {
    if (img || loading || typeof global.Image === 'undefined') return img;
    loading = true;
    var i = new global.Image();
    i.onload = function () { img = i; if (BT.app) BT.app.redraw(); if (onLoad) onLoad(); };
    i.src = 'assets/ratten.png';
    return null;
  }

  /** Fester Zufallswert 0..1 je Zelle und Nummer. */
  function hash(i, k, salt) {
    var h = Math.imul(i * 8 + k + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }

  function draw(ctx, sim, view, scale, alpha, opts) {
    var R = sim && sim.rats;
    if (!R || !R.total) return;
    var pic = image();
    var f = sim.fields, size = Math.max(SIZE, MIN_PX / scale), far = scale < FAR;
    var h = pic ? size * pic.height / pic.width : size * 0.7;
    var hl = opts && opts.highlight === 'ratten', ring = [];
    var t = (sim.tick + (alpha || 0)) * 0.35;
    var x0 = Math.max(0, Math.floor((view.x - size) / f.size)), x1 = Math.min(f.cols - 1, Math.floor((view.x + view.width + size) / f.size));
    var y0 = Math.max(0, Math.floor((view.y - size) / f.size)), y1 = Math.min(f.rows - 1, Math.floor((view.y + view.height + size) / f.size));
    var q = sim.world.query;
    for (var cy = y0; cy <= y1; cy++) {
      for (var cx = x0; cx <= x1; cx++) {
        var i = cy * f.cols + cx, n = R.n[i];
        if (n < 1) continue;
        var groups = far ? (n >= 2 ? 1 : 0) : Math.min(MAX, Math.ceil(n / PER));
        for (var k = 0; k < groups; k++) {
          var ph = hash(i, k, 3) * 6.283;
          var x = (cx + 0.15 + 0.7 * hash(i, k, 1)) * f.size + Math.sin(t + ph) * 2.5;
          var y = (cy + 0.15 + 0.7 * hash(i, k, 2)) * f.size + Math.cos(t * 0.8 + ph) * 1.5;
          if (BT.isBlocked(q.biomeAt(x, y), null)) continue;
          // wenige Ratten: blasser (die Gruppe steht fuer weniger als PER)
          ctx.globalAlpha = far ? Math.min(1, 0.35 + n / 12) : Math.min(1, 0.45 + 0.55 * (n - k * PER) / PER);
          if (pic) {
            ctx.save();
            ctx.translate(x, y);
            if (hash(i, k, 4) < 0.5) ctx.scale(-1, 1);
            ctx.drawImage(pic, -size / 2, -h / 2, size, h);
            ctx.restore();
          } else {
            ctx.fillStyle = '#7a6a58';
            ctx.beginPath(); ctx.ellipse(x, y, size * 0.4, size * 0.25, 0, 0, Math.PI * 2); ctx.fill();
          }
          if (hl) ring.push(x, y);
        }
      }
    }
    ctx.globalAlpha = 1;
    if (ring.length) {
      var r = size * 0.65;
      ctx.beginPath();
      for (var j = 0; j < ring.length; j += 2) { ctx.moveTo(ring[j] + r, ring[j + 1]); ctx.arc(ring[j], ring[j + 1], r, 0, Math.PI * 2); }
      ctx.strokeStyle = opts.highlightColor || '#ffffff';
      ctx.lineWidth = Math.max(2 / scale, 1);
      ctx.stroke();
    }
  }

  BT.RatRenderer = { draw: draw, image: image };
})(typeof window !== 'undefined' ? window : globalThis);
