'use strict';
// Pure utility functions, frei von Electron-Abhaengigkeiten.
// Werden von main.js requirt UND von node --test getestet.

// Vergleicht Semver-aehnliche Versionen mit optionalem Pre-Release-Suffix.
// 1.3.0-beta.1 < 1.3.0 < 1.3.1
function compareVersions(a, b) {
  const parse = v => {
    const [main, pre] = String(v).split('-');
    return { nums: main.split('.').map(n => parseInt(n, 10) || 0), pre: pre || null };
  };
  const A = parse(a), B = parse(b);
  for (let i = 0; i < 3; i++) {
    const da = A.nums[i] || 0, db = B.nums[i] || 0;
    if (da !== db) return da - db;
  }
  if (A.pre && !B.pre) return -1;
  if (!A.pre && B.pre) return 1;
  if (A.pre && B.pre) return A.pre.localeCompare(B.pre);
  return 0;
}

// JSON.stringify mit Escape von </script-Sequenzen, damit der Output sicher
// inline in <script>...</script> einbettbar ist.
function safeJson(v) {
  return JSON.stringify(v).replace(/<\/(script)/gi, '<\\/$1');
}

// HTML-Escape fuer die inline gebauten Dialog-Seiten. Escaped auch Quotes, damit derselbe
// Helfer in Attributwerten sicher ist und nicht nur zwischen Tags.
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

// Strikte claude.ai-Origin-Validierung. claudeusercontent.com (Artifact-iframes)
// muss explizit AUSGESCHLOSSEN bleiben (z.B. fuer Mic-Permission).
function isClaudeAiOrigin(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return u.hostname === 'claude.ai' || u.hostname.endsWith('.claude.ai');
  } catch { return false; }
}

// Frames, die der Bezahlvorgang auf claude.ai braucht. Stripe rendert seine gesamte UI
// in eigene iframes; ohne diese Freigabe bricht der Subframe-Guard sie ab und das
// Kartenformular bleibt als pulsierender Platzhalter stehen. Alle bis auf hooks.stripe.com
// sind am echten Formular gemessen, hooks traegt die 3DS-Challenge nach dem Absenden.
// pay.google.com ist die Google-Pay-Option, ohne sie fehlt eine Zahlungsart.
// Exakter Hostname-Vergleich, kein endsWith: eine Subdomain-Regel wuerde hier auch
// angreiferkontrollierte Hosts unter denselben Domains einschliessen.
const PAYMENT_FRAME_HOSTS = new Set([
  'js.stripe.com', 'm.stripe.network', 'b.stripecdn.com',
  'newassets.hcaptcha.com', 'hooks.stripe.com', 'pay.google.com'
]);

function isPaymentFrameDomain(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && PAYMENT_FRAME_HOSTS.has(u.hostname);
  } catch { return false; }
}

// Custom-MCP-Connector: der OAuth-Server-Host ist beliebig und steht in keiner Allowlist.
// Erkennt eine OAuth2-Authorize-URL, damit das Popup in-app aufgeht statt im Systembrowser
// (sonst landet der Callback nie in der claude.ai-Session).
// Eng gefasst: RFC 6749 verlangt response_type und client_id, echte Authorize-Endpunkte
// tragen zusaetzlich fast immer redirect_uri, scope oder code_challenge. Ein einzelner
// Parameter reicht deshalb nicht, und der Pfad allein erst recht nicht - ein blosses
// https://fremder-host/sso/ aus einem Chat-Link oeffnete sonst jede Seite im rahmenlosen
// App-Fenster, wo dem Nutzer die Adressleiste zum Gegenpruefen fehlt.
const OAUTH_PARAMS = ['response_type', 'client_id', 'redirect_uri', 'scope', 'code_challenge'];
const OAUTH_PATH_RE = /\/(oauth2?|authorize|authorization|sso)(\/|$)/;

function looksLikeOAuthUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const hits = OAUTH_PARAMS.filter(p => u.searchParams.has(p)).length;
    if (hits >= 2) return true;
    return hits >= 1 && OAUTH_PATH_RE.test(u.pathname.toLowerCase());
  } catch { return false; }
}


// Validiert + filtert eine eingehende Notification-Liste gegen Version, Plattform,
// Ablauf-Datum und bereits dismissed-IDs. Die Liste kommt aus einer JSON-Datei im Netz,
// alles darin ist also nicht vertrauenswuerdig: jedes Feld wird typgeprueft und gekappt,
// Links nur als https. Gibt eine sicher-typisierte Liste zurueck.
// Kontext (App-Version, Plattform, dismissed) kommt als Parameter, damit die Funktion
// ohne Electron testbar bleibt.
const NOTIFICATION_SEVERITIES = new Set(['info', 'warn', 'critical', 'success']);
const NOTIFICATION_VERSION_RE = /^\d+(\.\d+)*(-\S+)?$/;
const MAX_NOTIFICATIONS = 10;

