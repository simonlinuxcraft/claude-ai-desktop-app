(function() {
  if (window._cdNotify) return;
  window._cdNotify = true;
  if (window._cdNotifyInterval) { clearInterval(window._cdNotifyInterval); window._cdNotifyInterval = null; }

  // Heuristik: claude.ai zeigt waehrend Generation einen Stop-Button und tauscht ihn
  // gegen einen Send-Button, sobald Claude fertig ist. Wir beobachten den Stop-Button
  // im Composer und feuern ein Event, wenn er verschwindet.
  //
  // Mehrere Selektor-Strategien als Fallback-Stack: wenn claude.ai eine Strategie
  // bricht, greifen die anderen. Bei Erst-Match jeder Strategie loggen wir einmal,
  // damit man bei Regressionen in DevTools sieht welche noch greift.

  // Wortgrenzen: ohne sie traf "halt" auch "Inhalt kopieren".
  var STOP_RE = /\b(stop|stoppen|abbrechen|abbruch|halt)\b/i;
  var lastFire = 0;
  var COOLDOWN = 2000;
  var wasGenerating = false;
  var strategiesUsed = {};

  function logStrategy(id, name) {
    if (strategiesUsed[id]) return;
    strategiesUsed[id] = true;
    try { console.info('[claudeDesktop.notify] stop-button via strategy', id, name); } catch (e) {}
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    try {
      var st = getComputedStyle(el);
      if (st.position === 'fixed' && st.display !== 'none' && st.visibility !== 'hidden') return true;
    } catch (e) {}
    return false;
  }

  // Der Stop-Button sitzt immer am Composer. Ohne diese Eingrenzung traf die Suche auch
  // Eintraege aus Sidebar und Nachrichtenliste, z.B. "Weitere Optionen fuer <Chat> abbrechen",
  // und die Heuristik meldete dauerhaft "generiert". Ohne Composer bleibt das ganze Dokument.
  function scope() {
    var ed = document.querySelector('div[contenteditable="true"]');
    // Ohne Eingabefeld antwortet Claude auch nicht. Die Suche im ganzen Dokument traf auf
    // Seiten wie Einstellungen oder Projekte Eintraege wie "Inhalt" und hielt den Tab fuer busy.
    if (!ed) return null;
    var form = ed.closest('form');
    if (form) return form;
    // Bis zum ersten Vorfahren hoch, der ueberhaupt Buttons enthaelt: das ist die
    // Composer-Leiste (gemessen 5 Ebenen ueber dem Eingabefeld, mit Senden, Diktieren,
    // Modellwahl). Selbstkalibrierend, damit ein Layout-Umbau bei claude.ai nicht sofort
    // den Scope leert und die Erkennung stumm schaltet.
    var n = ed;
    for (var up = 0; up < 8 && n.parentElement; up++) {
      n = n.parentElement;
      if (n.querySelector('button')) return n;
    }
    return document;
  }

  function findStopButton() {
    var root = scope();
    if (!root) return null;
    // 1. aria-label (DE+EN), mit Wortgrenzen nachgeprueft wie Strategie 4
    var arias = root.querySelectorAll('button[aria-label*="stop" i], button[aria-label*="abbrechen" i], button[aria-label*="halt" i]');
    for (var a = 0; a < arias.length; a++) {
      if (STOP_RE.test(arias[a].getAttribute('aria-label') || '') && isVisible(arias[a])) { logStrategy(1, 'aria-label'); return arias[a]; }
    }
    // 2. data-testid
    var byTest = root.querySelector('button[data-testid*="stop" i]');
    if (byTest && isVisible(byTest)) { logStrategy(2, 'data-testid'); return byTest; }
    // 3. SVG-Icon mit data-icon oder ueber svg-rect (Stop-Symbol = Quadrat)
    var byDataIcon = root.querySelector('button [data-icon="stop" i], button [data-icon="square" i]');
    if (byDataIcon) {
      var btn = byDataIcon.closest('button');
      if (btn && isVisible(btn)) { logStrategy(3, 'data-icon'); return btn; }
    }
    // 4. Textinhalt-Fallback
    var btns = root.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var l = (b.getAttribute('aria-label') || b.textContent || '').trim();
      if (l && STOP_RE.test(l) && isVisible(b)) {
        logStrategy(4, 'text-content');
        return b;
      }
    }
    return null;
  }

  function getLastAssistantPreview() {
    try {
      var selectors = [
        '[data-testid="assistant-message"]',
        'div.font-claude-message',
        '[class*="assistant"][class*="message"]'
      ];
      for (var s = 0; s < selectors.length; s++) {
        var msgs = document.querySelectorAll(selectors[s]);
        if (msgs.length === 0) continue;
        var last = msgs[msgs.length - 1];
        if (!last) continue;
        var text = (last.innerText || '').replace(/\s+/g, ' ').trim();
        if (text) return text.slice(0, 200);
      }
    } catch (e) {}
    return '';
  }

  function report(on) {
    try {
      if (window.claudeDesktop && typeof window.claudeDesktop.generating === 'function') window.claudeDesktop.generating(on);
    } catch (e) {}
  }

  function tick() {
    var stopBtn = findStopButton();
    var generating = !!stopBtn;
    if (generating !== wasGenerating) report(generating);
    if (wasGenerating && !generating) {
      var now = Date.now();
      if (now - lastFire >= COOLDOWN) {
        lastFire = now;
        try {
          if (window.claudeDesktop && typeof window.claudeDesktop.responseDone === 'function') {
            window.claudeDesktop.responseDone({ preview: getLastAssistantPreview() });
          }
        } catch (e) {}
      }
    }
    wasGenerating = generating;
  }

  // Polling reicht aus — DOM-Mutationen sind haeufig, aber wir wollen nur den
  // Uebergang erkennen. 700ms ist ein Kompromiss aus Latenz und CPU.
  // Nach einem Neuladen kann der alte Stand noch "antwortet" sein.
  report(false);
  window._cdNotifyInterval = setInterval(tick, 700);
})();
