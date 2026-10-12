/**
 * Kartentabelle: die Eingriffe des Menschen als Daten (docs/MENSCH.md).
 *
 * Aktive Karten waehlt man frei (Lehrkraft oder Lernende), Folgekarten treten
 * von selbst ein. Gespielt wird mit sim.play(id, ort); ausgefuehrt wird beim
 * naechsten Tick, festgehalten in sim.events. So ergibt derselbe Seed mit
 * denselben Karten zur selben Zeit denselben Verlauf.
 *
 *   kind     'start' (einmalig, Voraussetzung fuer die anderen), 'aktiv', 'folge'
 *   target   was man auf der Karte anklickt: 'kueste', 'dorf', 'land' oder null
 *   hint     Text, solange auf das Ziel gewartet wird
 *   repeat   darf mehrfach gespielt werden (jede weitere Karte verstaerkt)
 *   needs    Karte, die vorher gespielt sein muss
 *   soon     noch nicht umgesetzt (wird in der Leiste nur angezeigt)
 *   icon     Platzhalter, bis es Kartenbilder gibt
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});

  /**
   * pauseYears: nach jeder Karte so lange warten, bis die naechste aktive
   * Karte gespielt werden darf (in der Oberflaeche einstellbar).
   */
  BT.CARD_RULES = { pauseYears: 2 };

  BT.CARDS = {
    landung: {
      id: 'landung', kind: 'start', icon: '⛵',
      name: 'Landung',
      text: 'Ein Schiff mit Siedlern landet an der Küste. Das erste Haus entsteht.',
      target: 'kueste', hint: 'Klicke an die Küste, wo das Schiff landen soll.',
      repeat: false
    },
    dorf: {
      id: 'dorf', kind: 'aktiv', icon: '🏘️', needs: 'landung', repeat: true,
      name: 'Dorf vergrößern',
      text: 'Wald am Dorfrand wird gerodet, neue Häuser entstehen. Auf der gerodeten Erde wächst erst nach Jahren wieder etwas.'
    },
    acker: {
      id: 'acker', kind: 'aktiv', icon: '🌾', needs: 'landung', repeat: true,
      name: 'Acker anlegen',
      text: 'Ein Getreidefeld nahe am Dorf. Geerntet wird im Herbst. Hirsche finden das Getreide auch lecker.'
    },
    // Meldungen, die von selbst entstehen (nur Chronik, keine Marke im Diagramm)
    ernte: {
      id: 'ernte', kind: 'info', icon: '🧺',
      name: 'Ernte',
      text: 'Die Siedler bringen die Ernte ein.'
    },
    // Folgekarte: tritt von selbst ein (Marke im Diagramm)
    wildschaden: {
      id: 'wildschaden', kind: 'folge', icon: '🦌',
      name: 'Hirsche im Acker',
      text: 'Mindestens ein Viertel des Getreides haben Tiere gefressen, bevor geerntet wurde.'
    },
    schafe: {
      id: 'schafe', kind: 'aktiv', icon: '🐑', soon: true, needs: 'landung', repeat: true,
      name: 'Schafweide',
      text: 'Eine Weide mit Schafen. Wölfe lieben Schafe, und Schafe können ausbüchsen.'
    },
    hunde: {
      id: 'hunde', kind: 'aktiv', icon: '🐕', soon: true, needs: 'landung', repeat: true,
      name: 'Hütehunde',
      text: 'Hunde halten Wölfe und Hirsche fern. Aber Hunde können verwildern.'
    },
    woelfeJagen: {
      id: 'woelfeJagen', kind: 'aktiv', icon: '🏹', soon: true, needs: 'landung', repeat: true,
      name: 'Wölfe jagen',
      text: 'Jäger ziehen in die Wolfsreviere, zum Schutz von Dorf und Herden.'
    },
    wildJagen: {
      id: 'wildJagen', kind: 'aktiv', icon: '🍖', soon: true, needs: 'landung', repeat: true,
      name: 'Wild jagen',
      text: 'Hirsche und Laufvögel werden als Nahrung gejagt.'
    },
    sammeln: {
      id: 'sammeln', kind: 'aktiv', icon: '🧺', soon: true, needs: 'landung', repeat: true,
      name: 'Sammeln',
      text: 'Siedler sammeln Früchte und Samen rund ums Dorf.'
    },
    ratten: {
      id: 'ratten', kind: 'aktiv', icon: '🐀', soon: true, needs: 'landung', repeat: true,
      name: 'Ratten an Bord',
      text: 'Mit einem Vorratsschiff kommen Ratten an Land. Sie fressen Eier, Samen und Küken.'
    }
  };

  BT.CARD_ORDER = ['landung', 'dorf', 'acker', 'schafe', 'hunde', 'woelfeJagen', 'wildJagen', 'sammeln', 'ratten'];
})(typeof window !== 'undefined' ? window : globalThis);
