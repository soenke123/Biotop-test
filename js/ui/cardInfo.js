/**
 * Bild fuer das Infofenster einer Karte (Kartenleiste, js/ui/app.js).
 *
 * Gibt es ein Kartenbild, steht es in FILES (assets/karte_<id>.png, wie bei
 * den Menschen in render/humanRenderer.js nur eingetragene Dateien, damit
 * keine fehlende Datei die Konsole fuellt). Bis dahin wird eine kleine Szene
 * gezeichnet: Hintergrund, Symbole und, wo es Tiere zeigt, die Tierbilder.
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});

  // Kartenbilder, sobald es sie gibt, z. B. landung: 'assets/karte_landung.png'
  var FILES = {};
  var images = {};

  // Szenen: ground 'kueste' (Meer links) oder 'land'; Dinge mit x, y (0..1), Groesse (Anteil der Hoehe).
  // sp: Tierbild (Art), sonst e: Symbol. flip: Tier schaut nach links.
  var SCENES = {
    landung: { ground: 'kueste', items: [
      { e: '⛵', x: 0.17, y: 0.52, s: 0.34 }, { e: '🏠', x: 0.56, y: 0.42, s: 0.26 },
      { e: '🧑', x: 0.44, y: 0.66, s: 0.13 }, { e: '🧑', x: 0.5, y: 0.7, s: 0.13 }, { e: '🧑', x: 0.64, y: 0.66, s: 0.13 },
      { sp: 'laufvogel', e: '🐦', x: 0.7, y: 0.78, s: 0.16 }, { sp: 'zwerghirsch', e: '🦌', x: 0.9, y: 0.4, s: 0.2 }] },
    dorf: { ground: 'land', items: [
      { e: '🌳', x: 0.1, y: 0.3, s: 0.3 }, { e: '🌳', x: 0.2, y: 0.55, s: 0.3 }, { e: '🌲', x: 0.08, y: 0.78, s: 0.26 },
      { e: '🪵', x: 0.36, y: 0.5, s: 0.13 }, { e: '🪵', x: 0.42, y: 0.72, s: 0.13 }, { e: '🪓', x: 0.33, y: 0.3, s: 0.14 },
      { e: '🏠', x: 0.62, y: 0.36, s: 0.24 }, { e: '🏡', x: 0.8, y: 0.5, s: 0.24 }, { e: '🏠', x: 0.64, y: 0.72, s: 0.22 },
      { e: '🧑', x: 0.5, y: 0.58, s: 0.12 }] },
    acker: { ground: 'land', field: true, items: [
      { e: '🌾', x: 0.32, y: 0.4, s: 0.16 }, { e: '🌾', x: 0.48, y: 0.45, s: 0.16 }, { e: '🌾', x: 0.4, y: 0.65, s: 0.16 },
      { e: '🌾', x: 0.58, y: 0.66, s: 0.16 }, { e: '🧑‍🌾', x: 0.24, y: 0.62, s: 0.16 }, { e: '🏠', x: 0.88, y: 0.22, s: 0.2 },
      { sp: 'zwerghirsch', e: '🦌', x: 0.78, y: 0.64, s: 0.22, flip: true }] },
    schafe: { ground: 'land', fence: true, items: [
      { e: '🐑', x: 0.34, y: 0.48, s: 0.14 }, { e: '🐑', x: 0.46, y: 0.62, s: 0.14 }, { e: '🐑', x: 0.52, y: 0.42, s: 0.14 },
      { e: '🐑', x: 0.3, y: 0.68, s: 0.14 }, { e: '🐑', x: 0.84, y: 0.74, s: 0.14 },
      { sp: 'inselwolf', e: '🐺', x: 0.86, y: 0.3, s: 0.2, flip: true }, { e: '🏠', x: 0.12, y: 0.2, s: 0.18 }] },
    hunde: { ground: 'land', items: [
      { e: '🏠', x: 0.26, y: 0.36, s: 0.24 }, { e: '🐕', x: 0.42, y: 0.56, s: 0.17 }, { e: '🐕', x: 0.24, y: 0.7, s: 0.17 },
      { e: '🐑', x: 0.56, y: 0.72, s: 0.13 }, { sp: 'inselwolf', e: '🐺', x: 0.88, y: 0.42, s: 0.2, flip: true },
      { sp: 'zwerghirsch', e: '🦌', x: 0.8, y: 0.78, s: 0.2, flip: true }] },
    woelfeJagen: { ground: 'land', items: [
      { e: '🌲', x: 0.1, y: 0.3, s: 0.26 }, { e: '🧍', x: 0.26, y: 0.58, s: 0.22 }, { e: '🏹', x: 0.34, y: 0.56, s: 0.14 },
      { sp: 'inselwolf', e: '🐺', x: 0.68, y: 0.48, s: 0.22, flip: true }, { sp: 'inselwolf', e: '🐺', x: 0.84, y: 0.62, s: 0.2, flip: true },
      { e: '🌲', x: 0.9, y: 0.22, s: 0.24 }] },
    wildJagen: { ground: 'land', items: [
      { e: '🧍', x: 0.24, y: 0.56, s: 0.22 }, { e: '🏹', x: 0.32, y: 0.54, s: 0.14 },
      { sp: 'laufvogel', e: '🐦', x: 0.58, y: 0.62, s: 0.18, flip: true }, { sp: 'laufvogel', e: '🐦', x: 0.7, y: 0.74, s: 0.16, flip: true },
      { sp: 'zwerghirsch', e: '🦌', x: 0.84, y: 0.38, s: 0.22 }, { e: '🌳', x: 0.08, y: 0.24, s: 0.24 }] },
    sammeln: { ground: 'land', items: [
      { e: '🌳', x: 0.22, y: 0.3, s: 0.3 }, { e: '🌳', x: 0.7, y: 0.26, s: 0.28 }, { e: '🫐', x: 0.2, y: 0.36, s: 0.08 },
      { e: '🫐', x: 0.27, y: 0.26, s: 0.08 }, { e: '🫐', x: 0.68, y: 0.32, s: 0.08 }, { e: '🧑', x: 0.42, y: 0.6, s: 0.18 },
      { e: '🧺', x: 0.5, y: 0.7, s: 0.13 }, { sp: 'laufvogel', e: '🐦', x: 0.82, y: 0.68, s: 0.18, flip: true }] },
    ratten: { ground: 'kueste', items: [
      { e: '🚢', x: 0.17, y: 0.5, s: 0.3 }, { e: '🐀', x: 0.46, y: 0.62, s: 0.12 }, { e: '🐀', x: 0.58, y: 0.5, s: 0.12 },
      { e: '🐀', x: 0.66, y: 0.72, s: 0.12 }, { e: '🥚', x: 0.84, y: 0.6, s: 0.1 }, { e: '🪹', x: 0.84, y: 0.66, s: 0.16 }] }
  };

  function ground(ctx, W, H, sc) {
    var sky = ctx.createLinearGradient(0, 0, 0, H * 0.3);
    sky.addColorStop(0, '#9fd3e6'); sky.addColorStop(1, '#cfe8df');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#86b65a';
    ctx.fillRect(0, H * 0.18, W, H);
    if (sc.ground === 'kueste') {
      // Meer links, Strand als Band
      ctx.fillStyle = '#e8d8a4';
      ctx.beginPath(); ctx.moveTo(0, H * 0.18); ctx.lineTo(W * 0.42, H * 0.18);
      ctx.quadraticCurveTo(W * 0.3, H * 0.6, W * 0.4, H); ctx.lineTo(0, H); ctx.fill();
      ctx.fillStyle = '#3f8fb5';
      ctx.beginPath(); ctx.moveTo(0, H * 0.18); ctx.lineTo(W * 0.36, H * 0.18);
      ctx.quadraticCurveTo(W * 0.24, H * 0.6, W * 0.33, H); ctx.lineTo(0, H); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
      for (var k = 0; k < 4; k++) {
        var y = H * (0.32 + k * 0.17), x = W * (0.04 + (k % 2) * 0.1);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + W * 0.03, y - 5, x + W * 0.06, y); ctx.stroke();
      }
    }
    if (sc.field) {
      ctx.fillStyle = '#d9b24a';
      ctx.fillRect(W * 0.18, H * 0.3, W * 0.5, H * 0.52);
      ctx.strokeStyle = 'rgba(120, 80, 30, 0.45)'; ctx.lineWidth = 2;
      for (var f = 1; f < 9; f++) {
        ctx.beginPath(); ctx.moveTo(W * 0.18, H * (0.3 + f * 0.058)); ctx.lineTo(W * 0.68, H * (0.3 + f * 0.058)); ctx.stroke();
      }
    }
    if (sc.fence) {
      ctx.strokeStyle = '#8a6136'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(W * 0.42, H * 0.57, W * 0.22, H * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
      for (var a = 0; a < 16; a++) {
        var t = a / 16 * Math.PI * 2, px = W * 0.42 + Math.cos(t) * W * 0.22, py = H * 0.57 + Math.sin(t) * H * 0.28;
        ctx.beginPath(); ctx.moveTo(px, py - 7); ctx.lineTo(px, py + 3); ctx.stroke();
      }
    }
  }

  function item(ctx, W, H, it) {
    var size = it.s * H, x = it.x * W, y = it.y * H;
    var img = it.sp && BT.Sprites ? BT.Sprites.get(it.sp, 'm', 'stand') : null;
    if (img) {
      var k = size * 1.4 / Math.max(img.width, img.height);
      ctx.save();
      ctx.translate(x, y);
      if (it.flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -img.width * k / 2, -img.height * k / 2, img.width * k, img.height * k);
      ctx.restore();
      return;
    }
    ctx.font = Math.round(size) + 'px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(it.e, x, y);
  }

  /** Bild der Karte in das Canvas zeichnen (Kartenbild oder Szene). */
  function draw(canvas, id) {
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    var file = FILES[id];
    if (file) {
      var img = images[id];
      if (!img) {
        img = images[id] = new global.Image();
        img.onload = function () { draw(canvas, id); };
        img.src = file;
      }
      if (img.complete && img.naturalWidth) {
        var k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        ctx.drawImage(img, (W - img.naturalWidth * k) / 2, (H - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
        return;
      }
    }
    var sc = SCENES[id];
    if (!sc) return;
    ground(ctx, W, H, sc);
    for (var i = 0; i < sc.items.length; i++) item(ctx, W, H, sc.items[i]);
  }

  BT.CardInfo = { draw: draw, FILES: FILES };
})(typeof window !== 'undefined' ? window : globalThis);
