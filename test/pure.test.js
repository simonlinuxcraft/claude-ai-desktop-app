'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  compareVersions,
  safeJson,
  isClaudeAiOrigin,
  isPaymentFrameDomain,
  looksLikeOAuthUrl,
  filterNotifications,
  scaleWindow,
  validateAccelerator,
  resolveThemeMode,
  resolveDesignStyle
} = require('../utils/pure');

test('compareVersions: gleiche Version', () => {
  assert.equal(compareVersions('1.3.7', '1.3.7'), 0);
});

test('compareVersions: Patch hoeher', () => {
  assert.ok(compareVersions('1.3.8', '1.3.7') > 0);
});

test('compareVersions: Minor hoeher schlaegt Patch', () => {
  assert.ok(compareVersions('1.4.0', '1.3.99') > 0);
});

test('compareVersions: Pre-Release < Stable mit gleicher Versionsnummer', () => {
  assert.ok(compareVersions('1.3.0-beta.1', '1.3.0') < 0);
  assert.ok(compareVersions('1.3.0', '1.3.0-beta.1') > 0);
});

test('compareVersions: zwei Pre-Releases vergleichen lexikografisch', () => {
  assert.ok(compareVersions('1.3.0-beta.1', '1.3.0-beta.2') < 0);
});

test('compareVersions: fehlende Patch-Stelle wird als 0 gewertet', () => {
  assert.equal(compareVersions('1.3', '1.3.0'), 0);
});

test('safeJson: escaped </script', () => {
  const out = safeJson({ html: '<script>alert(1)</script>' });
  assert.ok(!out.includes('</script>'));
  assert.ok(!out.includes('<'));
  assert.deepEqual(JSON.parse(out), { html: '<script>alert(1)</script>' });
});

test('safeJson: <!-- kann den Script-Block nicht offen halten', () => {
  const out = safeJson({ prefix: '<!-- <script>' });
  assert.ok(!out.includes('<'));
  assert.equal(JSON.parse(out).prefix, '<!-- <script>');
});

test('safeJson: case-insensitive </SCRIPT', () => {
  const out = safeJson({ html: '</SCRIPT>' });
  assert.ok(!/<\/script/i.test(out));
});

test('safeJson: normales Objekt unveraendert', () => {
  assert.equal(safeJson({ a: 1, b: 'x' }), '{"a":1,"b":"x"}');
});

test('isClaudeAiOrigin: claude.ai akzeptiert', () => {
  assert.equal(isClaudeAiOrigin('https://claude.ai'), true);
  assert.equal(isClaudeAiOrigin('https://claude.ai/chat/abc'), true);
});

test('isClaudeAiOrigin: Subdomains akzeptiert', () => {
  assert.equal(isClaudeAiOrigin('https://api.claude.ai'), true);
  assert.equal(isClaudeAiOrigin('https://app.claude.ai/x'), true);
});

test('isClaudeAiOrigin: claudeusercontent.com abgelehnt', () => {
  assert.equal(isClaudeAiOrigin('https://www.claudeusercontent.com'), false);
  assert.equal(isClaudeAiOrigin('https://claudeusercontent.com'), false);
});

test('isClaudeAiOrigin: Spoofing-Versuche abgelehnt', () => {
  assert.equal(isClaudeAiOrigin('https://evilclaude.ai'), false);
  assert.equal(isClaudeAiOrigin('https://claude.ai.evil.com'), false);
  assert.equal(isClaudeAiOrigin('https://claude-ai.com'), false);
});

test('isClaudeAiOrigin: HTTP (nicht HTTPS) abgelehnt', () => {
  assert.equal(isClaudeAiOrigin('http://claude.ai'), false);
});

test('isClaudeAiOrigin: file:/data: abgelehnt', () => {
  assert.equal(isClaudeAiOrigin('file:///etc/passwd'), false);
  assert.equal(isClaudeAiOrigin('data:text/html,<h1>x</h1>'), false);
});

test('isClaudeAiOrigin: ungueltige URL abgelehnt', () => {
  assert.equal(isClaudeAiOrigin('not a url'), false);
  assert.equal(isClaudeAiOrigin(''), false);
  assert.equal(isClaudeAiOrigin(null), false);
  assert.equal(isClaudeAiOrigin(undefined), false);
});