// Uebersetzungen stehen in n.i18n.<lang>.{title,body,linkLabel}. title selbst bleibt ein
// String, sonst verwerfen aeltere App-Versionen den ganzen Hinweis.
function filterNotifications(payload, { appVersion = '0.0.0', isSnap = false, dismissedIds = [], lang = 'en' } = {}) {
  if (!payload || !Array.isArray(payload.notifications)) return [];
  const now = Date.now();
  const out = [];
  for (const n of payload.notifications) {
    if (!n || typeof n !== 'object') continue;
    if (typeof n.id !== 'string' || n.id.length === 0 || n.id.length > 80) continue;
    if (typeof n.title !== 'string' || n.title.length === 0) continue;
    if (dismissedIds.includes(n.id)) continue;
    if (n.if === 'snap' && !isSnap) continue;
    if (n.if === 'appimage' && isSnap) continue;
    if (typeof n.minVersion === 'string' && NOTIFICATION_VERSION_RE.test(n.minVersion) && compareVersions(appVersion, n.minVersion) < 0) continue;
    if (typeof n.maxVersion === 'string' && NOTIFICATION_VERSION_RE.test(n.maxVersion) && compareVersions(appVersion, n.maxVersion) > 0) continue;
    if (typeof n.expires === 'string') {
      const exp = Date.parse(n.expires);
      if (Number.isFinite(exp) && exp < now) continue;
    }
    const loc = n.i18n && typeof n.i18n === 'object' && n.i18n[lang] && typeof n.i18n[lang] === 'object' ? n.i18n[lang] : {};
    const pick = (k) => (typeof loc[k] === 'string' && loc[k].length > 0 ? loc[k] : n[k]);
    out.push({
      id: n.id,
      severity: NOTIFICATION_SEVERITIES.has(n.severity) ? n.severity : 'info',
      title: String(pick('title')).slice(0, 200),
      body: typeof pick('body') === 'string' ? pick('body').slice(0, 600) : '',
      link: (typeof n.link === 'string' && /^https:\/\//i.test(n.link)) ? n.link : null,
      linkLabel: typeof pick('linkLabel') === 'string' ? pick('linkLabel').slice(0, 60) : null,
      dismissible: n.dismissible !== false
    });
  }
  return out.slice(0, MAX_NOTIFICATIONS);
}

// Fenstergroessen proportional zur Arbeitsflaeche.
//
// Die Dialogmasse im Code sind gegen eine 1920x1080-Arbeitsflaeche entworfen. Vorher wurden
// sie nur nach unten abgeschnitten: auf einem 1366x768-Laptop passte der Bug-Report-Dialog
// (820 hoch) nicht und der Inhalt scrollte, auf einem 1440p- oder 4K-Schirm blieb derselbe
// Dialog bei 540x820 stehen und wirkte verloren. Der Inhalt selbst skalierte nie mit.
//
// Hier faellt ein einziger Faktor, mit dem sowohl das Fenster als auch der Seiteninhalt
// (webContents.setZoomFactor) skaliert werden. Weil beides denselben Faktor bekommt, bleibt
// das Layout-Verhaeltnis exakt erhalten - der Dialog wird als Ganzes groesser oder kleiner,
// statt dass Text und Rahmen auseinanderlaufen.
//
// Die Werte sind logische Pixel (DIP): hat der Nutzer sein 4K-Display auf 200% gestellt,
// meldet Electron 1920x1080 und der Faktor bleibt 1. Systemskalierung wird also nicht
// doppelt angewandt.
const UI_REFERENCE = { width: 1920, height: 1080 };
// Obergrenze: darueber wirkt der Dialog aufgeblasen, ohne mehr zu zeigen.
const UI_SCALE_MAX = 1.6;
// Unter diesem Faktor wird Text unangenehm klein. Passt ein Dialog dann immer noch nicht,
// ist Scrollen das kleinere Uebel als unlesbare Schrift.
const UI_SCALE_FLOOR = 0.75;
// Luft zum Bildschirmrand, damit ein Dialog nie buendig an der Kante klebt.
const UI_MARGIN = 60;

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// Liefert { width, height, scale } fuer ein Fenster, das bei Referenzaufloesung
// designWidth x designHeight gross waere. scale gehoert als Zoom-Faktor an den Inhalt.
//
// Hoch skaliert wird global nach Schirmgroesse, herunter nur so weit, wie es dieser
// konkrete Dialog braucht. Sonst wuerde auf einem 1366er Laptop auch ein kleiner Dialog
// schrumpfen, der laengst gepasst haette.
function scaleWindow(designWidth, designHeight, workArea) {
  const wa = workArea || {};
  const waW = Number.isFinite(wa.width) && wa.width > 0 ? wa.width : UI_REFERENCE.width;
  const waH = Number.isFinite(wa.height) && wa.height > 0 ? wa.height : UI_REFERENCE.height;
  const maxW = Math.max(240, waW - UI_MARGIN);
  const maxH = Math.max(180, waH - UI_MARGIN);

  // Groesser als die Referenz? Dann mitwachsen, aber gedeckelt. Kleiner? Erst mal 1.0
  // lassen und weiter unten nur bei Bedarf reduzieren.
  const raw = Math.min(waW / UI_REFERENCE.width, waH / UI_REFERENCE.height);
  let scale = clamp(raw, 1, UI_SCALE_MAX);

  // So weit verkleinern, dass dieser Dialog auf die Arbeitsflaeche passt, aber nicht
  // unter den Lesbarkeits-Boden.
  const fit = Math.min(maxW / designWidth, maxH / designHeight);
  scale = Math.min(scale, Math.max(fit, UI_SCALE_FLOOR));
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;

  // Selbst unterhalb des Bodens darf das Fenster nie ueber den Schirm hinausragen; der
  // Inhalt scrollt dann innen.
  return {
    width: Math.min(Math.round(designWidth * scale), maxW),
    height: Math.min(Math.round(designHeight * scale), maxH),
    scale
  };
}

const HOTKEY_RE = /^(?:(?:Command|Cmd|Control|Ctrl|CommandOrControl|CmdOrCtrl|Alt|Option|AltGr|Shift|Super|Meta)\+)*[A-Za-z0-9]+$|^(?:(?:Command|Cmd|Control|Ctrl|CommandOrControl|CmdOrCtrl|Alt|Option|AltGr|Shift|Super|Meta)\+)*(?:F1[0-9]?|F20|F[1-9]|Plus|Space|Tab|Backspace|Delete|Insert|Return|Enter|Up|Down|Left|Right|Home|End|PageUp|PageDown|Escape|Esc|VolumeUp|VolumeDown|VolumeMute|MediaPlayPause|PrintScreen|numdec|numadd|numsub|nummult|numdiv|num[0-9])$/;

function validateAccelerator(accel) {
  if (typeof accel !== 'string' || accel.length === 0 || accel.length >= 64) return null;
  return HOTKEY_RE.test(accel) ? accel : null;
}

const THEME_MODES = ['light', 'dark', 'oled', 'midnight', 'matrix'];

// Loest den Farbmodus aus einem gespeicherten window-state.json auf. Bis 1.4.15 stand er
// dort in zwei Booleans, seitdem in themeMode. Ohne diese Ableitung startet jede bestehende
// Installation nach dem Update in Dark statt im zuletzt gewaehlten Modus.
function resolveThemeMode(saved) {
  const s = saved || {};
  if (THEME_MODES.includes(s.themeMode)) return s.themeMode;
  if (s.themeMode !== undefined) return 'dark';   // unbekannter Wert, z.B. aus einer neueren Version
  if (s.oledMode === true) return 'oled';
  if (s.isDarkMode === false) return 'light';
  return 'dark';
}

const DESIGN_STYLES = ['modern', 'classic', 'neon', 'matrix'];

// Wie resolveThemeMode, nur fuer den Stil: bis 1.4.15 stand er als Boolean customDesign im
// State (true = Modern, false = Classic), seitdem als designStyle.
function resolveDesignStyle(saved) {
  const s = saved || {};
  if (DESIGN_STYLES.includes(s.designStyle)) return s.designStyle;
  if (s.designStyle !== undefined) return 'modern';
  if (s.customDesign === false) return 'classic';
  return 'modern';
}

module.exports = { compareVersions, safeJson, escapeHtml, filterNotifications, scaleWindow, UI_SCALE_FLOOR, isClaudeAiOrigin, isPaymentFrameDomain, looksLikeOAuthUrl, validateAccelerator, HOTKEY_RE, THEME_MODES, resolveThemeMode, DESIGN_STYLES, resolveDesignStyle };
