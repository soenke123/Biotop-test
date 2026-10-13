/**
 * Kartentabelle: die Eingriffe des Menschen als Daten (docs/MENSCH.md).
 *
 * Aktive Karten waehlt man frei (Lehrkraft oder Lernende), Folgekarten treten
 * von selbst ein. Gespielt wird mit sim.play(id, ort); ausgefuehrt wird beim
 * naechsten Tick, festgehalten in sim.events. So ergibt derselbe Seed mit
 * denselben Karten zur selben Zeit denselben Verlauf.
 *
 *   kind     'start' (Voraussetzung fuer die anderen), 'aktiv', 'folge', 'info'
 *   target   was man auf der Karte anklickt: 'kueste' oder null. Gibt es mehrere
 *            Doerfer, klickt man bei den anderen Karten das Dorf an (sim.cardTarget)
 *   hint     Text, solange auf das Ziel gewartet wird
 *   repeat   darf mehrfach gespielt werden (jede weitere Karte verstaerkt)
 *   more     ausfuehrliche Erklaerung (Infofenster der Kartenleiste). Karten nennen nur, was
 *            die Menschen tun, nicht die Folgen fuer die Tiere: Die sollen die Lernenden selbst
 *            entdecken (Ausnahme: die Rodung beim Dorf)
 *   undo     was beim Zuruecknehmen (−) passiert; die Folgen bleiben
 *   needs    Karte, die vorher gespielt sein muss
 *   soon     noch nicht umgesetzt (wird in der Leiste nur angezeigt)
 *   icon     Symbol (Chronik, Titel des Infofensters; in der Leiste, wenn es kein image gibt)
 *   image    Bild auf der Karte in der Leiste. Das Bild im Infofenster ist ein Ausschnitt
 *            der Inselkarte, assets/karte_<id>.png (erzeugt mit tools/kartenbilder.js)
 *
 * Jede aktive Karte laesst sich zuruecknehmen (sim.unplay): Dann verschwindet,
 * was sie gebracht hat (Haeuser, Acker, Weide, Hunde, Jaeger), aber was schon
 * geschehen ist, bleibt (gerodeter Wald, ausgebuechste Schafe, wilde Hunde).
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
      id: 'landung', kind: 'start', icon: '⛵', image: 'assets/schiff.png',
      name: 'Landung',
      text: 'Ein Schiff mit Siedlern landet an der Küste. Das erste Haus entsteht.',
      target: 'kueste', hint: 'Klicke an die Küste, wo das Schiff landen soll.',
      repeat: true,
      more: 'Ein Schiff bringt fünf Siedler. Sie bauen ein Haus hinter dem Strand und laufen tagsüber in der Umgebung umher. Jede weitere Landung gründet ein neues Dorf an einer anderen Küste.',
      undo: 'Die Siedler verlassen das Dorf mit allem, was dazugehört: Häuser, Äcker, Weiden, Hunde, Jäger und Sammler. Der Dorfplatz wird zu Erde und wächst langsam wieder zu. Gerodeter Wald bleibt Wiese.'
    },
    dorf: {
      id: 'dorf', kind: 'aktiv', icon: '🏘️', image: 'assets/haus_fachwerk.png', needs: 'landung', repeat: true,
      name: 'Dorf vergrößern',
      text: 'Wald am Dorfrand wird gerodet, neue Häuser entstehen. Auf der gerodeten Erde wächst erst nach Jahren wieder etwas.',
      more: 'Die Siedler roden ein Stück Wald neben dem Dorf und bauen zwei neue Häuser mit vier Siedlern. Auf der Rodung bleibt erst nackte Erde, nach drei bis fünf Jahren wächst dort Wiese, aber kein Wald. Weniger Wald heißt weniger Laub, Früchte und Verstecke. Das größere Dorf stört die Tiere in einem größeren Umkreis.',
      undo: 'Die zwei Häuser dieser Karte werden verlassen, ihre Siedler ziehen weg. Die Rodung bleibt: Der Wald kommt nicht zurück.'
    },
    acker: {
      id: 'acker', kind: 'aktiv', icon: '🌾', needs: 'landung', repeat: true,
      name: 'Acker anlegen',
      text: 'Ein Getreidefeld nahe am Dorf. Geerntet wird im Herbst.',
      more: 'Ein Acker entsteht nahe am Dorf, wenn nötig wird dafür Wald gerodet. Im Frühling und Sommer wächst Getreide, im Herbst wird geerntet, danach ist der Acker kahl. Wie die Ernte ausfällt, steht nach jeder Ernte in der Chronik.',
      undo: 'Der Acker wird aufgegeben. Erst ist dort nackte Erde, nach einigen Jahren wächst wieder, was vorher da war (aus Wald wird Wiese).'
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
      id: 'schafe', kind: 'aktiv', icon: '🐑', image: 'assets/schaf/schaf_m_stehend.png', needs: 'landung', repeat: true,
      name: 'Schafweide',
      text: 'Eine eingezäunte Weide mit Schafen nahe am Dorf.',
      more: 'Eine eingezäunte Weide mit zwölf Schafen entsteht auf dem Grasland nahe am Dorf. Die Siedler halten die Herde: Jedes Frühjahr kommen Lämmer.',
      undo: 'Die Weide wird aufgegeben, die Siedler nehmen ihre Schafe mit, der Zaun kommt weg.'
    },
    hunde: {
      id: 'hunde', kind: 'aktiv', icon: '🐕', image: 'assets/hund/hund_f_stehend.png', needs: 'landung', repeat: true,
      name: 'Hütehunde',
      text: 'Hunde bewachen Dorf und Weiden: Wölfe und Hirsche halten mehr Abstand.',
      more: 'Drei Hunde laufen zwischen Dorf und Weiden umher. Wölfe und Hirsche halten mehr Abstand.',
      undo: 'Die drei Hunde dieser Karte kommen weg.'
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
      id: 'woelfeJagen', kind: 'aktiv', icon: '🏹', image: 'assets/doerfler/jagdwolf_2.png', needs: 'landung', repeat: true,
      name: 'Wölfe jagen',
      text: 'Zwei Wolfsjäger ziehen in die Wolfsreviere, zum Schutz von Dorf und Herden.',
      more: 'Zwei Wolfsjäger ziehen immer wieder für einige Tage los, suchen Wolfsrudel und schießen. Beschossene Rudel fliehen weit weg. Was sie erlegt haben, steht jedes Jahr in der Chronik.',
      undo: 'Zwei Wolfsjäger hören auf zu jagen.'
    },
    wildJagen: {
      id: 'wildJagen', kind: 'aktiv', icon: '🍖', image: 'assets/doerfler/jagdwild_2.png', needs: 'landung', repeat: true,
      name: 'Wild jagen',
      text: 'Zwei Jäger erlegen Hirsche und Laufvögel als Nahrung.',
      more: 'Zwei Jäger ziehen immer wieder für einige Tage los und erlegen, was sie zuerst sehen, Hirsche oder Laufvögel. Die Beute tragen sie ins Dorf. Was sie erlegt haben, steht jedes Jahr in der Chronik.',
      undo: 'Zwei Jäger hören auf zu jagen.'
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
      id: 'sammeln', kind: 'aktiv', icon: '🫐', image: 'assets/doerfler/sammeln_2.png', needs: 'landung', repeat: true,
      name: 'Sammeln',
      text: 'Zwei Sammler holen Früchte und Samen, mal nah am Dorf, mal weit draußen.',
      more: 'Zwei Sammler gehen los und pflücken Früchte und Samen, bis ihre Körbe voll sind, mal nah am Dorf, mal weit draußen. Wie viele Körbe sie heimbringen, steht jedes Jahr in der Chronik.',
      undo: 'Zwei Sammler hören auf.'
    },
    ratten: {
      id: 'ratten', kind: 'aktiv', icon: '🐀', image: 'assets/ratten.png', soon: true, needs: 'landung', repeat: true,
      name: 'Ratten an Bord',
      text: 'Mit einem Vorratsschiff kommen Ratten an Land.'
    }
  };

  BT.CARD_ORDER = ['landung', 'dorf', 'acker', 'schafe', 'hunde', 'woelfeJagen', 'wildJagen', 'sammeln', 'ratten'];
})(typeof window !== 'undefined' ? window : globalThis);