// Stripe rendert den Bezahlvorgang auf claude.ai/upgrade komplett in eigene iframes.
// Fehlt einer dieser Hosts, blockt der Subframe-Guard ihn still und der Kauf bleibt
// im pulsierenden Platzhalter haengen, ohne Fehlermeldung. Die Hostliste ist gegen
// eine echte Sitzung gemessen, dieser Test haelt sie fest.
test('isPaymentFrameDomain: gemessene Stripe-Frame-Hosts erlaubt', () => {
  assert.equal(isPaymentFrameDomain('https://js.stripe.com/v3/controller-with-preconnect-abc.html'), true);
  assert.equal(isPaymentFrameDomain('https://js.stripe.com/v3/elements-inner-card-abc.html'), true);
  assert.equal(isPaymentFrameDomain('https://m.stripe.network/inner.html'), true);
  assert.equal(isPaymentFrameDomain('https://b.stripecdn.com/stripethirdparty-srv/assets/v33.6/HCaptchaInvisible.html'), true);
  assert.equal(isPaymentFrameDomain('https://newassets.hcaptcha.com/captcha/v1/abc/static/hcaptcha.html'), true);
  assert.equal(isPaymentFrameDomain('https://hooks.stripe.com/3d_secure_2/hosted'), true);
  assert.equal(isPaymentFrameDomain('https://pay.google.com/gp/p/ui/payframe'), true);
});

test('isPaymentFrameDomain: reine XHR-Hosts nicht in der Frame-Allowlist', () => {
  // Diese laufen als XHR und passieren den Frame-Guard nie, sie gehoeren nicht hinein.
  assert.equal(isPaymentFrameDomain('https://r.stripe.com/b'), false);
  assert.equal(isPaymentFrameDomain('https://m.stripe.com/6'), false);
  assert.equal(isPaymentFrameDomain('https://merchant-ui-api.stripe.com/x'), false);
});

test('isPaymentFrameDomain: Spoofing und http abgelehnt', () => {
  assert.equal(isPaymentFrameDomain('https://js.stripe.com.evil.net/x'), false);
  assert.equal(isPaymentFrameDomain('https://evil-js.stripe.com'), false);
  assert.equal(isPaymentFrameDomain('https://stripe.com'), false);
  assert.equal(isPaymentFrameDomain('http://js.stripe.com/v3/controller.html'), false);
  assert.equal(isPaymentFrameDomain('not a url'), false);
});

test('validateAccelerator: simple Modifier+Key', () => {
  assert.equal(validateAccelerator('CommandOrControl+Shift+E'), 'CommandOrControl+Shift+E');
  assert.equal(validateAccelerator('Alt+Space'), 'Alt+Space');
});

test('validateAccelerator: F-Tasten und Spezialtasten', () => {
  assert.equal(validateAccelerator('F11'), 'F11');
  assert.equal(validateAccelerator('Ctrl+Up'), 'Ctrl+Up');
});

test('validateAccelerator: leerer/zu langer String abgelehnt', () => {
  assert.equal(validateAccelerator(''), null);
  assert.equal(validateAccelerator('x'.repeat(100)), null);
});

test('validateAccelerator: nicht-string abgelehnt', () => {
  assert.equal(validateAccelerator(null), null);
  assert.equal(validateAccelerator(undefined), null);
  assert.equal(validateAccelerator(123), null);
});

test('validateAccelerator: Junk abgelehnt', () => {
  assert.equal(validateAccelerator('not a hotkey'), null);
  assert.equal(validateAccelerator('CommandOrControl+'), null);
  assert.equal(validateAccelerator('+E'), null);
});

test('resolveThemeMode: neues Feld gewinnt', () => {
  assert.equal(resolveThemeMode({ themeMode: 'midnight', isDarkMode: true, oledMode: false }), 'midnight');
  assert.equal(resolveThemeMode({ themeMode: 'light' }), 'light');
});

test('resolveThemeMode: Alt-State ohne themeMode wird migriert', () => {
  assert.equal(resolveThemeMode({ isDarkMode: true, oledMode: true }), 'oled');
  assert.equal(resolveThemeMode({ isDarkMode: false, oledMode: false }), 'light');
  assert.equal(resolveThemeMode({ isDarkMode: true, oledMode: false }), 'dark');
});

