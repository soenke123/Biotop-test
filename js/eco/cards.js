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
      id: 'schafe', kind: 'aktiv', icon: '🐑', needs: 'landung', repeat: true,
      name: 'Schafweide',
      text: 'Eine eingezäunte Weide mit Schafen nahe am Dorf. Die Schafe fressen das Gras kurz. Nach einigen Jahren büchsen Schafe aus.'
    },
    hunde: {
      id: 'hunde', kind: 'aktiv', icon: '🐕', needs: 'landung', repeat: true,
      name: 'Hütehunde',
      text: 'Hunde bewachen Dorf und Weiden: Wölfe und Hirsche halten mehr Abstand. Nach einigen Jahren verwildern Hunde und bringen eine Krankheit zu den Wölfen.'
    },
    // Folgekarten der Schafe und Hunde (eco/humans.js, etwa 4 Jahre nach der Karte, je Karte einmal)
    schafeAus: {
      id: 'schafeAus', kind: 'folge', icon: '🐑',
      name: 'Schafe brechen aus',
      text: 'Schafe sind aus der Weide entwischt und weit weggelaufen. Sie leben jetzt wild auf der Insel.'
    },
    hundeWild: {
      id: 'hundeWild', kind: 'folge', icon: '🐕',
      name: 'Hunde verwildern',
      text: 'Hunde sind verwildert: Sie laufen weit weg und gründen ein Rudel oder schließen sich einem wilden an. Sie leben wie Wölfe, aber die Laufvögel kennen sie nicht, und sie tragen eine Krankheit, an der Wölfe sterben.'
    },
    // Folgekarte: Woelfe stecken sich bei verwilderten Hunden an (spec.disease, eco/simulation.js)
    krankheit: {
      id: 'krankheit', kind: 'folge', icon: '🦠',
      name: 'Wölfe erkranken',
      text: 'Die verwilderten Hunde tragen Staupe. Wölfe in ihrer Nähe stecken sich an, werden schwach und sterben oft daran.'
    },
    woelfeJagen: {
      id: 'woelfeJagen', kind: 'aktiv', icon: '🏹', needs: 'landung', repeat: true,
      name: 'Wölfe jagen',
      text: 'Zwei Wolfsjäger ziehen in die Wolfsreviere, zum Schutz von Dorf und Herden. Greifen Wölfe sie an, gewinnen meist die Jäger.'
    },
    wildJagen: {
      id: 'wildJagen', kind: 'aktiv', icon: '🍖', needs: 'landung', repeat: true,
      name: 'Wild jagen',
      text: 'Zwei Jäger erlegen Hirsche und Laufvögel als Nahrung. Die Laufvögel fliehen nicht. Hungrige Wölfe greifen die Jäger manchmal an.'
    },
    // Folgen der Jagd (eco/humans.js)
    jagdbilanz: {
      id: 'jagdbilanz', kind: 'info', icon: '🎯',
      name: 'Jagdbilanz',
      text: 'Was die Jäger im letzten Jahr erlegt haben.'
    },
    jaegerTot: {
      id: 'jaegerTot', kind: 'folge', icon: '🐺',
      name: 'Wölfe töten einen Menschen',
      text: 'Hungrige Wölfe haben einen Jäger oder Sammler angegriffen und getötet. Im Frühling kommt ein neuer.'
    },
    sammelbilanz: {
      id: 'sammelbilanz', kind: 'info', icon: '🫐',
      name: 'Sammelbilanz',
      text: 'Was die Sammler im letzten Jahr heimgebracht haben.'
    },
    sammeln: {
      id: 'sammeln', kind: 'aktiv', icon: '🫐', needs: 'landung', repeat: true,
      name: 'Sammeln',
      text: 'Zwei Sammler holen Früchte und Samen, mal nah am Dorf, mal weit draußen. Die fehlen dann den Laufvögeln. Hungrige Wölfe greifen auch Sammler an.'
    },
    ratten: {
      id: 'ratten', kind: 'aktiv', icon: '🐀', soon: true, needs: 'landung', repeat: true,
      name: 'Ratten an Bord',
      text: 'Mit einem Vorratsschiff kommen Ratten an Land. Sie fressen Eier, Samen und Küken.'
    }
  };

  BT.CARD_ORDER = ['landung', 'dorf', 'acker', 'schafe', 'hunde', 'woelfeJagen', 'wildJagen', 'sammeln', 'ratten'];
})(typeof window !== 'undefined' ? window : globalThis);
