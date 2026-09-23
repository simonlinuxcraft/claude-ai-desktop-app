// Gemeinsame Quelle fuer das statische OLED-Stylesheet. Reine Funktion des Theme-States
// (nur st.accent), keine DOM-Zugriffe. Genutzt von main.js (fuettert das document-start-
// Preload per IPC) UND vom injizierten Controller (inject/theme.js). Eine Quelle, damit
// Preload und Controller nicht auseinanderlaufen.
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.cdThemeStatic = api;
})(this, function () {
  function sparkUse(x, y, sc, op) {
    return "<use href='#s' transform='translate(" + x + "," + y + ") scale(" + sc + ")' opacity='" + op + "'/>";
  }
  function sparkleBg(st) {
    var ac = (st && st.accent) || {}, f = ac.from || '#F26A3F', t = ac.to || '#E83B6E';
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='620' height='620' viewBox='0 0 620 620'>"
      + "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='" + f + "'/><stop offset='1' stop-color='" + t + "'/></linearGradient>"
      + "<path id='s' d='M0,-1 L.2245,-.309 L.951,-.309 L.363,.118 L.588,.809 L0,.382 L-.588,.809 L-.363,.118 L-.951,-.309 L-.2245,-.309 Z'/></defs>"
      + "<g fill='url(#g)'>"
      + sparkUse(110, 140, 11, .3) + sparkUse(430, 95, 7, .2) + sparkUse(540, 400, 9, .26)
      + sparkUse(230, 500, 6, .18) + sparkUse(580, 580, 5, .16) + sparkUse(300, 280, 8, .22)
      + "</g></svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  // Pendant zum Sternenfeld, fuer Mitternachtsblau: verteilte Wellen-Glyphen statt
  // durchgezogener Linien. Eine Linie ueber die volle Breite reisst sichtbar ab, sobald
  // claude.ai irgendwo eine deckende Flaeche darueberlegt; ein einzelnes Motiv kann nicht
  // "kaputt" aussehen. Abstand zum Kachelrand, damit beim Kacheln nichts angeschnitten wird.
  // Wellenkamm mit eingerolltem Scheitel, wie das klassische Wellenzeichen: flacher Anstieg
  // von der Grundlinie, dann gut eine Umdrehung Spirale nach innen. Die Spirale wird als
  // Polylinie gerechnet statt von Hand als Bezier gelegt, sonst stimmen die Windungen nicht.
  function crestPath() {
    var cx = 0.20, cy = -0.14, r = 0.38, a = -Math.PI / 2;
    var d = 'M-1.25,0.44 C-0.70,0.54 -0.60,-0.40 ' + cx.toFixed(2) + ',' + (cy - r).toFixed(2);
    for (var i = 0; i < 22; i++) {
      a -= 0.42;
      r *= 0.90;
      d += ' L' + (cx + r * Math.cos(a)).toFixed(3) + ',' + (cy + r * Math.sin(a)).toFixed(3);
    }
    return d;
  }

  function waveUse(x, y, sc, op) {
    return "<use href='#w' transform='translate(" + x + "," + y + ") scale(" + sc + ")' opacity='" + op + "'/>";
  }
  // Zeichenregen fuer das Matrix-Theme. Spalten mit hellem Kopf, nach unten in den
  // dunkleren Ton auslaufend. Feste Koordinaten (kein Zufall), damit das Sheet
  // deterministisch bleibt. Kurze Spalten statt durchgehender Bahnen: eine Bahn ueber die
  // volle Kachelhoehe reisst sichtbar ab, sobald claude.ai eine deckende Flaeche darueberlegt.
  function rainBg() {
    var KOPF = '#247F3B', SCHWEIF = '#185427';
    // x, y, Laenge. Unregelmaessige Abstaende, damit das Kacheln nicht als Raster auffaellt.
    var spalten = [
      [14, 30, 9], [40, 300, 7], [72, 150, 11], [96, 470, 6], [128, 60, 8],
      [150, 350, 10], [182, 210, 7], [206, 520, 9], [238, 90, 6], [262, 390, 11],
      [292, 250, 8], [316, 20, 10], [348, 440, 7], [372, 170, 9], [404, 330, 6],
      [428, 80, 11], [458, 500, 8], [482, 230, 7], [512, 130, 10], [536, 410, 9],
      [566, 40, 7], [590, 290, 11], [28, 560, 5], [110, 580, 6], [340, 570, 5],
      [470, 590, 5], [604, 470, 6], [220, 600, 4]
    ];
    var ZEICHEN = '01A7F3X9E2C8Z4B6Y5D1N0M3K7';
    var g = '', k = 0;
    for (var i = 0; i < spalten.length; i++) {
      var x = spalten[i][0], y0 = spalten[i][1], n = spalten[i][2];
      for (var j = 0; j < n; j++) {
        var t = j / n;
        var farbe = j === 0 ? KOPF : SCHWEIF;
        var op = (0.8 * (1 - t * 0.8)).toFixed(3);
        var y = y0 + j * 14;
        if (y > 616) break;
        g += "<text x='" + x + "' y='" + y + "' fill='" + farbe + "' opacity='" + op + "'>"
          + ZEICHEN.charAt(k++ % ZEICHEN.length) + "</text>";
      }
    }
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='620' height='620' viewBox='0 0 620 620'>"
      + "<g font-family='ui-monospace,monospace' font-size='11'>" + g + "</g></svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  function wavesBg(st) {
    var ac = (st && st.accent) || {}, f = ac.from || '#2F7FFF', t = ac.to || '#00E5FF';
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='620' height='620' viewBox='0 0 620 620'>"
      + "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='" + f + "'/><stop offset='1' stop-color='" + t + "'/></linearGradient>"
      + "<path id='w' d='" + crestPath() + "' fill='none' stroke-width='0.13' stroke-linecap='round' stroke-linejoin='round'/></defs>"
      + "<g stroke='url(#g)' fill='none'>"
      + waveUse(120, 130, 26, .24) + waveUse(430, 95, 17, .16) + waveUse(515, 370, 23, .20)
      + waveUse(215, 470, 15, .14) + waveUse(330, 265, 20, .18) + waveUse(95, 335, 13, .12)
      + waveUse(545, 545, 14, .13)
      + "</g></svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  function buildStaticCSS(st) {
    var BG = '#050306', BG_HI = '#120f12';
    // OLED: Flaechen liegen alle unter 1.2:1 Kontrast -> auf near-black crush unsichtbar.
    // Trennung laeuft daher ueber 1px-Hairlines (Kante triggert, nicht Flaechenhelligkeit).
    var MENU_EDGE = 'rgba(232,82,79,0.12)', HAIR_DIM = 'rgba(255,255,255,0.07)', FOCUS = 'rgba(232,82,79,0.45)';
    var O = 'html[data-cd-theme="oled"][data-cd-surface="dark"]';
    var W = 'html[data-cd-theme="light"]';
    var SPARK = sparkleBg(st);

    // Mitternachtsblau. Die drei Stufen entsprechen bg/bgHover/bgActive des THEME-Objekts
    // in main.js, damit App-Fenster und Seite dieselbe Treppe zeigen. Kanten und Fokus in
    // kuehlem Blau; der Fokus-Ring nimmt das Neon-Cyan des Theme-Akzents auf.
    var MBG = '#070c18', MBG_HI = '#0d1526', MBG_TOP = '#151f36';
    var M_EDGE = 'rgba(47,127,255,0.20)', M_HAIR = 'rgba(138,154,181,0.20)', M_FOCUS = 'rgba(0,229,255,0.55)';
    var M = 'html[data-cd-theme="midnight"][data-cd-surface="dark"]';
    var WAVES = wavesBg(st);

    // Matrix. Wie Mitternachtsblau aufgebaut, nur auf gruenstichigem Fast-Schwarz. Der
    // Zeichenregen ist die Signatur dieses Themes, so wie das Sternenfeld die von OLED ist.
    var XBG = '#040806', XBG_HI = '#0b1610', XBG_TOP = '#122017';
    var X_EDGE = 'rgba(56,199,92,0.20)', X_HAIR = 'rgba(36,127,59,0.28)', X_FOCUS = 'rgba(56,199,92,0.55)';
    var X = 'html[data-cd-theme="matrix"][data-cd-surface="dark"]';
    var RAIN = rainBg();
    // Verlaufsring um die Composer-Karte, animiert. Selektor davor setzen.
    var D = 'html[data-cd-design="modern"]';
    var RING = '{content:"";position:absolute;inset:-2px;border-radius:var(--cd-composer-radius,14px);padding:2px;background:linear-gradient(135deg,var(--cd-accent-from),var(--cd-accent-to),var(--cd-accent-from),var(--cd-accent-to));background-size:300% 300%;animation:cdGradShift 6s steps(60) infinite;-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask-composite:exclude;pointer-events:none;z-index:5}';

    // [class*="X"] matcht auch Tailwinds Opacity-Modifier "X/NN" (z.B. eine helle 5%-Toenung
    // fuer einen Preis-Chip), die sonst faelschlich volldeckend geschwaerzt wird und ihren
    // eigenen (auf hell gedachten) Text unsichtbar macht. :not() schliesst genau diese Variante aus.
    function safeBg(scope, tokens, color) {
      return tokens.map(function (t) {
        return scope + ' [class*="' + t + '"]:not([class*="' + t + '/"])';
      }).join(',') + '{background-color:' + color + ' !important}';
    }

    // Anders als die uebrigen Themes haengt Matrix NUR im Sheet, wenn es auch laeuft.
    // Gemessen: der Block kostet sonst jeden Nutzer rund 27% mehr Style-Recalc
    // (5.34 -> 6.81 ms), auch wenn er nie Matrix waehlt - die [class*=]-Selektoren werden
    // bei jedem Recalc mitgeprueft. Beim Themewechsel baut der Controller das Sheet neu,
    // der Block ist also rechtzeitig da.
    var matrixRegeln = st.mode !== 'matrix' ? [] : [
      // --- Matrix: gruenstichiges Fast-Schwarz mit Zeichenregen. Aufbau eins zu eins wie
      // Mitternachtsblau, nur andere Stufen; neue Themes haengen hinten an, damit das
      // bestehende Sheet Byte-gleich bleibt (siehe test/theme-static.test.js).
      X + '{background-color:' + XBG + ' !important;--cd-rain-img:' + RAIN + '}',
      X + ' body{background-color:' + XBG + ' !important;background-image:var(--cd-rain-img) !important;background-size:620px 620px}',
      X + '[data-cd-modal] body{background-image:none !important}',
      X + ' #__next,' + X + ' #root,' + X + ' main,' + X + ' [role="main"]{background-color:transparent !important;background-image:none !important}',
      X + ' nav,' + X + ' aside,' + X + ' header,' + X + ' [class*="sidebar" i],' + X + ' [class*="Sidebar"],' + X + ' [class*="topbar" i],' + X + ' [class*="TopBar"]{background-color:' + XBG + ' !important;background-image:none !important}',
      X + ' nav,' + X + ' aside,' + X + ' [class*="sidebar" i],' + X + ' [class*="Sidebar"]{border-right:1px solid ' + X_HAIR + ' !important}',
      safeBg(X, ['bg-bg-000', 'bg-bg-100', 'bg-bg-200'], XBG),
      safeBg(X, ['bg-bg-300', 'bg-bg-400'], XBG_HI),
      safeBg(X, ['bg-bg-500', 'bg-bg-600'], XBG_TOP),
      safeBg(X, ['bg-surface-0', 'bg-surface-1'], XBG),
      safeBg(X, ['bg-surface-2', 'bg-surface-3'], XBG_HI),
      safeBg(X, ['bg-black', 'bg-neutral-900', 'bg-neutral-950', 'bg-zinc-900', 'bg-zinc-950', 'bg-gray-900', 'bg-gray-950', 'bg-stone-900', 'bg-stone-950', 'bg-slate-900', 'bg-slate-950'], XBG),
      X + ' [class*="om-dc-select"],' + X + ' [class*="om-tray-composer-shell"]{background-color:' + XBG_HI + ' !important}',
      X + ' [class*="from-bg-"],' + X + ' [class*="to-bg-"],' + X + ' [class*="via-bg-"]{background-image:none !important}',
      X + ' [class*="pointer-events-none"][class*="inset-0"]{background-color:transparent !important;background-image:none !important}',
      X + ' header[class*="bg-"]{background-color:' + XBG + ' !important;background-image:none !important}',
      X + ' [class*="top-scrim"],' + X + ' [class*="bottom-scrim"]{background-image:none !important}',
      X + ' nav a,' + X + ' nav button,' + X + ' aside a,' + X + ' aside button,' + X + ' [class*="sidebar" i] a,' + X + ' [class*="sidebar" i] button,' + X + ' [class*="Sidebar"] a,' + X + ' [class*="Sidebar"] button{background-color:transparent !important;border-color:transparent !important;box-shadow:none !important}',
      X + ' nav a:hover,' + X + ' nav button:hover,' + X + ' aside a:hover,' + X + ' aside button:hover,' + X + ' [class*="sidebar" i] a:hover,' + X + ' [class*="sidebar" i] button:hover{background-color:' + XBG_HI + ' !important}',
      X + ' nav [aria-current="page"],' + X + ' nav [data-state="active"],' + X + ' nav [aria-selected="true"],' + X + ' aside [aria-current="page"],' + X + ' aside [data-state="active"],' + X + ' aside [aria-selected="true"]{background-color:' + XBG_TOP + ' !important}',
      X + ' [role="menu"],' + X + ' [role="dialog"],' + X + ' [role="listbox"],' + X + ' [role="tooltip"],' + X + ' [class*="opover"],' + X + ' [class*="ropdown"],' + X + ' [class*="enuContent"],' + X + ' [data-radix-popper-content-wrapper]>*{background-color:' + XBG_HI + ' !important;background-image:none !important;border:1px solid ' + X_EDGE + ' !important;box-shadow:0 8px 28px rgba(0,0,0,0.6) !important}',
      X + ' [role="menu"] [role="menuitem"],' + X + ' [role="menu"] button,' + X + ' [role="menu"] a,' + X + ' [role="listbox"] [role="option"]{background-color:transparent !important;border-color:transparent !important}',
      X + ' [role="menu"] [role="menuitem"]:hover,' + X + ' [role="menu"] button:hover,' + X + ' [role="menu"] a:hover,' + X + ' [role="listbox"] [role="option"]:hover,' + X + ' [role="menuitem"][data-highlighted]{background-color:' + XBG_TOP + ' !important}',
      X + ' input:focus,' + X + ' textarea:focus,' + X + ' [role="searchbox"]:focus,' + X + ' [role="combobox"]:focus{outline:1.5px solid ' + X_FOCUS + ' !important;outline-offset:2px !important}',
      X + ' .cd-composer{position:relative;border-color:transparent !important;overflow:visible !important;background-color:revert-layer !important}',
      X + ' .cd-composer::before' + RING,
      // Animierter Regen. Bewusst NICHT background-position animiert: das waere ein Repaint
      // ueber die volle Flaeche bei jedem Frame. Stattdessen eine eigene Ebene, die per
      // transform verschoben wird. Die Ebene ist eine Kachel hoeher als der Viewport und
      // laeuft genau eine Kachelhoehe weit, dann springt sie zurueck; weil das Muster mit
      // 620px kachelt, ist der Sprung unsichtbar.
      // steps(44) statt linear, und das ist der eigentliche Punkt: 620px / 14px Zeilenabstand
      // ergibt einen Sprung pro Zeile, also gut zwei Frames pro Sekunde statt sechzig.
      // Gemessen ueber je 20 Sekunden: linear 65.8% eines Kerns, steps 7.3%, Ruhezustand
      // ohne Regen 4.9%. Die Animation bleibt zwar im Compositor (Style-Recalc und Layout
      // sind 0.0ms), aber jeder Frame kostet trotzdem das Neuzusammensetzen einer
      // bildschirmgrossen Ebene. Zeilenweise sieht ausserdem mehr nach Terminal aus.
      'html[data-cd-rain="on"] #cd-rain{position:fixed;left:0;right:0;top:0;height:calc(100% + 620px);'
        + 'background-image:var(--cd-rain-img);background-size:620px 620px;background-repeat:repeat;'
        + 'pointer-events:none;z-index:-1;will-change:transform;animation:cdRain 24s steps(44) infinite}',
      '@keyframes cdRain{from{transform:translateY(-620px)}to{transform:translateY(0)}}',
      // Solange die Ebene laeuft, traegt sie das Muster. Der body muss dabei durchsichtig
      // werden: die Ebene haengt an z-index:-1, und nach der Malreihenfolge liegen negative
      // z-index-Kinder VOR den Hintergruenden der Block-Nachfahren, ein deckender
      // body-Hintergrund wuerde sie also zudecken. Die Flaechenfarbe kommt von <html>.
      // body[class] statt body: die safeBg-Regeln oben treffen den body ueber seine
      // Tailwind-Klasse (gemessen: bg-surface-1) und haben mit vier Attributen die hoehere
      // Spezifitaet. Das zusaetzliche [class] hebt diese Regel darueber.
      'html[data-cd-rain="on"]' + X.slice('html'.length) + ' body[class]{background-image:none !important;background-color:transparent !important}',
      // Bewegung abschalten, wenn das System es verlangt.
      '@media (prefers-reduced-motion:reduce){html[data-cd-rain="on"] #cd-rain{animation:none}}'
    ];

    return [
      // --- White: claude.ai bleibt technisch dark, wird per GPU-Invert hell. Beim Umschalten
      // aendert sich nur die filter-Property am Wurzelknoten -> ~6ms Recalc (der Compositor
      // faerbt um, kein Main-Thread-Repaint), statt ~480ms fuer claude.ais eigenen
      // prefers-color-scheme-Palettenwechsel. hue-rotate(180) haelt die Farbtoene nah am
      // Original (Rot bleibt Rot). Echte Medien (Fotos/Avatare/Thumbnails) zurueck-invertieren,
      // damit sie nicht negativ erscheinen.
      // Die Wurzelfarbe liegt UNTER dem Filter, wird also mitgedreht: #fff rendert als Schwarz.
      // Sichtbar ueberall dort, wo claude.ai die Wurzel nicht selbst zudeckt, gemessen auf der
      // Design-Seite als schwarze untere Bildschirmhaelfte. Darum #000, das ergibt Weiss.
      W + '{filter:invert(1) hue-rotate(180deg) !important;background-color:#000 !important}',
      // iframe gehoert dazu: Artefakte, das Design-Feature und der Stripe-Bezahlvorgang
      // laufen cross-origin und bringen ihr eigenes Farbschema mit. Ohne Rueck-Invertierung
      // erscheint ihr Inhalt als Negativ (gemessen am Design-Feature: gelb wurde oliv,
      // Hauttoene kippten). Unser Filter darf nur claude.ais eigene Oberflaeche umdrehen.
      W + ' img,' + W + ' video,' + W + ' canvas,' + W + ' image,' + W + ' iframe,' + W + ' [style*="background-image"]{filter:invert(1) hue-rotate(180deg)}',
      // --- OLED: html schwarz (Fallback) ---
      O + '{background-color:' + BG + ' !important}',
      // body traegt das Sternen-Hintergrundbild (claude.ais Container darueber sind
      // transparent, scheinen also durch). KEIN background-attachment:fixed: das nimmt dem
      // body die Compositor-Faehigkeit und erzwingt bei jeder Aenderung/jedem Scroll einen
      // Vollbild-Repaint -> zaeher "alles hakt / 1 fps"-Effekt beim Streamen, Scrollen und
      // Theme-Wechsel. Ohne fixed bleiben die Sterne trotzdem stehen, weil claude.ai in einem
      // inneren Container scrollt (der body selbst scrollt nicht), aber ohne die Repaint-Strafe.
      O + ' body{background-color:' + BG + ' !important;background-image:' + SPARK + ' !important;background-size:620px 620px}',
      // Sterne ausblenden solange ein Modal offen ist, sonst schimmern sie unruhig durch den Backdrop.
      // Geschaltet ueber data-cd-modal am <html> (updateModalFlag im Observer), nicht ueber body:has(),
      // weil :has() bei jedem Style-Recalc den Subtree scannt und den Recalc massiv verteuert.
      O + '[data-cd-modal] body{background-image:none !important}',
      O + ' #__next,' + O + ' #root,' + O + ' main,' + O + ' [role="main"]{background-color:transparent !important;background-image:none !important}',
      // undurchsichtige Flaechen decken die Sterne ab
      O + ' nav,' + O + ' aside,' + O + ' header,' + O + ' [class*="sidebar" i],' + O + ' [class*="Sidebar"],' + O + ' [class*="topbar" i],' + O + ' [class*="TopBar"]{background-color:' + BG + ' !important;background-image:none !important}',
      // Sidebar gegen den gleich-schwarzen Chatbereich abgrenzen (sonst Kante 1.0:1 = unsichtbar).
      O + ' nav,' + O + ' aside,' + O + ' [class*="sidebar" i],' + O + ' [class*="Sidebar"]{border-right:1px solid ' + HAIR_DIM + ' !important}',
      safeBg(O, ['bg-bg-000', 'bg-bg-100', 'bg-bg-200'], BG),
      safeBg(O, ['bg-bg-300', 'bg-bg-400'], BG_HI),
      safeBg(O, ['bg-bg-500', 'bg-bg-600'], '#1a1517'),
      // claude.ais neuere surface-Tokens (z.B. Settings-Content bg-surface-2 = grau) ebenfalls schwaerzen.
      safeBg(O, ['bg-surface-0', 'bg-surface-1'], BG),
      safeBg(O, ['bg-surface-2', 'bg-surface-3'], BG_HI),
      safeBg(O, ['bg-black', 'bg-neutral-900', 'bg-neutral-950', 'bg-zinc-900', 'bg-zinc-950', 'bg-gray-900', 'bg-gray-950', 'bg-stone-900', 'bg-stone-950', 'bg-slate-900', 'bg-slate-950'], BG),
      O + ' [class*="from-bg-"],' + O + ' [class*="to-bg-"],' + O + ' [class*="via-bg-"]{background-image:none !important}',
      O + ' header[class*="bg-"]{background-color:' + BG + ' !important;background-image:none !important}',
      // --- OLED: Navigation / Menues ---
      O + ' nav a,' + O + ' nav button,' + O + ' aside a,' + O + ' aside button,' + O + ' [class*="sidebar" i] a,' + O + ' [class*="sidebar" i] button,' + O + ' [class*="Sidebar"] a,' + O + ' [class*="Sidebar"] button{background-color:transparent !important;border-color:transparent !important;box-shadow:none !important}',
      O + ' nav a:hover,' + O + ' nav button:hover,' + O + ' aside a:hover,' + O + ' aside button:hover,' + O + ' [class*="sidebar" i] a:hover,' + O + ' [class*="sidebar" i] button:hover{background-color:#181417 !important}',
      O + ' nav [aria-current="page"],' + O + ' nav [data-state="active"],' + O + ' nav [aria-selected="true"],' + O + ' aside [aria-current="page"],' + O + ' aside [data-state="active"],' + O + ' aside [aria-selected="true"]{background-color:#1c181b !important}',
      O + ' [role="menu"],' + O + ' [role="dialog"],' + O + ' [role="listbox"],' + O + ' [role="tooltip"],' + O + ' [class*="opover"],' + O + ' [class*="ropdown"],' + O + ' [class*="enuContent"],' + O + ' [data-radix-popper-content-wrapper]>*{background-color:' + BG_HI + ' !important;background-image:none !important;border:1px solid ' + MENU_EDGE + ' !important;box-shadow:0 8px 28px rgba(0,0,0,0.6) !important}',
      O + ' [role="menu"] [role="menuitem"],' + O + ' [role="menu"] button,' + O + ' [role="menu"] a,' + O + ' [role="listbox"] [role="option"]{background-color:transparent !important;border-color:transparent !important}',
      O + ' [role="menu"] [role="menuitem"]:hover,' + O + ' [role="menu"] button:hover,' + O + ' [role="menu"] a:hover,' + O + ' [role="listbox"] [role="option"]:hover,' + O + ' [role="menuitem"][data-highlighted]{background-color:#1c181b !important}',
      O + ' input:focus,' + O + ' textarea:focus,' + O + ' [role="searchbox"]:focus,' + O + ' [role="combobox"]:focus{outline:1.5px solid ' + FOCUS + ' !important;outline-offset:2px !important}',
      // --- OLED: Composer-Gradient-Rand ---
      // steps(60) statt ease-in-out, also zehn Stufen pro Sekunde. Das Verschieben der
      // background-position rechnet Gradient und Maske bei jedem Frame neu, und weil das im
      // Compositing steckt, taucht es in RecalcStyle und Layout nicht auf (beide 0.0ms).
      // Gemessen als CPU-Zeit aller Prozesse ueber /proc, je 15s im direkten Wechsel:
      // ease-in-out 66.3% und 59.3% eines Kerns, steps(60) 14.7% und 13.6%. Der Ring laeuft
      // dauerhaft und in jedem Stil ausser Classic, das war die Grundlast der App im Leerlauf.
      '@keyframes cdGradShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}',
      O + ' .cd-composer{position:relative;border-color:transparent !important;overflow:visible !important;background-color:' + BG + ' !important}',
      O + ' .cd-composer::before' + RING,
      // --- Mitternachtsblau: gleiche Token-Gruppen wie OLED, nur auf drei Blaustufen statt
      // near-black. Kein Sternenfeld: das bleibt die Signatur von OLED. Die Stufen liegen
      // ebenfalls dicht beieinander (unter 1.5:1), Trennung laeuft darum wie dort ueber
      // Hairlines, hier in einem kuehlen Blau statt dem Rot-Ton.
      M + '{background-color:' + MBG + ' !important}',
      // Wie beim Sternenfeld kein background-attachment:fixed, das kostet den Compositor-Pfad
      // und macht Scrollen und Streamen zaeh.
      M + ' body{background-color:' + MBG + ' !important;background-image:' + WAVES + ' !important;background-size:620px 620px}',
      M + '[data-cd-modal] body{background-image:none !important}',
      M + ' #__next,' + M + ' #root,' + M + ' main,' + M + ' [role="main"]{background-color:transparent !important;background-image:none !important}',
      M + ' nav,' + M + ' aside,' + M + ' header,' + M + ' [class*="sidebar" i],' + M + ' [class*="Sidebar"],' + M + ' [class*="topbar" i],' + M + ' [class*="TopBar"]{background-color:' + MBG + ' !important;background-image:none !important}',
      M + ' nav,' + M + ' aside,' + M + ' [class*="sidebar" i],' + M + ' [class*="Sidebar"]{border-right:1px solid ' + M_HAIR + ' !important}',
      safeBg(M, ['bg-bg-000', 'bg-bg-100', 'bg-bg-200'], MBG),
      safeBg(M, ['bg-bg-300', 'bg-bg-400'], MBG_HI),
      safeBg(M, ['bg-bg-500', 'bg-bg-600'], MBG_TOP),
      safeBg(M, ['bg-surface-0', 'bg-surface-1'], MBG),
      safeBg(M, ['bg-surface-2', 'bg-surface-3'], MBG_HI),
      safeBg(M, ['bg-black', 'bg-neutral-900', 'bg-neutral-950', 'bg-zinc-900', 'bg-zinc-950', 'bg-gray-900', 'bg-gray-950', 'bg-stone-900', 'bg-stone-950', 'bg-slate-900', 'bg-slate-950'], MBG),
      // Das Design-Feature bringt eigene Controls mit fest verdrahtetem Grau mit (gemessen
      // rgb(107,107,107) am Auswahlfeld), die keiner der Surface-Tokens erwischt.
      M + ' [class*="om-dc-select"],' + M + ' [class*="om-tray-composer-shell"]{background-color:' + MBG_HI + ' !important}',
      M + ' [class*="from-bg-"],' + M + ' [class*="to-bg-"],' + M + ' [class*="via-bg-"]{background-image:none !important}',
      // claude.ai legt eine dekorative Vollbild-Flaeche ueber die Seite (gemessen: inset-0,
      // 1438x704). Von den Surface-Tokens oben wird sie deckend eingefaerbt und schneidet die
      // Wellen ab. pointer-events-none grenzt sie gegen echte Modal-Backdrops ab, die klickbar
      // sind und deckend bleiben muessen. Steht nach safeBg, sonst gewinnt die Reihenfolge nicht.
      M + ' [class*="pointer-events-none"][class*="inset-0"]{background-color:transparent !important;background-image:none !important}',
      M + ' header[class*="bg-"]{background-color:' + MBG + ' !important;background-image:none !important}',
      // Scrims faden den Inhalt in die Seitenfarbe. Ueber einem Muster koennen sie das nicht
      // leisten: als Verlauf in der Basisfarbe schneiden sie die Wellen sichtbar durch. Hier
      // also ganz weg, statt claude.ais Grau (das als Balken stehenbleibt) nachzumalen.
      M + ' [class*="top-scrim"],' + M + ' [class*="bottom-scrim"]{background-image:none !important}',
      M + ' nav a,' + M + ' nav button,' + M + ' aside a,' + M + ' aside button,' + M + ' [class*="sidebar" i] a,' + M + ' [class*="sidebar" i] button,' + M + ' [class*="Sidebar"] a,' + M + ' [class*="Sidebar"] button{background-color:transparent !important;border-color:transparent !important;box-shadow:none !important}',
      M + ' nav a:hover,' + M + ' nav button:hover,' + M + ' aside a:hover,' + M + ' aside button:hover,' + M + ' [class*="sidebar" i] a:hover,' + M + ' [class*="sidebar" i] button:hover{background-color:' + MBG_HI + ' !important}',
      M + ' nav [aria-current="page"],' + M + ' nav [data-state="active"],' + M + ' nav [aria-selected="true"],' + M + ' aside [aria-current="page"],' + M + ' aside [data-state="active"],' + M + ' aside [aria-selected="true"]{background-color:' + MBG_TOP + ' !important}',
      M + ' [role="menu"],' + M + ' [role="dialog"],' + M + ' [role="listbox"],' + M + ' [role="tooltip"],' + M + ' [class*="opover"],' + M + ' [class*="ropdown"],' + M + ' [class*="enuContent"],' + M + ' [data-radix-popper-content-wrapper]>*{background-color:' + MBG_HI + ' !important;background-image:none !important;border:1px solid ' + M_EDGE + ' !important;box-shadow:0 8px 28px rgba(0,0,0,0.6) !important}',
      M + ' [role="menu"] [role="menuitem"],' + M + ' [role="menu"] button,' + M + ' [role="menu"] a,' + M + ' [role="listbox"] [role="option"]{background-color:transparent !important;border-color:transparent !important}',
      M + ' [role="menu"] [role="menuitem"]:hover,' + M + ' [role="menu"] button:hover,' + M + ' [role="menu"] a:hover,' + M + ' [role="listbox"] [role="option"]:hover,' + M + ' [role="menuitem"][data-highlighted]{background-color:' + MBG_TOP + ' !important}',
      M + ' input:focus,' + M + ' textarea:focus,' + M + ' [role="searchbox"]:focus,' + M + ' [role="combobox"]:focus{outline:1.5px solid ' + M_FOCUS + ' !important;outline-offset:2px !important}',
      M + ' .cd-composer{position:relative;border-color:transparent !important;overflow:visible !important;background-color:' + MBG + ' !important}',
      M + ' .cd-composer::before' + RING,
      // Scrims sind die Verlaufsstreifen, die den Inhalt oben und unten in die Seitenfarbe
      // faden. claude.ai haelt darin sein eigenes Grau (gemessen rgb(21,21,21)), das auf jedem
      // eigenen Grund als Balken stehenbleibt, in OLED genauso wie in Mitternachtsblau.
      O + ' [class*="top-scrim"]{background-image:linear-gradient(' + BG + ',rgba(0,0,0,0)) !important}',
      O + ' [class*="bottom-scrim"]{background-image:linear-gradient(0deg,' + BG + ',rgba(0,0,0,0)) !important}',
      // .cd-composer sitzt inzwischen auf der Eingabekarte statt aufs Fieldset (siehe tagComposer).
      // Die Karte behaelt ihre eigene Flaeche aus claude.ais @layer, die Basisfarbe oben galt dem Fieldset.
      O + ' .cd-composer,' + M + ' .cd-composer{background-color:revert-layer !important}',
      // Der Ring haengt am Akzentstil, nicht am Farbtheme: Modern und Neon (laeuft als
      // design="modern") zeigen ihn in jedem Theme, Classic als Anthropics Original-Ton in keinem.
      // rounded-composer ist claude.ais Kartenklasse: per CSS steht der Ring ab dem ersten Frame.
      // Das JS-Tag kam nach jedem Neuaufbau der Karte (Chat -> Neuer Chat) erst einen Frame spaeter.
      // .cd-composer bleibt als Rueckfall, falls die Klasse umbenannt wird. 16px = Kartenradius 14 + 2,
      // tagComposer ueberschreibt das inline mit dem gemessenen Wert.
      D + ' .cd-composer,' + D + ' fieldset .rounded-composer{position:relative;overflow:visible !important;--cd-composer-radius:16px}',
      D + ' .cd-composer::before,' + D + ' fieldset .rounded-composer::before' + RING,
      // Hell entsteht per Invert am Wurzelknoten, der Ring wuerde mitgedreht. Zurueckdrehen wie bei Medien.
      W + '[data-cd-design="modern"] .cd-composer::before,' + W + '[data-cd-design="modern"] fieldset .rounded-composer::before{filter:invert(1) hue-rotate(180deg)}',
      'html[data-cd-design="classic"] .cd-composer::before{content:none !important}',
      ''
    ].concat(matrixRegeln).join('');
  }

  return { buildStaticCSS: buildStaticCSS, sparkleBg: sparkleBg };
});