test('resolveThemeMode: leerer/kaputter State faellt auf dark', () => {
  assert.equal(resolveThemeMode({}), 'dark');
  assert.equal(resolveThemeMode(null), 'dark');
  assert.equal(resolveThemeMode({ themeMode: 'neon' }), 'dark');
});

test('resolveDesignStyle: neues Feld gewinnt', () => {
  assert.equal(resolveDesignStyle({ designStyle: 'neon', customDesign: false }), 'neon');
  assert.equal(resolveDesignStyle({ designStyle: 'classic' }), 'classic');
});

test('resolveDesignStyle: alter Boolean wird migriert', () => {
  assert.equal(resolveDesignStyle({ customDesign: false }), 'classic');
  assert.equal(resolveDesignStyle({ customDesign: true }), 'modern');
});

test('resolveDesignStyle: leerer/kaputter State faellt auf modern', () => {
  assert.equal(resolveDesignStyle({}), 'modern');
  assert.equal(resolveDesignStyle(null), 'modern');
  assert.equal(resolveDesignStyle({ designStyle: 'pink' }), 'modern');
});

// looksLikeOAuthUrl entscheidet, ob eine fremde Seite im rahmenlosen App-Fenster
// aufgeht statt im Systembrowser. Zu weit gefasst ist das eine Phishing-Flaeche.

test('looksLikeOAuthUrl: echte Authorize-URLs werden erkannt', () => {
  assert.equal(looksLikeOAuthUrl('https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=x&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&scope=email'), true);
  assert.equal(looksLikeOAuthUrl('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=x&response_type=code'), true);
  assert.equal(looksLikeOAuthUrl('https://mcp.example.org/authorize?client_id=x&code_challenge=y'), true);
  // Ein Parameter genuegt, wenn der Pfad zusaetzlich nach OAuth aussieht.
  assert.equal(looksLikeOAuthUrl('https://mcp.example.org/oauth2/authorize?client_id=x'), true);
});

test('looksLikeOAuthUrl: harmlos aussehende Fremdlinks werden abgelehnt', () => {
  // Pfad allein reicht nicht mehr: das war der Weg, ueber den ein Chat-Link jede
  // Seite ins App-Fenster holen konnte.
  assert.equal(looksLikeOAuthUrl('https://evil.example/sso/'), false);
  assert.equal(looksLikeOAuthUrl('https://evil.example/oauth/'), false);
  // Ein einzelner Parameter ohne OAuth-Pfad reicht ebenfalls nicht.
  assert.equal(looksLikeOAuthUrl('https://evil.example/?client_id=x'), false);
  assert.equal(looksLikeOAuthUrl('https://evil.example/landing?scope=all'), false);
});

test('looksLikeOAuthUrl: nur https, Junk faellt durch', () => {
  assert.equal(looksLikeOAuthUrl('http://example.org/authorize?client_id=x&response_type=code'), false);
  assert.equal(looksLikeOAuthUrl('javascript:alert(1)'), false);
  assert.equal(looksLikeOAuthUrl('nicht mal eine url'), false);
  assert.equal(looksLikeOAuthUrl(''), false);
  assert.equal(looksLikeOAuthUrl(null), false);
});

// filterNotifications verarbeitet eine JSON-Datei aus dem Netz. Alles darin ist
// nicht vertrauenswuerdig, deshalb muss jedes Feld typgeprueft und gekappt werden.

const notif = (over = {}) => ({ notifications: [{ id: 'a', title: 'T', ...over }] });

test('filterNotifications: gueltige Notification kommt durch', () => {
  const out = filterNotifications(notif({ body: 'B', severity: 'warn' }));
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'a');
  assert.equal(out[0].severity, 'warn');
  assert.equal(out[0].dismissible, true);
});

test('filterNotifications: kaputter Payload ergibt leere Liste', () => {
  assert.deepEqual(filterNotifications(null), []);
  assert.deepEqual(filterNotifications({}), []);
  assert.deepEqual(filterNotifications({ notifications: 'nope' }), []);
  assert.deepEqual(filterNotifications({ notifications: [null, 42, 'x'] }), []);
});

