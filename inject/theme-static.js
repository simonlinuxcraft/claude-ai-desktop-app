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

  // Vorberechnete Flaechenpalette je Theme. claude.ai definiert rund 190 --cds-Farbtokens;
  // der Variablen-Scan in theme.js rechnet sie auf das Theme um, kann das aber erst, wenn
  // claude.ais CSS geladen ist. Bis dahin standen die Flaechen in dessen neutralem Grau,
  // gemessen 6x gedrosselt noch bei 663 und 769 ms vollflaechig. Hier stehen dieselben
  // Werte schon im document-start-Sheet, der Scan ueberschreibt sie spaeter identisch und
  // korrigiert sie, falls claude.ai seine Palette aendert.
  // Neu erzeugen: Theme setzen, dann den [data-cd-surface="dark"]-Block aus dem Sheet
  // cd-theme-vars auslesen (siehe scratchpad/blocks.mjs).
  var SURFACE_VORAB = {
    matrix: '--cds-black:#020403 !important;--cds-gray-500:#18291d !important;--cds-gray-600:#122017 !important;--cds-gray-800:#040806 !important;--cds-gray-850:#040806 !important;--cds-gray-900:#040806 !important;--cds-clay-emphasized:#1f3325 !important;--cds-mineral:#1f3325 !important;--cds-gray-450:#1f3325 !important;--cds-gray-550:#18291d !important;--cds-gray-650:#122017 !important;--cds-gray-700:#0b1610 !important;--cds-gray-750:#040806 !important;--cds-gray-810:#040806 !important;--cds-gray-820:#040806 !important;--cds-gray-830:#040806 !important;--cds-gray-840:#040806 !important;--cds-gray-860:#040806 !important;--cds-gray-870:#040806 !important;--cds-gray-880:#040806 !important;--cds-gray-890:#040806 !important;--cds-red-400:#1f3325 !important;--cds-red-450:#18291d !important;--cds-red-500:#18291d !important;--cds-red-550:#122017 !important;--cds-red-600:#122017 !important;--cds-red-650:#0b1610 !important;--cds-red-700:#0b1610 !important;--cds-red-750:#040806 !important;--cds-red-800:#040806 !important;--cds-red-810:#040806 !important;--cds-red-820:#040806 !important;--cds-red-830:#040806 !important;--cds-red-840:#040806 !important;--cds-red-850:#040806 !important;--cds-red-860:#040806 !important;--cds-red-870:#040806 !important;--cds-red-880:#040806 !important;--cds-red-890:#040806 !important;--cds-red-900:#040806 !important;--cds-orange-350:#1f3325 !important;--cds-orange-400:#1f3325 !important;--cds-orange-450:#18291d !important;--cds-orange-500:#18291d !important;--cds-orange-550:#122017 !important;--cds-orange-600:#122017 !important;--cds-orange-650:#0b1610 !important;--cds-orange-700:#040806 !important;--cds-orange-750:#040806 !important;--cds-orange-800:#040806 !important;--cds-orange-810:#040806 !important;--cds-orange-820:#040806 !important;--cds-orange-830:#040806 !important;--cds-orange-840:#040806 !important;--cds-orange-850:#040806 !important;--cds-orange-860:#040806 !important;--cds-orange-870:#040806 !important;--cds-orange-880:#040806 !important;--cds-orange-890:#040806 !important;--cds-orange-900:#040806 !important;--cds-yellow-250:#1f3325 !important;--cds-yellow-300:#1f3325 !important;--cds-yellow-350:#1f3325 !important;--cds-yellow-400:#18291d !important;--cds-yellow-450:#18291d !important;--cds-yellow-500:#122017 !important;--cds-yellow-550:#122017 !important;--cds-yellow-600:#0b1610 !important;--cds-yellow-650:#0b1610 !important;--cds-yellow-700:#040806 !important;--cds-yellow-750:#040806 !important;--cds-yellow-800:#040806 !important;--cds-yellow-810:#040806 !important;--cds-yellow-820:#040806 !important;--cds-yellow-830:#040806 !important;--cds-yellow-840:#040806 !important;--cds-yellow-850:#040806 !important;--cds-yellow-860:#040806 !important;--cds-yellow-870:#040806 !important;--cds-yellow-880:#040806 !important;--cds-yellow-890:#040806 !important;--cds-yellow-900:#040806 !important;--cds-green-300:#1f3325 !important;--cds-green-350:#18291d !important;--cds-green-400:#0b1610 !important;--cds-green-450:#040806 !important;--cds-green-500:#040806 !important;--cds-green-550:#040806 !important;--cds-green-600:#040806 !important;--cds-green-650:#040806 !important;--cds-green-700:#040806 !important;--cds-green-750:#040806 !important;--cds-green-800:#040806 !important;--cds-green-810:#040806 !important;--cds-green-820:#040806 !important;--cds-green-830:#040806 !important;--cds-green-840:#040806 !important;--cds-green-850:#040806 !important;--cds-green-860:#040806 !important;--cds-green-870:#040806 !important;--cds-green-880:#040806 !important;--cds-green-890:#040806 !important;--cds-green-900:#040806 !important;--cds-aqua-300:#1f3325 !important;--cds-aqua-350:#18291d !important;--cds-aqua-400:#18291d !important;--cds-aqua-450:#18291d !important;--cds-aqua-500:#122017 !important;--cds-aqua-550:#122017 !important;--cds-aqua-600:#0b1610 !important;--cds-aqua-650:#0b1610 !important;--cds-aqua-700:#040806 !important;--cds-aqua-750:#040806 !important;--cds-aqua-800:#040806 !important;--cds-aqua-810:#040806 !important;--cds-aqua-820:#040806 !important;--cds-aqua-830:#040806 !important;--cds-aqua-840:#040806 !important;--cds-aqua-850:#040806 !important;--cds-aqua-860:#040806 !important;--cds-aqua-870:#040806 !important;--cds-aqua-880:#040806 !important;--cds-aqua-890:#040806 !important;--cds-aqua-900:#040806 !important;--cds-blue-450:#1f3325 !important;--cds-blue-500:#1f3325 !important;--cds-blue-550:#18291d !important;--cds-blue-600:#122017 !important;--cds-blue-650:#122017 !important;--cds-blue-700:#0b1610 !important;--cds-blue-750:#040806 !important;--cds-blue-800:#040806 !important;--cds-blue-810:#040806 !important;--cds-blue-820:#040806 !important;--cds-blue-830:#040806 !important;--cds-blue-840:#040806 !important;--cds-blue-850:#040806 !important;--cds-blue-860:#040806 !important;--cds-blue-870:#040806 !important;--cds-blue-880:#040806 !important;--cds-blue-890:#040806 !important;--cds-blue-900:#040806 !important;--cds-violet-500:#1f3325 !important;--cds-violet-550:#1f3325 !important;--cds-violet-600:#18291d !important;--cds-violet-650:#122017 !important;--cds-violet-700:#122017 !important;--cds-violet-750:#0b1610 !important;--cds-violet-800:#040806 !important;--cds-violet-810:#040806 !important;--cds-violet-820:#040806 !important;--cds-violet-830:#040806 !important;--cds-violet-840:#040806 !important;--cds-violet-850:#040806 !important;--cds-violet-860:#040806 !important;--cds-violet-870:#040806 !important;--cds-violet-880:#040806 !important;--cds-violet-890:#040806 !important;--cds-violet-900:#040806 !important;--cds-magenta-450:#1f3325 !important;--cds-magenta-500:#1f3325 !important;--cds-magenta-550:#18291d !important;--cds-magenta-600:#122017 !important;--cds-magenta-650:#122017 !important;--cds-magenta-700:#0b1610 !important;--cds-magenta-750:#040806 !important;--cds-magenta-800:#040806 !important;--cds-magenta-810:#040806 !important;--cds-magenta-820:#040806 !important;--cds-magenta-830:#040806 !important;--cds-magenta-840:#040806 !important;--cds-magenta-850:#040806 !important;--cds-magenta-860:#040806 !important;--cds-magenta-870:#040806 !important;--cds-magenta-880:#040806 !important;--cds-magenta-890:#040806 !important;--cds-magenta-900:#040806 !important;--cds-fill-git-added:#122017 !important;--cds-fill-git-added-hover:#122017 !important;--cds-fill-git-removed-hover:#1f3325 !important;--cds-fill-git-modified:#18291d !important;--cds-fill-git-modified-hover:#18291d !important;--cds-fill-git-closed:#122017 !important;--cds-fill-git-closed-hover:#18291d !important;--cds-fill-git-conflicting:#18291d !important;--cds-fill-git-conflicting-hover:#18291d !important;--cds-text-git-added:#122017 !important;--cds-text-git-removed:#18291d !important;--cds-text-git-modified:#18291d !important;--cds-text-git-closed:#1f3325 !important;--cds-text-git-conflicting:#18291d !important;--cds-text-git-draft:#1f3325 !important;',
    oled: '--cds-black:#030203 !important;--cds-gray-500:#252023 !important;--cds-gray-600:#1c181b !important;--cds-gray-800:#050306 !important;--cds-gray-850:#050306 !important;--cds-gray-900:#050306 !important;--cds-clay-emphasized:#2c2528 !important;--cds-mineral:#2c2528 !important;--cds-gray-450:#2c2528 !important;--cds-gray-550:#252023 !important;--cds-gray-650:#1c181b !important;--cds-gray-700:#120f12 !important;--cds-gray-750:#050306 !important;--cds-gray-810:#050306 !important;--cds-gray-820:#050306 !important;--cds-gray-830:#050306 !important;--cds-gray-840:#050306 !important;--cds-gray-860:#050306 !important;--cds-gray-870:#050306 !important;--cds-gray-880:#050306 !important;--cds-gray-890:#050306 !important;--cds-red-400:#2c2528 !important;--cds-red-450:#252023 !important;--cds-red-500:#252023 !important;--cds-red-550:#1c181b !important;--cds-red-600:#1c181b !important;--cds-red-650:#120f12 !important;--cds-red-700:#120f12 !important;--cds-red-750:#050306 !important;--cds-red-800:#050306 !important;--cds-red-810:#050306 !important;--cds-red-820:#050306 !important;--cds-red-830:#050306 !important;--cds-red-840:#050306 !important;--cds-red-850:#050306 !important;--cds-red-860:#050306 !important;--cds-red-870:#050306 !important;--cds-red-880:#050306 !important;--cds-red-890:#050306 !important;--cds-red-900:#050306 !important;--cds-orange-350:#2c2528 !important;--cds-orange-400:#2c2528 !important;--cds-orange-450:#252023 !important;--cds-orange-500:#252023 !important;--cds-orange-550:#1c181b !important;--cds-orange-600:#1c181b !important;--cds-orange-650:#120f12 !important;--cds-orange-700:#050306 !important;--cds-orange-750:#050306 !important;--cds-orange-800:#050306 !important;--cds-orange-810:#050306 !important;--cds-orange-820:#050306 !important;--cds-orange-830:#050306 !important;--cds-orange-840:#050306 !important;--cds-orange-850:#050306 !important;--cds-orange-860:#050306 !important;--cds-orange-870:#050306 !important;--cds-orange-880:#050306 !important;--cds-orange-890:#050306 !important;--cds-orange-900:#050306 !important;--cds-yellow-250:#2c2528 !important;--cds-yellow-300:#2c2528 !important;--cds-yellow-350:#2c2528 !important;--cds-yellow-400:#252023 !important;--cds-yellow-450:#252023 !important;--cds-yellow-500:#1c181b !important;--cds-yellow-550:#1c181b !important;--cds-yellow-600:#120f12 !important;--cds-yellow-650:#120f12 !important;--cds-yellow-700:#050306 !important;--cds-yellow-750:#050306 !important;--cds-yellow-800:#050306 !important;--cds-yellow-810:#050306 !important;--cds-yellow-820:#050306 !important;--cds-yellow-830:#050306 !important;--cds-yellow-840:#050306 !important;--cds-yellow-850:#050306 !important;--cds-yellow-860:#050306 !important;--cds-yellow-870:#050306 !important;--cds-yellow-880:#050306 !important;--cds-yellow-890:#050306 !important;--cds-yellow-900:#050306 !important;--cds-green-300:#2c2528 !important;--cds-green-350:#252023 !important;--cds-green-400:#120f12 !important;--cds-green-450:#050306 !important;--cds-green-500:#050306 !important;--cds-green-550:#050306 !important;--cds-green-600:#050306 !important;--cds-green-650:#050306 !important;--cds-green-700:#050306 !important;--cds-green-750:#050306 !important;--cds-green-800:#050306 !important;--cds-green-810:#050306 !important;--cds-green-820:#050306 !important;--cds-green-830:#050306 !important;--cds-green-840:#050306 !important;--cds-green-850:#050306 !important;--cds-green-860:#050306 !important;--cds-green-870:#050306 !important;--cds-green-880:#050306 !important;--cds-green-890:#050306 !important;--cds-green-900:#050306 !important;--cds-aqua-300:#2c2528 !important;--cds-aqua-350:#252023 !important;--cds-aqua-400:#252023 !important;--cds-aqua-450:#252023 !important;--cds-aqua-500:#1c181b !important;--cds-aqua-550:#1c181b !important;--cds-aqua-600:#120f12 !important;--cds-aqua-650:#120f12 !important;--cds-aqua-700:#050306 !important;--cds-aqua-750:#050306 !important;--cds-aqua-800:#050306 !important;--cds-aqua-810:#050306 !important;--cds-aqua-820:#050306 !important;--cds-aqua-830:#050306 !important;--cds-aqua-840:#050306 !important;--cds-aqua-850:#050306 !important;--cds-aqua-860:#050306 !important;--cds-aqua-870:#050306 !important;--cds-aqua-880:#050306 !important;--cds-aqua-890:#050306 !important;--cds-aqua-900:#050306 !important;--cds-blue-450:#2c2528 !important;--cds-blue-500:#2c2528 !important;--cds-blue-550:#252023 !important;--cds-blue-600:#1c181b !important;--cds-blue-650:#1c181b !important;--cds-blue-700:#120f12 !important;--cds-blue-750:#050306 !important;--cds-blue-800:#050306 !important;--cds-blue-810:#050306 !important;--cds-blue-820:#050306 !important;--cds-blue-830:#050306 !important;--cds-blue-840:#050306 !important;--cds-blue-850:#050306 !important;--cds-blue-860:#050306 !important;--cds-blue-870:#050306 !important;--cds-blue-880:#050306 !important;--cds-blue-890:#050306 !important;--cds-blue-900:#050306 !important;--cds-violet-500:#2c2528 !important;--cds-violet-550:#2c2528 !important;--cds-violet-600:#252023 !important;--cds-violet-650:#1c181b !important;--cds-violet-700:#1c181b !important;--cds-violet-750:#120f12 !important;--cds-violet-800:#050306 !important;--cds-violet-810:#050306 !important;--cds-violet-820:#050306 !important;--cds-violet-830:#050306 !important;--cds-violet-840:#050306 !important;--cds-violet-850:#050306 !important;--cds-violet-860:#050306 !important;--cds-violet-870:#050306 !important;--cds-violet-880:#050306 !important;--cds-violet-890:#050306 !important;--cds-violet-900:#050306 !important;--cds-magenta-450:#2c2528 !important;--cds-magenta-500:#2c2528 !important;--cds-magenta-550:#252023 !important;--cds-magenta-600:#1c181b !important;--cds-magenta-650:#1c181b !important;--cds-magenta-700:#120f12 !important;--cds-magenta-750:#050306 !important;--cds-magenta-800:#050306 !important;--cds-magenta-810:#050306 !important;--cds-magenta-820:#050306 !important;--cds-magenta-830:#050306 !important;--cds-magenta-840:#050306 !important;--cds-magenta-850:#050306 !important;--cds-magenta-860:#050306 !important;--cds-magenta-870:#050306 !important;--cds-magenta-880:#050306 !important;--cds-magenta-890:#050306 !important;--cds-magenta-900:#050306 !important;--cds-fill-git-added:#1c181b !important;--cds-fill-git-added-hover:#1c181b !important;--cds-fill-git-removed-hover:#2c2528 !important;--cds-fill-git-modified:#252023 !important;--cds-fill-git-modified-hover:#252023 !important;--cds-fill-git-closed:#1c181b !important;--cds-fill-git-closed-hover:#252023 !important;--cds-fill-git-conflicting:#252023 !important;--cds-fill-git-conflicting-hover:#252023 !important;--cds-text-git-added:#1c181b !important;--cds-text-git-removed:#252023 !important;--cds-text-git-modified:#252023 !important;--cds-text-git-closed:#2c2528 !important;--cds-text-git-conflicting:#252023 !important;--cds-text-git-draft:#2c2528 !important;',
    midnight: '--cds-black:#04070f !important;--cds-gray-500:#1c2844 !important;--cds-gray-600:#151f36 !important;--cds-gray-800:#070c18 !important;--cds-gray-850:#070c18 !important;--cds-gray-900:#070c18 !important;--cds-clay-emphasized:#233052 !important;--cds-mineral:#233052 !important;--cds-gray-450:#233052 !important;--cds-gray-550:#1c2844 !important;--cds-gray-650:#151f36 !important;--cds-gray-700:#0d1526 !important;--cds-gray-750:#070c18 !important;--cds-gray-810:#070c18 !important;--cds-gray-820:#070c18 !important;--cds-gray-830:#070c18 !important;--cds-gray-840:#070c18 !important;--cds-gray-860:#070c18 !important;--cds-gray-870:#070c18 !important;--cds-gray-880:#070c18 !important;--cds-gray-890:#070c18 !important;--cds-red-400:#233052 !important;--cds-red-450:#1c2844 !important;--cds-red-500:#1c2844 !important;--cds-red-550:#151f36 !important;--cds-red-600:#151f36 !important;--cds-red-650:#0d1526 !important;--cds-red-700:#0d1526 !important;--cds-red-750:#070c18 !important;--cds-red-800:#070c18 !important;--cds-red-810:#070c18 !important;--cds-red-820:#070c18 !important;--cds-red-830:#070c18 !important;--cds-red-840:#070c18 !important;--cds-red-850:#070c18 !important;--cds-red-860:#070c18 !important;--cds-red-870:#070c18 !important;--cds-red-880:#070c18 !important;--cds-red-890:#070c18 !important;--cds-red-900:#070c18 !important;--cds-orange-350:#233052 !important;--cds-orange-400:#233052 !important;--cds-orange-450:#1c2844 !important;--cds-orange-500:#1c2844 !important;--cds-orange-550:#151f36 !important;--cds-orange-600:#151f36 !important;--cds-orange-650:#0d1526 !important;--cds-orange-700:#070c18 !important;--cds-orange-750:#070c18 !important;--cds-orange-800:#070c18 !important;--cds-orange-810:#070c18 !important;--cds-orange-820:#070c18 !important;--cds-orange-830:#070c18 !important;--cds-orange-840:#070c18 !important;--cds-orange-850:#070c18 !important;--cds-orange-860:#070c18 !important;--cds-orange-870:#070c18 !important;--cds-orange-880:#070c18 !important;--cds-orange-890:#070c18 !important;--cds-orange-900:#070c18 !important;--cds-yellow-250:#233052 !important;--cds-yellow-300:#233052 !important;--cds-yellow-350:#233052 !important;--cds-yellow-400:#1c2844 !important;--cds-yellow-450:#1c2844 !important;--cds-yellow-500:#151f36 !important;--cds-yellow-550:#151f36 !important;--cds-yellow-600:#0d1526 !important;--cds-yellow-650:#0d1526 !important;--cds-yellow-700:#070c18 !important;--cds-yellow-750:#070c18 !important;--cds-yellow-800:#070c18 !important;--cds-yellow-810:#070c18 !important;--cds-yellow-820:#070c18 !important;--cds-yellow-830:#070c18 !important;--cds-yellow-840:#070c18 !important;--cds-yellow-850:#070c18 !important;--cds-yellow-860:#070c18 !important;--cds-yellow-870:#070c18 !important;--cds-yellow-880:#070c18 !important;--cds-yellow-890:#070c18 !important;--cds-yellow-900:#070c18 !important;--cds-green-300:#233052 !important;--cds-green-350:#1c2844 !important;--cds-green-400:#0d1526 !important;--cds-green-450:#070c18 !important;--cds-green-500:#070c18 !important;--cds-green-550:#070c18 !important;--cds-green-600:#070c18 !important;--cds-green-650:#070c18 !important;--cds-green-700:#070c18 !important;--cds-green-750:#070c18 !important;--cds-green-800:#070c18 !important;--cds-green-810:#070c18 !important;--cds-green-820:#070c18 !important;--cds-green-830:#070c18 !important;--cds-green-840:#070c18 !important;--cds-green-850:#070c18 !important;--cds-green-860:#070c18 !important;--cds-green-870:#070c18 !important;--cds-green-880:#070c18 !important;--cds-green-890:#070c18 !important;--cds-green-900:#070c18 !important;--cds-aqua-300:#233052 !important;--cds-aqua-350:#1c2844 !important;--cds-aqua-400:#1c2844 !important;--cds-aqua-450:#1c2844 !important;--cds-aqua-500:#151f36 !important;--cds-aqua-550:#151f36 !important;--cds-aqua-600:#0d1526 !important;--cds-aqua-650:#0d1526 !important;--cds-aqua-700:#070c18 !important;--cds-aqua-750:#070c18 !important;--cds-aqua-800:#070c18 !important;--cds-aqua-810:#070c18 !important;--cds-aqua-820:#070c18 !important;--cds-aqua-830:#070c18 !important;--cds-aqua-840:#070c18 !important;--cds-aqua-850:#070c18 !important;--cds-aqua-860:#070c18 !important;--cds-aqua-870:#070c18 !important;--cds-aqua-880:#070c18 !important;--cds-aqua-890:#070c18 !important;--cds-aqua-900:#070c18 !important;--cds-blue-450:#233052 !important;--cds-blue-500:#233052 !important;--cds-blue-550:#1c2844 !important;--cds-blue-600:#151f36 !important;--cds-blue-650:#151f36 !important;--cds-blue-700:#0d1526 !important;--cds-blue-750:#070c18 !important;--cds-blue-800:#070c18 !important;--cds-blue-810:#070c18 !important;--cds-blue-820:#070c18 !important;--cds-blue-830:#070c18 !important;--cds-blue-840:#070c18 !important;--cds-blue-850:#070c18 !important;--cds-blue-860:#070c18 !important;--cds-blue-870:#070c18 !important;--cds-blue-880:#070c18 !important;--cds-blue-890:#070c18 !important;--cds-blue-900:#070c18 !important;--cds-violet-500:#233052 !important;--cds-violet-550:#233052 !important;--cds-violet-600:#1c2844 !important;--cds-violet-650:#151f36 !important;--cds-violet-700:#151f36 !important;--cds-violet-750:#0d1526 !important;--cds-violet-800:#070c18 !important;--cds-violet-810:#070c18 !important;--cds-violet-820:#070c18 !important;--cds-violet-830:#070c18 !important;--cds-violet-840:#070c18 !important;--cds-violet-850:#070c18 !important;--cds-violet-860:#070c18 !important;--cds-violet-870:#070c18 !important;--cds-violet-880:#070c18 !important;--cds-violet-890:#070c18 !important;--cds-violet-900:#070c18 !important;--cds-magenta-450:#233052 !important;--cds-magenta-500:#233052 !important;--cds-magenta-550:#1c2844 !important;--cds-magenta-600:#151f36 !important;--cds-magenta-650:#151f36 !important;--cds-magenta-700:#0d1526 !important;--cds-magenta-750:#070c18 !important;--cds-magenta-800:#070c18 !important;--cds-magenta-810:#070c18 !important;--cds-magenta-820:#070c18 !important;--cds-magenta-830:#070c18 !important;--cds-magenta-840:#070c18 !important;--cds-magenta-850:#070c18 !important;--cds-magenta-860:#070c18 !important;--cds-magenta-870:#070c18 !important;--cds-magenta-880:#070c18 !important;--cds-magenta-890:#070c18 !important;--cds-magenta-900:#070c18 !important;--cds-fill-git-added:#151f36 !important;--cds-fill-git-added-hover:#151f36 !important;--cds-fill-git-removed-hover:#233052 !important;--cds-fill-git-modified:#1c2844 !important;--cds-fill-git-modified-hover:#1c2844 !important;--cds-fill-git-closed:#151f36 !important;--cds-fill-git-closed-hover:#1c2844 !important;--cds-fill-git-conflicting:#1c2844 !important;--cds-fill-git-conflicting-hover:#1c2844 !important;--cds-text-git-added:#151f36 !important;--cds-text-git-removed:#1c2844 !important;--cds-text-git-modified:#1c2844 !important;--cds-text-git-closed:#233052 !important;--cds-text-git-conflicting:#1c2844 !important;--cds-text-git-draft:#233052 !important;',
  };

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
    var RING = '{content:"";position:absolute;inset:-2px;border-radius:var(--cd-composer-radius,14px);padding:2px;background:linear-gradient(135deg,var(--cd-accent-from),var(--cd-accent-to),var(--cd-accent-from),var(--cd-accent-to));background-size:300% 300%;animation:cdGradShift 6s steps(30) infinite;-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask-composite:exclude;pointer-events:none;z-index:5}';

    // [class*="X"] matcht auch Tailwinds Opacity-Modifier "X/NN" (z.B. eine helle 5%-Toenung
    // fuer einen Preis-Chip), die sonst faelschlich volldeckend geschwaerzt wird und ihren
    // eigenen (auf hell gedachten) Text unsichtbar macht. :not() schliesst genau diese Variante aus.
    function safeBg(scope, tokens, color) {
      return tokens.map(function (t) {
        return scope + ' [class*="' + t + '"]:not([class*="' + t + '/"])';
      }).join(',') + '{background-color:' + color + ' !important}';
    }

    // Vorab-Override fuer claude.ais Brand-Ton. Der volle Variablen-Scan in theme.js laeuft
    // erst bei DOMContentLoaded; bis dahin zeigt das Spark-Logo im Chat sein Original-Orange,
    // gemessen 1.2s nach einem Reload und auf langsamen Geraeten laenger. --cds-clay ist die
    // Variable, aus der das Logo seinen fill zieht (Attribut fill="var(--cds-clay,#d97757)");
    // claude.ai definiert sie ein zweites Mal auf .cds-root-Containern mitten im Baum, sonst
    // erbt das Logo dort wieder das Original. Haengt wie Matrix nur ein, wenn es auch greift.
    // Flaechenpalette vorab, damit der erste Paint schon im Theme liegt.
    var surfVorab = SURFACE_VORAB[st.mode]
      ? ['html[data-cd-theme="' + st.mode + '"][data-cd-surface="dark"]{' + SURFACE_VORAB[st.mode] + '}']
      : [];

    var brandVorab = (st.design !== 'modern' || st.mode === 'light') ? [] : [
      D + ',' + D + ' .cds-root{--cds-clay:' + ((st.accent && st.accent.mid) || '#E8524F') + ' !important}'
    ];

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
      // steps(30) statt ease-in-out: steps gilt je Keyframe-Abschnitt, 2 x 30 in 6s = zehn Stufen/s. Das Verschieben der
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
    ].concat(matrixRegeln).concat(brandVorab).concat(surfVorab).concat([O, M, X].map(function (S) {
      // Die Zeile um "Neu" traegt Auswahl und Hover selbst, ein gefaerbter Link darin wirkt zweifarbig.
      return S + ' [class*="df-row-h"]>a,' + S + ' [class*="df-row-h"]>a:hover{background-color:transparent !important}';
    })).concat([
      // data-cd-idle setzt main, solange das Fenster keinen Fokus hat. Ring und Regen stehen dann
      // still, sonst laufen sie auf einem zweiten Monitor oder hinter anderen Fenstern weiter.
      'html[data-cd-idle] .cd-composer::before,html[data-cd-idle] fieldset .rounded-composer::before,html[data-cd-idle] #cd-rain{animation-play-state:paused !important}',
      // Classic hat keinen Ring, dann braucht die Eingabekarte ihren eigenen Rand zurueck. Die dunklen
      // Themes setzen ihn fuer den Ring auf transparent, ohne ihn hob sich die Karte kaum ab.
      'html[data-cd-design="classic"][data-cd-theme][data-cd-surface] .cd-composer{border-color:revert-layer !important}'
    ]).concat([
      // Boot-Composer: claude.ai zeigt bis zur Hydration ein statisches Kartenstueck (id static-composer-box, kein fieldset).
      D + ' #static-composer-box{position:relative;overflow:visible !important;--cd-composer-radius:16px}',
      D + ' #static-composer-box::before' + RING,
      W + '[data-cd-design="modern"] #static-composer-box::before{filter:invert(1) hue-rotate(180deg)}'
    ]).join('');
  }

  return { buildStaticCSS: buildStaticCSS, sparkleBg: sparkleBg };
});
