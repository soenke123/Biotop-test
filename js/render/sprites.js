/**
 * Tierbilder laden. Ohne Bild (noch nicht geladen, Datei fehlt) zeichnet der
 * Renderer einen farbigen Punkt - das Programm haengt nie an den Grafiken.
 *
 * Unter file:// laedt ein <img> problemlos; das Canvas wird dadurch "tainted",
 * was nichts ausmacht, weil nirgends Pixel zurueckgelesen werden.
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});
  var images = {};

  BT.Sprites = {
    preload: function (onLoad) {
      if (typeof global.Image === 'undefined') return;
      BT.SPECIES_ORDER.forEach(function (id) {
        var spec = BT.SPECIES[id];
        if (!spec.sprite || images[id] !== undefined) return;
        images[id] = null;
        var img = new global.Image();
        img.onload = function () { images[id] = img; if (onLoad) onLoad(id); };
        img.src = spec.sprite;
      });
    },
    get: function (id) { return images[id] || null; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