test('filterNotifications: Pflichtfelder und Laengen werden erzwungen', () => {
  assert.equal(filterNotifications(notif({ id: '' })).length, 0);
  assert.equal(filterNotifications(notif({ id: 'x'.repeat(81) })).length, 0);
  assert.equal(filterNotifications({ notifications: [{ id: 'a' }] }).length, 0);
  const long = filterNotifications(notif({ title: 'T'.repeat(500), body: 'B'.repeat(900), linkLabel: 'L'.repeat(200) }))[0];
  assert.equal(long.title.length, 200);
  assert.equal(long.body.length, 600);
  assert.equal(long.linkLabel.length, 60);
});

test('filterNotifications: nur https-Links, alles andere wird verworfen', () => {
  assert.equal(filterNotifications(notif({ link: 'https://example.org' }))[0].link, 'https://example.org');
  assert.equal(filterNotifications(notif({ link: 'http://example.org' }))[0].link, null);
  assert.equal(filterNotifications(notif({ link: 'javascript:alert(1)' }))[0].link, null);
  assert.equal(filterNotifications(notif({ link: 42 }))[0].link, null);
});

test('filterNotifications: unbekannte Severity faellt auf info', () => {
  assert.equal(filterNotifications(notif({ severity: 'boom' }))[0].severity, 'info');
  assert.equal(filterNotifications(notif({ severity: 'critical' }))[0].severity, 'critical');
});

test('filterNotifications: Version, Plattform, Ablauf und dismissed filtern', () => {
  const ctx = { appVersion: '1.4.17' };
  assert.equal(filterNotifications(notif({ minVersion: '1.5.0' }), ctx).length, 0);
  assert.equal(filterNotifications(notif({ minVersion: '1.4.0' }), ctx).length, 1);
  assert.equal(filterNotifications(notif({ maxVersion: '1.4.0' }), ctx).length, 0);
  assert.equal(filterNotifications(notif({ if: 'snap' }), { isSnap: false }).length, 0);
  assert.equal(filterNotifications(notif({ if: 'snap' }), { isSnap: true }).length, 1);
  assert.equal(filterNotifications(notif({ expires: '2000-01-01' })).length, 0);
  assert.equal(filterNotifications(notif({ expires: '2999-01-01' })).length, 1);
  assert.equal(filterNotifications(notif(), { dismissedIds: ['a'] }).length, 0);
});

test('filterNotifications: hoechstens 10 Eintraege', () => {
  const many = { notifications: Array.from({ length: 25 }, (_, i) => ({ id: 'n' + i, title: 'T' })) };
  assert.equal(filterNotifications(many).length, 10);
});

// scaleWindow bestimmt Groesse und Zoom aller Dialoge. Ein Fehler hier heisst entweder
// abgeschnittene Fenster oder unlesbar kleine Schrift, je nach Monitor des Nutzers.

const SCHIRME = {
  netbook:    { width: 1024, height: 600 },
  laptop:     { width: 1366, height: 730 },
  hd:         { width: 1600, height: 860 },
  fullhd:     { width: 1920, height: 1080 },
  fullhdPanel:{ width: 1920, height: 1010 },
  wqhd:       { width: 2560, height: 1400 },
  ultrawide:  { width: 3440, height: 1400 },
  uhd:        { width: 3840, height: 2100 }
};
// Die im Code verwendeten Design-Massen, Stand nach der Proportions-Anpassung.
const DIALOGE = [
  ['Bug-Report', 720, 910], ['Settings', 660, 740], ['What\u2019s New', 700, 720],
  ['About', 600, 620], ['Design', 640, 700], ['MessageBox', 480, 260],
  ['Mic-Consent', 520, 480], ['Quick-Prompt', 600, 160], ['Hauptfenster', 1200, 800]
];

test('scaleWindow: kein Dialog laeuft je ueber die Arbeitsflaeche', () => {
  for (const [name, wa] of Object.entries(SCHIRME)) {
    for (const [dlg, w, h] of DIALOGE) {
      const r = scaleWindow(w, h, wa);
      assert.ok(r.width <= wa.width, `${name}/${dlg}: zu breit (${r.width} > ${wa.width})`);
      assert.ok(r.height <= wa.height, `${name}/${dlg}: zu hoch (${r.height} > ${wa.height})`);
    }
  }
});

test('scaleWindow: Referenzaufloesung laesst die Designmasse unveraendert', () => {
  for (const [, w, h] of DIALOGE) {
    const r = scaleWindow(w, h, SCHIRME.fullhd);
    assert.equal(r.width, w);
    assert.equal(r.height, h);
    assert.equal(r.scale, 1);
  }
});

