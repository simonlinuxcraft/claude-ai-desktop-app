'use strict';
// Preload für claude.ai-Tab-Views.
// Stellt eine schmale Bridge bereit, über die das injected notify.js den Main-Process
// über fertige Antworten informieren kann.
const { contextBridge, ipcRenderer } = require('electron');

// Frame-Heartbeat fuer den Surface-Watchdog in main.js: requestAnimationFrame feuert nur,
// solange der Compositor BeginFrames liefert. Haengt die Surface, bleibt die Antwort aus,
// waehrend IPC und Timer normal weiterlaufen.
// Zwei Antworten: 'alive' sofort (der Renderer lebt), 'raf' nur wenn auch Frames laufen.
ipcRenderer.on('cd-frame-ping', () => {
  ipcRenderer.send('cd-frame-pong', 'alive');
  requestAnimationFrame(() => ipcRenderer.send('cd-frame-pong', 'raf'));
});

contextBridge.exposeInMainWorld('claudeDesktop', {
  responseDone: (payload) => {
    let preview = '';
    if (payload && typeof payload === 'object' && typeof payload.preview === 'string') {
      preview = payload.preview.slice(0, 200);
    }
    ipcRenderer.send('claude-response-done', { preview });
  },
  resetVerification: () => ipcRenderer.send('claude-reset-verification'),
  offlineRetry: () => ipcRenderer.send('cd-offline-retry')
});

// Ein einziger sendSync fuer beide Startaufgaben unten: der Aufruf blockiert den
// Renderer-Start, und die Antwort traegt inzwischen auch den Controller-Quelltext.
var cdState = null;
function cdThemeState() {
  if (cdState === null) {
    try { cdState = ipcRenderer.sendSync('cd-theme-mode') || {}; } catch (e) { cdState = {}; }
  }
  return cdState;
}

// Theme-Controller schon bei document-start in die Seite bringen. main.js injiziert ihn
// zusaetzlich bei dom-ready per executeJavaScript, aber dort landet er hinter Reacts
// Hydration in der Task-Queue: gemessen lief sein Variablen-Scan erst nach 2,3s, mit 6facher
// CPU-Drosselung nach 9,7s. So lange stehen claude.ais Originalfarben in Karten und
// Raendern (sichtbar an der Dokumentkarte, die blau statt themenfarben erschien), obwohl die
// Palette schon ab rund 300ms lesbar ist. Als Script-Tag laeuft der Controller, sobald das
// Dokument existiert; sein init wartet selbst auf DOMContentLoaded. Die zweite Injektion ist
// unschaedlich, der Controller ist ueber window._cdThemeCtl idempotent.
(function () {
  try {
    if (!/(^|\.)claude\.ai$/.test(location.hostname)) return;
    var ctl = cdThemeState().ctl;
    if (!ctl) return;
    var gesetzt = false;
    function setzen() {
      if (gesetzt) return true;
      var de = document.documentElement;
      if (!de) return false;
      var s = document.createElement('script');
      s.textContent = ctl;
      de.appendChild(s);
      s.remove();
      gesetzt = true;
      return true;
    }
    if (!setzen()) {
      var iv = setInterval(function () { if (setzen()) clearInterval(iv); }, 0);
      document.addEventListener('readystatechange', setzen);
    }
  } catch (e) {}
})();

