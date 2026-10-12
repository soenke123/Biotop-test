/**
 * Tierbilder laden. Je Art gibt es Bilder fuer Weibchen, Maennchen und
 * Jungtier (f, m, j) in mehreren Haltungen (spec.sprites). Ohne Bild (noch
 * nicht geladen, Datei fehlt) zeichnet der Renderer einen farbigen Punkt -
 * das Programm haengt nie an den Grafiken.
 *
 * Unter file:// laedt ein <img> problemlos; das Canvas wird dadurch "tainted",
 * was nichts ausmacht, weil nirgends Pixel zurueckgelesen werden.
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});
  var images = {};
  var KINDS = ['f', 'm', 'j'];

  function key(id, kind, pose) { return id + '_' + kind + '_' + pose; }

  BT.Sprites = {
    preload: function (onLoad) {
      if (typeof global.Image === 'undefined') return;
      BT.SPECIES_ORDER.forEach(function (id) {
        var sp = BT.SPECIES[id].sprites;
        if (!sp) return;
        KINDS.forEach(function (kind) {
          for (var pose in sp.poses) load(key(id, kind, pose), 'assets/' + sp.name + '_' + kind + '_' + sp.poses[pose] + '.png');
        });
      });
      function load(k, src) {
        if (images[k] !== undefined) return;
        images[k] = null;
        var img = new global.Image();
        img.onload = function () { images[k] = img; if (onLoad) onLoad(k); };
        img.src = src;
      }
    },

    /**
     * Bild fuer ein Tier. kind: 'f', 'm' oder 'j'; pose: move, stand, eat, rest.
     * Fehlt die Haltung, wird `move` genommen.
     */
    get: function (id, kind, pose) {
      return images[key(id, kind, pose)] || images[key(id, kind, 'move')] || null;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