test('scaleWindow: groessere Schirme skalieren hoch, gedeckelt', () => {
  assert.ok(scaleWindow(540, 820, SCHIRME.wqhd).scale > 1.2);
  // 4K wuerde rechnerisch Faktor 2 ergeben, der Deckel haelt bei 1.6.
  assert.equal(scaleWindow(540, 820, SCHIRME.uhd).scale, 1.6);
});

test('scaleWindow: 4K bei 200% Systemskalierung bleibt wie Full HD', () => {
  // Electron meldet logische Pixel, die Systemskalierung darf nicht doppelt wirken.
  const r = scaleWindow(540, 820, { width: 1920, height: 1050 });
  assert.equal(r.scale, 1);
  assert.equal(r.width, 540);
});

test('scaleWindow: kleine Dialoge schrumpfen auf kleinen Schirmen nicht unnoetig', () => {
  // 540x480 passt auf 1366x730 problemlos und muss unangetastet bleiben.
  const r = scaleWindow(540, 480, SCHIRME.laptop);
  assert.equal(r.scale, 1);
  assert.equal(r.height, 480);
});

test('scaleWindow: zu hoher Dialog schrumpft genau so weit wie noetig', () => {
  const r = scaleWindow(540, 820, SCHIRME.laptop);
  assert.ok(r.height <= SCHIRME.laptop.height, 'passt nicht auf den Laptop-Schirm');
  assert.ok(r.scale < 1 && r.scale > 0.75, `unerwarteter Faktor ${r.scale}`);
});

test('scaleWindow: Seitenverhaeltnis bleibt erhalten', () => {
  for (const wa of Object.values(SCHIRME)) {
    const r = scaleWindow(560, 700, wa);
    // Solange nicht am Boden geclamped wird, muss das Verhaeltnis stimmen.
    if (r.scale > 0.75) {
      assert.ok(Math.abs(r.width / r.height - 560 / 700) < 0.02, `Verhaeltnis verzerrt bei ${wa.width}x${wa.height}`);
    }
  }
});

test('scaleWindow: kaputte oder fehlende workArea faellt auf die Referenz zurueck', () => {
  for (const bad of [undefined, null, {}, { width: 0, height: 0 }, { width: NaN, height: NaN }]) {
    const r = scaleWindow(540, 480, bad);
    assert.equal(r.width, 540);
    assert.equal(r.height, 480);
    assert.equal(r.scale, 1);
  }
});

// Die grossen Dialoge sollen quadratisch bis leicht hochkant sein, nicht schmal und lang.
// Bug-Report und Einstellungen lagen vorher bei 0.66 bzw. mussten ueber 500px scrollen.
// Ausgenommen: das Hauptfenster (Browserfenster fuer claude.ai, gehoert quer), die
// MessageBox (breiter Standarddialog) und das Quick-Prompt-Overlay (schmaler Balken).
const INHALTSDIALOGE = ['Bug-Report', 'Settings', 'What\u2019s New', 'About', 'Design'];
test('Dialogmasse: Seitenverhaeltnis zwischen 0.75 und 1.1', () => {
  const gross = DIALOGE.filter(([n]) => INHALTSDIALOGE.includes(n));
  assert.equal(gross.length, INHALTSDIALOGE.length, 'ein Inhaltsdialog fehlt in DIALOGE');
  for (const [name, w, h] of gross) {
    const v = w / h;
    assert.ok(v >= 0.75 && v <= 1.1, `${name}: Verhaeltnis ${v.toFixed(2)} ausserhalb 0.75..1.1`);
  }
});

test('filterNotifications: nimmt die Uebersetzung und faellt sonst auf Englisch zurueck', () => {
  const payload = { notifications: [{ id: 'a', title: 'Hello', body: 'Body', linkLabel: 'More',
    i18n: { de: { title: 'Hallo', linkLabel: 'Mehr' }, fr: 'kaputt' } }] };
  const de = filterNotifications(payload, { lang: 'de' })[0];
  assert.equal(de.title, 'Hallo');
  assert.equal(de.body, 'Body');
  assert.equal(de.linkLabel, 'Mehr');
  assert.equal(filterNotifications(payload, { lang: 'fr' })[0].title, 'Hello');
  assert.equal(filterNotifications(payload, { lang: 'it' })[0].title, 'Hello');
});