// Anti-FOUC: die Flaechenfarbe schon bei document-start setzen (laeuft vor dem ersten Paint),
// damit beim kalten Start/Tab nicht claude.ais eigenes Grau aufblitzt, bis der Theme-Controller
// bei dom-ready greift. Nur auf claude.ai, nur in Modi die die Seite selbst umfaerben
// (OLED, Mitternachtsblau). Der Controller raeumt das
// cd-theme-preload-Sheet beim Uebernehmen wieder weg (sonst stoert es einen spaeteren Light-Switch).
(function () {
  try {
    if (!/(^|\.)claude\.ai$/.test(location.hostname)) return;
    var st = cdThemeState();
    // Nur Modi, die die Seite selbst umfaerben. dark laeuft auf claude.ais eigener Palette,
    // light auf dem Invert-Filter, beide brauchen kein Vorab-Sheet.
    var PRE_BG = { oled: '#050306', midnight: '#070c18', matrix: '#040806' };
    if (!PRE_BG[st.mode]) return;
    var BG = PRE_BG[st.mode];
    // Sternenfeld identisch zu theme.js sparkleBg(); muss mit theme.js synchron bleiben,
    // damit beim Uebergang Preload -> Controller kein Sprung sichtbar ist.
    function spark() {
      var ac = st.accent || {}, f = ac.from || '#F26A3F', t = ac.to || '#E83B6E';
      function u(x, y, sc, op) { return "<use href='#s' transform='translate(" + x + "," + y + ") scale(" + sc + ")' opacity='" + op + "'/>"; }
      var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='620' height='620' viewBox='0 0 620 620'>"
        + "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='" + f + "'/><stop offset='1' stop-color='" + t + "'/></linearGradient>"
        + "<path id='s' d='M0,-1 L.2245,-.309 L.951,-.309 L.363,.118 L.588,.809 L0,.382 L-.588,.809 L-.363,.118 L-.951,-.309 L-.2245,-.309 Z'/></defs>"
        + "<g fill='url(#g)'>"
        + u(110, 140, 11, .3) + u(430, 95, 7, .2) + u(540, 400, 9, .26)
        + u(230, 500, 6, .18) + u(580, 580, 5, .16) + u(300, 280, 8, .22)
        + "</g></svg>";
      return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    }
    function apply() {
      var de = document.documentElement;
      if (!de) return false;
      // Hat der Controller schon uebernommen, nichts mehr anfassen. Sein Sheet ersetzt
      // dieses hier; ohne die Bremse stellt ein spaeteres readystatechange das Vorab-Sheet
      // wieder her, das er gerade entfernt hat, und das stoert einen Wechsel nach Hell.
      if (document.getElementById('cd-theme-static')) return true;
      de.style.backgroundColor = BG;
      de.setAttribute('data-cd-theme', st.mode);
      de.setAttribute('data-cd-surface', 'dark');
      // data-cd-design und data-cd-rain gehoeren hier genauso hin wie theme und surface:
      // ohne design greift der Brand-Block des statischen Sheets nicht und das Spark-Logo
      // steht bis zum Controller auf claude.ais Orange (gemessen 6x gedrosselt bis 2,4s).
      // rain bewusst 'off': die animierte Ebene legt erst der Controller an, bei 'off' malt
      // der body dasselbe Muster statisch, sonst bleibt der Hintergrund hier leer.
      de.setAttribute('data-cd-design', st.design === 'classic' ? 'classic' : 'modern');
      de.setAttribute('data-cd-rain', 'off');
      if (!document.getElementById('cd-theme-preload')) {
        var s = document.createElement('style');
        s.id = 'cd-theme-preload';
        // Das VOLLE statische Theme schon hier (vor dem ersten Paint), damit der Inhalt
        // sofort gethemt erscheint statt ~1.7s claude.ai-Styling zu zeigen und dann sichtbar
        // umzuspringen (der Controller haengt per executeJavaScript hinter Reacts Hydration).
        // staticCSS kommt aus derselben Quelle wie der Controller (main -> theme-static.js).
        // Fallback (Subset) nur, falls staticCSS mal leer ist, damit dieses Sheet allein traegt.
        s.textContent = (st.staticCSS && st.staticCSS.length) ? st.staticCSS
          : ('html{background-color:' + BG + ' !important}'
          + 'body{background-color:' + BG + ' !important;background-image:' + (st.mode === 'oled' ? spark() : 'none') + ' !important;background-size:620px 620px}'
          + '[class*="bg-bg-"],[class*="bg-black"],[class*="bg-neutral-9"],[class*="bg-zinc-9"],[class*="bg-gray-9"],[class*="bg-stone-9"],[class*="bg-slate-9"]{background-color:' + BG + ' !important}'
          + 'nav,aside,header,[class*="sidebar" i],[class*="Sidebar"],[class*="topbar" i],[class*="TopBar"]{background-color:' + BG + ' !important;background-image:none !important}'
          + 'nav,aside,[class*="sidebar" i],[class*="Sidebar"]{border-right:1px solid rgba(255,255,255,0.07) !important}');
        (document.head || de).appendChild(s);
      }
      return true;
    }
    if (!apply()) {
      var iv = setInterval(function () { if (apply()) clearInterval(iv); }, 0);
      document.addEventListener('readystatechange', apply);
    }
  } catch (e) {}
})();