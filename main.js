'use strict';
const { app, BrowserWindow, WebContentsView, shell, Menu, Tray, globalShortcut, nativeImage, nativeTheme, dialog, Notification, session, ipcMain, net, screen, clipboard, powerMonitor, desktopCapturer } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile, spawn } = require('child_process');
const { version } = require('./package.json');
const { getFilteredNotes } = require('./release-notes');
const { bugReportStrings } = require('./bug-report-strings');
const { compareVersions, safeJson, escapeHtml, filterNotifications, scaleWindow, UI_SCALE_FLOOR, isClaudeAiOrigin, isPaymentFrameDomain, looksLikeOAuthUrl, validateAccelerator, THEME_MODES, resolveThemeMode, DESIGN_STYLES, resolveDesignStyle } = require('./utils/pure');

// Electron "Object has been destroyed" Error-Dialog abfangen
const _origErrorBox = dialog.showErrorBox;
dialog.showErrorBox = (title, content) => {
  if (typeof content === 'string' && content.includes('Object has been destroyed')) return;
  _origErrorBox(title, content);
};

// stdout/stderr EPIPE schlucken. Im Snap ist die stdio-Pipe oft geschlossen; ein
// console.* (z.B. aus electron-updater) wirft dann "write EPIPE" als Uncaught
// Exception und Electron zeigt den Crash-Dialog. Logging darf nie crashen.
process.stdout.on('error', (e) => { if (e && e.code === 'EPIPE') return; });
process.stderr.on('error', (e) => { if (e && e.code === 'EPIPE') return; });

// Auffanglinie fuer verwaiste Promise-Rejections (z.B. ein openExternal das doch
// durchrutscht), damit sie nicht als Crash-Dialog hochkommen. Nur loggen.
process.on('unhandledRejection', (e) => { try { console.error('unhandledRejection:', (e && e.message) || e); } catch {} });

if (app.isPackaged) process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// Wayland-Bypass: BrowserWindow-Positionierung ist unter nativem Wayland
// no-op (Issue #40886, Maintainer-Statement Okt 2025). Loesung: ueber
// XWayland rendern. Der Switch wird zur Build-Zeit im AppImage-Wrapper
// (scripts/after-pack.js) und im Snap (snap/local/electron-launch) immer
// fix gesetzt. Im Dev-Modus muss er manuell beim Start mitgegeben werden:
// `npx electron . --no-sandbox --ozone-platform=x11`. Das `npm run dev`-
// Script in package.json macht das automatisch.

// Sandbox-Fallback
// Belt-and-suspenders zum --no-sandbox-Flag im .desktop-File: greift wenn die App
// ohne Argumente gestartet wird (z.B. nach Auto-Update durch quitAndInstall, oder
// per Doppelklick aus dem Dateimanager). chrome-sandbox-Helper ist auf üblichen
// Linux-Distributionen nicht setuid-konfiguriert, ohne diesen Switch crasht der
// Renderer beim Start. Idempotent zum Wrapper-Flag; muss vor app.whenReady() stehen.
app.commandLine.appendSwitch('no-sandbox');

// Single Instance
// exit statt quit: quit ist asynchron, der Init lief bis dahin komplett durch (Fenster,
// Tray, claude.ai in den Tabs) und das will-quit danach nahm den globalen Hotkey mit.
if (!app.requestSingleInstanceLock()) { app.exit(0); }

// Konstanten

const isDev = !app.isPackaged;
// Chrome reduziert seit v107 die UA-Version auf <major>.0.0.0 (UA Reduction). Die volle
// Build-Version (z.B. 146.0.7680.216) im UA sendet KEIN echter Chrome mehr; nacktes Chromium
// kommt durch die CF-Verifizierung, die App mit voller Version blieb haengen. Volle Version
// gehoert nur in Sec-Ch-Ua-Full-Version-List, nicht in den UA-String.
const chromeUA = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome.split('.')[0]}.0.0.0 Safari/537.36`;

// Wayland erkennen: clientseitige Toplevel-Positionierung wird vom Compositor
// ignoriert (kein xdg_positioner fuer toplevel). Alle x/y-Constructor-Params und
// setPosition()-Aufrufe sind unter Wayland No-ops; statt absoluter Koordinaten
// nutzen wir parent+center:true und ueberlassen die Platzierung dem Compositor.
const isWayland = process.platform === 'linux'
  && (process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY);
// Reverse-DNS-App-ID: Wayland-app_id, X11-Fensterklasse und Identitaet am Portal. Ohne sie
// und ohne gleichnamige .desktop-Datei bindet das GlobalShortcuts-Portal nichts (GNOME 50:
// "App info not found"). Der Snap behaelt seine Identitaet, dort haengt die Zuordnung der
// Benachrichtigungen an CHROME_DESKTOP.
const APP_ID = 'io.github.simonlinuxcraft.DesktopForClaude';
if (!process.env.SNAP) app.setDesktopName(`${APP_ID}.desktop`);
// Nativ statt ueber XWayland: die Wrapper setzen --ozone-platform=x11, ein danach
// angehaengtes --ozone-platform=wayland gewinnt.
const nativeWayland = isWayland && app.commandLine.getSwitchValue('ozone-platform') !== 'x11';
// Globale Hotkeys gibt es nativ unter Wayland nur ueber das Portal, in Electron 44.5 noch
// nicht standardmaessig an.
if (nativeWayland) app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal,GlobalShortcutsPortalPreferredTrigger');

const TAB_BAR_HEIGHT = 40;
const WINDOW_BORDER = 1; // dezenter Fensterrahmen: 1px der Tab-Bar-Border scheint im View-Inset durch
// Eckradius, mit dem Electron 43+ rahmenlose Fenster unter Linux rundet (gemessen an 44.5: 8px).
const CORNER_RADIUS = 8;
const POOL_SIZE = 2;
const MAX_CRASH_RELOADS = 3;
const CRASH_WINDOW_MS = 60_000;
const ONLINE_CHECK_MS = 60_000;
const UPDATE_CHECK_MS = 3_600_000;
const DOMAIN_CACHE_MAX = 50;
// Nachfuellen des Tab-Pools: kurz nach einer Entnahme, laenger nach einem Theme-/Stilwechsel,
// weil dort ohnehin schon neu geladen wird.
const POOL_REFILL_MS = 1200;
const POOL_REFILL_AFTER_SWITCH_MS = 3000;
const POOL_REFILL_FIRST_TAB_MS = 2000;
// Laengstes Prompt, das Quick-Prompt und Clipboard-Chat annehmen. Dieselbe Zahl steht in
// preload-quickprompt.js: der Preload laeuft mit sandbox:true und kann utils/ nicht requiren.
const MAX_PROMPT_CHARS = 8000;
// Wie viele weggeklickte Notification-IDs im State bleiben, bevor die aeltesten fallen.
const MAX_DISMISSED_IDS = 200;
// Groessen, die im hicolor-Icon-Theme gepflegt werden.
const ICON_THEME_SIZES = ['512x512', '256x256', '128x128', '64x64', '48x48', '32x32', '16x16'];

// Live-Notification-System (GitHub-hosted JSON)
const NOTIFICATIONS_URL = 'https://raw.githubusercontent.com/simonlinuxcraft/claude-ai-desktop-app/main/notifications.json';
const NOTIFICATIONS_FETCH_MS = 6 * 60 * 60 * 1000;        // alle 6h
const NOTIFICATIONS_FIRST_FETCH_DELAY_MS = 8 * 1000;       // nach App-Start 8s warten
const NOTIFICATION_BANNER_HEIGHT = 64;
const MAX_NOTIFICATIONS_VISIBLE = 1;                        // ein Banner gleichzeitig

// Injected Scripts (aus Dateien geladen)

const NOTIFY_SCRIPT = fs.readFileSync(path.join(__dirname, 'inject', 'notify.js'), 'utf8');
const VERIFY_SCRIPT = fs.readFileSync(path.join(__dirname, 'inject', 'verify-banner.js'), 'utf8');
// theme-static.js zuerst: definiert window.cdThemeStatic, das theme.js nutzt. Dieselbe
// Quelle liefert das statische Sheet auch fuer den document-start-Preload (buildStaticCSS unten).
const THEME_STATIC_SRC = fs.readFileSync(path.join(__dirname, 'inject', 'theme-static.js'), 'utf8');
const THEME_SCRIPT = THEME_STATIC_SRC + '\n' + fs.readFileSync(path.join(__dirname, 'inject', 'theme.js'), 'utf8');
const { buildStaticCSS: cdBuildStaticCSS } = require(path.join(__dirname, 'inject', 'theme-static.js'));

// State

let mainWindow = null;
let tabs = [];
let activeTabIndex = 0;
let isOnline = true;
let themeMode = 'dark';        // aus THEME_MODES, Reihenfolge dort ist der Cycle der Tab-Leiste
let oledIntroSeen = false;
let designStyle = 'modern';   // aus DESIGN_STYLES

// Tab-Pool (vorgeladene Views)
const viewPool = [];

// Helpers

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function throttle(fn, ms) {
  let last = 0, timer;
  return (...args) => {
    const now = Date.now();
    clearTimeout(timer);
    if (now - last >= ms) { last = now; fn(...args); }
    else { timer = setTimeout(() => { last = Date.now(); fn(...args); }, ms - (now - last)); }
  };
}

// shell.openExternal liefert ein Promise, das unter Snap rejecten kann (Portal/
// xdg-open nicht erreichbar). Ohne .catch wuerde daraus eine unhandled rejection.
function openExternalSafe(url) {
  try { const p = shell.openExternal(url); if (p && p.catch) p.catch(() => {}); } catch {}
}

// Notification kann unter striktem Confinement werfen; ein Throw aus einem async
// Callback oder Event-Handler waere sonst ein Uncaught-Exception-Crash.
function notify(opts) {
  try { new Notification(opts).show(); } catch {}
}

// Sicherer WebContents-Zugriff
function alive(viewOrWc) {
  if (!viewOrWc) return false;
  const wc = viewOrWc.webContents || viewOrWc;
  return wc && !wc.isDestroyed();
}

// i18n (multi-language)

const sysLang = (() => {
  const l = (process.env.LANG || process.env.LANGUAGE || '').toLowerCase();
  if (l.startsWith('de')) return 'de';
  if (l.startsWith('fr')) return 'fr';
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('pt')) return 'pt';
  if (l.startsWith('it')) return 'it';
  if (l.startsWith('nl')) return 'nl';
  if (l.startsWith('pl')) return 'pl';
  if (l.startsWith('ru')) return 'ru';
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('ko')) return 'ko';
  if (l.startsWith('zh')) return 'zh';
  if (l.startsWith('tr')) return 'tr';
  if (l.startsWith('ar')) return 'ar';
  if (l.startsWith('sv')) return 'sv';
  if (l.startsWith('da')) return 'da';
  if (l.startsWith('no') || l.startsWith('nb') || l.startsWith('nn')) return 'no';
  if (l.startsWith('fi')) return 'fi';
  if (l.startsWith('cs')) return 'cs';
  if (l.startsWith('uk')) return 'uk';
  if (l.startsWith('hu')) return 'hu';
  if (l.startsWith('ro')) return 'ro';
  if (l.startsWith('el')) return 'el';
  if (l.startsWith('hi')) return 'hi';
  if (l.startsWith('th')) return 'th';
  if (l.startsWith('vi')) return 'vi';
  if (l.startsWith('id') || l.startsWith('ms')) return 'id';
  return 'en';
})();

// Sprachwahl nach Systemsprache: de/fr/it wenn vorhanden, sonst Englisch-Fallback.
// fr/it sind optional - fehlt die Uebersetzung an einem Aufruf, greift en statt undefined.
function t(de, en, fr, it) {
  if (sysLang === 'de') return de;
  if (sysLang === 'fr') return fr != null ? fr : en;
  if (sysLang === 'it') return it != null ? it : en;
  return en;
}
// Release-Notes-Strings dürfen ein String (legacy: nur Deutsch) oder ein
// { de, en, fr?, it? } Objekt sein. localize() wählt nach Systemsprache und
// fällt auf en (sonst de) zurück, wenn die passende Übersetzung fehlt.
function localize(field) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  if (sysLang === 'de') return field.de || field.en || '';
  if (sysLang === 'fr') return field.fr || field.en || field.de || '';
  if (sysLang === 'it') return field.it || field.en || field.de || '';
  return field.en || field.de || '';
}


// Window-State (persistiert Größe, Position, Theme)

const stateFile = path.join(app.getPath('userData'), 'window-state.json');
let windowState = {};
let lastSavedState = '';
let tray = null;
let isQuitting = false;
let settingsWindow = null;
let designWindow = null;
let quickPromptWindow = null;
let whatsNewWindow = null;
let aboutWindow = null;
let appMenuView = null;
let bugReportWindow = null;
let minimizeOnClose = false;
let trayMono = false;
let roundedCorners = true;   // Einstellung, greift beim naechsten Start
let windowsRounded = true;   // was die Fenster dieser Sitzung tatsaechlich nutzen
let matrixRain = true;   // animierter Zeichenregen im Matrix-Theme
let currentHotkey = null;
let currentClipboardHotkey = null;
let promptTemplates = [];      // [{ id, name, prefix }]
let bgNotificationsEnabled = false;
let microphoneEnabled = false;
let microphoneConsentAsked = false;
// Modul-weiter Mutex fuer den Mic-Consent-Dialog. Verhindert Double-Modals
// (z.B. wenn Settings-Toggle und claude.ai-Mic-Click parallel triggern).
let consentInflight = null;
let updateCheckInterval = null;
let onlineCheckInterval = null;
let waitForFirstTabInterval = null;
let notificationsFetchInterval = null;
let activeNotifications = [];                    // gefilterte, aktuell sichtbare Notifications
let dismissedNotificationIds = [];                // persistiert in windowState

// Zentrales Schema fuer alle persistierten State-Felder. Eine Stelle definiert
// Default-Verhalten + Validierung. loadWindowState() liest, buildState() schreibt.
// Felder mit `optional: true` werden nur gesetzt wenn sie im JSON definiert sind
// (behalten sonst den Modul-Default), die anderen werden immer auf den
// validierten Wert gezwungen.
const STATE_SCHEMA = [
  // Lesen laeuft ueber resolveDesignStyle (kennt auch den alten Boolean), set ist No-op.
  { key: 'designStyle', get: () => designStyle, set: () => {} },
  // Legacy: 1.4.15 und aelter kennen nur den Boolean. Weiter mitschreiben, damit ein
  // Downgrade nicht im falschen Stil startet (Neon faellt dort auf Modern zurueck).
  { key: 'customDesign', get: () => designStyle !== 'classic', set: () => {} },
  // Lesen laeuft ueber resolveThemeMode (kennt auch den Alt-State), set ist darum No-op.
  { key: 'themeMode', get: () => themeMode, set: () => {} },
  // Legacy: 1.4.15 und aelter kennen nur diese beiden Booleans. Weiter mitschreiben, damit
  // ein Downgrade nicht im falschen Modus startet (midnight und matrix fallen dort auf oled zurueck).
  { key: 'isDarkMode', get: () => themeMode !== 'light', set: () => {} },
  { key: 'oledMode', get: () => themeMode === 'oled' || themeMode === 'midnight' || themeMode === 'matrix', set: () => {} },
  { key: 'oledIntroSeen', optional: true, get: () => oledIntroSeen,
    set: v => { oledIntroSeen = v === true; } },
  { key: 'minimizeOnClose', get: () => minimizeOnClose,
    set: v => { minimizeOnClose = v === true; } },
  { key: 'trayMono', get: () => trayMono,
    set: v => { trayMono = v === true; } },
  { key: 'roundedCorners', get: () => roundedCorners,
    set: v => { roundedCorners = v !== false; } },
  { key: 'matrixRain', get: () => matrixRain,
    set: v => { matrixRain = v !== false; } },
  { key: 'hotkey', get: () => currentHotkey,
    set: v => { currentHotkey = (typeof v === 'string' && v.length > 0) ? v : null; } },
  { key: 'clipboardHotkey', get: () => currentClipboardHotkey,
    set: v => { currentClipboardHotkey = (typeof v === 'string' && v.length > 0) ? v : null; } },
  { key: 'promptTemplates', get: () => promptTemplates,
    set: v => {
      promptTemplates = Array.isArray(v)
        ? v.filter(tpl => tpl && typeof tpl.name === 'string' && typeof tpl.prefix === 'string').slice(0, 50)
        : [];
    } },
  { key: 'bgNotificationsEnabled', get: () => bgNotificationsEnabled,
    set: v => { bgNotificationsEnabled = v === true; } },
  { key: 'microphoneEnabled', get: () => microphoneEnabled,
    set: v => { microphoneEnabled = v === true; } },
  { key: 'microphoneConsentAsked', get: () => microphoneConsentAsked,
    set: v => { microphoneConsentAsked = v === true; } },
  { key: 'dismissedNotificationIds', get: () => dismissedNotificationIds.slice(0, 200),
    set: v => {
      dismissedNotificationIds = Array.isArray(v)
        ? v.filter(id => typeof id === 'string').slice(0, 200)
        : [];
    } },
  { key: 'lastSeenVersion', get: () => windowState.lastSeenVersion || null,
    set: () => { /* eigene Logik in What's-New, hier nur passthrough */ } },
  // Offene Tabs. Fallback auf den zuletzt gespeicherten Wert ist zwingend: der
  // closed-Handler leert `tabs` bevor before-quit synchron speichert, sonst wuerde
  // beim Schliessen ueber das Fenster-X eine leere Liste die Session ueberschreiben.
  // Restore liest windowState.tabs direkt, darum ist set ein Passthrough-No-op.
  { key: 'tabs',
    get: () => (tabs.length
      ? tabs.map(tb => tb.url).filter(u => typeof u === 'string' && isAllowedDomain(u))
      : (Array.isArray(windowState.tabs) ? windowState.tabs : [])).slice(0, 20),
    set: () => { /* Restore laeuft in createWindow, hier nur passthrough */ } }
];



function loadWindowState() {
  try {
    if (fs.existsSync(stateFile)) windowState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {}
  for (const f of STATE_SCHEMA) {
    if (f.optional && windowState[f.key] === undefined) continue;
    f.set(windowState[f.key]);
  }

  themeMode = resolveThemeMode(windowState);
  designStyle = resolveDesignStyle(windowState);

  // Einmalige Intro-Aktivierung: OLED als Default beim ersten Start mit dem
  // OLED-Release. Bei bestehenden Nutzern bleibt der Stil (Modern/Classic/Neon)
  // wie vorher, nur der Modus wird auf OLED gesetzt. Sobald oledIntroSeen=true
  // persistiert ist, wird der Modus beim Folge-Start aus dem State gelesen.
  if (!oledIntroSeen) {
    themeMode = 'oled';
    oledIntroSeen = true;
    // Sofort persistieren, damit ein Hard-Crash vor dem ersten Save den User
    // nicht beim Folge-Start nochmal zwangsweise in OLED schickt.
    try { saveWindowStateSync(); } catch {}
  }

  // Startgroesse: ohne gespeicherten Wert 1200x800 proportional zum Schirm (auf einem
  // 1366er Laptop passten 800 Hoehe nie, auf einem 1440p-Schirm war es unnoetig klein).
  // Mit gespeichertem Wert diesen nehmen, aber gegen die aktuelle Arbeitsflaeche clampen:
  // eine an einem grossen Monitor gemerkte Groesse ragte am Laptop sonst aus dem Schirm.
  // Bewusst nur die Fenstergroesse, kein Zoom - der Inhalt ist claude.ai selbst.
  let wa = null;
  try { wa = screen.getPrimaryDisplay().workArea; } catch {}
  const fallback = scaleWindow(1200, 800, wa);
  const maxW = wa ? wa.width : fallback.width;
  const maxH = wa ? wa.height : fallback.height;

  const result = {
    width: Math.min(windowState.width || fallback.width, maxW),
    height: Math.min(windowState.height || fallback.height, maxH),
    x: windowState.x, y: windowState.y, isMaximized: windowState.isMaximized || false
  };

  // Gespeicherte Position auf sichtbare Displays clampen
  if (result.x !== undefined && result.y !== undefined) {
    try {
      const displays = screen.getAllDisplays();
      const onScreen = displays.some(d => {
        const wa = d.workArea;
        return result.x < wa.x + wa.width && result.x + result.width > wa.x
          && result.y < wa.y + wa.height && result.y + result.height > wa.y;
      });
      if (!onScreen) {
        delete result.x;
        delete result.y;
      }
    } catch {}
  }

  return result;
}

function buildState() {
  const base = {};
  for (const f of STATE_SCHEMA) base[f.key] = f.get();
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      const bounds = mainWindow.getBounds();
      return { ...bounds, isMaximized: mainWindow.isMaximized(), ...base };
    } catch {}
  }
  const prev = windowState || {};
  return { width: prev.width, height: prev.height, x: prev.x, y: prev.y, isMaximized: prev.isMaximized === true, ...base };
}

// Atomar schreiben: tmp-Datei, dann rename. Ein Crash oder eine volle Platte mitten im
// Write hinterliess sonst eine halbe JSON-Datei. loadWindowState schluckt den Parse-Fehler
// und startet mit leerem State - der Nutzer verliert Hotkeys, Templates und Tabliste und
// landet ueber oledIntroSeen zwangsweise wieder in OLED.
const stateTmpFile = stateFile + '.tmp';

const saveWindowState = debounce(() => {
  try {
    const state = buildState();
    const json = JSON.stringify(state);
    if (json === lastSavedState) return;
    windowState = state;
    // Erst nach dem Rename merken: sonst gilt ein fehlgeschlagener Write als gespeichert
    // und der unveraenderte State wird nie wieder geschrieben.
    fs.writeFile(stateTmpFile, json, (err) => {
      if (err) return;
      fs.rename(stateTmpFile, stateFile, (renameErr) => { if (!renameErr) lastSavedState = json; });
    });
  } catch {}
}, 500);

function saveWindowStateSync() {
  try {
    const state = buildState();
    windowState = state;
    fs.writeFileSync(stateTmpFile, JSON.stringify(state));
    fs.renameSync(stateTmpFile, stateFile);
  } catch {}
}

// Domain-Validierung

const domainCache = new Map();

function isAllowedDomain(url) {
  let h;
  try { h = new URL(url).hostname; } catch { return false; }
  let r = domainCache.get(h);
  if (r !== undefined) return r;
  r = h === 'claude.ai' || h.endsWith('.claude.ai')
    || h === 'claudeusercontent.com' || h.endsWith('.claudeusercontent.com')
    || h === 'claudemcpcontent.com' || h.endsWith('.claudemcpcontent.com')
    || h === 'claudemcp.com' || h.endsWith('.claudemcp.com')
    || h === 'challenges.cloudflare.com';
  if (domainCache.size >= DOMAIN_CACHE_MAX) domainCache.delete(domainCache.keys().next().value);
  domainCache.set(h, r);
  return r;
}

function isOAuthDomain(url) {
  try {
    const h = new URL(url).hostname;
    return h === 'accounts.google.com' || h === 'oauth2.googleapis.com'
      || h === 'github.com' || h === 'www.github.com'
      || h === 'drive.google.com' || h === 'docs.google.com'
      || h === 'login.microsoftonline.com'
      || h === 'gitlab.com' || h === 'bitbucket.org'
      || h.endsWith('.auth0.com') || h.endsWith('.claude.ai')
      || h === 'higgsfield.ai' || h.endsWith('.higgsfield.ai');
  } catch { return false; }
}

// Theme & Design

const DESIGN_STYLE_LABEL = { modern: 'Modern', classic: 'Classic', neon: 'Neon', matrix: 'Matrix' };

const THEME = {
  dark:  { bg: '#262624', bgHover: '#333330', bgActive: '#3a3a37', text: '#9a9a96', textActive: '#e8e8e4', border: '#333330', frameHi: '#5c554b', frameLo: '#4a443b' },
  light: { bg: '#f5f2ef', bgHover: '#ede9e4', bgActive: '#faf8f6', text: '#8a7e72', textActive: '#2a2420', border: '#e8e4de', frameHi: '#cbc2b5', frameLo: '#b8ad9d' },
  oled:  { bg: '#050306', bgHover: '#121013', bgActive: '#1c181b', text: '#9a948f', textActive: '#e8e8e4', border: '#1a1719', frameHi: '#443a42', frameLo: '#332b32' },
  midnight: { bg: '#070c18', bgHover: '#0d1526', bgActive: '#151f36', text: '#8a9ab5', textActive: '#e9eff8', border: '#182238', frameHi: '#44608f', frameLo: '#34496e' },
  matrix: { bg: '#040806', bgHover: '#0b1610', bgActive: '#122017', text: '#8aab96', textActive: '#e6f2ea', border: '#16281c', frameHi: '#2f6b45', frameLo: '#24543a' }
};

// Akzent pro Stil. Kein Theme erzwingt einen eigenen: jede Kombination aus Farbthema und
// Stil ist waehlbar.
// brandHsl setzt claude.ais eigenes --accent-brand um, das den Sende-Pfeil und die
// Brand-Icons faerbt. Es MUSS als HSL-Komponenten geschrieben werden: die Seite konsumiert
// es als hsl(var(--accent-brand)), ein Hex-Wert macht die Deklaration ungueltig und die
// Icons fallen auf Grau zurueck. Ohne brandHsl bleibt claude.ais Original stehen.
const ACCENT = {
  modern:  { from: '#F26A3F', to: '#E83B6E' },
  classic: { from: '#d4734c', to: '#d4734c' },
  neon:    { from: '#1B54BE', to: '#2A72E8', neonFrom: '#2F7FFF', neonTo: '#00E5FF', brandHsl: '217 100% 59%' },
  matrix:  { from: '#0E7A34', to: '#12833A', neonFrom: '#38C75C', neonTo: '#2EA34B', brandHsl: '135 56% 50%' },
  // Neon und Matrix fuehren zwei Paare: from/to liegt unter weissem Buttontext (4.5:1 bzw.
  // 6.9:1, Matrix 5.5:1 und 4.9:1), neonFrom/neonTo ist reine Deko (Composer-Rand,
  // Fokus-Ring) und wuerde als Buttonflaeche mit Weiss darauf auf 1.5:1 fallen.
};

// Warnfarbe pro Theme. Bernstein bleibt das Signal, der Ton folgt dem Untergrund: das warme
// Orange kippt auf tiefblauem Grund ins Schmutzige, auf Weiss braucht es mehr Deckung. k
// skaliert die Flaechen-Alphas, damit der Kasten in jedem Theme gleich praesent wirkt.
const WARN = {
  dark:     { rgb: '224,169,62', fg: '#e0a93e', title: '#e0a93e', k: 1 },
  oled:     { rgb: '224,169,62', fg: '#e0a93e', title: '#e0a93e', k: 1 },
  light:    { rgb: '224,150,40', fg: '#c97e1c', title: '#a86412', k: 1.2 },
  midnight: { rgb: '232,199,106', fg: '#e8c76a', title: '#e8c76a', k: 0.9 },
  matrix:   { rgb: '224,169,62', fg: '#e0a93e', title: '#e0a93e', k: 1 }
};
function warnColor() {
  const w = WARN[currentThemeMode()] || WARN.dark;
  return { fg: w.fg, title: w.title, a: v => `rgba(${w.rgb},${Math.round(v * w.k * 100) / 100})` };
}

// Beta-Build erkennen — eigene Icons (BETA-Badge) zur visuellen Unterscheidung von Stable
const isBeta = process.env.CLAUDE_BETA === '1'
            || (process.env.APPIMAGE || '').toLowerCase().includes('beta');

function currentThemeMode() {
  return THEME[themeMode] ? themeMode : 'dark';
}
function theme()  { return THEME[currentThemeMode()]; }
// Sub-Window-Theme: identisch mit theme(). Im OLED-Mode kommt die zusaetzliche
// Lesbarkeit nicht ueber einen helleren bg, sondern ueber einen Brand-Glow-Overlay
// (s. customTitlebarCSS), damit das Schwarz erhalten bleibt.
function subTheme() {
  return theme();
}
function accent() {
  return ACCENT[designStyle] || ACCENT.modern;
}
function icon()   {
  const modern = designStyle !== 'classic';
  if (isBeta) return path.join(__dirname, modern ? 'icon-beta.png' : 'icon-original-beta.png');
  return path.join(__dirname, modern ? 'icon.png' : 'icon-original.png');
}
function trayIcon(mono = trayMono) {
  if (mono) return path.join(__dirname, 'icon-tray-mono.png');
  const modern = designStyle !== 'classic';
  if (isBeta) return path.join(__dirname, modern ? 'icon-tray-beta.png' : 'icon-original-tray-beta.png');
  return path.join(__dirname, modern ? 'icon-tray.png' : 'icon-original-tray.png');
}

const _iconDataUrlCache = {};
function iconDataUrl() {
  const p = icon();
  if (_iconDataUrlCache[p]) return _iconDataUrlCache[p];
  try {
    const b64 = fs.readFileSync(p).toString('base64');
    _iconDataUrlCache[p] = `data:image/png;base64,${b64}`;
  } catch { _iconDataUrlCache[p] = ''; }
  return _iconDataUrlCache[p];
}

// Das Spark-Logo ist transparent (keine Kachel im PNG). Wer es auf farbigen Untergrund
// setzt, muss selbst fuer Kontrast sorgen - siehe .hero-logo im About-Fenster.
function iconDataUrlForCurrentTheme() {
  return iconDataUrl();
}

// Tab-Bar HTML

let _tabBarCache = '';
let _tabBarKey = '';

function getTabBarHTML() {
  const key = `${currentThemeMode()}:${designStyle}`;
  if (key === _tabBarKey && _tabBarCache) return _tabBarCache;
  _tabBarKey = key;
  const th = theme();
  const a = accent();

  _tabBarCache = `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;">
<style>
:root{--bg:${th.bg};--bgh:${th.bgHover};--bga:${th.bgActive};--t:${th.text};--ta:${th.textActive};--bd:${th.border};
  --frame-hi:${th.frameHi};--frame-lo:${th.frameLo};--ac-from:${a.from};--ac-to:${a.to}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{background:var(--bg);font:500 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  color:var(--t);overflow:hidden;user-select:none;
  display:flex;flex-direction:column;contain:layout style;
  border:${WINDOW_BORDER}px solid var(--frame-lo);
  border-image:linear-gradient(180deg,var(--frame-hi),var(--frame-lo)) 1}
${roundFrameCSS('var(--frame-hi)', 'var(--frame-lo)')}
#notif-bar{display:flex;flex-direction:column;flex-shrink:0;-webkit-app-region:no-drag}
#notif-bar:empty{display:none}
.notif{display:flex;align-items:center;gap:14px;min-height:${NOTIFICATION_BANNER_HEIGHT}px;padding:10px 14px 10px 0;font-family:inherit;line-height:1.35;color:var(--ta);border-bottom:1px solid var(--bd);background:var(--bgh);position:relative}
.notif[data-sev="info"]{background:linear-gradient(90deg,color-mix(in srgb,var(--ac-from) 14%,var(--bgh)),var(--bgh))}
.notif[data-sev="warn"]{background:linear-gradient(90deg,color-mix(in srgb,${warnColor().fg} 22%,var(--bgh)),var(--bgh))}
.notif[data-sev="critical"]{background:linear-gradient(90deg,color-mix(in srgb,#e05e3e 28%,var(--bgh)),var(--bgh))}
.notif[data-sev="success"]{background:linear-gradient(90deg,color-mix(in srgb,#3fb96e 22%,var(--bgh)),var(--bgh))}
.notif-dot{flex:0 0 4px;align-self:stretch;background:var(--ac-from);margin-right:6px}
.notif[data-sev="warn"] .notif-dot{background:${warnColor().fg}}
.notif[data-sev="critical"] .notif-dot{background:#e05e3e}
.notif[data-sev="success"] .notif-dot{background:#3fb96e}
.notif-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;overflow:hidden}
.notif-text strong{font-weight:600;color:var(--ta);font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.notif-text span{color:var(--t);font-weight:400;font-size:12.5px;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.notif-link{flex:0 0 auto;background:var(--ac-from);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12.5px;font-family:inherit;font-weight:600;cursor:pointer;white-space:nowrap;transition:filter .12s ease}
.notif[data-sev="warn"] .notif-link{background:${warnColor().fg};color:#1c1208}
.notif[data-sev="critical"] .notif-link{background:#e05e3e;color:#fff}
.notif[data-sev="success"] .notif-link{background:#3fb96e;color:#0e1d14}
.notif-link:hover{filter:brightness(1.08)}
.notif-x{flex:0 0 auto;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--t);font-size:18px;line-height:1;border:none;background:transparent;font-family:inherit;transition:background .12s ease}
.notif-x:hover{background:var(--bga);color:var(--ta)}
#tab-row{display:flex;align-items:flex-end;height:${TAB_BAR_HEIGHT}px;flex:0 0 ${TAB_BAR_HEIGHT}px;-webkit-app-region:drag}
.menu-btn{-webkit-app-region:no-drag;width:30px;height:30px;display:flex;align-items:center;justify-content:center;
  cursor:pointer;color:var(--ta);border-radius:8px;margin:0 2px 6px 6px;flex-shrink:0;
  transition:background .15s,color .15s,border-color .15s;border:1px solid transparent;opacity:.85}
.menu-btn:hover{background:color-mix(in srgb,var(--ac-from) 12%,transparent);
  border-color:color-mix(in srgb,var(--ac-from) 35%,transparent);color:var(--ac-from);opacity:1}
.menu-btn svg{width:16px;height:16px}
#tabs{display:flex;align-items:flex-end;height:100%;flex:1;padding:0 4px;gap:2px;
  overflow-x:auto;min-width:0}
#tabs::-webkit-scrollbar{height:0}
.tab{display:flex;align-items:center;height:34px;padding:0 14px;border-radius:11px 11px 0 0;
  cursor:pointer;white-space:nowrap;max-width:220px;min-width:60px;gap:8px;
  position:relative;color:var(--t);transition:background .15s,color .15s;contain:layout style;
  -webkit-app-region:no-drag}
.tab:hover{background:linear-gradient(180deg,transparent,var(--bgh));color:var(--ta)}
.tab.active{background:var(--bga);color:var(--ta);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac-from) 28%,transparent)}
.tab.active::after{content:'';position:absolute;bottom:0;left:10px;right:10px;height:2.5px;
  background:linear-gradient(90deg,var(--ac-from),var(--ac-to));border-radius:2px 2px 0 0;
  box-shadow:0 0 8px color-mix(in srgb,var(--ac-from) 45%,transparent)}
.tab-title{flex:1;overflow:hidden;text-overflow:ellipsis}
.tab-close{width:18px;height:18px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  font-size:15px;line-height:1;opacity:0;flex-shrink:0;transition:opacity .1s,background .1s}
.tab:hover .tab-close{opacity:.5}
.tab-close:hover{opacity:1!important;background:linear-gradient(135deg,var(--ac-from),var(--ac-to));color:#fff}
.controls{display:flex;align-items:center;gap:4px;padding:0 6px 6px;-webkit-app-region:no-drag}
.ctrl-btn{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  cursor:pointer;color:var(--ta);font-size:16px;opacity:.85;transition:all .15s;border:1px solid transparent}
.ctrl-btn:hover{background:color-mix(in srgb,var(--ac-from) 12%,transparent);
  border-color:color-mix(in srgb,var(--ac-from) 35%,transparent);color:var(--ac-from);opacity:1}
.ctrl-btn svg{width:16px;height:16px}
/* Theme-Cycle und Modern/Classic-Pille sind ausgeblendet, seit das Design-Fenster beides
   uebernimmt. Buttons und IPC bleiben verdrahtet: display:none entfernen holt sie zurueck. */
#theme-toggle,#design-toggle{display:none}
#new-tab{background:linear-gradient(135deg,var(--ac-from),var(--ac-to));color:#fff;opacity:1;
  box-shadow:0 2px 8px color-mix(in srgb,var(--ac-from) 35%,transparent)}
#new-tab:hover{background:linear-gradient(135deg,var(--ac-from),var(--ac-to));color:#fff;
  border-color:transparent;filter:brightness(1.08)}
.design-pill{padding:2px 11px;height:22px;border-radius:11px;font-size:10px;font-weight:600;
  letter-spacing:.4px;text-transform:uppercase;display:flex;align-items:center;cursor:pointer;
  background:var(--bgh);color:var(--t);transition:all .15s;-webkit-app-region:no-drag;margin-right:4px;
  border:1px solid var(--bd)}
.design-pill:hover{background:linear-gradient(135deg,var(--ac-from),var(--ac-to));color:#fff;border-color:transparent}
/* Dauerhafter Verweis auf Anthropics eigene Linux-App. Unter 900px Fensterbreite
   ausgeblendet, sonst draengt sie die Tabs weg. */
.official-pill{padding:2px 11px;height:22px;border-radius:11px;font-size:10px;font-weight:600;
  letter-spacing:.4px;display:flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap;
  background:transparent;color:var(--t);transition:all .15s;-webkit-app-region:no-drag;margin-right:4px;
  border:1px solid var(--bd)}
.official-pill:hover{background:var(--bgh);color:var(--ta);border-color:var(--ac-from)}
.official-pill svg{width:11px;height:11px;flex-shrink:0}
@media (max-width:900px){.official-pill{display:none}}
.win-controls{display:flex;align-items:stretch;margin-left:6px;padding-right:2px;-webkit-app-region:no-drag;height:${TAB_BAR_HEIGHT}px}
.win-btn{width:38px;height:100%;border:none;background:transparent;color:var(--ta);
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  transition:background .12s,color .12s;opacity:.78;font-family:inherit;padding:0}
.win-btn:hover{background:var(--bgh);opacity:1}
.win-btn svg{width:11px;height:11px;display:block}
#win-close:hover{background:linear-gradient(135deg,var(--ac-from),var(--ac-to));color:#fff}
</style></head><body>
<div id="notif-bar"></div>
<div id="tab-row">
<div class="menu-btn" id="app-menu" title="${t('Menü', 'Menu', 'Menu', 'Menu')}">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
</div>
<div id="tabs"></div>
<div class="controls">
  <div class="design-pill" id="design-toggle" title="${t('Design wechseln', 'Toggle design', 'Changer de design', 'Cambia design')}">${DESIGN_STYLE_LABEL[designStyle]}</div>
  <div class="official-pill" id="official-app" title="${t('Anthropic bietet eine eigene Claude-App für Linux an. Hier steht, wie sie installiert wird.', 'Anthropic ships its own Claude app for Linux. This explains how to install it.', 'Anthropic propose sa propre application Claude pour Linux. Voici comment l’installer.', 'Anthropic distribuisce una propria app Claude per Linux. Qui come installarla.')}">
    <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    ${t('Offizielle App', 'Official app', 'App officielle', 'App ufficiale')}
  </div>
  <div class="ctrl-btn" id="export-btn" title="${t('Konversation als Markdown exportieren', 'Export conversation as Markdown', 'Exporter la conversation en Markdown', 'Esporta la conversazione in Markdown')}">
    <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>
  <div class="ctrl-btn" id="bug-report" title="${(bugReportStrings[sysLang] || bugReportStrings.en).title}">
    <svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>
  <div class="ctrl-btn" id="reset-verify" title="${t('claude.ai-Verifizierung zurücksetzen (bei hängender Sicherheitsprüfung)', 'Reset claude.ai verification (when the security check is stuck)', 'Réinitialiser la vérification claude.ai (si la vérification est bloquée)', 'Reimposta la verifica claude.ai (se il controllo è bloccato)')}">
    <svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>
  <div class="ctrl-btn" id="theme-toggle" title="${t('Theme wechseln', 'Toggle theme', 'Changer de thème', 'Cambia tema')}">
    <svg id="theme-icon-dark" viewBox="0 0 24 24"${currentThemeMode() === 'dark' ? '' : ' style="display:none"'}><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
    <svg id="theme-icon-light" viewBox="0 0 24 24"${currentThemeMode() === 'light' ? '' : ' style="display:none"'}><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
    <svg id="theme-icon-oled" viewBox="0 0 24 24"${currentThemeMode() === 'oled' ? '' : ' style="display:none"'}><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" fill="currentColor"/></svg>
    <svg id="theme-icon-midnight" viewBox="0 0 24 24"${currentThemeMode() === 'midnight' ? '' : ' style="display:none"'}><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" fill="currentColor" opacity=".5"/><path d="M5.6 3l.75 2.05L8.4 5.8l-2.05.75L5.6 8.6l-.75-2.05L2.8 5.8l2.05-.75z" fill="currentColor"/></svg>
  </div>
  <div class="ctrl-btn" id="new-tab" title="${t('Neuer Tab', 'New Tab', 'Nouvel onglet', 'Nuova scheda')} (Ctrl+T)">
    <svg viewBox="0 0 16 16"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>
  </div>
</div>
<div class="win-controls">
  <button class="win-btn" id="win-min" title="${t('Minimieren', 'Minimize', 'Réduire', 'Riduci a icona')}" aria-label="Minimize">
    <svg viewBox="0 0 12 12"><rect x="2" y="5.5" width="8" height="1" fill="currentColor"/></svg>
  </button>
  <button class="win-btn" id="win-max" title="${t('Maximieren', 'Maximize', 'Agrandir', 'Ingrandisci')}" aria-label="Maximize">
    <svg id="win-max-icon" viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1"/></svg>
    <svg id="win-restore-icon" viewBox="0 0 12 12" style="display:none"><rect x="2.5" y="4" width="5.5" height="5.5" fill="none" stroke="currentColor" stroke-width="1"/><path d="M4.5 4V2.5H10V8H8" fill="none" stroke="currentColor" stroke-width="1"/></svg>
  </button>
  <button class="win-btn" id="win-close" title="${t('Schließen', 'Close', 'Fermer', 'Chiudi')}" aria-label="Close">
    <svg viewBox="0 0 12 12"><path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
  </button>
</div>
</div>
<script>
const tabsEl=document.getElementById('tabs');
let tabEls=[];
document.getElementById('new-tab').addEventListener('click',()=>window.tabAPI.newTab());
document.getElementById('theme-toggle').addEventListener('click',()=>window.tabAPI.toggleTheme());
document.getElementById('design-toggle').addEventListener('click',()=>window.tabAPI.toggleDesign());
document.getElementById('official-app').addEventListener('click',()=>window.tabAPI.officialApp());
document.getElementById('bug-report').addEventListener('click',()=>window.tabAPI.bugReport());
document.getElementById('reset-verify').addEventListener('click',()=>window.tabAPI.resetVerification());
document.getElementById('export-btn').addEventListener('click',()=>window.tabAPI.exportConversation());
document.getElementById('app-menu').addEventListener('click',(e)=>{
  const r=e.currentTarget.getBoundingClientRect();
  window.tabAPI.openAppMenu(Math.round(r.left),Math.round(r.bottom));
});
document.getElementById('win-min').addEventListener('click',()=>window.tabAPI.winMinimize());
document.getElementById('win-max').addEventListener('click',()=>window.tabAPI.winToggleMaximize());
document.getElementById('win-close').addEventListener('click',()=>window.tabAPI.winClose());
window.tabAPI.onWindowStateUpdate(s=>{
  const m=!!(s&&s.maximized);
  document.getElementById('win-max-icon').style.display=m?'none':'';
  document.getElementById('win-restore-icon').style.display=m?'':'none';
});
window.tabAPI.requestWindowState();

const STYLE_LABEL=${JSON.stringify(DESIGN_STYLE_LABEL)};
window.tabAPI.onDesignUpdate(style=>{
  document.getElementById('design-toggle').textContent=STYLE_LABEL[style]||style;
});

window.tabAPI.onTabsUpdate(data=>{
  const c=data.tabs.length;
  while(tabEls.length>c)tabsEl.removeChild(tabEls.pop());
  for(let i=0;i<c;i++){
    let el=tabEls[i];
    if(!el){
      el=document.createElement('div');el.className='tab';
      el.innerHTML='<span class="tab-title"></span><span class="tab-close">&times;</span>';
      el.addEventListener('click',e=>{
        const idx=tabEls.indexOf(el);
        if(e.target.classList.contains('tab-close'))window.tabAPI.closeTab(idx);
        else window.tabAPI.switchTab(idx);
      });
      tabsEl.appendChild(el);tabEls.push(el);
    }
    const ts=el.firstChild,title=data.tabs[i].title;
    if(ts.textContent!==title)ts.textContent=title;
    const a=i===data.activeIndex;
    if(el.classList.contains('active')!==a)el.classList.toggle('active',a);
    el.lastChild.style.display=c>1?'':'none';
  }
});

// Aus THEME erzeugt, damit die beiden Paletten nicht auseinanderlaufen.
const THEME_VARS=${JSON.stringify(Object.fromEntries(Object.entries(THEME).map(
  ([k, v]) => [k, [v.bg, v.bgHover, v.bgActive, v.text, v.textActive, v.border, v.frameHi, v.frameLo]])))};
window.tabAPI.onThemeUpdate(u=>{
  const m=THEME_VARS[u.mode]?u.mode:'dark';
  // Weicher Wechsel: bei echtem Moduswechsel (nicht beim ersten Aufruf) kurz eine
  // Farb-Transition einblenden, damit die Leiste mit dem Inhalt zusammen fadet statt
  // hart umzuspringen. Danach leeren, damit Hover etc. nicht dauerhaft mitanimieren.
  if(window.__tbMode!==undefined && window.__tbMode!==m){
    let ts=document.getElementById('tb-trans');
    if(!ts){ts=document.createElement('style');ts.id='tb-trans';document.head.appendChild(ts);}
    ts.textContent='*{transition:background-color .28s ease,color .28s ease,border-color .28s ease !important}';
    clearTimeout(window.__tbTransT);
    window.__tbTransT=setTimeout(()=>{const s=document.getElementById('tb-trans');if(s)s.textContent='';},360);
  }
  window.__tbMode=m;
  const v=THEME_VARS[m];
  const r=document.documentElement.style;
  r.setProperty('--bg',v[0]);r.setProperty('--bgh',v[1]);r.setProperty('--bga',v[2]);
  r.setProperty('--t',v[3]);r.setProperty('--ta',v[4]);r.setProperty('--bd',v[5]);
  r.setProperty('--frame-hi',v[6]);r.setProperty('--frame-lo',v[7]);
  // Der Akzent kommt mit, weil er am Theme haengen kann (Mitternachtsblau bringt einen
  // eigenen mit). Ohne das bliebe beim Moduswechsel der alte Ton in Plus-Button und Hover.
  if(u.from)r.setProperty('--ac-from',u.from);
  if(u.to)r.setProperty('--ac-to',u.to);
  document.body.style.background='';
  for(const k of Object.keys(THEME_VARS)){
    const el=document.getElementById('theme-icon-'+k);
    if(el)el.style.display=m===k?'':'none';
  }
});

const notifBar=document.getElementById('notif-bar');
// Laeuft im Renderer, kann utils/pure.js nicht requiren. Bewusst dieselbe Zeichenmenge
// wie escapeHtml dort, damit der Helfer auch in Attributwerten traegt.
function escTxt(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
window.tabAPI.onNotificationsUpdate(list=>{
  notifBar.innerHTML='';
  if(!Array.isArray(list)||list.length===0)return;
  for(const n of list){
    const row=document.createElement('div');
    row.className='notif';row.dataset.sev=n.severity||'info';
    row.innerHTML=
      '<span class="notif-dot"></span>'+
      '<div class="notif-text"><strong>'+escTxt(n.title)+'</strong>'+
        (n.body?'<span>'+escTxt(n.body)+'</span>':'')+'</div>'+
      (n.link?'<button class="notif-link" data-act="link">'+escTxt(n.linkLabel||'${t('Mehr', 'More', 'Plus', 'Altro')}')+'</button>':'')+
      (n.dismissible!==false?'<button class="notif-x" data-act="dismiss" title="${t('Schließen', 'Close', 'Fermer', 'Chiudi')}">×</button>':'');
    row.addEventListener('click',e=>{
      const a=e.target&&e.target.dataset?e.target.dataset.act:null;
      if(a==='link'&&n.link)window.tabAPI.openNotificationLink(n.id,n.link);
      else if(a==='dismiss')window.tabAPI.dismissNotification(n.id);
    });
    notifBar.appendChild(row);
  }
});
window.tabAPI.requestNotifications();
</script></body></html>`;
  return _tabBarCache;
}

// Tab-Bar Sync (IPC → Renderer)

const sendTabsUpdate = throttle(() => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('tabs-update', {
    tabs: tabs.map((tab, i) => ({ title: tab.title || `Tab ${i + 1}` })),
    activeIndex: activeTabIndex
  });
}, 100);

function sendThemeUpdate() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const ac = accent();
  mainWindow.webContents.send('theme-update', { mode: currentThemeMode(), from: ac.from, to: ac.to });
}

function sendDesignUpdate() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('design-update', designStyle);
}

// Script-Injection

// Verify-Banner-Script mit lokalisierten Strings befüllen
function verifyScript() {
  const i18n = {
    msg: t(
      'Die Sicherheitsprüfung hängt in einer Schleife. „Zurücksetzen“ leert die claude.ai-Sitzung vollständig und behebt das in den meisten Fällen, du meldest dich danach neu an. Hilft das nicht, liegt es an deiner Netzwerk-Adresse: ein aktives VPN ist oft die Ursache (für claude.ai ausschalten), sonst hilft ein anderes Netzwerk.',
      'The security check is stuck in a loop. "Reset" fully clears the claude.ai session and fixes this in most cases; you sign in again afterwards. If that does not help, it is your network address: an active VPN is often the cause (turn it off for claude.ai), otherwise try a different network.',
      'La vérification de sécurité tourne en boucle. « Réinitialiser » efface entièrement la session claude.ai et résout le problème dans la plupart des cas ; vous vous reconnectez ensuite. Si cela ne suffit pas, cela vient de votre adresse réseau : un VPN actif en est souvent la cause (désactivez-le pour claude.ai), sinon essayez un autre réseau.',
      'Il controllo di sicurezza è bloccato in un ciclo. "Reimposta" cancella completamente la sessione di claude.ai e nella maggior parte dei casi risolve; dopodiché accedi di nuovo. Se non basta, dipende dal tuo indirizzo di rete: una VPN attiva è spesso la causa (disattivala per claude.ai), altrimenti prova una rete diversa.'
    ),
    reset: t('Zurücksetzen', 'Reset', 'Réinitialiser', 'Reimposta'),
    dismiss: t('Schließen', 'Dismiss', 'Ignorer', 'Ignora')
  };
  return VERIFY_SCRIPT.replace('__VERIFY_I18N__', JSON.stringify(i18n));
}

// Theme-State fuer den Controller (inject/theme.js): mode + design + accent.
// mid (#E8524F) ist der Brand-Mittelton fuer das Orange->Brand-Recoloring (Modern).
function themeState() {
  const ac = accent();
  // Auf der Seite ist der Akzent nur Deko (Composer-Rand, Fokus-Ring, Sterne), da darf
  // das Neon-Paar ran. mid faerbt claude.ais eigenes Orange um und muss zum Theme passen.
  return {
    mode: currentThemeMode(),
    design: designStyle === 'classic' ? 'classic' : 'modern',
    accent: { from: ac.neonFrom || ac.from, to: ac.neonTo || ac.to, mid: ac.neonFrom || '#E8524F', brandHsl: ac.brandHsl || null },
    rain: matrixRain
  };
}
function themeScript() {
  return 'window._cdTheme=' + JSON.stringify(themeState()) + ';' + THEME_SCRIPT;
}

// Anti-FOUC: preload-content.js holt Theme-State + das volle statische Sheet synchron bei
// document-start, um das komplette OLED-Theme VOR dem ersten claude.ai-Paint zu setzen. Sonst
// rendert claude.ai ~1.7s mit eigenem Styling, bis der per executeJavaScript bei dom-ready
// eingereihte Controller hinter Reacts Hydration im Main-Thread endlich drankommt und alles
// sichtbar umspringt. staticCSS kommt aus derselben Quelle wie der Controller (theme-static.js).
ipcMain.on('cd-theme-mode', (e) => {
  const st = themeState();
  let staticCSS = '';
  try { if (st.mode === 'oled' || st.mode === 'midnight' || st.mode === 'matrix') staticCSS = cdBuildStaticCSS(st); } catch {}
  // ctl: derselbe Controller, den dom-ready spaeter injiziert. Der Preload setzt ihn schon
  // bei document-start als Script-Tag ein, weil executeJavaScript bei dom-ready hinter
  // Reacts Hydration in der Task-Queue landet (gemessen 2,3s, mit 6x CPU-Drossel 9,7s).
  // Bis dahin stehen claude.ais Originalfarben in Karten und Raendern.
  e.returnValue = Object.assign({}, st, { staticCSS, ctl: themeScript() });
});

function injectScripts(wc) {
  if (!alive(wc)) return;
  // Nur in claude.ai-Seiten injizieren, nie in OAuth-Provider-/Login-Seiten
  // (Google, Linear, ...), die waehrend eines Connector-Flows im View laufen.
  // Sonst werden fremde Login-Seiten umgefaerbt (unlesbar) und unsere
  // MutationObserver stoeren deren OAuth-JS ("Invalid flow state").
  if (!isAllowedDomain(wc.getURL())) return;
  wc.executeJavaScript(NOTIFY_SCRIPT).catch(() => {});
  wc.executeJavaScript(verifyScript()).catch(() => {});
  wc.executeJavaScript(themeScript()).catch(() => {});
}

function reinjectScripts(wc) {
  if (!alive(wc)) return;
  if (!isAllowedDomain(wc.getURL())) return;
  // Notify-Script: idempotent
  wc.executeJavaScript('!!window._cdNotify').then(active => {
    if (!active) wc.executeJavaScript(NOTIFY_SCRIPT).catch(() => {});
  }).catch(() => {});
  // Theme-Controller bleibt bei SPA-Nav bestehen; falls weg neu injizieren, sonst State re-asserten
  wc.executeJavaScript('!!window._cdThemeCtl').then(active => {
    if (!active) wc.executeJavaScript(themeScript()).catch(() => {});
    else wc.executeJavaScript('window._cdSetTheme&&window._cdSetTheme(' + JSON.stringify(themeState()) + ')').catch(() => {});
  }).catch(() => {});
}

// Theme live auf alle offenen Views anwenden (kein Reload, kein Re-Inject):
// nur Attribute am <html> umschalten via window._cdSetTheme.
function applyThemeToAllViews() {
  const s = JSON.stringify(themeState());
  for (const tab of tabs) {
    if (!tab || !alive(tab.view)) continue;
    const wc = tab.view.webContents;
    if (!isAllowedDomain(wc.getURL())) continue;
    wc.executeJavaScript('window._cdSetTheme&&window._cdSetTheme(' + s + ')').catch(() => {});
  }
}

// View Setup (Security + Events)

// Window-Open-Handler: OAuth/claude.ai in-app, Rest extern. Als Factory, damit das
// OAuth-Popup denselben Handler bekommt; Provider mit verschachteltem window.open
// (z.B. Microsoft) oeffnen sonst ein ungesteuertes Default-Fenster ohne Session.
function oauthWindowOpenHandler(getOpenerUrl) {
  return ({ url }) => {
    if (isOAuthDomain(url) || (isAllowedDomain(getOpenerUrl()) && looksLikeOAuthUrl(url))) {
      return { action: 'allow', overrideBrowserWindowOptions: {
        ...oauthPopupSize(), title: t('Anmeldung', 'Sign In', 'Connexion', 'Accesso'),
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, partition: 'persist:claude' }
      }};
    }
    if (isAllowedDomain(url)) return { action: 'allow' };
    try {
      const p = new URL(url).protocol;
      if (p === 'https:' || p === 'http:' || p === 'mailto:') openExternalSafe(url);
    } catch {}
    return { action: 'deny' };
  };
}

function setupView(view) {
  const wc = view.webContents;

  // Window-Open: OAuth in-app, claude.ai erlaubt, Rest extern
  wc.setWindowOpenHandler(oauthWindowOpenHandler(() => wc.getURL()));

  // OAuth-Popup Lifecycle (nur wenn das neue Fenster wirklich OAuth ist)
  wc.on('did-create-window', (childWindow, details) => {
    const initialUrl = details && details.url ? details.url : '';
    // Artefakt-/Preview-Fenster von claude.ai: kein OAuth-Lifecycle, aber sie erben
    // setBackgroundColor nicht (das gilt nur fuer createContentView) und blitzen im
    // OLED-Mode weiss auf. Nur die Hintergrundfarbe setzen, sonst nichts anfassen.
    if (isAllowedDomain(initialUrl) && !isOAuthDomain(initialUrl)) {
      try { childWindow.setBackgroundColor(theme().bg); } catch {}
      return;
    }
    if (!isOAuthDomain(initialUrl) && !looksLikeOAuthUrl(initialUrl)) return;

    let closed = false;
    const cleanup = () => {
      if (closed || childWindow.isDestroyed()) return;
      closed = true;
      childWindow.webContents.off('will-navigate', onNav);
      childWindow.webContents.off('will-redirect', onRedirect);
      childWindow.webContents.off('did-navigate', onDidNav);
      childWindow.close();
    };
    const onNav = (event, navUrl) => {
      if (closed) return;
      if (!isOAuthDomain(navUrl) && !isAllowedDomain(navUrl)) {
        try { const p = new URL(navUrl).protocol; if (p !== 'https:' && p !== 'http:') event.preventDefault(); }
        catch { event.preventDefault(); }
      }
    };
    const onRedirect = (_event, navUrl) => { if (isAllowedDomain(navUrl)) cleanup(); };
    const onDidNav = (_event, navUrl) => { if (isAllowedDomain(navUrl)) cleanup(); };

    childWindow.webContents.on('will-navigate', onNav);
    childWindow.webContents.on('will-redirect', onRedirect);
    childWindow.webContents.on('did-navigate', onDidNav);

    // Verschachteltes window.open aus dem Popup (Provider-SSO) ebenfalls steuern.
    childWindow.webContents.setWindowOpenHandler(oauthWindowOpenHandler(() => {
      try { return childWindow.isDestroyed() ? '' : childWindow.webContents.getURL(); } catch { return ''; }
    }));
  });

  // Navigation Guards
  wc.on('will-navigate', (event, navUrl) => {
    // claude.ai/bekannte-OAuth/OAuth-Authorize immer zulassen. looksLikeOAuthUrl deckt
    // den Connector-Approve ab, der im selben Fenster zum Provider (Host nicht in der
    // Allowlist) navigiert; ohne das blockt der Guard still -> "Approve tut nichts".
    if (isAllowedDomain(navUrl) || isOAuthDomain(navUrl) || looksLikeOAuthUrl(navUrl)) return;
    // Mid-OAuth: sind wir bereits auf einer externen Provider-Seite (per OAuth dorthin
    // gelangt), dessen eigene Folge-Schritte (Login etc.) per https zulassen, bis es
    // zurueck auf claude.ai redirected. Startup (leer/about:blank) faellt nicht darunter.
    let onProvider = false;
    try { onProvider = new URL(wc.getURL()).protocol === 'https:' && !isAllowedDomain(wc.getURL()); } catch {}
    let proto = '';
    try { proto = new URL(navUrl).protocol; } catch {}
    // Mid-OAuth nur auf der gleichen Registrable-Domain wie die Provider-Seite
    // zulassen; fremde https-Hosts (Marketing-/Hilfe-Links der Provider-Seite)
    // gehen extern, damit die View kein offener Browser wird.
    let sameSite = false;
    try {
      const a = new URL(navUrl).hostname.split('.').slice(-2).join('.');
      const b = new URL(wc.getURL()).hostname.split('.').slice(-2).join('.');
      sameSite = !!a && a === b;
    } catch {}
    if (onProvider && proto === 'https:' && sameSite) return;
    event.preventDefault();
    if (proto === 'https:' || proto === 'http:' || proto === 'mailto:') openExternalSafe(navUrl);
  });

  wc.on('will-frame-navigate', (event) => {
    if (event.isMainFrame) return; // Hauptframe entscheidet will-navigate
    const navUrl = event.url;
    // Subframes enger: ein blosses looksLikeOAuthUrl reicht fuer ein eingebettetes
    // iframe nicht, nur zulassen wenn die Top-Level-Seite selbst claude.ai ist.
    const topAllowed = isAllowedDomain(wc.getURL());
    if (isAllowedDomain(navUrl) || isOAuthDomain(navUrl) || (topAllowed && looksLikeOAuthUrl(navUrl))) return;
    // Stripe rendert den Bezahlvorgang komplett in eigene iframes. Nur freigeben, wenn
    // die Seite darueber wirklich claude.ai ist, und bewusst nicht ueber isAllowedDomain:
    // Skript-Injection, Theme und window.open sollen dort weiterhin nicht greifen.
    if (topAllowed && isPaymentFrameDomain(navUrl)) return;
    // Electron cancelt hier ohne did-fail-load und ohne Konsolenmeldung. Ein fehlender
    // Host in der Allowlist sieht fuer den Nutzer deshalb aus wie "haengt einfach", zuletzt
    // beim Turnstile-iframe (1.3.11) und bei den Stripe-Frames. Diese Zeile macht den
    // naechsten Fall aus einem Terminal-Start heraus sofort sichtbar.
    console.warn('[nav] subframe blocked:', navUrl, '| top:', wc.getURL());
    event.preventDefault();
  });

  // Tab-Titel
  wc.on('page-title-updated', (e, title) => {
    e.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setTitle(`Desktop for Claude v${version}`);
    const idx = tabs.findIndex(tab => tab.view === view);
    if (idx >= 0) {
      const clean = title.replace(/\s*[-\u2013]\s*Claude.*$/, '') || t('Neuer Chat', 'New Chat', 'Nouvelle conversation', 'Nuova chat');
      if (tabs[idx].title !== clean) { tabs[idx].title = clean; sendTabsUpdate(); }
    }
  });

  // Theme-Controller schon bei dom-ready injizieren (vor dem ersten Content-Paint),
  // damit beim neuen Tab/Reload kein heller/grauer claude.ai-Frame aufblitzt.
  wc.on('dom-ready', () => {
    if (alive(wc) && isAllowedDomain(wc.getURL())) wc.executeJavaScript(themeScript()).catch(() => {});
  });
  // Restliche Skripte + Theme-Reassert bei vollem Load
  wc.on('did-finish-load', () => {
    updateTitle();
    injectScripts(wc);
  });

  // SPA-Navigation (Chat-Wechsel): Scripts re-injizieren
  wc.on('did-navigate-in-page', () => reinjectScripts(wc));

  // Aktuelle URL am Tab mitfuehren, damit Offline-Restore und Session-Wiederherstellung
  // den echten Chat kennen. data: ausschliessen, sonst frisst die Offline-Seite die URL.
  const syncTabUrl = (url) => {
    const tab = tabs.find(tb => tb.view === view);
    if (tab && url && !url.startsWith('data:')) tab.url = url;
  };
  wc.on('did-navigate', (_e, url) => syncTabUrl(url));
  wc.on('did-navigate-in-page', (_e, url, isMainFrame) => { if (isMainFrame) syncTabUrl(url); });

  // Crash-Recovery
  wc.on('render-process-gone', (_, details) => {
    if (details.reason === 'clean-exit' || wc.isDestroyed()) return;
    const tab = tabs.find(tb => tb.view === view);
    if (!tab) return;
    // Gemeint ist ein Schutz gegen Crash-Schleifen. Ohne Zeitfenster summierte der Zaehler
    // ueber Tage und der Tab blieb beim vierten Crash endgueltig leer.
    const crashAt = Date.now();
    if (crashAt - (tab.lastCrashAt || 0) > CRASH_WINDOW_MS) tab.crashCount = 0;
    tab.lastCrashAt = crashAt;
    tab.crashCount = (tab.crashCount || 0) + 1;
    if (tab.crashCount > MAX_CRASH_RELOADS) {
      console.error(`Tab crashed ${tab.crashCount}x (${details.reason}), giving up.`);
      return;
    }
    console.error(`Tab crashed (${details.reason}), reload ${tab.crashCount}/${MAX_CRASH_RELOADS}...`);
    setTimeout(() => { if (alive(wc)) wc.reload(); }, 300);
  });
}

// View-Erstellung + Pool

function createContentView() {
  const view = new WebContentsView({
    webPreferences: {
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      partition: 'persist:claude',
      backgroundThrottling: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload-content.js')
    }
  });
  view.setBackgroundColor(theme().bg);
  // Die Ansicht liegt unten ueber dem Rahmen-Ring der Tab-Leiste; ohne eigene Rundung verdeckt sie ihn.
  if (windowsRounded) view.setBorderRadius(CORNER_RADIUS - WINDOW_BORDER);
  view.setVisible(false);
  view.webContents.setUserAgent(chromeUA);
  return view;
}

function drainPool() {
  while (viewPool.length > 0) {
    const v = viewPool.pop();
    if (alive(v)) v.webContents.close();
  }
}

function fillPool() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  while (viewPool.length < POOL_SIZE) {
    const view = createContentView();
    setupView(view);
    view.webContents.loadURL('https://claude.ai');
    viewPool.push(view);
  }
}

function getPooledView() {
  if (viewPool.length > 0) {
    const view = viewPool.shift();
    setTimeout(fillPool, POOL_REFILL_MS);
    return view;
  }
  return null;
}


// Tab-Operationen

// defer: Tab anlegen ohne zu laden und ohne zu aktivieren. Geladen wird beim ersten
// Anklicken (pendingUrl in switchToTab). Fuer den Session-Restore, damit N Tabs nicht
// gleichzeitig claude.ai anfragen.
function createTab(url = 'https://claude.ai', defer = false) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  closeAppMenu();   // sonst laege die neue View ueber dem offenen Menue (Strg+T)

  let view = (!defer && url === 'https://claude.ai') ? getPooledView() : null;
  if (!view) {
    view = createContentView();
    setupView(view);
    if (!defer) view.webContents.loadURL(url);
  }

  mainWindow.contentView.addChildView(view);
  tabs.push({ view, title: t('Neuer Chat', 'New Chat', 'Nouvelle conversation', 'Nuova chat'), url, crashCount: 0, pendingUrl: defer ? url : null });
  if (!defer) switchToTab(tabs.length - 1);
  else sendTabsUpdate();
  updateMenu();
  return tabs[tabs.length - 1];
}

let lastViewBounds = '';

// setBackgroundThrottling wird zur Laufzeit bewusst NICHT mehr angefasst. Gemessen mit
// Electron 41.7.1: setBackgroundThrottling(false) setzt disable_hidden_ im RenderWidgetHost,
// danach ignoriert der Renderer jedes Verstecken (View unsichtbar, rAF laeuft trotzdem
// weiter). Der Renderer haelt sich fuer sichtbar, die native View ist es nicht - und beim
// Wiederanzeigen faellt dann kein WasShown an, also auch kein neuer Frame: die Flaeche
// bleibt auf der Hintergrundfarbe stehen, in OLED schwarz. Der Default aus webPreferences
// (backgroundThrottling: true) drosselt versteckte Tabs ohnehin korrekt.

// Beim Fenster-Fokus (z.B. Alt+Tab) landet der Tastaturfokus sonst im Tabbar
// (Top-Level-WebContents) auf dem ersten Button (win-min) statt im Chat-Inhalt,
// wodurch der erste Tastendruck das Fenster minimiert. Fokus auf die aktive View
// umlenken. Deferred, weil Electron den nativen Fokus nach dem Event restauriert.
function focusActiveView() {
  setImmediate(() => {
    // Offenes App-Menue behaelt den Tastaturfokus (Pfeiltasten, Enter, Escape).
    if (appMenuView) return;
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isFocused()) return;
    const active = tabs[activeTabIndex];
    if (!active || !alive(active.view)) return;
    try { active.view.webContents.focus(); } catch {}
  });
}

const resizeActiveView = throttle(() => {
  if (!mainWindow || mainWindow.isDestroyed() || !tabs[activeTabIndex]) return;
  const b = mainWindow.getContentBounds();
  const nh = getNotificationBarHeight();
  const bw = WINDOW_BORDER;
  const topInset = TAB_BAR_HEIGHT + nh + bw;
  const key = `${b.width}:${b.height}:${nh}`;
  if (key === lastViewBounds) return;
  lastViewBounds = key;
  tabs[activeTabIndex].view.setBounds({ x: bw, y: topInset, width: Math.max(0, b.width - 2 * bw), height: Math.max(0, b.height - topInset - bw) });
}, 16);

// Nach einem Resize-Burst (Tiling/Half-Screen) ein letztes autoritatives Relayout.
// Auf X11 bleibt die WebContentsView nach dem Tiling sonst mit veralteten Bounds
// haengen: Inhalt verschoben oder Fensterrest schwarz/grau. Cache leeren + finales
// Relayout. Wenn das Fenster dieselben Bounds behaelt und nur die Compositor-Surface
// haengt, ist setBounds mit identischen Werten ein No-op und die Flaeche bleibt
// schwarz - darum zusaetzlich ein echter 1px-Delta (kurz verkleinern, zuruecksetzen),
// der eine Neukomposition erzwingt.
const settleActiveView = debounce(() => {
  if (!mainWindow || mainWindow.isDestroyed() || !tabs[activeTabIndex] || !alive(tabs[activeTabIndex].view)) return;
  // Nicht am unsichtbaren Fenster herumschieben: ein Bounds-Wechsel ohne Sichtbarkeit
  // hinterlaesst eine Surface-ID, auf deren Frame der Compositor dann wartet.
  if (!mainWindow.isVisible() || mainWindow.isMinimized()) return;
  lastViewBounds = '';
  resizeActiveView();
  const view = tabs[activeTabIndex].view;
  try {
    const b = view.getBounds();
    view.setBounds({ x: b.x, y: b.y, width: b.width, height: Math.max(0, b.height - 1) });
    setImmediate(() => { if (alive(view)) view.setBounds(b); });
  } catch {}
}, 200);

// Manueller Repaint fuer den Fall, dass die Compositor-Surface leer bleibt. Bewusst
// dieselbe setVisible-Sequenz wie switchToTab, denn das Weg-und-zurueck-Wechseln ist
// der einzige nachweislich funktionierende Weg, die Surface neu anzuhaengen. Ueber
// switchToTab selbst geht es nicht: dort greift der Early-Return auf den aktiven Tab.
function repaintActiveView() {
  const a = tabs[activeTabIndex];
  if (!a || !alive(a.view)) return;
  try {
    a.view.setVisible(false);
    // Echte Verzoegerung statt setImmediate: das Verstecken muss einen Frame lang stehen,
    // sonst zieht der Compositor Hide und Show zu einem No-op zusammen.
    setTimeout(() => {
      if (!alive(a.view) || tabs[activeTabIndex] !== a) return;
      a.view.setVisible(true);
      lastViewBounds = '';
      resizeActiveView();
      focusActiveView();
    }, 50);
  } catch {}
}

// Letzte Eskalationsstufe: View abhaengen und neu anhaengen. Erzwingt eine frische
// Layer/Surface, ohne die Seite neu zu laden - der Chat-Zustand bleibt erhalten.
function reattachActiveView() {
  const a = tabs[activeTabIndex];
  if (!a || !alive(a.view) || !mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.contentView.removeChildView(a.view);
    mainWindow.contentView.addChildView(a.view);
    a.view.setVisible(true);
    lastViewBounds = '';
    resizeActiveView();
    focusActiveView();
  } catch {}
}

// Ausloeser-unabhaengiger Auffangpfad fuer die schwarze Flaeche. Haengt die Compositor-
// Surface, bekommt der Renderer keine BeginFrames mehr und requestAnimationFrame verstummt,
// waehrend IPC und Timer weiterlaufen. Genau das misst der Heartbeat. Nur die aktive View wird
// gepingt: Hintergrund-Tabs bekommen absichtlich keine Frames.
// Der Renderer antwortet zweimal: sofort ('alive', beweist nur dass er lebt) und aus
// requestAnimationFrame ('raf', kommt nur solange Frames laufen). Erst beide zusammen sind
// aussagekraeftig - lebendig plus stumm heisst haengende Surface, gar keine Antwort heisst
// nur beschaeftigter Renderer, dagegen hilft kein Repaint.
const FRAME_CHECK_MS = 4000, FRAME_MISS_LIMIT = 2;
let frameRaf = true, frameAlive = false, frameMisses = 0, repairStep = 0, surfaceRepairs = 0;

// Reparieren in Stufen. Hilft die billigste nicht, ist der naechste Durchlauf eine Stufe
// haerter, statt denselben wirkungslosen Repaint alle paar Sekunden zu wiederholen.
function repairSurface() {
  surfaceRepairs++;
  const step = repairStep++;
  console.warn(`Surface stumm, Reparatur Stufe ${step} (#${surfaceRepairs})`);
  if (step === 0) repaintActiveView();
  else if (step === 1) settleActiveView();
  else { reattachActiveView(); repairStep = 2; }
}

function startSurfaceWatchdog() {
  ipcMain.on('cd-frame-pong', (e, kind) => {
    const a = tabs[activeTabIndex];
    if (!a || !alive(a.view) || e.sender !== a.view.webContents) return;
    if (kind === 'raf') frameRaf = true; else frameAlive = true;
  });
  setInterval(() => {
    const a = tabs[activeTabIndex];
    const watchable = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()
      && !mainWindow.isMinimized() && a && alive(a.view) && a.view.getVisible();
    if (!watchable) { frameRaf = true; frameMisses = 0; repairStep = 0; return; }
    if (frameRaf || !frameAlive) { frameMisses = 0; repairStep = 0; }
    else frameMisses++;
    frameRaf = false; frameAlive = false;
    try { a.view.webContents.send('cd-frame-ping'); } catch {}
    if (frameMisses >= FRAME_MISS_LIMIT) { frameMisses = 0; repairSurface(); }
  }, FRAME_CHECK_MS);
}

function switchToTab(index) {
  if (index < 0 || index >= tabs.length || !mainWindow || mainWindow.isDestroyed()) return;
  const target = tabs[index];
  if (!alive(target.view)) return;

  if (index === activeTabIndex && target.view.getVisible()) {
    sendTabsUpdate();
    return;
  }

  // Alten Tab verstecken
  const prev = tabs[activeTabIndex];
  if (prev && alive(prev.view)) prev.view.setVisible(false);

  activeTabIndex = index;

  target.view.setVisible(true);
  if (target.pendingUrl) { const u = target.pendingUrl; target.pendingUrl = null; target.view.webContents.loadURL(u); }

  lastViewBounds = '';
  resizeActiveView();
  updateTitle();
  updateMenu();
  sendTabsUpdate();
}

function closeTab(index) {
  if (tabs.length <= 1 || index < 0 || index >= tabs.length) return;
  const tab = tabs[index];
  mainWindow.contentView.removeChildView(tab.view);

  if (activeTabIndex === index) {
    const newIdx = index > 0 ? index - 1 : 0;
    tabs.splice(index, 1);
    activeTabIndex = Math.min(newIdx, tabs.length - 1);
    switchToTab(activeTabIndex);
  } else {
    tabs.splice(index, 1);
    if (activeTabIndex > index) activeTabIndex--;
    if (activeTabIndex >= tabs.length) activeTabIndex = tabs.length - 1;
  }

  setImmediate(() => {
    if (alive(tab.view)) {
      tab.view.webContents.removeAllListeners();
      tab.view.webContents.close();
    }
  });
  updateMenu();
  sendTabsUpdate();
}

function updateTitle() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const title = `Desktop for Claude v${version}`;
  if (mainWindow.getTitle() !== title) mainWindow.setTitle(title);
}

// Theme-Wechsel

// Einziger Weg, den Farbmodus zu setzen: Tab-Leisten-Cycle und Design-Fenster laufen beide
// hier durch. Der Pool wird geleert, weil die vorgeladenen Views ihre Hintergrundfarbe beim
// Erzeugen bekommen und sonst im alten Modus stehenbleiben.
function setThemeMode(mode) {
  if (!THEME_MODES.includes(mode) || mode === currentThemeMode()) return;
  themeMode = mode;
  drainPool();
  applyThemeToAllViews();

  const bg = theme().bg;
  const active = tabs[activeTabIndex]?.view;
  if (active && alive(active)) active.setBackgroundColor(bg);

  // claude.ai bleibt immer im dark-Modus; White entsteht per GPU-Invert im injizierten Theme
  // (data-cd-theme="light" -> filter:invert am Wurzelknoten, ~6ms statt ~480ms fuer claude.ais
  // prefers-color-scheme-Palettenwechsel). Deshalb kein Farbschema-Flip mehr.
  nativeTheme.themeSource = 'dark';
  sendThemeUpdate();

  for (const tab of tabs) {
    if (tab.view !== active && alive(tab.view)) tab.view.setBackgroundColor(bg);
  }

  setTimeout(fillPool, POOL_REFILL_AFTER_SWITCH_MS);
  saveWindowState();
}

// Icons dem gewaehlten Stil nachziehen: Fenster, Tray und die im Icon-Theme abgelegten
// Groessen, aus denen Dock und Taskleiste ihr angeheftetes Symbol lesen.
// Snap liefert sein Icon ueber die gebundelte .desktop, Schreiben in ~/ waere dort ein
// No-op und macht nur journalctl-Laerm.
function syncDesktopIcons() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setIcon(icon());
  refreshTrayImage();
  if (process.env.SNAP) return;

  try { fs.copyFileSync(icon(), path.join(app.getPath('home'), 'Apps', 'desktop-for-claude-icon.png')); } catch {}
  if (process.platform !== 'linux') return;

  // Der Dateiname MUSS von Anthropics claude-desktop.png abweichen: das User-Icon-Theme
  // schlaegt /usr/share/icons, ein Stilwechsel hier wuerde sonst deren Menue-Icon mitfaerben.
  // Der Beta-Build schreibt nur sein eigenes Icon, nie das des Stable-Builds.
  const iconFile = isBeta ? 'desktop-for-claude-beta.png' : 'desktop-for-claude.png';
  const hicolor = path.join(app.getPath('home'), '.local', 'share', 'icons', 'hicolor');
  for (const sz of ICON_THEME_SIZES) {
    const target = path.join(hicolor, sz, 'apps', iconFile);
    try {
      if (fs.existsSync(target)) fs.copyFileSync(icon(), target);
    } catch {}
  }
  // execFile statt exec: der Pfad kommt aus $HOME und ginge sonst durch die Shell.
  execFile('gtk-update-icon-cache', ['-t', '-f', hicolor], () => {});
}

// Design-Toggle

function setDesignStyle(style) {
  if (!DESIGN_STYLES.includes(style) || style === designStyle) return;
  designStyle = style;

  syncDesktopIcons();

  // Live wie beim Farbmodus. Frueher lud das Tab-Leiste und aktiven Tab neu, im Hell-Modus
  // stand dabei kurz die dunkle Seite da, bis der Invert wieder griff.
  drainPool();
  applyThemeToAllViews();
  sendThemeUpdate();
  sendDesignUpdate();

  setTimeout(fillPool, POOL_REFILL_AFTER_SWITCH_MS);
  saveWindowState();
  updateMenu(true);
}

// Bug-Report-Dialog

const BUG_EMAIL = 'simonlinuxcraft@pm.me';
const WEB3FORMS_ACCESS_KEY = 'f72095f3-b338-4fa5-8462-5ddee347eb32';
const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

// Solange das hier leer ist, geht der Report direkt an Web3Forms und der Access-Key liegt
// im Client, aus dem asar extrahierbar. cloudflare-worker/ haelt den Key als Secret und
// limitiert die Rate: nach `wrangler deploy` hier die Worker-URL (.../submit) eintragen,
// dann faellt der Key aus dem Client weg. Siehe cloudflare-worker/README.md.
const BUG_REPORT_PROXY = '';

const BUG_SUBMIT_URL = BUG_REPORT_PROXY || WEB3FORMS_ENDPOINT;

function getAppMode() {
  if (process.env.APPIMAGE) return 'AppImage';
  if (process.env.SNAP) return 'Snap';
  if (!app.isPackaged) return 'Development';
  return 'Packaged';
}

// Im Snap ist die os-release des Hosts ohne system-observe gesperrt, dort verraet /proc/version
// die Distro ueber Kernel- und Compiler-Kennung.
function hostSystemInfo() {
  let distro = '?';
  try {
    if (process.env.SNAP) {
      distro = fs.readFileSync('/proc/version', 'utf8').trim();
    } else {
      const m = fs.readFileSync('/etc/os-release', 'utf8').match(/^PRETTY_NAME="?([^"\n]*)/m);
      if (m) distro = m[1];
    }
  } catch {}
  const desktop = process.env.XDG_CURRENT_DESKTOP || process.env.XDG_SESSION_DESKTOP || '?';
  let displays = '?';
  try {
    displays = screen.getAllDisplays().map(d => `${d.size.width}x${d.size.height}@${d.scaleFactor}`).join(', ');
  } catch {}
  return { distro, desktop, displays };
}

async function copyDiagnosticsInfo() {
  const lines = [];
  lines.push(`App: Desktop for Claude v${app.getVersion()}`);
  lines.push(`Mode: ${getAppMode()}`);
  lines.push(`Electron: ${process.versions.electron}  Chrome: ${process.versions.chrome}  Node: ${process.versions.node}`);
  lines.push(`OS: ${process.platform} ${process.arch}  Kernel: ${os.release()}`);
  lines.push(`Session: XDG_SESSION_TYPE=${process.env.XDG_SESSION_TYPE || '?'}  WAYLAND_DISPLAY=${process.env.WAYLAND_DISPLAY || ''}  DISPLAY=${process.env.DISPLAY || ''}`);
  const sys = hostSystemInfo();
  lines.push(`Distro: ${sys.distro}`);
  lines.push(`Desktop: ${sys.desktop}`);
  lines.push(`Displays: ${sys.displays}`);
  lines.push(`Locale: ${app.getLocale()}  sysLang: ${sysLang}`);
  lines.push(`UA: ${chromeUA}`);
  lines.push(`Surface-Repairs: ${surfaceRepairs}  Stufe: ${repairStep}`);

  try {
    const features = app.getGPUFeatureStatus ? app.getGPUFeatureStatus() : null;
    if (features && typeof features === 'object') {
      const fmt = Object.keys(features).sort().map(k => `${k}=${features[k]}`).join(', ');
      lines.push(`GPU-Features: ${fmt}`);
    }
  } catch (e) {
    lines.push(`GPU-Features: error (${e && e.message || e})`);
  }

  try {
    const gpuInfo = await app.getGPUInfo('complete');
    if (gpuInfo && Array.isArray(gpuInfo.gpuDevice)) {
      gpuInfo.gpuDevice.forEach((d, i) => {
        lines.push(`GPU[${i}]: vendor=0x${(d.vendorId || 0).toString(16)} device=0x${(d.deviceId || 0).toString(16)} active=${d.active} driverVendor=${d.driverVendor || ''} driverVersion=${d.driverVersion || ''}`);
      });
    }
    const aux = gpuInfo && gpuInfo.auxAttributes;
    if (aux) {
      const glVendor = aux.glVendor || aux.gl_vendor || '';
      const glRenderer = aux.glRenderer || aux.gl_renderer || '';
      const glVersion = aux.glVersion || aux.gl_version || '';
      lines.push(`GL-Vendor: ${glVendor}`);
      lines.push(`GL-Renderer: ${glRenderer}`);
      lines.push(`GL-Version: ${glVersion}`);
    }
  } catch (e) {
    lines.push(`GPU-Info: error (${e && e.message || e})`);
  }

  const active = tabs[activeTabIndex];
  if (active && alive(active.view)) {
    try {
      const wgl = await active.view.webContents.executeJavaScript(`(()=>{try{const c=document.createElement('canvas');const gl=c.getContext('webgl2')||c.getContext('webgl');if(!gl)return{ok:false};const e=gl.getExtension('WEBGL_debug_renderer_info');return{ok:true,vendor:e?gl.getParameter(e.UNMASKED_VENDOR_WEBGL):'',renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'',version:gl.getParameter(gl.VERSION),ua:navigator.userAgent};}catch(err){return{ok:false,err:String(err)};}})()`, true);
      if (wgl && wgl.ok) {
        lines.push(`WebGL-Vendor: ${wgl.vendor}`);
        lines.push(`WebGL-Renderer: ${wgl.renderer}`);
        lines.push(`WebGL-Version: ${wgl.version}`);
        lines.push(`navigator.userAgent: ${wgl.ua}`);
      } else {
        lines.push(`WebGL: not available (${wgl && wgl.err || ''})`);
      }
    } catch (e) {
      lines.push(`WebGL-Probe: error (${e && e.message || e})`);
    }
  }

  const text = lines.join('\n');
  try { await clipboard.writeText(text); } catch {}
  showCustomMessageBox({
    type: 'info',
    title: 'Desktop for Claude',
    message: t('Diagnose-Info in Zwischenablage kopiert', 'Diagnostics info copied to clipboard', 'Infos de diagnostic copiées dans le presse-papiers', 'Informazioni di diagnostica copiate negli appunti'),
    detail: text
  });
}

async function resetClaudeVerification(targetTab) {
  const confirm = await showCustomMessageBox({
    type: 'warning',
    title: 'Desktop for Claude',
    message: t(
      'claude.ai-Cache und -Cookies zurücksetzen?',
      'Reset claude.ai cache and cookies?',
      'Réinitialiser le cache et les cookies de claude.ai ?',
      'Reimpostare cache e cookie di claude.ai?'
    ),
    detail: t(
      'Du wirst danach erneut bei claude.ai angemeldet sein müssen. Hilft, wenn die Verifizierungs-Seite („Performing security verification") in einer Schleife hängt.',
      'You will need to sign in to claude.ai again afterwards. This helps when the verification page ("Performing security verification") gets stuck in a loop.',
      'Vous devrez ensuite vous reconnecter à claude.ai. Utile lorsque la page de vérification (« Performing security verification ») tourne en boucle.',
      'Dopodiché sarà necessario accedere di nuovo a claude.ai. Utile quando la pagina di verifica ("Performing security verification") rimane bloccata in un ciclo.'
    ),
    buttons: [t('Abbrechen', 'Cancel', 'Annuler', 'Annulla'), t('Zurücksetzen', 'Reset', 'Réinitialiser', 'Reimposta')],
    defaultId: 1,
    cancelId: 0
  });
  if (!confirm || confirm.response !== 1) return;

  try {
    const ses = session.fromPartition('persist:claude');
    // Cloudflare bindet seinen Verdacht an Session-State (cf_clearance/__cf_bm, auch auf
    // challenges.cloudflare.com, plus Cache und Auth-Cache). Origin-gefiltertes Loeschen
    // liess davon genug stehen, dass die Partition CF-seitig "verbrannt" blieb und die
    // Verifizierung weiter in der Schleife hing. Empirisch verifiziert: nur ein vollstaendiges
    // Leeren der Partition (alle Origins, alle Caches) macht sie wieder durchlaessig.
    // Jeder Schritt einzeln gekapselt, damit ein fehlschlagender die restlichen nicht
    // verhindert. Aber nicht mehr stillschweigend: schlaegt hier etwas fehl, bleibt die
    // Partition CF-seitig verbrannt und der Nutzer erlebt nur "der Button tut nichts".
    const steps = [
      ['clearStorageData', () => ses.clearStorageData()],
      ['clearCache', () => ses.clearCache()],
      ['clearAuthCache', () => ses.clearAuthCache()],
      ['clearCodeCaches', () => ses.clearCodeCaches({})],
      ['clearHostResolverCache', () => ses.clearHostResolverCache()]
    ];
    const failed = [];
    for (const [name, run] of steps) {
      try { await run(); } catch (e) { failed.push(`${name}: ${(e && e.message) || e}`); }
    }
    domainCache.clear();
    if (failed.length) console.warn('resetClaudeVerification unvollstaendig:', failed.join(' | '));
  } catch (e) {
    console.error('resetClaudeVerification:', e);
  }

  const active = (targetTab && alive(targetTab.view)) ? targetTab : tabs[activeTabIndex];
  if (active && alive(active.view)) {
    active.view.webContents.loadURL('https://claude.ai');
  }
}

function showBugReportDialog() {
  if (bugReportWindow && !bugReportWindow.isDestroyed()) {
    bugReportWindow.focus();
    return;
  }
  const s = { ...bugReportStrings.en, ...(bugReportStrings[sysLang] || {}) };
  const th = subTheme();
  const ac = accent();
  const dark = currentThemeMode() !== 'light';
  const w = warnColor();
  const bg = th.bg;
  const fg = th.textActive;
  const sub = th.text;
  const inputBg = th.bgHover;
  const inputBorder = th.border;
  const inputFocus = ac.from;
  const btnBg = ac.from;
  const btnHover = ac.to;
  const btnDisabled = th.bgActive;
  const successColor = '#3da66a';

  const sys = hostSystemInfo();
  const meta = {
    version: app.getVersion(),
    os: `${process.platform} ${process.arch} (${os.release()}) | ${sys.distro} | ${sys.desktop} ${process.env.XDG_SESSION_TYPE || '?'} | ${sys.displays}`,
    locale: app.getLocale() || sysLang || 'unknown',
    mode: getAppMode()
  };

  // Hoehe am gemessenen Inhalt, damit der Dialog nicht scrollt.
  const brSize = fitToWorkArea(640, 690);
  const brPos = centerOnMainWindow(brSize.width, brSize.height);
  const win = new BrowserWindow({
    width: brSize.width, height: brSize.height, ...brPos, resizable: false,
    parent: mainWindow, modal: true,
    title: s.title, icon: icon(),
    backgroundColor: bg,
    autoHideMenuBar: true,
    frame: false, roundedCorners: windowsRounded,
    webPreferences: {
      preload: path.join(__dirname, 'preload-bugreport.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true
    }
  });
  bugReportWindow = win;
  applyUiScale(win, brSize.scale);
  win.setMenuBarVisibility(false);
  win.on('closed', () => { bugReportWindow = null; });

  const cfg = JSON.stringify({
    bugEmail: BUG_EMAIL,
    submitUrl: BUG_SUBMIT_URL,
    // Ueber den Proxy braucht der Client keinen Key, der liegt dort als Worker-Secret.
    accessKey: BUG_REPORT_PROXY ? null : WEB3FORMS_ACCESS_KEY,
    meta,
    strings: s
  });

  const html = `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src ${new URL(BUG_SUBMIT_URL).origin};">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${bg};color:${fg};font-family:system-ui,-apple-system,sans-serif;font-size:14px;
  display:flex;flex-direction:column;height:100vh;padding:0;overflow:hidden}
.field{margin-bottom:12px;display:flex;flex-direction:column}
label{font-size:12px;font-weight:500;color:${sub};margin-bottom:6px;letter-spacing:.02em}
textarea,input[type=email]{background:${inputBg};color:${fg};border:1px solid ${inputBorder};
  border-radius:8px;padding:10px 12px;font-size:13.5px;font-family:inherit;outline:none;
  transition:border-color .15s,box-shadow .15s;resize:none}
textarea:focus,input[type=email]:focus{border-color:${inputFocus};box-shadow:0 0 0 3px ${inputFocus}22}
textarea.desc{min-height:92px;line-height:1.5}
textarea.errcodes{min-height:54px;line-height:1.45;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px}
.auto-info-row{display:flex;align-items:flex-start;gap:10px;margin:6px 0 14px;
  padding:10px 12px;background:${inputBg};border:1px solid ${inputBorder};border-radius:8px;cursor:pointer;
  user-select:none;transition:border-color .15s}
.auto-info-row:hover{border-color:${inputFocus}}
.auto-info-row input[type=checkbox]{margin-top:2px;accent-color:${inputFocus};cursor:pointer;flex-shrink:0}
.auto-info-row .text{display:flex;flex-direction:column;gap:2px}
.auto-info-row .label{font-size:13px;color:${fg};font-weight:500}
.auto-info-row .hint{font-size:11.5px;color:${sub};line-height:1.4}
.confirm-row{display:flex;align-items:flex-start;gap:10px;margin:2px 0 16px;
  padding:11px 13px;border-radius:8px;cursor:pointer;user-select:none;
  background:${w.a(0.10)};
  border:1.5px solid ${w.a(0.45)};
  transition:border-color .15s,background .15s}
.confirm-row:hover{border-color:${inputFocus}}
.confirm-row.checked{background:${inputBg};border-color:${inputBorder}}
.confirm-row input[type=checkbox]{margin-top:2px;accent-color:${inputFocus};cursor:pointer;flex-shrink:0}
.confirm-row .text{display:flex;flex-direction:column;gap:2px}
.confirm-row .label{font-size:13px;color:${fg};font-weight:600}
.confirm-row .hint{font-size:11.5px;color:${sub};line-height:1.4}
.nudge{display:none;gap:9px;align-items:flex-start;padding:10px 12px;margin:-4px 0 14px;
  background:${w.a(0.12)};
  border:1px solid ${w.a(0.5)};
  border-radius:8px;font-size:12.5px;line-height:1.45}
.nudge.show{display:flex}
.nudge .ico{flex:0 0 auto;color:${w.fg};line-height:0;margin-top:1px}
.nudge .txt{flex:1;color:${fg}}
.nudge a{color:${inputFocus};text-decoration:underline;cursor:pointer;font-weight:500}
.nudge a:hover{filter:brightness(1.15)}
.actions{display:flex;gap:10px;justify-content:flex-end;margin-top:auto;padding-top:8px}
button{border:none;padding:10px 20px;border-radius:9px;font-size:13.5px;cursor:pointer;
  font-weight:500;font-family:inherit;transition:filter .15s,background .15s,opacity .15s}
button.primary{background:linear-gradient(135deg,${ac.from},${ac.to});color:#fff}
button.primary:hover:not(:disabled){filter:brightness(1.08)}
button.primary:disabled{background:${btnDisabled};cursor:not-allowed;filter:none}
button.secondary{background:transparent;color:${sub};border:1px solid ${inputBorder}}
button.secondary:hover{background:${inputBg};color:${fg}}
button:focus-visible{outline:2px solid ${ac.from};outline-offset:2px}
.honeypot{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.disclaimer{display:flex;gap:10px;align-items:flex-start;padding:11px 13px;margin:-2px 0 16px;
  background:${w.a(0.10)};
  border:1px solid ${w.a(0.35)};
  border-radius:8px;font-size:12.5px;line-height:1.5}
.disclaimer .ico{flex:0 0 auto;color:${w.fg};line-height:0;margin-top:1px}
.disclaimer .txt{flex:1;color:${fg}}
.disclaimer .ttl{font-weight:600;display:block;margin-bottom:3px;color:${w.title}}
.disclaimer a{color:${inputFocus};text-decoration:underline;cursor:pointer;font-weight:500}
.disclaimer a:hover{filter:brightness(1.15)}
.status{display:none;flex-direction:column;align-items:center;justify-content:center;
  height:100%;text-align:center;padding:20px}
.status.visible{display:flex}
.status .icon{margin-bottom:14px;line-height:0;color:${sub}}
.status .icon svg{width:48px;height:48px}
.status h3{font-size:17px;font-weight:600;margin-bottom:8px}
.status p{color:${sub};font-size:13px;line-height:1.5;margin-bottom:18px;max-width:380px}
.status.success .icon{color:${successColor}}
.status .email{font-size:14px;font-weight:600;color:${fg};margin-bottom:14px;word-break:break-all;
  background:${inputBg};padding:8px 14px;border-radius:6px;border:1px solid ${inputBorder}}
.error-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
${customTitlebarCSS()}
.bugreport-main{flex:1;padding:18px 24px 24px;overflow-y:auto;display:flex;flex-direction:column;min-height:0}
.bugreport-main::-webkit-scrollbar{width:10px}
.bugreport-main::-webkit-scrollbar-track{background:transparent}
.bugreport-main::-webkit-scrollbar-thumb{background:${inputBorder};border-radius:6px;border:3px solid ${bg};background-clip:padding-box}
.bugreport-main::-webkit-scrollbar-thumb:hover{background:${sub};border:3px solid ${bg};background-clip:padding-box}
.status-host{flex:1;display:flex;align-items:center;justify-content:center}
</style></head><body>
${customTitlebarHTML(s.title)}
<div class="bugreport-main">
<div id="form-view">
  <div class="disclaimer" role="note">
    <span class="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
    <span class="txt"><span class="ttl">${s.disclaimerTitle}</span>${s.disclaimerBody} <a id="anthropic-link" href="#" tabindex="0">${s.disclaimerLink}</a></span>
  </div>

  <form id="bugform" novalidate>
    <div class="field">
      <label for="desc">${s.descLabel}</label>
      <textarea id="desc" class="desc" required placeholder="${s.descPlaceholder}"></textarea>
    </div>

    <div class="nudge" id="support-nudge" role="note">
      <span class="ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>
      <span class="txt">${s.nudgeText} <a id="nudge-link" href="#" tabindex="0">${s.disclaimerLink}</a></span>
    </div>

    <div class="field">
      <label for="errcodes">${s.errorLabel}</label>
      <textarea id="errcodes" class="errcodes" placeholder="${s.errorPlaceholder}"></textarea>
    </div>
    <div class="field">
      <label for="email">${s.emailLabel}</label>
      <input type="email" id="email" placeholder="${s.emailPlaceholder}" autocomplete="email">
    </div>

    <label class="auto-info-row" for="autoinfo">
      <input type="checkbox" id="autoinfo" checked>
      <span class="text">
        <span class="label">${s.autoInfoLabel}</span>
      </span>
    </label>

    <input type="text" name="botcheck" id="botcheck" class="honeypot" tabindex="-1" autocomplete="off">

    <label class="confirm-row" for="confirmapp" id="confirm-row">
      <input type="checkbox" id="confirmapp">
      <span class="text">
        <span class="label">${s.confirmLabel}</span>
        <span class="hint">${s.confirmHint}</span>
      </span>
    </label>

    <div class="actions">
      <button type="button" class="secondary" id="cancel-btn">${s.cancelBtn}</button>
      <button type="submit" class="primary" id="send-btn" disabled>${s.sendBtn}</button>
    </div>
  </form>
</div>

<div class="status success" id="success-view">
  <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg></div>
  <h3>${s.successTitle}</h3>
  <p>${s.successMsg}</p>
  <button class="primary" onclick="window.close()">${s.closeBtn}</button>
</div>

<div class="status" id="error-view">
  <div class="icon" style="color:${btnBg}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
  <h3>${s.errorTitle}</h3>
  <p>${s.errorHint}</p>
  <div class="email" id="err-email"></div>
  <div class="error-row">
    <button class="secondary" onclick="window.close()">${s.closeBtn}</button>
    <button class="primary" id="copy-btn"></button>
  </div>
</div>
</div>

<script>
(function(){
  const cfg = ${cfg};
  const formView = document.getElementById('form-view');
  const successView = document.getElementById('success-view');
  const errorView = document.getElementById('error-view');
  const form = document.getElementById('bugform');
  const sendBtn = document.getElementById('send-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const desc = document.getElementById('desc');
  const errcodes = document.getElementById('errcodes');
  const emailInput = document.getElementById('email');
  const autoInfoCheckbox = document.getElementById('autoinfo');
  const confirmCheckbox = document.getElementById('confirmapp');
  const confirmRow = document.getElementById('confirm-row');
  const botcheck = document.getElementById('botcheck');
  const errEmail = document.getElementById('err-email');
  const copyBtn = document.getElementById('copy-btn');

  errEmail.textContent = cfg.bugEmail;
  copyBtn.textContent = cfg.strings.copyBtn;
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(cfg.bugEmail).then(() => {
      copyBtn.textContent = cfg.strings.copied;
      setTimeout(() => { copyBtn.textContent = cfg.strings.copyBtn; }, 1500);
    });
  });

  cancelBtn.addEventListener('click', () => window.close());

  const syncConfirm = () => {
    sendBtn.disabled = !confirmCheckbox.checked;
    confirmRow.classList.toggle('checked', confirmCheckbox.checked);
  };
  confirmCheckbox.addEventListener('change', syncConfirm);
  syncConfirm();

  const tbClose = document.getElementById('cd-titlebar-close');
  if (tbClose) tbClose.addEventListener('click', () => window.close());

  function wireSupportLink(el) {
    if (!el) return;
    const open = (e) => {
      if (e) { e.preventDefault(); }
      try { window.bugAPI.openSupport(); } catch {}
    };
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') open(e);
    });
  }
  wireSupportLink(document.getElementById('anthropic-link'));
  wireSupportLink(document.getElementById('nudge-link'));

  // Wenn die Beschreibung nach Account/Login/Bezahlung klingt, dezent auf den
  // Anthropic-Support hinweisen. Nur ein Nudge, das harte Gate bleibt die Checkbox.
  const supportNudge = document.getElementById('support-nudge');
  const NUDGE_KW = ['log in','login','logg','einlogg','anmeld','sign in','signin',
    'password','passwort','kennwort','mot de passe','contrase',
    'account','konto','cuenta','compte',
    'subscription','abonn','abbonamento','suscrip','abo-','abo kündig','abo kundig',
    'billing','rechnung','facturac','factura','fatturaz','invoice',
    'payment','paiement','bezahl','zahlung','pagamento',
    'refund','erstattung','remboursement','reembolso','rimborso','chargeback',
    'cancel','kündig','kundig','annuler','cancelar','cancellare','disdire',
    'credit card','kreditkarte','carte bancaire','tarjeta','carta di credito',
    'upgrade','downgrade'];
  const checkNudge = () => {
    const t = (desc.value + ' ' + errcodes.value).toLowerCase();
    supportNudge.classList.toggle('show', NUDGE_KW.some((k) => t.includes(k)));
  };
  desc.addEventListener('input', checkNudge);
  errcodes.addEventListener('input', checkNudge);

  function showView(which) {
    formView.style.display = which === 'form' ? '' : 'none';
    successView.classList.toggle('visible', which === 'success');
    errorView.classList.toggle('visible', which === 'error');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const description = desc.value.trim();
    if (!description) { desc.focus(); return; }
    if (!confirmCheckbox.checked) { confirmCheckbox.focus(); return; }
    if (botcheck.value) return;

    const userEmail = emailInput.value.trim();
    const errText = errcodes.value.trim();
    const includeAutoInfo = !!autoInfoCheckbox.checked;
    sendBtn.disabled = true;
    sendBtn.textContent = cfg.strings.sendingBtn;

    const meta = cfg.meta;
    let bodyMessage = description;
    if (errText) {
      bodyMessage += '\\n\\n--- Error Codes / Messages ---\\n' + errText;
    }
    if (includeAutoInfo) {
      bodyMessage +=
        '\\n\\n--- App-Info ---' +
        '\\nVersion: ' + meta.version +
        '\\nOS: ' + meta.os +
        '\\nLocale: ' + meta.locale +
        '\\nMode: ' + meta.mode;
    }
    bodyMessage += (userEmail ? '\\n\\nUser-Email: ' + userEmail : '\\n\\nUser-Email: (not provided)');

    const payload = {
      subject: 'Desktop for Claude Bug Report v' + meta.version,
      from_name: 'Desktop for Claude App',
      message: bodyMessage,
      botcheck: ''
    };
    if (cfg.accessKey) payload.access_key = cfg.accessKey;
    if (userEmail) payload.email = userEmail;

    try {
      const res = await fetch(cfg.submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showView('success');
      } else {
        throw new Error(data.message || ('HTTP ' + res.status));
      }
    } catch (err) {
      console.error('Bug-report submit failed:', err);
      showView('error');
    } finally {
      sendBtn.textContent = cfg.strings.sendBtn;
      sendBtn.disabled = !confirmCheckbox.checked;
    }
  });

  // preventScroll: das Beschreibungsfeld liegt unter dem Disclaimer. Ohne das scrollt der
  // Fokus es in den Blick und der Dialog oeffnet mitten im Text statt bei der Ueberschrift.
  // Beim Tippen zieht der Caret die Ansicht dann von selbst nach.
  setTimeout(() => {
    desc.focus({ preventScroll: true });
    const main = document.querySelector('.bugreport-main');
    if (main) main.scrollTop = 0;
  }, 50);
})();
</script>
</body></html>`;

  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

// Tray, Hintergrund-Modus, globaler Hotkey

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function toggleMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible() && !mainWindow.isMinimized() && mainWindow.isFocused()) mainWindow.hide();
  else showMainWindow();
}

function openNewChatFromHotkey() {
  showMainWindow();
  createTab('https://claude.ai/new');
}

function getQuickPromptHTML() {
  const th = theme();
  const ac = accent();
  const i18n = {
    placeholder: t('Frage an Claude\u2026', 'Ask Claude\u2026', 'Poser une question \u00e0 Claude\u2026', 'Chiedi a Claude\u2026'),
    hint: t('Enter zum Senden \u00b7 Shift+Enter neue Zeile \u00b7 Esc abbrechen \u00b7 Tab Template', 'Enter to send \u00b7 Shift+Enter new line \u00b7 Esc to cancel \u00b7 Tab template', 'Entr\u00e9e pour envoyer \u00b7 Maj+Entr\u00e9e nouvelle ligne \u00b7 \u00c9chap annuler \u00b7 Tab mod\u00e8le', 'Invio per inviare \u00b7 Maiusc+Invio nuova riga \u00b7 Esc annulla \u00b7 Tab modello'),
    noTemplate: t('Kein Template', 'No template', 'Aucun modèle', 'Nessun modello'),
    templates: t('Template', 'Template', 'Modèle', 'Modello')
  };
  const logoUrl = iconDataUrlForCurrentTheme();
  // XSS-safe: </script> in Template-Namen würde sonst aus dem Script-Kontext brechen
  const tpls = JSON.stringify(promptTemplates.map(t => ({ id: t.id, name: t.name, prefix: t.prefix })))
    .replace(/<\//g, '<\\/');
  return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:transparent;color:${th.textActive};font-family:system-ui,-apple-system,sans-serif;font-size:14px;overflow:hidden}
body{padding:10px}
@keyframes gradShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.frame{height:100%;border-radius:12px;padding:2px;
  background:linear-gradient(135deg,${ac.from},${ac.to},${ac.from},${ac.to});
  background-size:300% 300%;
  animation:gradShift 6s ease-in-out infinite}
.inner{height:100%;background:${th.bg};border-radius:10px;padding:12px 16px 10px;display:flex;flex-direction:column;gap:8px}
.wrap{flex:1;display:flex;align-items:flex-start;gap:12px;min-height:0}
.logo{width:28px;height:28px;flex-shrink:0;border-radius:7px;margin-top:4px;object-fit:contain;
  box-shadow:0 2px 8px color-mix(in srgb,${ac.from} 40%,transparent)}
textarea{flex:1;background:transparent;border:none;outline:none;resize:none;color:${th.textActive};font-family:inherit;font-size:15px;line-height:1.5;min-height:48px;padding:4px 0}
textarea::placeholder{color:${th.text}}
.bot{display:flex;align-items:center;justify-content:space-between;gap:10px}
.tpl-pick{display:flex;align-items:center;gap:6px;font-size:11.5px;color:${th.text}}
.tpl-pick select{background:${th.bgHover};color:${th.textActive};border:1px solid ${th.border};border-radius:5px;padding:3px 8px;font-family:inherit;font-size:11.5px;outline:none;cursor:pointer;max-width:200px}
.tpl-pick select:focus{border-color:${ac.from}}
.tpl-pick.empty{display:none}
.hint{color:${th.text};font-size:11px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style></head><body>
<div class="frame"><div class="inner">
<div class="wrap">
  <img class="logo" src="${logoUrl}" alt="Claude"/>
  <textarea id="q" placeholder="${i18n.placeholder}" autofocus></textarea>
</div>
<div class="bot">
  <div class="tpl-pick" id="tplwrap">
    <span>${i18n.templates}:</span>
    <select id="tpl"></select>
  </div>
  <div class="hint">${i18n.hint}</div>
</div>
</div></div>
<script>
const api = window.quickPromptAPI;
const q = document.getElementById('q');
const sel = document.getElementById('tpl');
const tplwrap = document.getElementById('tplwrap');
const TEMPLATES = ${tpls};
const I = ${safeJson(i18n)};

function buildTplOptions() {
  if (!TEMPLATES.length) { tplwrap.classList.add('empty'); return; }
  const opt = document.createElement('option'); opt.value = ''; opt.textContent = I.noTemplate;
  sel.appendChild(opt);
  for (const t of TEMPLATES) {
    const o = document.createElement('option'); o.value = t.id; o.textContent = t.name;
    sel.appendChild(o);
  }
}
buildTplOptions();

q.focus();
q.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); api.cancel(); return; }
  if (e.key === 'Tab' && TEMPLATES.length) { e.preventDefault(); sel.focus(); return; }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const v = q.value.trim();
    if (v.length === 0) { api.cancel(); return; }
    const tpl = TEMPLATES.find(t => t.id === sel.value);
    const finalText = tpl ? (tpl.prefix.trimEnd() + ' ' + v) : v;
    api.submit(finalText);
  }
});
sel.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); api.cancel(); }
  if (e.key === 'Enter') { e.preventDefault(); q.focus(); }
});
</script>
</body></html>`;
}

function openQuickPrompt() {
  if (quickPromptWindow && !quickPromptWindow.isDestroyed()) {
    quickPromptWindow.show();
    quickPromptWindow.focus();
    return;
  }
  const qpSize = fitToWorkArea(600, 160);
  const qpBase = {
    width: qpSize.width, height: qpSize.height,
    frame: false, roundedCorners: windowsRounded, resizable: false, movable: true,
    alwaysOnTop: true, skipTaskbar: true, show: false,
    transparent: true, hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload-quickprompt.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      spellcheck: false
    }
  };
  quickPromptWindow = new BrowserWindow({
    ...qpBase, ...centerOnMainDisplay(qpSize.width, qpSize.height)
  });
  quickPromptWindow.setMenu(null);
  applyUiScale(quickPromptWindow, qpSize.scale);
  quickPromptWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(getQuickPromptHTML()));
  quickPromptWindow.once('ready-to-show', () => {
    if (!quickPromptWindow || quickPromptWindow.isDestroyed()) return;
    quickPromptWindow.show();
    quickPromptWindow.focus();
  });
  quickPromptWindow.on('blur', () => {
    if (quickPromptWindow && !quickPromptWindow.isDestroyed()) quickPromptWindow.close();
  });
  quickPromptWindow.on('closed', () => { quickPromptWindow = null; });
}

// Quick-Prompt: Text in Eingabefeld einfügen und Cursor positionieren.
// Bewusst KEIN Auto-Submit: kein Button-Klick, kein synthetisches KeyboardEvent.
// User drückt selbst Enter zum Absenden – konsistent mit dem "passiver Wrapper"-Prinzip.
function submitQuickPrompt(text) {
  if (typeof text !== 'string') return;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_PROMPT_CHARS) return;
  showMainWindow();
  const tab = createTab('https://claude.ai/new');
  if (!tab || !alive(tab.view)) return;
  const wc = tab.view.webContents;
  const escaped = JSON.stringify(trimmed);
  const inject = () => {
    wc.executeJavaScript(`(function(){
      const prompt = ${escaped};
      let attempts = 0;
      const tryFill = () => {
        attempts++;
        if (attempts > 40) return; // ~6s max
        const el = document.querySelector('div[contenteditable="true"].ProseMirror')
                || document.querySelector('div[contenteditable="true"]')
                || document.querySelector('.ProseMirror');
        if (!el) { setTimeout(tryFill, 150); return; }
        try {
          el.focus();
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(el);
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('insertText', false, prompt);
          // Cursor ans Ende setzen, damit Enter direkt sendet
          const end = document.createRange();
          end.selectNodeContents(el);
          end.collapse(false);
          sel.removeAllRanges();
          sel.addRange(end);
        } catch(e) {}
      };
      tryFill();
    })();`).catch(() => {});
  };
  wc.once('did-finish-load', inject);
}

// Runde Ecken: border-image kann keine Rundung, deshalb ein maskierter Ring ueber dem Fenster,
// der genau Electrons Eckradius folgt. Er ragt 1px ueber den Rand: so glaettet am Bogen nur
// Electrons Zuschnitt, sonst wird die Kante doppelt geglaettet und der Bogen blass.
// Ohne Rundung bleibt der eckige border-image-Rahmen.
function roundFrameCSS(hi, lo) {
  if (!windowsRounded) return '';
  return `body{border-image:none;border-color:transparent}
html::after{content:'';position:fixed;inset:-1px;border-radius:${CORNER_RADIUS + 1}px;padding:${WINDOW_BORDER + 1}px;
  background:linear-gradient(180deg,${hi},${lo});pointer-events:none;z-index:2147483647;
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}`;
}

function customTitlebarCSS() {
  const th = subTheme();
  // Sub-Fenster nutzen pro Theme nur ihre flache Theme-Farbe (kein Brand-Glow mehr).
  // Soft-Depth-Fensterrahmen (oben heller, unten dunkler) gleich wie Hauptfenster, gemeinsam fuer
  // alle Dialoge die diese Titlebar einbinden (Bug-Report/Settings/What's-New/About).
  return `
body{border:${WINDOW_BORDER}px solid ${th.frameLo};border-image:linear-gradient(180deg,${th.frameHi},${th.frameLo}) ${WINDOW_BORDER}}
${roundFrameCSS(th.frameHi, th.frameLo)}
.cd-titlebar{height:36px;-webkit-app-region:drag;display:flex;align-items:center;
  padding:0 0 0 14px;background:transparent;color:${th.textActive};
  font-size:12.5px;flex-shrink:0;user-select:none}
.cd-titlebar-title{flex:1;font-weight:500;letter-spacing:.2px;color:${th.textActive};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8px}
.cd-titlebar-controls{display:flex;-webkit-app-region:no-drag;height:100%}
.cd-titlebar-btn{width:38px;height:36px;display:flex;align-items:center;justify-content:center;
  cursor:pointer;color:${th.textActive};border:0;background:transparent;
  transition:background .12s,color .12s;opacity:.78;padding:0;font-family:inherit}
.cd-titlebar-btn:hover{background:${th.bgHover};opacity:1}
.cd-titlebar-btn.cd-close:hover{background:#e05e3e;color:#fff}
.cd-titlebar-btn svg{width:11px;height:11px;display:block}`;
}

function customTitlebarHTML(titleText) {
  return `<div class="cd-titlebar">
    <span class="cd-titlebar-title">${titleText}</span>
    <div class="cd-titlebar-controls">
      <button class="cd-titlebar-btn cd-close" id="cd-titlebar-close" aria-label="Close">
        <svg viewBox="0 0 12 12"><path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
      </button>
    </div>
  </div>`;
}

function centerOnMainDisplay(width, height) {
  try {
    let display;
    if (mainWindow && !mainWindow.isDestroyed()) {
      display = screen.getDisplayMatching(mainWindow.getBounds());
    } else {
      display = screen.getPrimaryDisplay();
    }
    const wa = display.workArea;
    return {
      x: Math.round(wa.x + (wa.width - width) / 2),
      y: Math.round(wa.y + (wa.height - height) / 2)
    };
  } catch {
    return {};
  }
}

// Dialogmasse an die Arbeitsflaeche des Schirms anpassen, auf dem die App gerade laeuft.
// Die uebergebenen Werte sind Designmasse fuer 1920x1080; scaleWindow rechnet daraus
// Groesse und Zoom-Faktor (siehe utils/pure.js). Der Faktor gehoert per applyUiScale an
// den Fensterinhalt, sonst waechst nur der Rahmen und der Text bleibt klein.
function fitToWorkArea(width, height) {
  try {
    const d = (mainWindow && !mainWindow.isDestroyed())
      ? screen.getDisplayMatching(mainWindow.getBounds())
      : screen.getPrimaryDisplay();
    return scaleWindow(width, height, d.workArea);
  } catch {
    return { width, height, scale: 1 };
  }
}

// Das OAuth-Popup zeigt fremde Anmeldeseiten. Die skalieren selbst responsiv, deshalb
// hier nur die Fenstergroesse anpassen und bewusst kein Zoom setzen.
function oauthPopupSize() {
  const { width, height } = fitToWorkArea(600, 750);
  return { width, height };
}

// Den Zoom erst setzen, wenn die Seite steht: ein setZoomFactor vor dem ersten Laden
// wird von Chromium wieder auf 1 zurueckgesetzt.
//
// Immer setzen, auch bei Faktor 1. Chromium merkt sich den Zoom pro Origin, und alle
// Dialoge teilen sich die data:-Herkunft: wer die App einmal an einem 4K-Monitor
// benutzt hat, saesse sonst am Laptop dauerhaft auf dem dort gespeicherten 1.6.
// Ausschliesslich nach did-finish-load setzen. Ein setZoomFactor auf WebContents, die noch
// nichts geladen haben, zerstoert das Fenster gelegentlich noch vor dem ersten Laden - beim
// App-Menue liess sich der Hamburger dadurch mal oeffnen und mal nicht. Alle Aufrufer rufen
// applyUiScale vor loadURL, das Event kommt also in jedem Fall noch.
function applyUiScale(win, scale) {
  if (!win || win.isDestroyed()) return;
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
  win.webContents.on('did-finish-load', () => {
    try { if (!win.isDestroyed()) win.webContents.setZoomFactor(factor); } catch {}
  });
}

function centerOnMainWindow(width, height) {
  try {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || mainWindow.isMinimized()) {
      return centerOnMainDisplay(width, height);
    }
    const b = mainWindow.getBounds();
    return {
      x: Math.round(b.x + (b.width - width) / 2),
      y: Math.round(b.y + (b.height - height) / 2)
    };
  } catch {
    return centerOnMainDisplay(width, height);
  }
}

// Gemeinsamer BrowserWindow-Setup fuer Modal-Dialoge (showCustomMessageBox,
// requestMicrophoneConsent). Zentriert auf das Main-Window, parent+modal wenn
// mainWindow sichtbar ist, preload-messagebox.js + sandbox an.
function createDialogWindow(opts) {
  const { width, height, scale } = fitToWorkArea(opts.width, opts.height);
  const pos = centerOnMainWindow(width, height);
  const parentWin = (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) ? mainWindow : undefined;
  const win = new BrowserWindow({
    // Unter Wayland zeichnet Electron die Titelleiste innerhalb der Fenstergroesse, ohne das hier
    // fehlten dem Inhalt rund 37px. Unter X11 liegt sie ohnehin aussen.
    width, height, ...pos, useContentSize: true,
    parent: parentWin,
    modal: !!parentWin,
    resizable: false, minimizable: false, maximizable: false,
    title: opts.title || '',
    backgroundColor: subTheme().bg,
    icon: icon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, opts.preload || 'preload-messagebox.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      spellcheck: false
    }
  });
  win.setMenu(null);
  applyUiScale(win, scale);
  return win;
}

function setupTray() {
  if (tray) return;
  try {
    const img = nativeImage.createFromPath(trayIcon());
    tray = new Tray(img.isEmpty() ? trayIcon() : img);
    if (!img.isEmpty()) tray.setImage(img);
    tray.setToolTip('Desktop for Claude');
    tray.on('click', toggleMainWindow);
    updateTrayMenu();
  } catch (e) {
    tray = null;
  }
}

function refreshTrayImage() {
  if (!tray) return;
  try {
    const img = nativeImage.createFromPath(trayIcon());
    tray.setImage(img.isEmpty() ? trayIcon() : img);
  } catch {}
}

function updateTrayMenu() {
  if (!tray) return;
  try {
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: t('\u00d6ffnen', 'Open', 'Ouvrir', 'Apri'), click: showMainWindow },
      { label: t('Neuer Chat', 'New Chat', 'Nouvelle conversation', 'Nuova chat'), click: openNewChatFromHotkey },
      { type: 'separator' },
      { label: t('App-Einstellungen\u2026', 'App Settings\u2026', 'Paramètres de l’application…', 'Impostazioni dell’app…'), click: () => openSettingsWindow() },
      { type: 'separator' },
      { label: t('Beenden', 'Quit', 'Quitter', 'Esci'), click: () => { isQuitting = true; app.quit(); } }
    ]));
  } catch {}
}

function registerHotkey(accel) {
  if (typeof accel === 'string' && accel.length > 0 && accel === currentClipboardHotkey) return 'conflict';
  if (currentHotkey) {
    try { globalShortcut.unregister(currentHotkey); } catch {}
  }
  currentHotkey = null;
  if (!accel || typeof accel !== 'string') return 'ok';
  try {
    if (globalShortcut.register(accel, openQuickPrompt)) {
      currentHotkey = accel;
      return 'ok';
    }
  } catch {}
  return isWayland ? 'failed-wayland' : 'failed';
}

// Feature 6: Clipboard → Chat
async function openClipboardChat() {
  let text = '';
  try { text = (await clipboard.readText()) || ''; } catch {}
  text = text.trim();
  if (!text) {
    // Screenshot liegt als Bild in der Zwischenablage, nicht als Text. Ein Bild
    // laesst sich von hier nicht in den claude.ai-Composer injizieren, daher Hinweis
    // auf direktes Einfuegen statt der irrefuehrenden "leer"-Meldung.
    let hasImage = false;
    try { hasImage = await clipboard.has('image/png'); } catch {}
    notify({
      title: 'Desktop for Claude',
      body: hasImage
        ? t('Bild in der Zwischenablage. Bitte direkt im Chat mit Strg+V einfügen.', 'Image in clipboard. Paste it directly in the chat with Ctrl+V.', 'Image dans le presse-papiers. Collez-la directement dans le chat avec Ctrl+V.', 'Immagine negli appunti. Incollala direttamente nella chat con Ctrl+V.')
        : t('Zwischenablage ist leer.', 'Clipboard is empty.', 'Le presse-papiers est vide.', 'Gli appunti sono vuoti.')
    });
    return;
  }
  if (text.length > MAX_PROMPT_CHARS) text = text.slice(0, MAX_PROMPT_CHARS);
  submitQuickPrompt(text);
}

function registerClipboardHotkey(accel) {
  if (typeof accel === 'string' && accel.length > 0 && accel === currentHotkey) return 'conflict';
  if (currentClipboardHotkey) {
    try { globalShortcut.unregister(currentClipboardHotkey); } catch {}
  }
  currentClipboardHotkey = null;
  if (!accel || typeof accel !== 'string') return 'ok';
  try {
    if (globalShortcut.register(accel, openClipboardChat)) {
      currentClipboardHotkey = accel;
      return 'ok';
    }
  } catch {}
  return isWayland ? 'failed-wayland' : 'failed';
}

// Feature 4: Markdown-Export
async function exportActiveConversation() {
  const tab = tabs[activeTabIndex];
  if (!tab || !alive(tab.view)) return;
  const wc = tab.view.webContents;
  const url = wc.getURL();
  if (!/^https:\/\/(?:[a-z0-9-]+\.)?claude\.ai\//i.test(url)) {
    showCustomMessageBox({
      type: 'info', title: 'Desktop for Claude',
      message: t('Export nur in claude.ai-Tabs verfügbar.', 'Export only available in claude.ai tabs.', 'Export disponible uniquement dans les onglets claude.ai.', 'Esportazione disponibile solo nelle schede claude.ai.')
    });
    return;
  }

  let payload = null;
  try {
    payload = await wc.executeJavaScript(`(function(){
      function clean(s){ return (s||'').replace(/\\u00a0/g,' ').replace(/\\s+\\n/g,'\\n').trim(); }
      function nodeToMarkdown(root){
        if(!root) return '';
        const walk = (node) => {
          if(node.nodeType === 3) return node.textContent;
          if(node.nodeType !== 1) return '';
          const tag = node.tagName.toLowerCase();
          const inner = Array.from(node.childNodes).map(walk).join('');
          if(tag === 'br') return '\\n';
          if(tag === 'strong' || tag === 'b') return '**' + inner + '**';
          if(tag === 'em' || tag === 'i') return '*' + inner + '*';
          if(tag === 'code' && node.parentElement && node.parentElement.tagName.toLowerCase() !== 'pre') return '\`' + inner + '\`';
          if(tag === 'pre'){
            const code = node.querySelector('code');
            const lang = code && code.className ? (code.className.match(/language-([\\w-]+)/) || [])[1] || '' : '';
            return '\\n\\n\`\`\`' + lang + '\\n' + (code ? code.innerText : node.innerText) + '\\n\`\`\`\\n\\n';
          }
          if(tag === 'a'){
            const href = node.getAttribute('href') || '';
            return href ? '[' + inner + '](' + href + ')' : inner;
          }
          if(tag === 'li') return '- ' + inner.trim() + '\\n';
          if(tag === 'ul' || tag === 'ol') return '\\n' + inner + '\\n';
          if(tag === 'h1') return '\\n# ' + inner + '\\n\\n';
          if(tag === 'h2') return '\\n## ' + inner + '\\n\\n';
          if(tag === 'h3') return '\\n### ' + inner + '\\n\\n';
          if(tag === 'h4') return '\\n#### ' + inner + '\\n\\n';
          if(tag === 'blockquote') return inner.split('\\n').map(l=>'> '+l).join('\\n') + '\\n\\n';
          if(tag === 'p' || tag === 'div') return inner + '\\n\\n';
          return inner;
        };
        return clean(walk(root));
      }
      const title = (document.title || 'Claude Chat').replace(/\\s*[-\\u2013]\\s*Claude.*$/, '').trim() || 'Claude Chat';
      const sels = [
        '[data-testid="user-message"]',
        '[data-testid="assistant-message"]',
        '[data-test-render-count]',
        'div.font-claude-message',
        'div.font-user-message'
      ];
      const found = new Map();
      for(const sel of sels){
        document.querySelectorAll(sel).forEach(el => {
          const r = el.getBoundingClientRect();
          const key = Math.round(window.scrollY + r.top) + ':' + Math.round(r.left);
          if(!found.has(key)) found.set(key, el);
        });
      }
      const parts = Array.from(found.values()).sort((a,b) => {
        const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        return (ar.top + window.scrollY) - (br.top + window.scrollY);
      });
      const blocks = [];
      for(const el of parts){
        const isUser = !!(el.matches('[data-testid="user-message"]') || el.closest('[data-testid="user-message"]') || el.classList.contains('font-user-message'));
        const role = isUser ? 'User' : 'Claude';
        const md = nodeToMarkdown(el);
        if(md) blocks.push({ role, md });
      }
      return { title, url: location.href, blocks };
    })()`);
  } catch (e) {
    console.error('Export-Scrape fehlgeschlagen:', e);
  }
  if (!payload || !payload.blocks || !payload.blocks.length) {
    showCustomMessageBox({
      type: 'info', title: 'Desktop for Claude',
      message: t('Konnte keine Konversation finden.', 'Could not find a conversation on this page.', 'Impossible de trouver une conversation sur cette page.', 'Impossibile trovare una conversazione in questa pagina.'),
      detail: t('Stelle sicher, dass du in einem Chat bist (nicht auf der Übersicht).', 'Make sure you are inside a chat (not on the overview).', 'Assurez-vous d’être dans une conversation (pas sur la vue d’ensemble).', 'Assicurati di essere in una chat (non nella panoramica).')
    });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  let md = `# ${payload.title}\n\n`;
  md += `_${t('Quelle', 'Source', 'Source', 'Fonte')}: ${payload.url}_\n`;
  md += `_${t('Exportiert', 'Exported', 'Exporté', 'Esportato')}: ${today}_\n\n---\n\n`;
  for (const b of payload.blocks) {
    md += `## ${b.role === 'User' ? t('Du', 'You', 'Vous', 'Tu') : 'Claude'}\n\n${b.md}\n\n---\n\n`;
  }

  const safeName = payload.title.replace(/[^\w\s.-]+/g, '_').slice(0, 80) || 'claude-chat';
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(app.getPath('documents'), `${safeName}-${today}.md`),
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: t('Alle Dateien', 'All Files', 'Tous les fichiers', 'Tutti i file'), extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePath) return;
  fs.writeFile(result.filePath, md, 'utf8', (err) => {
    if (err) {
      showCustomMessageBox({
        type: 'error', title: t('Export fehlgeschlagen', 'Export failed', 'Échec de l’export', 'Esportazione non riuscita'),
        message: err.message || String(err)
      });
      return;
    }
    notify({
      title: t('Konversation exportiert', 'Conversation exported', 'Conversation exportée', 'Conversazione esportata'),
      body: path.basename(result.filePath)
    });
  });
}


function getSettingsHTML() {
  const th = subTheme();
  const ac = accent();
  const i18n = {
    title: t('Einstellungen', 'Settings', 'Param\u00e8tres', 'Impostazioni'),
    subtitle: t('Hintergrund, Hotkeys, Templates', 'Background, hotkeys, templates', 'Arri\u00e8re-plan, raccourcis, mod\u00e8les', 'Background, scorciatoie, modelli'),
    secBackground: t('Hintergrund', 'Background', 'Arri\u00e8re-plan', 'Background'),
    secMicrophone: t('Mikrofon', 'Microphone', 'Microphone', 'Microfono'),
    secHotkeys: t('Globale Hotkeys', 'Global hotkeys', 'Raccourcis globaux', 'Scorciatoie globali'),
    secTemplates: t('Prompt-Templates', 'Prompt templates', 'Mod\u00e8les de prompt', 'Modelli di prompt'),
    minimizeLabel: t('Beim Schlie\u00dfen in den Hintergrund minimieren', 'Minimize to tray on close', 'R\u00e9duire dans la zone de notification \u00e0 la fermeture', 'Riduci nell\'area di notifica alla chiusura'),
    minimizeHint: t('Claude bleibt im Hintergrund erreichbar \u2013 \u00fcber das Tray-Symbol oder die Hotkeys unten.', 'Claude stays reachable in the background \u2013 via the tray icon or the hotkeys below.', 'Claude reste accessible en arri\u00e8re-plan, via l\'ic\u00f4ne de la zone de notification ou les raccourcis ci-dessous.', 'Claude resta accessibile in background, tramite l\'icona nell\'area di notifica o le scorciatoie qui sotto.'),
    autostartLabel: t('Beim Anmelden automatisch starten', 'Start automatically at login', 'Lancer automatiquement \u00e0 la connexion', 'Avvia automaticamente all\'accesso'),
    autostartHint: t('Claude startet beim Hochfahren des Systems automatisch.', 'Claude launches automatically when the system starts.', 'Claude se lance automatiquement au d\u00e9marrage du syst\u00e8me.', 'Claude si avvia automaticamente all\'avvio del sistema.'),
    autostartFailed: t('Autostart konnte nicht aktiviert werden.', 'Could not enable autostart.', 'Impossible d\'activer le d\u00e9marrage automatique.', 'Impossibile attivare l\'avvio automatico.'),
    bgNotifLabel: t('Antwort-Benachrichtigung f\u00fcr Hintergrund-Tabs', 'Notify when a background tab finishes a response', 'Notification de r\u00e9ponse pour les onglets en arri\u00e8re-plan', 'Notifica di risposta per le schede in background'),
    bgNotifHint: t('Native Notification, sobald Claude in einem nicht aktiven Tab fertig geantwortet hat.', 'Native notification once Claude finishes a response in a tab you\u2019re not currently looking at.', 'Notification native d\u00e8s que Claude a termin\u00e9 sa r\u00e9ponse dans un onglet que vous ne regardez pas.', 'Notifica nativa non appena Claude termina una risposta in una scheda che non stai guardando.'),
    micLabel: t('Mikrofon-Zugriff erlauben', 'Allow microphone access', 'Autoriser l\'acc\u00e8s au microphone', 'Consenti l\'accesso al microfono'),
    micHint: t('Erlaubt Claude, dein Mikrofon f\u00fcr Spracheingaben zu nutzen. Beim ersten Klick auf das Mikrofon-Symbol fragt die App einmal nach \u2013 die Auswahl kannst du hier jederzeit \u00e4ndern.', 'Lets Claude use your microphone for voice input. The app asks once the first time you click the microphone icon \u2013 you can change your choice here at any time.', 'Permet \u00e0 Claude d\'utiliser votre microphone pour la saisie vocale. Au premier clic sur l\'ic\u00f4ne du microphone, l\'application demande une fois, vous pouvez modifier ce choix ici \u00e0 tout moment.', 'Permette a Claude di usare il microfono per l\'input vocale. Al primo clic sull\'icona del microfono l\'app chiede una volta, puoi modificare questa scelta qui in qualsiasi momento.'),
    micSnapHint: t('Auf Snap muss das Mikrofon einmalig freigegeben werden. Entweder im Snap-Store \u00f6ffnen und \u201eAudio Record" aktivieren \u2013 oder den Befehl unten im Terminal ausf\u00fchren.', 'On Snap the microphone must be enabled once. Either open the Snap Store and enable \u201cAudio Record\u201d \u2013 or run the command below in a terminal.', 'Sur Snap, le microphone doit \u00eatre autoris\u00e9 une fois. Ouvrez le Snap Store et activez \u00ab Audio Record \u00bb, ou ex\u00e9cutez la commande ci-dessous dans un terminal.', 'Su Snap il microfono deve essere autorizzato una volta. Apri lo Snap Store e attiva "Audio Record", oppure esegui il comando qui sotto in un terminale.'),
    micSnapButton: t('Im Snap-Store \u00f6ffnen', 'Open in Snap Store', 'Ouvrir dans le Snap Store', 'Apri nello Snap Store'),
    micSnapCmdLabel: t('Oder im Terminal:', 'Or in a terminal:', 'Ou dans un terminal :', 'Oppure in un terminale:'),
    micSnapCmdCopy: t('Befehl kopieren', 'Copy command', 'Copier la commande', 'Copia comando'),
    micSnapCmdCopied: t('Kopiert \u2713', 'Copied \u2713', 'Copi\u00e9 \u2713', 'Copiato \u2713'),
    micResetLabel: t('Erneut fragen beim n\u00e4chsten Mikrofon-Klick', 'Ask again on next microphone click', 'Redemander au prochain clic sur le microphone', 'Chiedi di nuovo al prossimo clic sul microfono'),
    micResetDone: t('Erledigt \u2013 Dialog erscheint beim n\u00e4chsten Mikrofon-Klick wieder.', 'Done \u2013 dialog will appear again on next microphone click.', 'Termin\u00e9, le dialogue r\u00e9appara\u00eetra au prochain clic sur le microphone.', 'Fatto, la finestra riapparir\u00e0 al prossimo clic sul microfono.'),
    micResetHint: t('Verwirft die letzte Auswahl, sodass der Hinweis-Dialog beim n\u00e4chsten Mikrofon-Zugriff wieder erscheint.', 'Discards the last choice so the consent dialog appears again on the next microphone request.', 'Annule le dernier choix afin que le dialogue de consentement r\u00e9apparaisse lors du prochain acc\u00e8s au microphone.', 'Annulla l\'ultima scelta in modo che la finestra di consenso riappaia al prossimo accesso al microfono.'),
    micSnapStatusConnected: t('Snap: Audio-Record verbunden', 'Snap: audio-record connected', 'Snap : Audio Record connect\u00e9', 'Snap: Audio Record connesso'),
    micSnapStatusDisconnected: t('Snap: Audio-Record nicht verbunden', 'Snap: audio-record not connected', 'Snap : Audio Record non connect\u00e9', 'Snap: Audio Record non connesso'),
    micSnapStatusUnknown: t('Snap-Status wird gepr\u00fcft\u2026', 'Checking snap status\u2026', 'V\u00e9rification du statut Snap\u2026', 'Verifica dello stato Snap\u2026'),
    micToggleNeedsConsent: t('Bitte zuerst die Snap-Berechtigung freigeben.', 'Please enable the Snap permission first.', 'Veuillez d\'abord activer l\'autorisation Snap.', 'Attiva prima l\'autorizzazione Snap.'),
    hotkeyQp: t('Neuer Chat (Quick-Prompt)', 'New chat (Quick-Prompt)', 'Nouvelle conversation (Quick-Prompt)', 'Nuova chat (Quick-Prompt)'),
    hotkeyClip: t('Zwischenablage als Prompt einf\u00fcgen', 'Send clipboard text as new prompt', 'Envoyer le presse-papiers comme nouveau prompt', 'Invia gli appunti come nuovo prompt'),
    press: t('Klick hier und dr\u00fccke eine Tastenkombination', 'Click here and press a key combination', 'Cliquez ici et appuyez sur une combinaison de touches', 'Fai clic qui e premi una combinazione di tasti'),
    pressing: t('Dr\u00fccke die gew\u00fcnschte Tastenkombination\u2026', 'Press your key combination\u2026', 'Appuyez sur la combinaison souhait\u00e9e\u2026', 'Premi la combinazione desiderata\u2026'),
    clear: t('L\u00f6schen', 'Clear', 'Effacer', 'Cancella'),
    close: t('Schlie\u00dfen', 'Close', 'Fermer', 'Chiudi'),
    registered: t('Hotkey registriert.', 'Hotkey registered.', 'Raccourci enregistré.', 'Scorciatoia registrata.'),
    failed: t('Diese Kombination konnte nicht registriert werden, sie ist evtl. systemweit belegt.', 'Could not register this combination, it is likely already in use system-wide.', 'Impossible d\'enregistrer cette combinaison, elle est peut-être déjà utilisée au niveau du système.', 'Impossibile registrare questa combinazione, forse è già in uso a livello di sistema.'),
    failedWayland: t('Globaler Hotkey konnte unter Wayland nicht registriert werden, der Compositor erlaubt das nicht. Quick-Prompt funktioniert nur bei aktivem Fenster.', 'Could not register a global hotkey on Wayland, the compositor does not allow it. Quick-Prompt only works when the window is focused.', 'Impossible d\'enregistrer un raccourci global sous Wayland, le compositeur ne l\'autorise pas. Le Quick-Prompt ne fonctionne que lorsque la fenêtre est active.', 'Impossibile registrare una scorciatoia globale su Wayland, il compositor non lo consente. Il Quick-Prompt funziona solo quando la finestra è attiva.'),
    conflictQp: t('Diese Kombination ist bereits dem Quick-Prompt-Hotkey zugewiesen.', 'This combination is already assigned to the Quick-Prompt hotkey.', 'Cette combinaison est déjà attribuée au raccourci Quick-Prompt.', 'Questa combinazione è già assegnata alla scorciatoia Quick-Prompt.'),
    conflictClip: t('Diese Kombination ist bereits dem Clipboard-Hotkey zugewiesen.', 'This combination is already assigned to the Clipboard hotkey.', 'Cette combinaison est déjà attribuée au raccourci du presse-papiers.', 'Questa combinazione è già assegnata alla scorciatoia degli appunti.'),
    removed: t('Hotkey entfernt.', 'Hotkey removed.', 'Raccourci supprimé.', 'Scorciatoia rimossa.'),
    needMod: t('Bitte mindestens eine Modifikator-Taste (Strg/Alt/Shift) verwenden.', 'Please use at least one modifier key (Ctrl/Alt/Shift).', 'Veuillez utiliser au moins une touche de modification (Ctrl/Alt/Maj).', 'Usa almeno un tasto modificatore (Ctrl/Alt/Maiusc).'),
    waylandPortalHint: t('Hinweis: Unter Wayland vergibt das System globale Hotkeys. GNOME ab Version 48 und KDE fragen beim ersten Mal nach, ob die App die Tastenkombination nutzen darf, danach lässt sie sich in den Systemeinstellungen ändern. Ältere Desktops kennen das nicht, dort greift der Hotkey nicht.', 'Note: On Wayland the system hands out global hotkeys. GNOME 48 or newer and KDE ask once whether the app may use the shortcut, after that you can change it in the system settings. Older desktops lack this, the hotkey does not work there.', 'Remarque : sous Wayland, c\'est le système qui attribue les raccourcis globaux. GNOME 48 ou plus récent et KDE demandent une fois si l\'application peut utiliser le raccourci, ensuite il se modifie dans les paramètres du système. Les bureaux plus anciens ne le permettent pas, le raccourci n\'y fonctionne pas.', 'Nota: su Wayland è il sistema ad assegnare le scorciatoie globali. GNOME 48 o successivo e KDE chiedono una volta se l\'app può usare la scorciatoia, poi si può modificare nelle impostazioni di sistema. I desktop più vecchi non lo supportano, lì la scorciatoia non funziona.'),
    waylandHint: t('Hinweis: Auf Wayland werden globale Hotkeys vom Compositor begrenzt und können je nach Desktop (GNOME/KDE) nicht systemweit greifen. Wenn die Registrierung fehlschlägt, weicht die App still aus. Du kannst den Quick-Prompt dann nur bei aktivem Fenster auslösen.', 'Note: On Wayland, global hotkeys are gated by the compositor and may not work system-wide depending on the desktop (GNOME/KDE). If registration fails, the app silently skips it. The Quick-Prompt is then only reachable while the window is focused.', 'Remarque : sous Wayland, les raccourcis globaux sont limités par le compositeur et peuvent ne pas fonctionner au niveau du système selon le bureau (GNOME/KDE). Si l\'enregistrement échoue, l\'application l\'ignore silencieusement, le Quick-Prompt n\'est alors accessible que lorsque la fenêtre est active.', 'Nota: su Wayland le scorciatoie globali sono limitate dal compositor e potrebbero non funzionare a livello di sistema a seconda del desktop (GNOME/KDE). Se la registrazione fallisce, l\'app la ignora silenziosamente, il Quick-Prompt è quindi accessibile solo quando la finestra è attiva.'),
    tplEmpty: t('Noch keine Templates. F\u00fcgst du eines hinzu, erscheint es im Quick-Prompt-Fenster als Auswahl.', 'No templates yet. Once added, they appear as a picker in the Quick-Prompt window.', 'Aucun mod\u00e8le pour l\'instant. Lorsque vous en ajoutez un, il appara\u00eet comme choix dans la fen\u00eatre Quick-Prompt.', 'Ancora nessun modello. Quando ne aggiungi uno, appare come scelta nella finestra Quick-Prompt.'),
    tplName: t('Name (z.B. \u201e\u00dcbersetze")', 'Name (e.g. \u201eTranslate")', 'Nom (par ex. \u00ab Traduire \u00bb)', 'Nome (es. "Traduci")'),
    tplPrefix: t('Prefix-Text (wird vor deinem Input eingef\u00fcgt)', 'Prefix text (prepended to your input)', 'Texte de pr\u00e9fixe (ajout\u00e9 avant votre saisie)', 'Testo prefisso (inserito prima del tuo input)'),
    tplAdd: t('Hinzuf\u00fcgen', 'Add', 'Ajouter', 'Aggiungi'),
    tplDelete: t('L\u00f6schen', 'Delete', 'Supprimer', 'Elimina'),
    tplLimit: t('Maximal 50 Templates.', 'Maximum 50 templates.', 'Maximum 50 mod\u00e8les.', 'Massimo 50 modelli.'),
    tplDup: t('Name existiert bereits.', 'A template with that name already exists.', 'Ce nom existe d\u00e9j\u00e0.', 'Esiste gi\u00e0 un modello con questo nome.')
  };
  return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{padding:0;background:${th.bg};color:${th.textActive};font-family:system-ui,-apple-system,sans-serif;font-size:13.5px;user-select:none;display:flex;flex-direction:column}
.head{padding:18px 22px 12px;border-bottom:1px solid ${th.border}}
h1{font-size:16px;margin:0 0 2px;font-weight:600}
.sub{color:${th.text};font-size:12px}
.scroll{flex:1;overflow-y:auto;padding:14px 22px 4px;column-count:2;column-gap:26px}
/* Die Abschnitte sind unabhaengige Bloecke, deshalb Multi-Column: der Browser
   balanciert sie selbst auf zwei Spalten und das Fenster wird breit statt lang.
   break-inside haelt einen Abschnitt zusammen. */
.section{break-inside:avoid}
@media (max-width:560px){.scroll{column-count:1}}
.scroll::-webkit-scrollbar{width:8px}
.scroll::-webkit-scrollbar-thumb{background:${th.border};border-radius:4px}
.section{margin-bottom:18px}
.section h2{font-size:11px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:${th.text};margin:0 0 10px}
.row{margin:10px 0}
label{display:block;margin-bottom:5px;font-weight:500}
.chk{display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-weight:500}
.chk input{margin-top:2px;accent-color:${ac.from};cursor:pointer}
.hint{color:${th.text};font-size:11.5px;margin-top:3px;margin-left:24px;line-height:1.5}
.hotkey-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin:6px 0}
.hotkey-row .lab{font-size:12px;color:${th.text};grid-column:1/-1;margin-bottom:-2px;font-weight:500}
.capture{padding:8px 12px;background:${th.bgHover};border:1px solid ${th.border};border-radius:6px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;cursor:pointer;color:${th.textActive};outline:none;min-height:34px;display:flex;align-items:center}
.capture.listening{border-color:${ac.from};background:${th.bgActive}}
button{background:linear-gradient(135deg,${ac.from},${ac.to});color:#fff;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12.5px;font-weight:500;font-family:inherit;transition:filter .15s ease,border-color .15s ease,color .15s ease}
button.secondary{background:${th.bgHover};color:${th.textActive};border:1px solid ${th.border}}
button.danger{background:transparent;color:${th.text};border:1px solid ${th.border};padding:5px 10px;font-size:11.5px}
button.danger:hover{color:#e05e3e;border-color:#e05e3e}
button:hover{filter:brightness(1.08)}
button:focus-visible,.capture:focus-visible{outline:2px solid ${ac.from};outline-offset:2px}
button:disabled{opacity:.5;cursor:not-allowed}
.tpl-add{display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:10px}
.tpl-add input,.tpl-add textarea{background:${th.bgHover};border:1px solid ${th.border};color:${th.textActive};border-radius:6px;padding:7px 10px;font-family:inherit;font-size:12.5px;outline:none;width:100%}
.tpl-add textarea{resize:vertical;min-height:44px;line-height:1.4;grid-column:1/-1}
.tpl-add input:focus,.tpl-add textarea:focus{border-color:${ac.from}}
.tpl-list{display:flex;flex-direction:column;gap:6px}
.tpl-empty{color:${th.text};font-size:11.5px;font-style:italic;padding:8px 0}
.tpl-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;background:${th.bgHover};border:1px solid ${th.border};border-radius:6px}
.tpl-info{flex:1;min-width:0}
.tpl-name{font-weight:600;font-size:12.5px;margin-bottom:1px}
.tpl-prefix{color:${th.text};font-size:11.5px;font-family:ui-monospace,Menlo,Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.actions{padding:12px 22px;border-top:1px solid ${th.border};display:flex;gap:8px;justify-content:flex-end}
.status{color:${th.text};font-size:11.5px;margin-top:5px;min-height:14px}
.snap-actions{margin-top:8px;margin-left:24px;display:flex;flex-direction:column;gap:6px}
.snap-cmd-label{color:${th.text};font-size:11.5px;margin-top:4px}
.snap-cmd-row{display:flex;gap:6px;align-items:center}
.snap-cmd-text{flex:1;background:${th.bgHover};border:1px solid ${th.border};border-radius:6px;padding:6px 9px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:${th.textActive};user-select:text;-webkit-user-select:text;overflow-x:auto;white-space:nowrap}
.snap-cmd-copy-btn{padding:6px 10px!important;font-size:11.5px}
.hint-block{margin-left:0;margin-top:6px}
.snap-status-pill{display:inline-flex;align-items:center;gap:6px;margin:6px 0 0 24px;padding:3px 10px;border-radius:999px;font-size:11.5px;border:1px solid ${th.border};background:${th.bgHover};color:${th.text}}
.snap-status-pill .dot{width:8px;height:8px;border-radius:50%;background:${th.text}}
.snap-status-pill[data-status="connected"]{background:rgba(46,160,67,.15);border-color:rgba(46,160,67,.4);color:#3aaf52}
.snap-status-pill[data-status="connected"] .dot{background:#3aaf52;box-shadow:0 0 0 0 rgba(58,175,82,.6);animation:dotpulse 2.4s infinite}
.snap-status-pill[data-status="disconnected"]{background:rgba(224,94,62,.15);border-color:rgba(224,94,62,.4);color:#e05e3e}
.snap-status-pill[data-status="disconnected"] .dot{background:#e05e3e}
@keyframes dotpulse{0%{box-shadow:0 0 0 0 rgba(58,175,82,.6)}70%{box-shadow:0 0 0 6px rgba(58,175,82,0)}100%{box-shadow:0 0 0 0 rgba(58,175,82,0)}}
${customTitlebarCSS()}
</style></head><body>
${customTitlebarHTML(t('Desktop for Claude - Einstellungen', 'Desktop for Claude - Settings', 'Desktop for Claude - Paramètres', 'Desktop for Claude - Impostazioni'))}
<div class="head">
  <h1>${i18n.title}</h1>
  <div class="sub">${i18n.subtitle}</div>
</div>

<div class="scroll">

  <div class="section">
    <h2>${i18n.secBackground}</h2>
    <div class="row">
      <label class="chk"><input type="checkbox" id="mc"><span>${i18n.minimizeLabel}</span></label>
      <div class="hint">${i18n.minimizeHint}</div>
    </div>
    <div class="row">
      <label class="chk"><input type="checkbox" id="as"><span>${i18n.autostartLabel}</span></label>
      <div class="hint">${i18n.autostartHint}</div>
    </div>
    <div class="row">
      <label class="chk"><input type="checkbox" id="bn"><span>${i18n.bgNotifLabel}</span></label>
      <div class="hint">${i18n.bgNotifHint}</div>
    </div>
    <div class="status" id="status-bg"></div>
  </div>

  <div class="section">
    <h2>${i18n.secMicrophone}</h2>
    <div class="row">
      <label class="chk"><input type="checkbox" id="mic"><span>${i18n.micLabel}</span></label>
      <div class="snap-status-pill" id="mic-snap-status" style="display:none" data-status="unknown">
        <span class="dot"></span><span class="text">${i18n.micSnapStatusUnknown}</span>
      </div>
      <div class="hint">${i18n.micHint}</div>
      <div class="hint" id="mic-snap-hint" style="display:none">${i18n.micSnapHint}</div>
      <div id="mic-snap-actions" class="snap-actions" style="display:none">
        <button class="secondary" id="mic-snap-open">${i18n.micSnapButton}</button>
        <div class="snap-cmd-label">${i18n.micSnapCmdLabel}</div>
        <div class="snap-cmd-row">
          <code class="snap-cmd-text" id="mic-snap-cmd">sudo snap connect claude-ai-desktop:audio-record</code>
          <button class="secondary snap-cmd-copy-btn" id="mic-snap-copy">${i18n.micSnapCmdCopy}</button>
        </div>
      </div>
    </div>
    <div class="row">
      <button class="secondary" id="mic-reset">${i18n.micResetLabel}</button>
      <div class="hint hint-block">${i18n.micResetHint}</div>
    </div>
    <div class="status" id="status-mic"></div>
  </div>

  <div class="section">
    <h2>${i18n.secHotkeys}</h2>
    ${isWayland ? `<div class="hint" style="margin-left:0;margin-bottom:10px">${nativeWayland ? i18n.waylandPortalHint : i18n.waylandHint}</div>` : ''}
    <div class="hotkey-row">
      <div class="lab">${i18n.hotkeyQp}</div>
      <div class="capture" data-key="qp" tabindex="0">${i18n.press}</div>
      <button class="danger" data-clear="qp">${i18n.clear}</button>
    </div>
    <div class="hotkey-row">
      <div class="lab">${i18n.hotkeyClip}</div>
      <div class="capture" data-key="clip" tabindex="0">${i18n.press}</div>
      <button class="danger" data-clear="clip">${i18n.clear}</button>
    </div>
    <div class="status" id="status-hk"></div>
  </div>

  <div class="section">
    <h2>${i18n.secTemplates}</h2>
    <div class="tpl-add">
      <input type="text" id="tpl-name" maxlength="40" placeholder="${i18n.tplName}">
      <button id="tpl-add">${i18n.tplAdd}</button>
      <textarea id="tpl-prefix" maxlength="2000" placeholder="${i18n.tplPrefix}"></textarea>
    </div>
    <div class="tpl-list" id="tpl-list"></div>
    <div class="status" id="status-tpl"></div>
  </div>

</div>

<div class="actions">
  <button id="close">${i18n.close}</button>
</div>

<script>
const I = ${safeJson(i18n)};
const api = window.settingsAPI;
const mc = document.getElementById('mc');
const as = document.getElementById('as');
const bn = document.getElementById('bn');
const mic = document.getElementById('mic');
const micReset = document.getElementById('mic-reset');
const micSnapHint = document.getElementById('mic-snap-hint');
const micSnapActions = document.getElementById('mic-snap-actions');
const micSnapStatusPill = document.getElementById('mic-snap-status');
const micSnapStatusText = micSnapStatusPill ? micSnapStatusPill.querySelector('.text') : null;
const micSnapOpen = document.getElementById('mic-snap-open');
const micSnapCopy = document.getElementById('mic-snap-copy');
let micSnapCopyTimer = null;
let micSnapPollHandle = null;
let isSnapInstall = false;
const closeBtn = document.getElementById('close');
const statusBg = document.getElementById('status-bg');
const statusHk = document.getElementById('status-hk');
const statusTpl = document.getElementById('status-tpl');
const statusMic = document.getElementById('status-mic');
let statusMicTimer = null;

const captures = { qp: null, clip: null };
const display = { qp: I.press, clip: I.press };
let listeningKey = null;

document.querySelectorAll('.capture').forEach(el => {
  const key = el.dataset.key;
  captures[key] = el;
  el.addEventListener('click', () => startListening(key));
  el.addEventListener('blur', () => { if (listeningKey === key) resetCapture(key); });
  el.addEventListener('keydown', (e) => onKeydown(e, key));
});
document.querySelectorAll('button[data-clear]').forEach(btn => {
  btn.addEventListener('click', () => clearHotkey(btn.dataset.clear));
});

function startListening(key) {
  if (listeningKey && listeningKey !== key) resetCapture(listeningKey);
  listeningKey = key;
  captures[key].classList.add('listening');
  captures[key].textContent = I.pressing;
  statusHk.textContent = '';
  captures[key].focus();
}

function resetCapture(key) {
  if (listeningKey === key) listeningKey = null;
  captures[key].classList.remove('listening');
  captures[key].textContent = display[key];
}

function onKeydown(e, key) {
  if (listeningKey !== key) return;
  e.preventDefault();
  const k = e.key;
  if (k === 'Escape') { resetCapture(key); return; }
  if (['Control','Shift','Alt','Meta','Dead','Unidentified'].includes(k)) return;
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (parts.length === 0) { statusHk.textContent = I.needMod; return; }
  let kk = k;
  if (kk === ' ') kk = 'Space';
  else if (kk.length === 1) kk = kk.toUpperCase();
  parts.push(kk);
  const accel = parts.join('+');
  applyHotkey(key, accel).then(res => {
    if (res === 'ok') statusHk.textContent = I.registered;
    else if (res === 'conflict') statusHk.textContent = key === 'qp' ? I.conflictClip : I.conflictQp;
    else if (res === 'failed-wayland') statusHk.textContent = I.failedWayland;
    else statusHk.textContent = I.failed;
    resetCapture(key);
  });
}

function applyHotkey(key, accel) {
  const fn = key === 'qp' ? api.setHotkey : key === 'clip' ? api.setClipboardHotkey : null;
  if (!fn) return Promise.resolve('failed');
  return fn(accel).then(res => {
    if (res === 'ok') display[key] = accel;
    return res;
  });
}

function clearHotkey(key) {
  applyHotkey(key, null).then(() => {
    display[key] = I.press;
    captures[key].textContent = I.press;
    statusHk.textContent = I.removed;
  });
}

mc.addEventListener('change', () => api.setMinimize(mc.checked));
as.addEventListener('change', async () => {
  const want = as.checked;
  as.disabled = true;
  try {
    const r = await api.setAutostart(want);
    if (r !== 'ok') { as.checked = !want; statusBg.textContent = I.autostartFailed; }
    else statusBg.textContent = '';
  } finally { as.disabled = false; }
});
bn.addEventListener('change', () => api.setBgNotifications(bn.checked));
mic.addEventListener('change', async () => {
  const want = mic.checked;
  if (!isSnapInstall) {
    api.setMicrophone(want);
    return;
  }
  // Snap: Plug-Status pruefen + ggf. Consent-Dialog
  mic.disabled = true;
  try {
    const res = await api.setMicrophoneWithConsent(want);
    mic.checked = !!res.applied;
    updateSnapStatus(res.status);
    if (want && !res.applied && res.status === 'disconnected') {
      statusMic.textContent = I.micToggleNeedsConsent;
      if (statusMicTimer) clearTimeout(statusMicTimer);
      statusMicTimer = setTimeout(() => { statusMic.textContent = ''; }, 4000);
    }
  } catch {
    mic.checked = !want;
  } finally {
    mic.disabled = false;
  }
});

function updateSnapStatus(status) {
  if (!micSnapStatusPill || !micSnapStatusText) return;
  micSnapStatusPill.dataset.status = status;
  if (status === 'connected') micSnapStatusText.textContent = I.micSnapStatusConnected;
  else if (status === 'disconnected') micSnapStatusText.textContent = I.micSnapStatusDisconnected;
  else micSnapStatusText.textContent = I.micSnapStatusUnknown;
}

async function refreshSnapStatus() {
  if (!isSnapInstall) return;
  try {
    const status = await api.getSnapMicStatus();
    updateSnapStatus(status);
  } catch {}
}
micReset.addEventListener('click', () => {
  api.resetMicrophoneConsent();
  mic.checked = false;
  statusMic.textContent = I.micResetDone;
  if (statusMicTimer) clearTimeout(statusMicTimer);
  statusMicTimer = setTimeout(() => { statusMic.textContent = ''; }, 2500);
});
micSnapOpen.addEventListener('click', () => api.openSnapPermissions());
micSnapCopy.addEventListener('click', () => {
  api.copySnapCmd();
  micSnapCopy.textContent = I.micSnapCmdCopied;
  if (micSnapCopyTimer) clearTimeout(micSnapCopyTimer);
  micSnapCopyTimer = setTimeout(() => { micSnapCopy.textContent = I.micSnapCmdCopy; }, 1800);
});

api.get().then(s => {
  mc.checked = !!s.minimizeOnClose;
  as.checked = !!s.autostart;
  bn.checked = !!s.bgNotifications;
  mic.checked = !!s.microphoneEnabled;
  isSnapInstall = !!s.isSnap;
  if (s.isSnap) {
    micSnapHint.style.display = '';
    micSnapActions.style.display = '';
    if (micSnapStatusPill) micSnapStatusPill.style.display = '';
    refreshSnapStatus();
    micSnapPollHandle = setInterval(refreshSnapStatus, 3000);
    window.addEventListener('beforeunload', () => {
      if (micSnapPollHandle) { clearInterval(micSnapPollHandle); micSnapPollHandle = null; }
    });
  }
  if (s.hotkey) { display.qp = s.hotkey; captures.qp.textContent = s.hotkey; }
  if (s.clipboardHotkey) { display.clip = s.clipboardHotkey; captures.clip.textContent = s.clipboardHotkey; }
  renderTemplates(s.templates || []);
});

const tplName = document.getElementById('tpl-name');
const tplPrefix = document.getElementById('tpl-prefix');
const tplAdd = document.getElementById('tpl-add');
const tplList = document.getElementById('tpl-list');

function renderTemplates(list) {
  tplList.innerHTML = '';
  if (!list.length) {
    const e = document.createElement('div');
    e.className = 'tpl-empty';
    e.textContent = I.tplEmpty;
    tplList.appendChild(e);
    return;
  }
  for (const t of list) {
    const item = document.createElement('div');
    item.className = 'tpl-item';
    const info = document.createElement('div'); info.className = 'tpl-info';
    const n = document.createElement('div'); n.className = 'tpl-name'; n.textContent = t.name;
    const p = document.createElement('div'); p.className = 'tpl-prefix'; p.textContent = t.prefix;
    info.appendChild(n); info.appendChild(p);
    const del = document.createElement('button'); del.className = 'danger'; del.textContent = I.tplDelete;
    del.addEventListener('click', () => api.deleteTemplate(t.id).then(res => renderTemplates(res.templates)));
    item.appendChild(info); item.appendChild(del);
    tplList.appendChild(item);
  }
}

tplAdd.addEventListener('click', () => {
  const name = tplName.value.trim();
  const prefix = tplPrefix.value;
  if (!name || !prefix.trim()) return;
  api.addTemplate({ name, prefix }).then(res => {
    if (res && Array.isArray(res.templates)) {
      tplName.value = '';
      tplPrefix.value = '';
      statusTpl.textContent = '';
      renderTemplates(res.templates);
    } else if (res && res.error === 'limit') statusTpl.textContent = I.tplLimit;
    else if (res && res.error === 'dup') statusTpl.textContent = I.tplDup;
  });
});

closeBtn.addEventListener('click', () => api.close());
const titlebarClose = document.getElementById('cd-titlebar-close');
if (titlebarClose) titlebarClose.addEventListener('click', () => api.close());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !listeningKey && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') api.close();
});
</script>
</body></html>`;
}

function getWhatsNewHTML(force = false) {
  const th = subTheme();
  const ac = accent();
  // Immer nur die Notes der aktuellen Version zeigen (alles seit dem letzten Release),
  // nie kumuliert ueber uebersprungene Versionen. force=true erzwingt versionsToShow=[version].
  const notes = getFilteredNotes(version, windowState.lastSeenVersion, { isSnap, force: true });
  const icons = {
    tray: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="3"/></svg>',
    // Aus dem App-Menue uebernommen (ICONS weiter unten), damit aeltere Release-Notes nicht
    // ohne Symbol dastehen: bug steckt in den Notes von 1.3.8 bis 1.4.15, info in 1.4.16,
    // cog in 1.4.6, plus in 1.4.3. Ein unbekannter Name liefert hier schlicht nichts.
    bug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>',
    cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    tabs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v5"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/></svg>',
    palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.1"/><circle cx="12" cy="8" r="1.1"/><circle cx="16" cy="10" r="1.1"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'
  };
  const i18n = {
    header: t('Neu in v' + version, 'New in v' + version, 'Nouveautés de la v' + version, 'Novità nella v' + version),
    sub: t('Ein kurzer \u00dcberblick \u00fcber die wichtigsten \u00c4nderungen', 'A quick look at the highlights', 'Un aperçu rapide des principales nouveautés', 'Una rapida panoramica sulle novità principali'),
    close: t('Los geht\u2019s', 'Let\u2019s go', 'C’est parti', 'Iniziamo'),
    openSettings: t('App-Einstellungen \u00f6ffnen', 'Open app settings', 'Ouvrir les paramètres de l’application', 'Apri le impostazioni dell’app')
  };
  // Optionales Bild pro Note: 'image' kann eine data:-URL oder ein Pfad relativ zum
  // App-Verzeichnis sein (z.B. 'whatsnew/1.4.8-feature.png'). Ohne Bild -> Icon.
  const slideMedia = (n) => {
    const fallback = `<div class="slide-ic">${icons[n.icon] || icons.check}</div>`;
    if (!n.image) return fallback;
    // image: String (ein Bild fuer alle Sprachen) ODER {de,en,fr,it}-Objekt (Bild pro
    // Sprache, analog zu title/text). Der Screenshot ist die einzige sprachabhaengige Stelle.
    let src = typeof n.image === 'string' ? n.image : localize(n.image);
    if (!src) return fallback;
    if (!src.startsWith('data:')) {
      // Das Fenster laeuft als data:-URL (opaque origin) und darf keine file://-Bilder laden,
      // darum das Asset zur Laufzeit lesen und als data-URL einbetten.
      try {
        const buf = fs.readFileSync(path.join(__dirname, n.image));
        const ext = path.extname(n.image).slice(1).toLowerCase();
        const mime = ext === 'svg' ? 'image/svg+xml' : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
        src = `data:${mime};base64,${buf.toString('base64')}`;
      } catch { return fallback; }
    }
    return `<img class="slide-img" src="${src}" alt="">`;
  };
  const slides = notes.map((n, i) => `
    <div class="slide${i === 0 ? ' active' : ''}${n.image ? ' has-img' : ''}" data-i="${i}">
      ${slideMedia(n)}
      <div class="slide-title">${localize(n.title)}</div>
      <div class="slide-text">${localize(n.text)}</div>
      ${n.action === 'support' ? `<button class="slide-btn" data-action="support"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${KOFI_PATH}"/></svg>${t('Auf Ko-fi unterstützen', 'Support on Ko-fi', 'Soutenir sur Ko-fi', 'Sostieni su Ko-fi')}</button>` : ''}
    </div>`).join('');
  const dots = notes.map((_, i) => `<span class="dot${i === 0 ? ' active' : ''}" data-i="${i}"></span>`).join('');
  const obNext = t('Weiter', 'Next', 'Suivant', 'Avanti');
  const obBack = t('Zurück', 'Back', 'Retour', 'Indietro');
  return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:${th.bg};color:${th.textActive};font-family:system-ui,-apple-system,sans-serif;font-size:14px;user-select:none}
body{display:flex;flex-direction:column;overflow:hidden}
${customTitlebarCSS()}
@keyframes wnGradShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.hero{position:relative;padding:30px 32px 28px;overflow:hidden;color:#fff;flex-shrink:0;
  background:linear-gradient(135deg,${ac.from},${ac.to},${ac.from},${ac.to});
  background-size:300% 300%;
  animation:wnGradShift 9s ease-in-out infinite}
.hero::before{content:'';position:absolute;right:-90px;top:-90px;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.10);pointer-events:none}
.hero::after{content:'';position:absolute;right:40px;bottom:-70px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.06);pointer-events:none}
.hero-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,.22);padding:5px 12px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:.5px;margin-bottom:14px;position:relative;z-index:1;backdrop-filter:blur(4px)}
.hero-pill::before{content:'';width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 8px rgba(255,255,255,.65)}
.hero-title{font-size:28px;font-weight:700;letter-spacing:-.6px;margin-bottom:6px;position:relative;z-index:1;line-height:1.1}
.hero-sub{font-size:13.5px;line-height:1.5;opacity:.92;position:relative;z-index:1;max-width:80%}
.body{flex:1;overflow-y:auto;padding:18px}
.trans-note{margin:0 0 14px;padding:10px 14px;border-radius:10px;font-size:11.5px;line-height:1.5;background:color-mix(in srgb,${ac.from} 10%,${th.bgHover});border:1px solid color-mix(in srgb,${ac.from} 30%,${th.border});color:${th.text}}
.body::-webkit-scrollbar{width:8px}
.body::-webkit-scrollbar-thumb{background:${th.border};border-radius:4px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tile{padding:18px 18px 16px;border-radius:14px;background:${th.bgHover};border:1px solid ${th.border};
  display:flex;flex-direction:column;gap:8px;transition:border-color .15s,transform .15s,background .15s}
.tile:hover{border-color:color-mix(in srgb,${ac.from} 50%,${th.border});background:${th.bgActive}}
.tile-ic{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,color-mix(in srgb,${ac.from} 18%,transparent),color-mix(in srgb,${ac.to} 14%,transparent));
  border:1px solid color-mix(in srgb,${ac.from} 35%,transparent);
  display:flex;align-items:center;justify-content:center;color:${ac.from};margin-bottom:2px}
.tile-ic svg{width:18px;height:18px}
.tile-title{font-weight:600;font-size:13.5px;color:${th.textActive};letter-spacing:-.1px;line-height:1.3}
.tile-text{color:${th.text};font-size:12px;line-height:1.55}
.tile-text code{display:inline-block;margin:2px 0;padding:2px 6px;background:${th.bgActive};border:1px solid ${th.border};border-radius:4px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:${th.textActive};user-select:text}
.slides{position:relative;flex:1;display:flex;align-items:center;justify-content:center;padding:8px 24px;overflow-y:auto}
.slides::-webkit-scrollbar{width:8px}
.slides::-webkit-scrollbar-thumb{background:${th.border};border-radius:4px}
.slide{display:none;flex-direction:column;align-items:center;text-align:center;max-width:460px}
.slide.active{display:flex}
.slide.active .slide-ic{animation:obPop .5s cubic-bezier(.34,1.56,.64,1) both}
.slide.active .slide-title{animation:obUp .42s ease .1s both}
.slide.active .slide-text{animation:obUp .42s ease .18s both}
@keyframes obPop{0%{opacity:0;transform:scale(.6) translateY(8px)}100%{opacity:1;transform:none}}
@keyframes obUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:none}}
.slide.has-img{max-width:500px}
.slide-img{width:100%;max-width:460px;max-height:250px;object-fit:cover;border-radius:14px;border:1px solid ${th.border};margin-bottom:20px;box-shadow:0 10px 28px rgba(0,0,0,.28)}
.slide.active .slide-img{animation:obImg .55s cubic-bezier(.22,1,.36,1) both}
@keyframes obImg{0%{opacity:0;transform:scale(.96) translateY(12px)}100%{opacity:1;transform:none}}
.slide-ic{width:66px;height:66px;border-radius:18px;background:linear-gradient(135deg,color-mix(in srgb,${ac.from} 20%,transparent),color-mix(in srgb,${ac.to} 15%,transparent));
  border:1px solid color-mix(in srgb,${ac.from} 38%,transparent);display:flex;align-items:center;justify-content:center;color:${ac.from};margin-bottom:20px}
.slide-ic svg{width:30px;height:30px}
.slide-title{font-weight:700;font-size:20px;letter-spacing:-.3px;color:${th.textActive};margin-bottom:12px;line-height:1.2}
.slide-text{color:${th.text};font-size:14px;line-height:1.65}
.slide-btn{margin-top:20px;display:inline-flex;align-items:center;gap:8px;font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer;
  border:none;border-radius:8px;padding:10px 22px;color:#fff;background:linear-gradient(135deg,${ac.from},${ac.to});box-shadow:0 4px 14px ${ac.from}33}
.slide-btn:hover{filter:brightness(1.08)}
.slide-btn:focus-visible{outline:2px solid ${ac.from};outline-offset:2px}
.slide.active .slide-btn{animation:obUp .42s ease .26s both}
/* Nur fuer den Hinweis-Slide zur offiziellen App. Kein anderer Slide nutzt diese Klassen. */
.wn-box{margin-top:10px;padding:10px 13px;border-radius:11px;text-align:left;font-size:12.5px;
  line-height:1.5;background:${th.bgHover};border:1px solid ${th.border}}
.wn-box b{color:${th.textActive};font-weight:600}
.wn-thanks{margin-top:13px;padding-top:11px;border-top:1px solid ${th.border};
  color:${th.textActive};font-size:13.5px;line-height:1.5}
.dots{display:flex;gap:7px;justify-content:center;padding:4px 0 2px;flex-shrink:0}
.dot{width:7px;height:7px;border-radius:50%;background:${th.border};cursor:pointer;transition:background .2s,width .2s,border-radius .2s}
.dot.active{background:${ac.from};width:20px;border-radius:4px}
.footer{padding:14px 24px 20px;display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid ${th.border};flex-shrink:0}
.footer button{font-family:inherit;cursor:pointer;border:none;border-radius:8px;font-size:12.5px;font-weight:600;transition:filter .15s,color .15s,background .15s}
.footer button.secondary{background:transparent;color:${th.text};padding:6px 0}
.footer button.secondary:hover{color:${th.textActive}}
.footer button.primary{background:linear-gradient(135deg,${ac.from},${ac.to});color:#fff;padding:11px 26px;box-shadow:0 4px 14px ${ac.from}33}
.footer button.primary:hover{filter:brightness(1.08)}
.footer button:focus-visible{outline:2px solid ${ac.from};outline-offset:2px}
</style></head><body>
${customTitlebarHTML(t('Was ist neu', 'What’s new', 'Nouveautés', 'Novità'))}
<div class="hero">
  <div class="hero-pill">v${version}</div>
  <div class="hero-title">${t('Was ist neu', 'What’s new', 'Nouveautés', 'Novità')}</div>
  <div class="hero-sub">${i18n.sub}</div>
</div>
<div class="body"><div class="slides">${slides}</div></div>
<div class="dots">${dots}</div>
<div class="footer">
  <button class="secondary" id="ob-back" style="visibility:hidden">${obBack}</button>
  <button class="primary" id="ob-next">${obNext}</button>
</div>
<script>
(function(){
  var idx=0, total=${notes.length};
  var slides=[].slice.call(document.querySelectorAll('.slide'));
  document.querySelectorAll('.slide-btn[data-action="support"]').forEach(function(b){b.addEventListener('click',function(){window.whatsNewAPI.openSupport();});});
  var dots=[].slice.call(document.querySelectorAll('.dot'));
  var back=document.getElementById('ob-back'), next=document.getElementById('ob-next');
  var nextLbl=${JSON.stringify(obNext)}, doneLbl=${JSON.stringify(i18n.close)};
  function show(i){
    idx=Math.max(0,Math.min(total-1,i));
    for(var j=0;j<slides.length;j++){slides[j].classList.toggle('active',j===idx);dots[j].classList.toggle('active',j===idx);}
    back.style.visibility=idx===0?'hidden':'visible';
    next.textContent=idx>=total-1?doneLbl:nextLbl;
  }
  back.addEventListener('click',function(){show(idx-1);});
  next.addEventListener('click',function(){ if(idx>=total-1){window.whatsNewAPI.close();} else {show(idx+1);} });
  for(var j=0;j<dots.length;j++){(function(k){dots[k].addEventListener('click',function(){show(k);});})(j);}
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'){show(idx+1);} else if(e.key==='ArrowLeft'){show(idx-1);}
    else if(e.key==='Escape'){window.whatsNewAPI.close();}
    else if(e.key==='Enter'){ if(idx>=total-1){window.whatsNewAPI.close();} else {show(idx+1);} }
  });
  var tc=document.getElementById('cd-titlebar-close'); if(tc){tc.addEventListener('click',function(){window.whatsNewAPI.close();});}
  if(total<=1){ next.textContent=doneLbl; }
  show(0);
})();
</script>
</body></html>`;
}

function openWhatsNewWindow(force = false) {
  if (whatsNewWindow && !whatsNewWindow.isDestroyed()) {
    whatsNewWindow.focus();
    return;
  }
  const size = fitToWorkArea(700, 720);
  const wnBase = {
    width: size.width, height: size.height,
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: false, resizable: false, minimizable: false, maximizable: false,
    title: t('Was ist neu', 'What\u2019s new', 'Nouveautés', 'Novità'),
    backgroundColor: subTheme().bg,
    icon: icon(),
    autoHideMenuBar: true,
    frame: false, roundedCorners: windowsRounded,
    webPreferences: {
      preload: path.join(__dirname, 'preload-whatsnew.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      spellcheck: false
    }
  };
  whatsNewWindow = new BrowserWindow({
    ...wnBase, ...centerOnMainWindow(size.width, size.height)
  });
  whatsNewWindow.setMenu(null);
  applyUiScale(whatsNewWindow, size.scale);
  whatsNewWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(getWhatsNewHTML(force)));
  whatsNewWindow.on('closed', () => { whatsNewWindow = null; });
}

// About / Info-Fenster

function getAboutHTML() {
  const th = subTheme();
  const ac = accent();
  const i18n = {
    tagline: t('Inoffizieller claude.ai-Wrapper für Linux', 'Unofficial claude.ai wrapper for Linux', 'Wrapper claude.ai non officiel pour Linux', 'Wrapper claude.ai non ufficiale per Linux'),
    secAbout: t('Über die App', 'About this app', 'À propos de l’application', 'Informazioni sull’app'),
    aboutText: t(
      'Eine inoffizielle Community-App, die claude.ai als native Desktop-Anwendung auf Linux bringt – mit Tabs, Tray, Quick-Prompt, Voice-Input und mehr. Open Source unter MIT-Lizenz.',
      'An unofficial community app that brings claude.ai to Linux as a native desktop application – with tabs, tray, quick-prompt, voice input and more. Open source under the MIT licence.',
      'Une application communautaire non officielle qui amène claude.ai sur Linux comme application de bureau native, avec onglets, zone de notification, Quick-Prompt, saisie vocale et plus encore. Open source sous licence MIT.',
      'Un\'app comunitaria non ufficiale che porta claude.ai su Linux come applicazione desktop nativa, con schede, area di notifica, Quick-Prompt, input vocale e altro ancora. Open source con licenza MIT.'
    ),
    secLinks: t('Links', 'Links', 'Liens', 'Link'),
    linkRepo: t('Quellcode & Issues auf GitHub', 'Source code & issues on GitHub', 'Code source et tickets sur GitHub', 'Codice sorgente e issue su GitHub'),
    linkKofi: t('Die App unterstützen (Ko-fi)', 'Support the app (Ko-fi)', 'Soutenir l’app (Ko-fi)', 'Sostieni l’app (Ko-fi)'),
    linkSupport: t('Anthropic-Support (offizielle Hilfe für claude.ai)', 'Anthropic Support (official help for claude.ai)', 'Support Anthropic (aide officielle pour claude.ai)', 'Supporto Anthropic (aiuto ufficiale per claude.ai)'),
    secLegal: t('Rechtliches', 'Legal', 'Mentions légales', 'Note legali'),
    legalText: t(
      'Diese App ist nicht mit Anthropic verbunden und wird nicht von Anthropic unterstützt. „Claude" und das Claude-Logo sind Markenzeichen von Anthropic PBC. Für Fragen zu Account, Login, Abo oder Bezahlung wende dich bitte direkt an den Anthropic-Support.',
      'This app is not affiliated with or endorsed by Anthropic. "Claude" and the Claude logo are trademarks of Anthropic PBC. For account, login, subscription or billing questions please contact Anthropic Support directly.',
      'Cette application n\'est ni affiliée à Anthropic ni approuvée par Anthropic. « Claude » et le logo Claude sont des marques d\'Anthropic PBC. Pour toute question concernant le compte, la connexion, l\'abonnement ou le paiement, contactez directement le support Anthropic.',
      'Questa applicazione non è affiliata ad Anthropic né approvata da Anthropic. "Claude" e il logo Claude sono marchi di Anthropic PBC. Per domande su account, accesso, abbonamento o pagamento, contatta direttamente il supporto Anthropic.'
    ),
    btnWhatsNew: t('Neuigkeiten anzeigen', 'Show What’s New', 'Afficher les nouveautés', 'Mostra le novità'),
    btnClose: t('Schließen', 'Close', 'Fermer', 'Chiudi')
  };
  return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:${th.bg};color:${th.textActive};font-family:system-ui,-apple-system,sans-serif;font-size:13.5px;user-select:none}
body{display:flex;flex-direction:column;overflow:hidden}
.hero{position:relative;padding:24px 28px 22px;background:linear-gradient(135deg,${ac.from},${ac.to});color:#fff;overflow:hidden;display:flex;align-items:center;gap:16px}
.hero::before{content:'';position:absolute;right:-70px;top:-70px;width:210px;height:210px;border-radius:50%;background:rgba(255,255,255,.12);pointer-events:none}
.hero::after{content:'';position:absolute;right:36px;bottom:-46px;width:126px;height:126px;border-radius:50%;background:rgba(255,255,255,.08);pointer-events:none}
.hero-logo{width:64px;height:64px;border-radius:15px;flex-shrink:0;position:relative;z-index:1;box-shadow:0 2px 12px rgba(0,0,0,.28);background:#0d0d0d;object-fit:contain}
.hero-text{position:relative;z-index:1;flex:1;min-width:0}
.hero-name{font-size:21px;font-weight:700;letter-spacing:-.2px;margin-bottom:2px}
.hero-version{font-size:12px;opacity:.85;font-family:ui-monospace,Menlo,Consolas,monospace;margin-bottom:6px}
.hero-tagline{font-size:13px;opacity:.92}
.body{flex:1;padding:18px 28px 12px;overflow-y:auto;display:flex;flex-direction:column;gap:16px}
.body::-webkit-scrollbar{width:8px}
.body::-webkit-scrollbar-thumb{background:${th.border};border-radius:4px}
h2{font-size:11px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:${th.text};margin-bottom:6px}
.about-text{font-size:13px;line-height:1.55;color:${th.textActive}}
.legal-text{font-size:12px;color:${th.text};line-height:1.5}
.link-list{display:flex;flex-direction:column;gap:6px}
.link-list a{display:flex;align-items:center;gap:10px;padding:9px 12px;background:${th.bgHover};border:1px solid ${th.border};border-radius:7px;color:${th.textActive};text-decoration:none;font-size:12.5px;cursor:pointer;transition:background .12s,border-color .12s}
.link-list a:hover{background:${th.bgActive};border-color:${ac.from}}
.link-list a:focus-visible{outline:2px solid ${ac.from};outline-offset:2px}
.link-list svg{width:15px;height:15px;flex-shrink:0;color:${ac.from}}
.footer{padding:14px 28px 18px;display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid ${th.border}}
button{background:linear-gradient(135deg,${ac.from},${ac.to});color:#fff;border:none;padding:9px 18px;border-radius:7px;cursor:pointer;font-size:12.5px;font-weight:600;font-family:inherit;transition:filter .15s ease}
button.secondary{background:${th.bgHover};color:${th.textActive};border:1px solid ${th.border}}
button:hover{filter:brightness(1.08)}
button:focus-visible{outline:2px solid ${ac.from};outline-offset:2px}
${customTitlebarCSS()}
</style></head><body>
${customTitlebarHTML(t('Über Desktop for Claude', 'About Desktop for Claude', 'À propos de Desktop for Claude', 'Informazioni su Desktop for Claude'))}
<div class="hero">
  <img class="hero-logo" src="${iconDataUrlForCurrentTheme()}" alt="Desktop for Claude"/>
  <div class="hero-text">
    <div class="hero-name">Desktop for Claude</div>
    <div class="hero-version">v${version}</div>
    <div class="hero-tagline">${i18n.tagline}</div>
  </div>
</div>
<div class="body">
  <div>
    <h2>${i18n.secAbout}</h2>
    <div class="about-text">${i18n.aboutText}</div>
  </div>
  <div>
    <h2>${i18n.secLinks}</h2>
    <div class="link-list">
      <a data-href="https://github.com/simonlinuxcraft/claude-ai-desktop-app">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
        <span>${i18n.linkRepo}</span>
      </a>
      <a data-href="${SUPPORT_URL}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        <span>${i18n.linkKofi}</span>
      </a>
      <a data-href="https://support.anthropic.com">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span>${i18n.linkSupport}</span>
      </a>
    </div>
  </div>
  <div>
    <h2>${i18n.secLegal}</h2>
    <div class="legal-text">${i18n.legalText}</div>
  </div>
</div>
<div class="footer">
  <button class="secondary" id="whatsnew-btn">${i18n.btnWhatsNew}</button>
  <button id="close">${i18n.btnClose}</button>
</div>
<script>
const api = window.aboutAPI;
document.getElementById('close').addEventListener('click', () => api.close());
document.getElementById('cd-titlebar-close')?.addEventListener('click', () => api.close());
document.getElementById('whatsnew-btn').addEventListener('click', () => api.openWhatsNew());
document.querySelectorAll('a[data-href]').forEach(a => {
  a.addEventListener('click', (e) => { e.preventDefault(); api.openExternal(a.dataset.href); });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });
</script>
</body></html>`;
}

function openAboutWindow() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus();
    return;
  }
  const size = fitToWorkArea(600, 620);
  const base = {
    width: size.width, height: size.height,
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: false, resizable: false, minimizable: false, maximizable: false,
    title: t('Über Desktop for Claude', 'About Desktop for Claude', 'À propos de Desktop for Claude', 'Informazioni su Desktop for Claude'),
    backgroundColor: subTheme().bg,
    icon: icon(),
    autoHideMenuBar: true,
    frame: false, roundedCorners: windowsRounded,
    webPreferences: {
      preload: path.join(__dirname, 'preload-about.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      spellcheck: false
    }
  };
  aboutWindow = new BrowserWindow({ ...base, ...centerOnMainWindow(size.width, size.height) });
  applyUiScale(aboutWindow, size.scale);
  aboutWindow.setMenu(null);
  aboutWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(getAboutHTML()));
  aboutWindow.on('closed', () => { aboutWindow = null; });
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  // Der Inhalt braucht gemessene 1007px. 960 laesst sichtbaren Rand und kuerzt das
  // Scrollen von ueber 500px auf wenige Dutzend.
  const swSize = fitToWorkArea(660, 740);
  const swBase = {
    width: swSize.width, height: swSize.height,
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: false, resizable: false, minimizable: false, maximizable: false,
    title: t('Desktop for Claude - Einstellungen', 'Desktop for Claude - Settings', 'Desktop for Claude - Paramètres', 'Desktop for Claude - Impostazioni'),
    backgroundColor: subTheme().bg,
    icon: icon(),
    autoHideMenuBar: true,
    frame: false, roundedCorners: windowsRounded,
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      spellcheck: false
    }
  };
  settingsWindow = new BrowserWindow({
    ...swBase, ...centerOnMainWindow(swSize.width, swSize.height)
  });
  settingsWindow.setMenu(null);
  applyUiScale(settingsWindow, swSize.scale);
  settingsWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(getSettingsHTML()));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

// Design-Fenster (Farbthema + Stil)

// Wie die Seite im jeweiligen Modus wirklich aussieht. Die Chrome-Farben kommen aus THEME,
// hier stehen nur die Flaechen der claude.ai-Seite, damit die Vorschau nicht nur die
// Fensterleiste zeigt. dark und light entsprechen claude.ais eigener Palette bzw. dem
// Invert-Ergebnis, oled und midnight unseren Overrides in theme-static.js.
const PREVIEW_SURFACE = {
  dark:     { page: '#262624', card: '#30302e' },
  light:    { page: '#faf9f7', card: '#ffffff' },
  oled:     { page: '#050306', card: '#120f12' },
  midnight: { page: '#070c18', card: '#0d1526' },
  matrix:   { page: '#040806', card: '#0b1610' }
};

function getDesignHTML() {
  const th = subTheme();
  const ac = accent();
  // Themes ohne eigenen Akzent zeigen in der Vorschau den Ton des gewaehlten Stils. NICHT
  // accent(): das liefert im Mitternachtsblau-Modus dessen Blau und faerbte alle vier Karten.
  const styleAccent = ACCENT[designStyle] || ACCENT.modern;
  const mode = currentThemeMode();
  const i18n = {
    title: t('App-Theme', 'App Theme', 'Thème de l’app', 'Tema dell’app'),
    subtitle: t('Farbthema, Stil, Zeichenregen und Tray-Symbol', 'Colour theme, style, character rain and tray icon', 'Thème, style, pluie de caractères et icône de notification', 'Tema, stile, pioggia di caratteri e icona di notifica'),
    secTheme: t('Farbthema', 'Colour theme', 'Thème de couleur', 'Tema colore'),
    secStyle: t('Stil', 'Style', 'Style', 'Stile'),
    styleNote: t(
      'Der Stil setzt die Akzentfarbe: Sende-Pfeil, Muster, Highlights und den Composer-Rand, den nur Classic weglässt. Jeder Stil lässt sich mit jedem Farbthema kombinieren.',
      'The style sets the accent colour: send arrow, pattern, highlights and the composer border, which only Classic leaves out. Every style combines with every colour theme.',
      'Le style définit la couleur d’accent : flèche d’envoi, motif, surbrillances et la bordure du composeur, que seul Classic omet. Chaque style se combine avec chaque thème.',
      'Lo stile imposta il colore d’accento: freccia di invio, motivo, evidenziazioni e il bordo del composer, che solo Classic omette. Ogni stile si combina con ogni tema.'
    ),
    secTray: t('Tray-Symbol', 'Tray icon', 'Icône de la zone de notification', 'Icona nell’area di notifica'),
    secCorners: t('Fensterecken (experimentell)', 'Window corners (experimental)', 'Coins des fenêtres (expérimental)', 'Angoli delle finestre (sperimentale)'),
    cornersNote: t('Wird beim nächsten Start der App übernommen.', 'Takes effect the next time the app starts.', 'Pris en compte au prochain démarrage de l’app.', 'Viene applicato al prossimo avvio dell’app.'),
    secRain: t('Zeichenregen / Matrix-Thema', 'Character rain / Matrix theme', 'Pluie de caractères / thème Matrix', 'Pioggia di caratteri / tema Matrix'),
    rainNote: t(
      'Gilt nur im Matrix-Thema. Der Regen springt zeilenweise statt zu gleiten, dadurch braucht er kaum Rechenleistung. Auf älteren Geräten kannst du ihn hier abschalten.',
      'Only applies to the Matrix theme. The rain steps line by line instead of gliding, so it needs very little processing power. On older machines you can turn it off here.',
      'Ne concerne que le thème Matrix. La pluie avance ligne par ligne au lieu de glisser, elle demande donc très peu de ressources. Sur une machine ancienne, désactivez-la ici.',
      'Vale solo per il tema Matrix. La pioggia avanza riga per riga invece di scorrere, quindi richiede pochissime risorse. Su macchine più vecchie puoi disattivarla qui.'
    ),
    close: t('Schließen', 'Close', 'Fermer', 'Chiudi')
  };
  const TRAY_LABELS = {
    color: {
      name: t('Farbig', 'Colour', 'Couleur', 'Colori'),
      hint: t('Das App-Logo mit Verlauf.', 'The app logo with its gradient.', 'Le logo de l’app avec son dégradé.', 'Il logo dell’app con la sfumatura.')
    },
    mono: {
      name: t('Monochrom', 'Monochrome', 'Monochrome', 'Monocromatico'),
      hint: t('Weiß wie die Systemsymbole.', 'White like the system icons.', 'Blanc comme les icônes système.', 'Bianco come le icone di sistema.')
    }
  };
  const THEME_LABELS = {
    dark: {
      name: t('Dunkel', 'Dark', 'Sombre', 'Scuro'),
      hint: t('claude.ais eigenes Dunkelgrau.', 'claude.ai’s own dark grey.', 'Le gris sombre d’origine de claude.ai.', 'Il grigio scuro originale di claude.ai.')
    },
    light: {
      name: t('Hell', 'White', 'Clair', 'Chiaro'),
      hint: t('Helle Oberfläche, warmes Papierweiß.', 'Light surface, warm paper white.', 'Surface claire, blanc papier chaud.', 'Superficie chiara, bianco carta caldo.')
    },
    oled: {
      name: 'OLED',
      hint: t('Tiefes Schwarz mit Sternenfeld, spart Strom auf OLED.', 'Deep black with a starfield, saves power on OLED.', 'Noir profond avec champ d’étoiles, économise la batterie sur OLED.', 'Nero profondo con campo di stelle, risparmia energia su OLED.')
    },
    midnight: {
      name: t('Mitternachtsblau', 'Midnight Blue', 'Bleu nuit', 'Blu notte'),
      hint: t('Tiefblau mit Neon-Akzent.', 'Deep blue with a neon accent.', 'Bleu profond avec accent néon.', 'Blu profondo con accento neon.')
    },
    matrix: {
      name: 'Matrix',
      hint: t('Zeichenregen auf fast Schwarz.', 'Character rain on near black.', 'Pluie de caractères sur noir profond.', 'Pioggia di caratteri su quasi nero.')
    }
  };
  const STYLE_LABELS = {
    modern: { name: 'Modern', hint: t('Warmes Orange.', 'Warm orange.', 'Orange chaud.', 'Arancione caldo.') },
    classic: { name: 'Classic', hint: t('Anthropics Original-Ton, eigenes Icon.', 'Anthropic’s original tone, its own icon.', 'Le ton d’origine d’Anthropic, icône propre.', 'Il tono originale di Anthropic, icona propria.') },
    neon: { name: 'Neon', hint: t('Blau, auch in den anderen Themes.', 'Blue, in the other themes too.', 'Bleu, aussi dans les autres thèmes.', 'Blu, anche negli altri temi.') },
    matrix: { name: 'Matrix', hint: t('Smaragdgrün, am stärksten auf OLED.', 'Emerald green, strongest on OLED.', 'Vert émeraude, plus intense en OLED.', 'Verde smeraldo, più intenso su OLED.') }
  };

  const card = (m) => {
    const p = THEME[m], s = PREVIEW_SURFACE[m], a = styleAccent;
    const vars = [
      `--p:${s.page}`, `--s:${s.card}`, `--bar:${p.bg}`, `--bara:${p.bgActive}`,
      `--l:${p.border}`, `--tt:${p.text}`, `--ta:${p.textActive}`,
      `--cf:${a.neonFrom || a.from}`, `--ct:${a.neonTo || a.to}`
    ].join(';');
    const chrome = JSON.stringify({ bg: p.bg, bgHover: p.bgHover, bgActive: p.bgActive, text: p.text, textActive: p.textActive, border: p.border, frameHi: p.frameHi, frameLo: p.frameLo, from: a.from, to: a.to });
    return `<button class="card" data-mode="${m}" data-chrome='${chrome}' aria-pressed="${m === mode}">
  <span class="prev" style="${vars}">
    <span class="prev-bar"><i class="tab"></i><i class="tab dim"></i></span>
    <span class="prev-body">
      <span class="prev-side"><i></i><i></i><i></i></span>
      <span class="prev-main"><i class="ln w1"></i><i class="ln w2"></i><i class="ln w3"></i><span class="prev-comp"></span></span>
    </span>
  </span>
  <span class="card-name">${THEME_LABELS[m].name}<svg class="tick" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
  <span class="card-hint">${THEME_LABELS[m].hint}</span>
</button>`;
  };

  const styleCard = (key) => {
    const a = ACCENT[key];
    return `<button class="style-card" data-design="${key}" data-from="${a.from}" data-to="${a.to}" data-cf="${a.neonFrom || a.from}" data-ct="${a.neonTo || a.to}" aria-pressed="${key === designStyle}">
  <span class="swatch" style="background:linear-gradient(135deg,${a.from},${a.to})"></span>
  <span class="style-text"><span class="card-name">${STYLE_LABELS[key].name}<svg class="tick" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
  <span class="card-hint">${STYLE_LABELS[key].hint}</span></span>
</button>`;
  };

  const CORNER_LABELS = {
    round:  { name: t('Abgerundet', 'Rounded', 'Arrondis', 'Arrotondati'), hint: t('Weiche Ecken am Fensterrand.', 'Soft corners on the window edge.', 'Coins doux au bord de la fenêtre.', 'Angoli morbidi sul bordo della finestra.') },
    square: { name: t('Eckig', 'Square', 'Droits', 'Squadrati'), hint: t('Der bisherige Look.', 'The previous look.', 'L’ancien style.', 'Lo stile precedente.') }
  };

  const cornerCard = (key) => {
    const rund = key === 'round';
    return `<button class="style-card" data-corners="${key}" aria-pressed="${rund === roundedCorners}">
  <span class="swatch" style="border:2px solid var(--ta);border-radius:${rund ? 7 : 1}px;opacity:.7"></span>
  <span class="style-text"><span class="card-name">${CORNER_LABELS[key].name}<svg class="tick" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
  <span class="card-hint">${CORNER_LABELS[key].hint}</span></span>
</button>`;
  };

  const RAIN_LABELS = {
    on:  { name: t('An', 'On', 'Activée', 'Attiva'), hint: t('Der Regen fällt Zeile für Zeile.', 'The rain falls line by line.', 'La pluie tombe ligne par ligne.', 'La pioggia cade riga per riga.') },
    off: { name: t('Aus', 'Off', 'Désactivée', 'Disattiva'), hint: t('Muster steht still.', 'Pattern stays still.', 'Le motif reste fixe.', 'Il motivo resta fermo.') }
  };

  const rainCard = (key) => {
    const an = key === 'on';
    return `<button class="style-card" data-rain="${key}" aria-pressed="${an === matrixRain}">
  <span class="swatch" style="background:linear-gradient(180deg,#247F3B,#185427)"></span>
  <span class="style-text"><span class="card-name">${RAIN_LABELS[key].name}<svg class="tick" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
  <span class="card-hint">${RAIN_LABELS[key].hint}</span></span>
</button>`;
  };

  const trayCard = (key) => {
    const mono = key === 'mono';
    let src = '';
    try { src = nativeImage.createFromPath(trayIcon(mono)).resize({ width: 32 }).toDataURL(); } catch {}
    return `<button class="style-card" data-tray="${key}" aria-pressed="${mono === trayMono}">
  <span class="swatch tray-prev"><img src="${src}" alt=""></span>
  <span class="style-text"><span class="card-name">${TRAY_LABELS[key].name}<svg class="tick" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
  <span class="card-hint">${TRAY_LABELS[key].hint}</span></span>
</button>`;
  };

  return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--ta);font-family:system-ui,-apple-system,sans-serif;font-size:13.5px;
  user-select:none;display:flex;flex-direction:column;
  transition:background-color .2s ease,color .2s ease}
:root{--bg:${th.bg};--bgh:${th.bgHover};--bga:${th.bgActive};--tt:${th.text};--ta:${th.textActive};
  --bd:${th.border};--fhi:${th.frameHi};--flo:${th.frameLo};--ac-from:${ac.from};--ac-to:${ac.to}}
.head{padding:18px 22px 12px;border-bottom:1px solid var(--bd)}
h1{font-size:16px;margin:0 0 2px;font-weight:600}
.sub{color:var(--tt);font-size:12px}
.scroll{flex:1;overflow-y:auto;padding:14px 22px 4px}
.scroll::-webkit-scrollbar{width:8px}
.scroll::-webkit-scrollbar-thumb{background:var(--bd);border-radius:4px}
.section{margin-bottom:18px}
.section h2{font-size:11px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:var(--tt);margin:0 0 10px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.grid-theme{grid-template-columns:1fr 1fr 1fr}
.card,.style-card{font-family:inherit;text-align:left;cursor:pointer;padding:8px;border-radius:10px;
  background:var(--bgh);border:1.5px solid var(--bd);color:var(--ta);
  transition:border-color .15s ease,background .15s ease}
.card{display:flex;flex-direction:column;gap:6px}
.card:hover,.style-card:hover{background:var(--bga)}
.card[aria-pressed="true"],.style-card[aria-pressed="true"]{border-color:var(--ac-from)}
.card:focus-visible,.style-card:focus-visible{outline:2px solid var(--ac-from);outline-offset:2px}
.card-name{display:flex;align-items:center;gap:5px;font-weight:600;font-size:12.5px}
.tick{width:13px;height:13px;flex:0 0 auto;color:var(--ac-from);opacity:0}
[aria-pressed="true"] .tick{opacity:1}
.card-hint{color:var(--tt);font-size:11px;line-height:1.4;display:block}
/* Vorschau: Fensterleiste, Seitenleiste, Textzeilen und Eingabefeld in den echten Farben */
.prev{display:block;border-radius:6px;overflow:hidden;border:1px solid var(--l);background:var(--p);height:86px}
.prev-bar{display:flex;gap:3px;align-items:center;height:15px;padding:0 4px;background:var(--bar);border-bottom:1px solid var(--l)}
.prev-bar .tab{width:26px;height:8px;border-radius:2px;background:var(--bara);display:block}
.prev-bar .tab.dim{background:var(--l)}
.prev-body{display:flex;height:calc(100% - 15px)}
.prev-side{width:26px;flex:0 0 26px;padding:5px 3px;background:var(--bar);border-right:1px solid var(--l);display:flex;flex-direction:column;gap:4px}
.prev-side i{height:4px;border-radius:2px;background:var(--tt);opacity:.45;display:block}
.prev-main{flex:1;padding:6px 6px 0;display:flex;flex-direction:column;gap:4px}
.prev-main .ln{height:4px;border-radius:2px;background:var(--ta);opacity:.55;display:block}
.prev-main .w1{width:70%}.prev-main .w2{width:88%}.prev-main .w3{width:52%}
.prev-comp{margin-top:auto;margin-bottom:6px;height:20px;border-radius:5px;background:var(--s);
  border:1.5px solid transparent;background-image:linear-gradient(var(--s),var(--s)),linear-gradient(135deg,var(--cf),var(--ct));
  background-origin:border-box;background-clip:padding-box,border-box;display:block}
[data-style="classic"] .prev-comp{background-image:none;border-color:var(--l)}
.style-card{display:flex;align-items:center;gap:8px;min-width:0}
.swatch{width:22px;height:22px;flex:0 0 22px;border-radius:6px;display:block}
/* Die GNOME-Leiste ist schwarz, darum zeigt die Vorschau beide Varianten auf Schwarz */
.tray-prev{background:#000;display:flex;align-items:center;justify-content:center}
.tray-prev img{width:16px;height:16px}
.style-text{min-width:0}
.note{color:var(--tt);font-size:11px;line-height:1.5;margin-top:8px}
.actions{padding:12px 22px;border-top:1px solid var(--bd);display:flex;justify-content:flex-end}
button.done{background:linear-gradient(135deg,var(--ac-from),var(--ac-to));color:#fff;border:none;
  padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12.5px;font-weight:500;font-family:inherit}
button.done:hover{filter:brightness(1.08)}
${customTitlebarCSS()}
/* customTitlebarCSS backt die Farben beim Oeffnen ein. Hier auf die Variablen umbiegen,
   sonst bleibt die Titelleiste beim Wechsel im alten Theme stehen. */
body{border:${WINDOW_BORDER}px solid var(--flo);border-image:linear-gradient(180deg,var(--fhi),var(--flo)) ${WINDOW_BORDER}}
${roundFrameCSS('var(--fhi)', 'var(--flo)')}
.cd-titlebar,.cd-titlebar-title,.cd-titlebar-btn{color:var(--ta)}
.cd-titlebar-btn:hover{background:var(--bgh)}
</style></head><body data-style="${designStyle}">
${customTitlebarHTML('Desktop for Claude - ' + t('App-Theme', 'App Theme', 'Thème de l’app', 'Tema dell’app'))}
<div class="head">
  <h1>${i18n.title}</h1>
  <div class="sub">${i18n.subtitle}</div>
</div>
<div class="scroll">
  <div class="section">
    <h2>${i18n.secTheme}</h2>
    <div class="grid grid-theme">${THEME_MODES.map(card).join('')}</div>
  </div>
  <div class="section">
    <h2>${i18n.secStyle}</h2>
    <div class="grid">${styleCard('modern')}${styleCard('classic')}${styleCard('neon')}${styleCard('matrix')}</div>
    <div class="note">${i18n.styleNote}</div>
  </div>
  <div class="section">
    <h2>${i18n.secRain}</h2>
    <div class="grid">${rainCard('on')}${rainCard('off')}</div>
    <div class="note">${i18n.rainNote}</div>
  </div>
  <div class="section">
    <h2>${i18n.secTray}</h2>
    <div class="grid">${trayCard('color')}${trayCard('mono')}</div>
  </div>
  <div class="section">
    <h2>${i18n.secCorners}</h2>
    <div class="grid">${cornerCard('round')}${cornerCard('square')}</div>
    <div class="note">${i18n.cornersNote}</div>
  </div>
</div>
<div class="actions"><button class="done" id="done">${i18n.close}</button></div>
<script>
const r=document.documentElement.style;
function pick(list,el){for(const b of list)b.setAttribute('aria-pressed',String(b===el));}
const cards=[...document.querySelectorAll('.card')];
const styles=[...document.querySelectorAll('[data-design]')];
const trays=[...document.querySelectorAll('[data-tray]')];
for(const b of trays)b.addEventListener('click',()=>{
  pick(trays,b);
  window.designAPI.setTrayMono(b.dataset.tray==='mono');
});
const corners=[...document.querySelectorAll('[data-corners]')];
for(const b of corners)b.addEventListener('click',()=>{
  pick(corners,b);
  window.designAPI.setRoundedCorners(b.dataset.corners==='round');
});
const rains=[...document.querySelectorAll('[data-rain]')];
for(const b of rains)b.addEventListener('click',()=>{
  pick(rains,b);
  window.designAPI.setMatrixRain(b.dataset.rain==='on');
});
// Das Fenster faerbt sich selbst sofort um, statt bis zum naechsten Oeffnen im alten
// Theme zu bleiben. Die Werte liegen schon in der Karte, es geht kein IPC-Roundtrip weg.
function applyChrome(c){
  r.setProperty('--bg',c.bg);r.setProperty('--bgh',c.bgHover);r.setProperty('--bga',c.bgActive);
  r.setProperty('--tt',c.text);r.setProperty('--ta',c.textActive);r.setProperty('--bd',c.border);
  r.setProperty('--fhi',c.frameHi);r.setProperty('--flo',c.frameLo);
  r.setProperty('--ac-from',c.from);r.setProperty('--ac-to',c.to);
}
for(const b of cards)b.addEventListener('click',()=>{
  pick(cards,b);
  applyChrome(JSON.parse(b.dataset.chrome));
  window.designAPI.setMode(b.dataset.mode);
});
for(const b of styles)b.addEventListener('click',()=>{
  if(b.getAttribute('aria-pressed')==='true')return;
  pick(styles,b);
  // Vorschau nachziehen: der Stil setzt den Akzent in jedem Farbthema.
  // --cf/--ct ist der Deko-Rand des Composers und nimmt das hellere Paar, --ac-*/chrome
  // liegt unter weissem Text und nimmt das kontrastfeste. Gleiche Trennung wie in card().
  const f=b.dataset.from,tc=b.dataset.to;
  for(const c of cards){
    const pv=c.querySelector('.prev');
    pv.style.setProperty('--cf',b.dataset.cf);pv.style.setProperty('--ct',b.dataset.ct);
    const ch=JSON.parse(c.dataset.chrome);ch.from=f;ch.to=tc;c.dataset.chrome=JSON.stringify(ch);
  }
  r.setProperty('--ac-from',f);r.setProperty('--ac-to',tc);
  document.body.dataset.style=b.dataset.design;
  window.designAPI.setDesign(b.dataset.design);
});
document.getElementById('done').addEventListener('click',()=>window.designAPI.close());
document.getElementById('cd-titlebar-close').addEventListener('click',()=>window.designAPI.close());
document.addEventListener('keydown',e=>{if(e.key==='Escape')window.designAPI.close();});
</script></body></html>`;
}

function openDesignWindow() {
  if (designWindow && !designWindow.isDestroyed()) {
    designWindow.focus();
    return;
  }
  const size = fitToWorkArea(720, 900);
  designWindow = new BrowserWindow({
    width: size.width, height: size.height,
    ...centerOnMainWindow(size.width, size.height),
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: false, resizable: false, minimizable: false, maximizable: false,
    title: 'Desktop for Claude - ' + t('App-Theme', 'App Theme', 'Thème de l’app', 'Tema dell’app'),
    backgroundColor: subTheme().bg,
    icon: icon(),
    autoHideMenuBar: true,
    frame: false, roundedCorners: windowsRounded,
    webPreferences: {
      preload: path.join(__dirname, 'preload-design.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      spellcheck: false
    }
  });
  designWindow.setMenu(null);
  applyUiScale(designWindow, size.scale);
  designWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(getDesignHTML()));
  designWindow.on('closed', () => { designWindow = null; });
}

// Fester Hinweis auf Anthropics eigene Linux-App. Absichtlich nur der Link und keine
// apt-Befehle: Repo-Pfad, Key-Fingerprint und Distro-Liste stehen in ihrer Doku und
// koennen sich aendern, hardkodierte Befehle wuerden veralten und Support kosten.
const OFFICIAL_APP_DOCS = 'https://code.claude.com/docs/en/desktop-linux';

async function showOfficialAppInfo() {
  const res = await showCustomMessageBox({
    type: 'info',
    title: t('Offizielle Claude-App', 'Official Claude app', 'Application Claude officielle', 'App Claude ufficiale'),
    message: t(
      'Anthropic bietet seit dem 30. Juni 2026 eine eigene Claude-App für Linux an.',
      'Anthropic has shipped its own Claude app for Linux since 30 June 2026.',
      'Anthropic propose sa propre application Claude pour Linux depuis le 30 juin 2026.',
      'Dal 30 giugno 2026 Anthropic distribuisce una propria app Claude per Linux.'
    ),
    detail: t(
      'Sie läuft auf Ubuntu 22.04 und neuer sowie Debian 12 und neuer (amd64/arm64) und wird über Anthropics apt-Quelle installiert. Enthalten sind Chat, Cowork und Claude Code mit Terminal und Editor. Auf Ubuntu 20.04 läuft sie nicht, und ein offizielles Snap gibt es nicht.\n\nDiese App hier ist nicht von Anthropic und wird nicht eingestellt. Updates und Fehlerbehebungen kommen weiter, neue Funktionen seltener als bisher.',
      'It runs on Ubuntu 22.04 and newer and Debian 12 and newer (amd64/arm64), installed through Anthropic’s apt repository. It includes Chat, Cowork and Claude Code with a terminal and editor. It does not run on Ubuntu 20.04, and there is no official snap.\n\nThis app is not from Anthropic and is not being discontinued. Updates and fixes keep coming, new features less often than before.',
      'Elle fonctionne sur Ubuntu 22.04 et plus récent ainsi que Debian 12 et plus récent (amd64/arm64), via le dépôt apt d’Anthropic. Elle inclut Chat, Cowork et Claude Code avec terminal et éditeur. Elle ne fonctionne pas sous Ubuntu 20.04 et il n’existe pas de snap officiel.\n\nCette application n’est pas d’Anthropic et n’est pas abandonnée. Les mises à jour et correctifs continuent, les nouvelles fonctions plus rarement qu’avant.',
      'Funziona su Ubuntu 22.04 e successivi e Debian 12 e successivi (amd64/arm64), tramite il repository apt di Anthropic. Include Chat, Cowork e Claude Code con terminale ed editor. Su Ubuntu 20.04 non funziona e non esiste uno snap ufficiale.\n\nQuesta app non è di Anthropic e non viene abbandonata. Aggiornamenti e correzioni continuano, nuove funzioni più raramente di prima.'
    ),
    buttons: [
      t('Anleitung öffnen', 'Open install guide', 'Ouvrir le guide', 'Apri la guida'),
      t('Schließen', 'Close', 'Fermer', 'Chiudi')
    ],
    defaultId: 0,
    cancelId: 1
  });
  if (res.response === 0) openExternalSafe(OFFICIAL_APP_DOCS);
}

// Ko-fi statt PayPal-Knopf: _donations ist in Deutschland gemeinnuetzigen Organisationen vorbehalten,
// _xclick sieht aus wie ein Shop. Die Widget-Adresse zeigt nur das Bezahlfeld, ohne Profil und Feed.
const SUPPORT_URL = 'https://ko-fi.com/simonlinuxcraft/?hidefeed=true&widget=true&embed=true';
const KOFI_PATH = 'M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298';

async function showSupportInfo() {
  const res = await showCustomMessageBox({
    title: t('App unterstützen', 'Support the app', 'Soutenir l’app', 'Sostieni l’app'),
    width: 420,
    height: 430,
    cancelId: 1,
    html: getSupportHTML
  });
  if (res.response === 0) openExternalSafe(SUPPORT_URL);
}

function getSupportHTML(channel) {
  const th = subTheme();
  const ac = accent();
  const check = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const pills = [
    t('Kostenlos', 'Free', 'Gratuit', 'Gratuita'),
    t('Ohne Werbung', 'No ads', 'Sans publicité', 'Senza pubblicità'),
    t('Alle Funktionen', 'Every feature', 'Toutes les fonctions', 'Tutte le funzioni')
  ].map(p => `<span class="pill">${check}${escapeHtml(p)}</span>`).join('');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(t('App unterstützen', 'Support the app', 'Soutenir l’app', 'Sostieni l’app'))}</title>
<style>
  ${sharedDialogCSS()}
  body { overflow: hidden; }
  .wrap { height: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 30px 32px 24px; }
  .heart { width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, ${ac.from}, ${ac.to}); color: #fff; box-shadow: 0 6px 20px ${ac.from}55; margin-bottom: 18px; }
  h1 { font-size: 19px; font-weight: 600; margin: 0 0 10px; letter-spacing: -.2px; }
  .lead { color: ${th.text}; font-size: 13.5px; line-height: 1.55; margin: 0 0 18px; }
  .pills { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-bottom: 22px; }
  .pill { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 999px; font-size: 12px;
    background: ${th.bgHover}; border: 1px solid ${th.border}; color: ${th.textActive}; }
  .pill svg { color: ${ac.from}; }
  .actions { margin-top: auto; width: 100%; display: flex; flex-direction: column; gap: 8px; }
  .btn { width: 100%; padding: 10px 16px; font-size: 13.5px; border-radius: 8px; }
  .btn.primary { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .btn.ghost { background: transparent; border-color: transparent; color: ${th.text}; }
  .btn.ghost:hover { background: ${th.bgHover}; color: ${th.textActive}; }
  .note { color: ${th.text}; font-size: 11.5px; opacity: .8; margin-top: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="heart"><svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></div>
  <h1>${escapeHtml(t('Desktop for Claude bleibt kostenlos', 'Desktop for Claude stays free', 'Desktop for Claude reste gratuit', 'Desktop for Claude resta gratuito'))}</h1>
  <p class="lead">${escapeHtml(t(
    'Die App entsteht in meiner Freizeit. Wenn sie dir hilft, kannst du die Entwicklungskosten mit einer freiwilligen Zahlung über Ko-fi unterstützen.',
    'I build this app in my spare time. If it helps you, you can support the development costs with a voluntary payment on Ko-fi.',
    'Je développe cette application sur mon temps libre. Si elle vous est utile, vous pouvez soutenir les frais de développement par un paiement volontaire sur Ko-fi.',
    'Sviluppo questa app nel tempo libero. Se ti è utile, puoi sostenere i costi di sviluppo con un pagamento volontario su Ko-fi.'
  ))}</p>
  <div class="pills">${pills}</div>
  <div class="actions">
    <button class="btn primary" data-idx="0"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${KOFI_PATH}"/></svg>${escapeHtml(t('Auf Ko-fi unterstützen', 'Support on Ko-fi', 'Soutenir sur Ko-fi', 'Sostieni su Ko-fi'))}</button>
    <button class="btn ghost" data-idx="1">${escapeHtml(t('Vielleicht später', 'Maybe later', 'Plus tard', 'Forse più tardi'))}</button>
  </div>
  <div class="note">${escapeHtml(t('Freiwillig. An der App ändert sich dadurch nichts.', 'Entirely optional. Nothing about the app changes.', 'Entièrement facultatif. Rien ne change dans l’application.', 'Del tutto facoltativo. Nell’app non cambia nulla.'))}</div>
</div>
<script>
(function(){
  const channel = ${JSON.stringify(channel)};
  const respond = (i) => { try { window.msgboxAPI.respond(channel, i); } catch (e) {} };
  document.querySelectorAll('.btn').forEach(b => b.addEventListener('click', () => respond(parseInt(b.dataset.idx, 10))));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); respond(1); } });
  setTimeout(() => document.querySelector('.btn.primary').focus(), 50);
})();
</script>
</body>
</html>`;
}

// Custom App-Menü (HTML-Popup statt OS-nativ)

function getAppMenuItems() {
  return [
    { type: 'item', action: 'new-tab', label: t('Neuer Tab', 'New Tab', 'Nouvel onglet', 'Nuova scheda'), accel: 'Ctrl+T', icon: 'plus' },
    { type: 'item', action: 'close-tab', label: t('Tab schließen', 'Close Tab', 'Fermer l’onglet', 'Chiudi scheda'), accel: 'Ctrl+W', icon: 'x' },
    { type: 'sep' },
    { type: 'item', action: 'export', label: t('Konversation exportieren', 'Export conversation', 'Exporter la conversation', 'Esporta la conversazione'), accel: 'Ctrl+Shift+E', icon: 'download' },
    { type: 'item', action: 'reload', label: t('Neu laden', 'Reload', 'Recharger', 'Ricarica'), accel: 'Ctrl+R', icon: 'refresh' },
    { type: 'sep' },
    { type: 'item', action: 'design-open', label: t('App-Theme', 'App Theme', 'Thème de l’app', 'Tema dell’app'), icon: 'palette' },
    { type: 'item', action: 'settings', label: t('App-Einstellungen', 'App Settings', 'Paramètres de l\'application', 'Impostazioni dell\'app'), accel: 'Ctrl+,', icon: 'cog' },
    { type: 'sep' },
    { type: 'item', action: 'check-updates', label: t('Nach Updates suchen', 'Check for Updates', 'Rechercher des mises à jour', 'Controlla aggiornamenti'), icon: 'refresh' },
    { type: 'item', action: 'bug-report', label: (bugReportStrings[sysLang] || bugReportStrings.en).title, icon: 'bug' },
    { type: 'item', action: 'copy-diagnostics', label: t('Diagnose-Info kopieren', 'Copy diagnostics info', 'Copier les infos de diagnostic', 'Copia informazioni di diagnostica'), icon: 'info' },
    { type: 'item', action: 'reset-verification', label: t('claude.ai-Verifizierung zurücksetzen', 'Reset claude.ai verification', 'Réinitialiser la vérification claude.ai', 'Reimposta la verifica claude.ai'), icon: 'shield' },
    { type: 'sep' },
    { type: 'item', action: 'official-app', label: t('Offizielle Claude-App', 'Official Claude app', 'Application Claude officielle', 'App Claude ufficiale'), icon: 'download' },
    { type: 'item', action: 'support', label: t('App unterstützen', 'Support the app', 'Soutenir l’app', 'Sostieni l’app'), icon: 'heart' },
    { type: 'item', action: 'whats-new', label: t('Was ist neu?', 'What’s New', 'Nouveautés', 'Novità'), icon: 'bolt' },
    { type: 'item', action: 'about', label: t('Über Desktop for Claude', 'About Desktop for Claude', 'À propos de Desktop for Claude', 'Informazioni su Desktop for Claude'), icon: 'info' },
    { type: 'sep' },
    { type: 'item', action: 'quit', label: t('Beenden', 'Quit', 'Quitter', 'Esci'), accel: 'Ctrl+Q', icon: 'power' }
  ];
}

function getAppMenuHTML(left, top) {
  const th = subTheme();
  const ac = accent();
  const dark = currentThemeMode() !== 'light';
  const items = getAppMenuItems();
  const ICONS = {
    plus:    '<path d="M12 5v14M5 12h14"/>',
    x:       '<path d="M18 6L6 18M6 6l12 12"/>',
    download:'<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    refresh: '<path d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/><circle cx="14.5" cy="15.5" r="1"/>',
    cog:     '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3h0a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8v0a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/>',
    bug:     '<path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>',
    info:    '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
    bolt:    '<polyline points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"/>',
    shield:  '<path d="M12 2L4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z"/><path d="M9 12l2 2 4-4"/>',
    power:   '<path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"/>',
    heart:   '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>'
  };

  const renderItem = (it, idx) => {
    if (it.type === 'sep') return '<div class="sep"></div>';
    const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[it.icon] || ''}</svg>`;
    const accel = it.accel ? `<span class="accel">${it.accel}</span>` : '';
    return `<button class="item" data-action="${it.action}" data-idx="${idx}"><span class="icon">${icon}</span><span class="label">${it.label}</span>${accel}</button>`;
  };

  return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:transparent;color:${th.textActive};
  font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',system-ui,sans-serif;font-size:13px;
  overflow:hidden;user-select:none}
.card{position:absolute;left:min(${left}px,100vw - 340px);top:${top}px;width:324px;margin:8px;
  max-height:calc(100vh - ${top}px - 16px);overflow-y:auto;scrollbar-width:thin;
  scrollbar-color:${th.border} transparent;
  background:${th.bg};border:1px solid ${th.border};border-radius:10px;
  box-shadow:0 6px 24px ${dark ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.18)'},
    0 1px 3px ${dark ? 'rgba(0,0,0,.4)' : 'rgba(0,0,0,.08)'};
  padding:5px}
.head{display:flex;align-items:center;gap:11px;padding:8px 11px 9px;margin:-1px -1px 4px;
  border-bottom:1px solid ${th.border}}
.head .meta{display:flex;flex-direction:column;line-height:1.2;flex:1;min-width:0}
.head .name{font-weight:700;font-size:14px;color:${th.textActive};letter-spacing:.2px}
.head .ver{font-size:11px;color:${th.text};font-family:ui-monospace,Menlo,Consolas,monospace}
.item{display:flex;align-items:center;gap:11px;width:100%;height:30px;padding:0 9px;
  border:none;background:transparent;color:${th.textActive};
  border-radius:6px;cursor:pointer;font:inherit;font-size:13px;
  transition:background .08s ease,color .08s ease}
.item:hover,.item.focused{background:${th.bgHover}}
.item.focused{outline:none}
.item:active{background:${th.bgActive}}
.icon{display:flex;align-items:center;justify-content:center;width:16px;height:16px;color:${th.text};flex-shrink:0}
.icon svg{width:16px;height:16px}
.item:hover .icon,.item.focused .icon{color:${ac.from}}
.label{flex:1;text-align:left;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.accel{color:${th.text};font-size:11.5px;font-weight:500;letter-spacing:.2px;flex-shrink:0;
  font-family:ui-monospace,Menlo,Consolas,monospace}
.item:hover .accel,.item.focused .accel{color:${th.textActive}}
.sep{height:1px;background:${th.border};margin:5px 4px}
</style></head><body>
<div class="card" id="card">
  <div class="head">
    <div class="meta">
      <div class="name">Claude</div>
      <div class="ver">v${version}</div>
    </div>
  </div>
  ${items.map(renderItem).join('')}
</div>
<script>
const api = window.appMenuAPI;
const card = document.getElementById('card');
// Alles ausserhalb der Karte ist Hintergrund: Druck darauf schliesst, wie bei nativen Menues.
document.addEventListener('mousedown', (e) => { if (!card.contains(e.target)) api.close(); });
const buttons = Array.from(card.querySelectorAll('.item'));
let focusIdx = -1;

function focusItem(i) {
  buttons.forEach(b => b.classList.remove('focused'));
  if (i >= 0 && i < buttons.length) {
    buttons[i].classList.add('focused');
    focusIdx = i;
  }
}

card.addEventListener('click', (e) => {
  const btn = e.target.closest('.item');
  if (!btn) return;
  api.action(btn.dataset.action);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); api.close(); return; }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusItem((focusIdx + 1) % buttons.length);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusItem((focusIdx - 1 + buttons.length) % buttons.length);
  } else if (e.key === 'Enter' && focusIdx >= 0) {
    e.preventDefault();
    api.action(buttons[focusIdx].dataset.action);
  }
});

</script>
</body></html>`;
}

// Das App-Menue ist eine transparente View ueber dem ganzen Hauptfenster, kein eigenes
// Fenster. Unter Wayland ignoriert der Compositor die x/y eines Toplevel-Fensters, das
// Menue landete dort irgendwo. Die View deckt auch die Tab-Leiste ab: ein Klick daneben
// trifft die View und schliesst, statt per blur-Timer zu raten.
function closeAppMenu() {
  const view = appMenuView;
  if (!view) return;
  appMenuView = null;
  try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(view); } catch {}
  // Kommt meist aus einem IPC-Handler dieser View, deshalb erst danach schliessen.
  setImmediate(() => { try { view.webContents.close(); } catch {} });
  focusActiveView();
}

function openAppMenu(rendererX, rendererY) {
  if (appMenuView) { closeAppMenu(); return; }
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return;

  const items = getAppMenuItems();
  // Höhe: Header ~52px + Items 30px + Separators 11px + 18px card-padding/border + 16px Abstand
  const itemH = 30, sepH = 11, headerH = 52;
  let designHeight = 18 + 16 + headerH;
  for (const it of items) designHeight += (it.type === 'sep' ? sepH : itemH);
  const cb = mainWindow.getContentBounds();
  const x = Number.isFinite(rendererX) ? Math.round(rendererX) : 0;
  const y = Number.isFinite(rendererY) ? Math.round(rendererY) : TAB_BAR_HEIGHT;
  // Wie die Dialoge mit dem Bildschirm skalieren, aber unter dem Knopf ins Fenster passen.
  // Unter dem Lesbarkeits-Boden scrollt die Karte.
  const { scale } = fitToWorkArea(340, designHeight);
  const s = Math.max(UI_SCALE_FLOOR, Math.min(scale, (cb.height - y) / designHeight));

  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload-appmenu.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      spellcheck: false
    }
  });
  appMenuView = view;
  view.setBackgroundColor('#00000000');
  view.setBounds({ x: 0, y: 0, width: cb.width, height: cb.height });
  // Haengt die Seite, laege eine unsichtbare View ueber dem Fenster und schluckte jeden Klick.
  view.webContents.once('did-fail-load', () => { if (appMenuView === view) closeAppMenu(); });
  view.webContents.once('render-process-gone', () => { if (appMenuView === view) closeAppMenu(); });
  // Zoom erst nach dem Laden setzen (siehe applyUiScale), dann einhaengen: so erscheint
  // das Menue gleich in seiner Groesse.
  view.webContents.once('did-finish-load', () => {
    if (appMenuView !== view || !mainWindow || mainWindow.isDestroyed()) return;
    try { view.webContents.setZoomFactor(s); } catch {}
    mainWindow.contentView.addChildView(view);
    view.webContents.focus();
  });
  view.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(getAppMenuHTML(x / s, y / s)));
}

// Custom MessageBox – zentriert über der App statt GTK-nativ

let _msgboxCounter = 0;

function showCustomMessageBox(opts) {
  const id = ++_msgboxCounter;
  const channel = `msgbox-respond-${id}`;
  const type = opts.type || 'info';
  const title = opts.title || 'Claude';
  const message = opts.message || '';
  const detail = opts.detail || '';
  const buttons = (Array.isArray(opts.buttons) && opts.buttons.length) ? opts.buttons : ['OK'];
  const defaultId = typeof opts.defaultId === 'number' ? opts.defaultId : 0;
  const cancelId = typeof opts.cancelId === 'number' ? opts.cancelId : (buttons.length - 1);

  return new Promise((resolve) => {
    let settled = false;
    let ipcHandler;
    const finish = (index) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener(channel, ipcHandler);
      resolve({ response: typeof index === 'number' ? index : cancelId });
    };

    const win = createDialogWindow({
      width: opts.width || 480,
      height: opts.height || (detail ? 260 : 200),
      title
    });

    ipcHandler = (_, index) => {
      finish(index);
      if (!win.isDestroyed()) win.close();
    };
    ipcMain.once(channel, ipcHandler);

    win.on('closed', () => finish(cancelId));

    const html = opts.html ? opts.html(channel) : getMessageBoxHTML({ type, title, message, detail, buttons, defaultId, cancelId, channel });
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  });
}

function getMessageBoxHTML({ type, title, message, detail, buttons, defaultId, cancelId, channel }) {
  const th = subTheme();
  const ac = accent();
  const iconColor = type === 'error' ? '#e05e3e' : (type === 'warning' ? warnColor().fg : ac.from);
  const iconSvg = {
    info:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    error:   '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
  }[type] || '';
  const buttonsHtml = buttons.map((label, i) => {
    const primary = i === defaultId;
    return `<button class="btn${primary ? ' primary' : ''}" data-idx="${i}">${escapeHtml(label)}</button>`;
  }).join('');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  ${sharedDialogCSS()}
  .container { display: flex; flex-direction: column; height: 100%; padding: 22px; }
  .top { display: flex; gap: 16px; flex: 1; align-items: flex-start; min-height: 0; }
  .icon { color: ${iconColor}; flex: 0 0 auto; line-height: 0; }
  .content { flex: 1; min-width: 0; }
  .msg { font-weight: 500; margin: 0 0 8px; line-height: 1.4; word-wrap: break-word; }
  .detail { color: ${th.text}; font-size: 13px; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word; max-height: 120px; overflow-y: auto; }
  .buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; flex: 0 0 auto; }
</style>
</head>
<body>
<div class="container">
  <div class="top">
    <div class="icon">${iconSvg}</div>
    <div class="content">
      <div class="msg">${escapeHtml(message)}</div>
      ${detail ? `<div class="detail">${escapeHtml(detail)}</div>` : ''}
    </div>
  </div>
  <div class="buttons">${buttonsHtml}</div>
</div>
<script>
(function(){
  const channel = ${JSON.stringify(channel)};
  const defaultIdx = ${defaultId};
  const cancelIdx = ${cancelId};
  const respond = (i) => { try { window.msgboxAPI.respond(channel, i); } catch (e) {} };
  document.querySelectorAll('.btn').forEach(b => {
    b.addEventListener('click', () => respond(parseInt(b.dataset.idx, 10)));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); respond(cancelIdx); }
    else if (e.key === 'Enter') { e.preventDefault(); respond(defaultIdx); }
  });
  setTimeout(() => {
    const primary = document.querySelector('.btn.primary') || document.querySelector('.btn');
    if (primary) primary.focus();
  }, 50);
})();
</script>
</body>
</html>`;
}

// Menü

let lastMenuHash = '';
let menuPending = false;

function updateMenu(force = false) {
  const hash = `${tabs.length}:${activeTabIndex}`;
  if (!force && hash === lastMenuHash) return;
  lastMenuHash = hash;
  if (menuPending) return;
  menuPending = true;

  setImmediate(() => {
    menuPending = false;

    const tabItems = tabs.map((_, i) => ({
      label: `Tab ${i + 1}${i === activeTabIndex ? ' \u25cf' : ''}`,
      accelerator: i < 9 ? `CmdOrCtrl+${i + 1}` : undefined,
      click: () => switchToTab(i)
    }));

    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Claude', submenu: [
        { label: t('Neuer Tab', 'New Tab', 'Nouvel onglet', 'Nuova scheda'), accelerator: 'CmdOrCtrl+T', click: () => createTab() },
        { label: t('Tab schlie\u00dfen', 'Close Tab', 'Fermer l’onglet', 'Chiudi scheda'), accelerator: 'CmdOrCtrl+W', click: () => closeTab(activeTabIndex) },
        { type: 'separator' }, ...tabItems, { type: 'separator' },
        { label: t('Konversation als Markdown exportieren\u2026', 'Export conversation as Markdown\u2026', 'Exporter la conversation en Markdown…', 'Esporta la conversazione in Markdown…'), accelerator: 'CmdOrCtrl+Shift+E', click: () => exportActiveConversation() },
        { type: 'separator' },
        { label: t('Einstellungen', 'Settings', 'Paramètres', 'Impostazioni'), accelerator: 'CmdOrCtrl+,', click: () => {
          if (tabs[activeTabIndex] && alive(tabs[activeTabIndex].view))
            tabs[activeTabIndex].view.webContents.loadURL('https://claude.ai/settings');
        }},
        { label: t('App-Einstellungen\u2026', 'App Settings\u2026', 'Paramètres de l’application…', 'Impostazioni dell’app…'), click: () => openSettingsWindow() },
        { type: 'separator' },
        { label: t('App-Theme', 'App Theme', 'Thème de l’app', 'Tema dell’app') + '\u2026', click: () => openDesignWindow() },
        { label: t('Nach Updates suchen\u2026', 'Check for Updates\u2026', 'Rechercher des mises à jour…', 'Controlla aggiornamenti…'), click: () => triggerManualUpdateCheck() },
        { label: (bugReportStrings[sysLang] || bugReportStrings.en).title, click: showBugReportDialog },
        { type: 'separator' },
        { role: 'quit', label: t('Beenden', 'Quit', 'Quitter', 'Esci') }
      ]},
      { label: t('Bearbeiten', 'Edit', 'Édition', 'Modifica'), submenu: [
        { role: 'undo', label: t('R\u00fcckg\u00e4ngig', 'Undo', 'Annuler', 'Annulla') },
        { role: 'redo', label: t('Wiederholen', 'Redo', 'Rétablir', 'Ripeti') },
        { type: 'separator' },
        { role: 'cut', label: t('Ausschneiden', 'Cut', 'Couper', 'Taglia') },
        { role: 'copy', label: t('Kopieren', 'Copy', 'Copier', 'Copia') },
        { role: 'paste', label: t('Einf\u00fcgen', 'Paste', 'Coller', 'Incolla') },
        { role: 'selectAll', label: t('Alles ausw\u00e4hlen', 'Select All', 'Tout sélectionner', 'Seleziona tutto') }
      ]},
      { label: t('Ansicht', 'View', 'Affichage', 'Visualizza'), submenu: [
        { label: t('Neu laden', 'Reload', 'Recharger', 'Ricarica'), accelerator: 'CmdOrCtrl+R', click: () => { if (tabs[activeTabIndex] && alive(tabs[activeTabIndex].view)) tabs[activeTabIndex].view.webContents.reload(); } },
        { label: t('Erzwungen neu laden', 'Force Reload', 'Recharger de force', 'Ricarica forzata'), accelerator: 'CmdOrCtrl+Shift+R', click: () => { if (tabs[activeTabIndex] && alive(tabs[activeTabIndex].view)) tabs[activeTabIndex].view.webContents.reloadIgnoringCache(); } },
        { label: t('Neu zeichnen', 'Redraw', 'Redessiner', 'Ridisegna'), accelerator: 'CmdOrCtrl+Alt+R', click: () => repaintActiveView() },
        { type: 'separator' },
        { role: 'resetZoom', label: t('Zoom zur\u00fccksetzen', 'Reset Zoom', 'Réinitialiser le zoom', 'Reimposta zoom') },
        { role: 'zoomIn', label: t('Vergr\u00f6\u00dfern', 'Zoom In', 'Zoom avant', 'Aumenta zoom') },
        { role: 'zoomOut', label: t('Verkleinern', 'Zoom Out', 'Zoom arrière', 'Riduci zoom') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('Vollbild', 'Fullscreen', 'Plein écran', 'Schermo intero') },
        ...(isDev ? [{ type: 'separator' }, { label: 'DevTools', accelerator: 'F12', click: () => { if (tabs[activeTabIndex] && alive(tabs[activeTabIndex].view)) tabs[activeTabIndex].view.webContents.toggleDevTools(); } }] : [])
      ]},
      { label: 'Tabs', submenu: [
        { label: t('Neuer Tab', 'New Tab', 'Nouvel onglet', 'Nuova scheda'), accelerator: 'CmdOrCtrl+T', click: () => createTab() },
        { label: t('Tab schlie\u00dfen', 'Close Tab', 'Fermer l’onglet', 'Chiudi scheda'), accelerator: 'CmdOrCtrl+W', click: () => closeTab(activeTabIndex) },
        { type: 'separator' },
        { label: t('N\u00e4chster Tab', 'Next Tab', 'Onglet suivant', 'Scheda successiva'), accelerator: 'CmdOrCtrl+Tab', click: () => switchToTab((activeTabIndex + 1) % tabs.length) },
        { label: t('Vorheriger Tab', 'Previous Tab', 'Onglet précédent', 'Scheda precedente'), accelerator: 'CmdOrCtrl+Shift+Tab', click: () => switchToTab((activeTabIndex - 1 + tabs.length) % tabs.length) },
        { type: 'separator' }, ...tabItems
      ]},
      { label: t('Fenster', 'Window', 'Fenêtre', 'Finestra'), submenu: [
        { role: 'minimize', label: t('Minimieren', 'Minimize', 'Réduire', 'Riduci a icona') },
        { role: 'close', label: t('Schlie\u00dfen', 'Close', 'Fermer', 'Chiudi') }
      ]}
    ]));
  });
}

// Offline-Handling

function handleOnlineChange(online) {
  if (online === isOnline) return;
  isOnline = online;
  updateTitle();
  if (!online) {
    showOfflinePage();
    notify({ title: 'Desktop for Claude', body: t('Keine Internetverbindung.', 'No internet connection.', 'Pas de connexion Internet.', 'Nessuna connessione a Internet.') });
  } else {
    // Jeder Tab, der auf der Offline-Seite haengt, muss per loadURL zurueck auf seinen
    // echten Chat. reload() wuerde nur die data:-Seite neu laden. Inaktive Tabs bleiben
    // sonst dauerhaft dort haengen, weil showOfflinePage nur den aktiven Tab trifft.
    const active = tabs[activeTabIndex];
    for (const tab of tabs) {
      if (!alive(tab.view)) continue;
      if (tab.view.webContents.getURL().startsWith('data:'))
        tab.view.webContents.loadURL(tab.url || 'https://claude.ai');
      else if (tab === active) tab.view.webContents.reload();
    }
    notify({ title: 'Desktop for Claude', body: t('Verbindung wiederhergestellt!', 'Connection restored!', 'Connexion rétablie !', 'Connessione ripristinata!') });
  }
}

function showOfflinePage() {
  const tab = tabs[activeTabIndex];
  if (!tab || !alive(tab.view)) return;
  const th = theme();
  tab.view.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
    `<!DOCTYPE html><html><head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <style>
    body{background:${th.bg};color:${th.textActive};font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0}
    h1{font-size:22px;font-weight:600;margin-bottom:8px}
    p{color:${th.text};font-size:14px;max-width:360px;text-align:center;line-height:1.6}
    button{margin-top:20px;background:#E8524F;color:#fff;border:none;padding:10px 28px;border-radius:10px;font-size:14px;cursor:pointer;font-weight:500}
    button:hover{background:#F0635C}
    .pulse{animation:p 2s ease-in-out infinite}@keyframes p{0%,100%{opacity:.3}50%{opacity:1}}
    </style></head><body>
    <h1>${t('Keine Verbindung', 'No Connection', 'Pas de connexion', 'Nessuna connessione')}</h1>
    <p>${t('Prüfe deine Netzwerkverbindung.', 'Check your network connection.', 'Vérifiez votre connexion réseau.', 'Controlla la connessione di rete.')}</p>
    <p class="pulse" style="font-size:12px">${t('Automatische Wiederverbindung\u2026', 'Reconnecting automatically\u2026', 'Reconnexion automatique…', 'Riconnessione automatica…')}</p>
    <button onclick="if(window.claudeDesktop&amp;&amp;claudeDesktop.offlineRetry)claudeDesktop.offlineRetry();else location.href='https://claude.ai'">${t('Erneut versuchen', 'Try Again', 'Réessayer', 'Riprova')}</button>
    </body></html>`
  ));
}

// Download-Manager

function setupDownloadManager() {
  // Echo-Schutz: claude.ai feuert manche Download-Links 2x. event.preventDefault()
  // im will-download-Handler stoppt das Duplikat sauber, OHNE dass Chromiums
  // Auto-Save-Dialog erscheint (item.cancel() würde den trotzdem öffnen).
  const activeKeys = new Set();
  const cooldownUntil = new Map();
  const COOLDOWN_MS = 3000;

  function dropKey(key) {
    activeKeys.delete(key);
    cooldownUntil.set(key, Date.now() + COOLDOWN_MS);
    setTimeout(() => {
      const u = cooldownUntil.get(key);
      if (u && Date.now() >= u) cooldownUntil.delete(key);
    }, COOLDOWN_MS + 500);
  }

  session.fromPartition('persist:claude').on('will-download', (event, item) => {
    const fileName = item.getFilename();
    const url = item.getURL();
    const keys = [url, fileName].filter(Boolean);
    const now = Date.now();

    // Echo-Filter: Duplikat → Temp-Pfad + cancel (Auto-Dialog wird unterdrückt)
    for (const k of keys) {
      const u = cooldownUntil.get(k);
      if (u && now < u) {
        try { item.setSavePath(path.join(app.getPath('temp'), '.cd-discard-' + now)); } catch {}
        try { item.cancel(); } catch {}
        return;
      }
      if (activeKeys.has(k)) {
        try { item.setSavePath(path.join(app.getPath('temp'), '.cd-discard-' + now)); } catch {}
        try { item.cancel(); } catch {}
        return;
      }
    }

    keys.forEach(k => activeKeys.add(k));

    // SYNCHRON: Temp-Pfad setzen — sonst öffnet Chromium parallel seinen eigenen Save-Dialog!
    const safeName = fileName.replace(/[^\w.-]+/g, '_');
    const tmpPath = path.join(app.getPath('temp'), '.cd-pending-' + now + '-' + safeName);
    try { item.setSavePath(tmpPath); } catch {}

    let chosenPath = null;
    let dialogDone = false;
    let downloadDone = false;
    let downloadState = '';
    let cancelledByDialog = false;
    let released = false;

    const finalize = () => {
      if (!dialogDone || !downloadDone) return;
      if (released) return;
      released = true;
      if (downloadState === 'completed' && chosenPath) {
        let ok = false;
        try { fs.renameSync(tmpPath, chosenPath); ok = true; }
        catch (_) {
          try { fs.copyFileSync(tmpPath, chosenPath); fs.unlinkSync(tmpPath); ok = true; }
          catch (e2) { console.error(`[DL] move failed: ${e2.message}`); try { fs.unlinkSync(tmpPath); } catch {} }
        }
        notify({
          title: ok ? t('Download fertig', 'Download complete', 'Téléchargement terminé', 'Download completato') : t('Download fehlgeschlagen', 'Download failed', 'Échec du téléchargement', 'Download non riuscito'),
          body: fileName
        });
      } else {
        try { fs.unlinkSync(tmpPath); } catch {}
        if (!cancelledByDialog && downloadState !== 'cancelled' && downloadState !== '') {
          notify({ title: t('Download fehlgeschlagen', 'Download failed', 'Échec du téléchargement', 'Download non riuscito'), body: fileName });
        }
      }
      keys.forEach(dropKey);
    };

    dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(app.getPath('downloads'), fileName),
      filters: [{ name: t('Alle Dateien', 'All Files', 'Tous les fichiers', 'Tutti i file'), extensions: ['*'] }]
    }).then(result => {
      dialogDone = true;
      if (result.canceled || !result.filePath) {
        cancelledByDialog = true;
        try { item.cancel(); } catch {}
      } else {
        chosenPath = result.filePath;
      }
      finalize();
    }).catch(() => {
      dialogDone = true;
      cancelledByDialog = true;
      try { item.cancel(); } catch {}
      finalize();
    });

    item.on('updated', (_, state) => {
      if (state === 'progressing' && !item.isPaused() && mainWindow && !mainWindow.isDestroyed()) {
        const total = item.getTotalBytes();
        if (total > 0) {
          const pct = Math.round((item.getReceivedBytes() / total) * 100);
          mainWindow.setTitle(`Desktop for Claude - Download ${pct}%`);
          mainWindow.setProgressBar(pct / 100);
        }
      }
    });

    item.once('done', (_, state) => {
      if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.setProgressBar(-1); updateTitle(); }
      downloadDone = true;
      downloadState = state;
      finalize();
    });
  });
}

// Auto-Updater

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
let manualUpdateCheck = false;

// Manuelle "Nach Updates suchen"-Aktion. Im Snap laeuft der electron-updater nicht
// (setupAutoUpdater bricht ab, kein Handler registriert), darum hier eigene Rueckmeldung
// statt eines stummen checkForUpdates() ohne sichtbares Ergebnis.
function triggerManualUpdateCheck() {
  if (isDev) {
    showCustomMessageBox({ type: 'info', title: 'Desktop for Claude', message: t('Updates sind im Entwicklungsmodus deaktiviert.', 'Updates are disabled in development mode.', 'Les mises à jour sont désactivées en mode développement.', 'Gli aggiornamenti sono disattivati in modalità sviluppo.') });
    return;
  }
  if (isSnap) {
    showCustomMessageBox({ type: 'info', title: 'Desktop for Claude', message: t('Updates werden über den Snap Store verwaltet und automatisch installiert.', 'Updates are managed by the Snap Store and installed automatically.', 'Les mises à jour sont gérées par le Snap Store et installées automatiquement.', 'Gli aggiornamenti sono gestiti dallo Snap Store e installati automaticamente.') });
    return;
  }
  manualUpdateCheck = true;
  autoUpdater.checkForUpdates().catch(() => {});
}

function setupAutoUpdater() {
  if (isDev) return;
  if (isSnap) return; // Snap aktualisiert sich ueber den Store; der AppImage-Updater laeuft hier ins Leere
  let failures = 0;

  const dialogParent = () => (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : null;

  autoUpdater.on('update-available', (info) => {
    failures = 0;
    if (isQuitting) return;
    if (manualUpdateCheck) {
      manualUpdateCheck = false;
      showCustomMessageBox({ type: 'info', title: t('Update verf\u00fcgbar', 'Update available', 'Mise à jour disponible', 'Aggiornamento disponibile'), message: `v${info.version} ${t('wird heruntergeladen\u2026', 'is downloading\u2026', 'en cours de téléchargement…', 'in download…')}` });
    } else {
      new Notification({ title: t('Update verf\u00fcgbar', 'Update available', 'Mise à jour disponible', 'Aggiornamento disponibile'), body: `v${info.version} ${t('wird geladen\u2026', 'downloading\u2026', 'téléchargement…', 'download…')}` }).show();
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    failures = 0;
    if (isQuitting) return;
    if (manualUpdateCheck) {
      manualUpdateCheck = false;
      showCustomMessageBox({ type: 'info', title: t('Kein Update', 'No Update', 'Aucune mise à jour', 'Nessun aggiornamento'), message: t('Du verwendest bereits die neueste Version.', 'You are already on the latest version.', 'Vous utilisez déjà la dernière version.', 'Stai già usando l’ultima versione.'), detail: `v${app.getVersion()}` });
    }
  });

  autoUpdater.on('download-progress', (p) => {
    if (isQuitting) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(`Desktop for Claude - Update ${Math.round(p.percent)}%`);
      mainWindow.setProgressBar(p.percent / 100);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (isQuitting) return;
    if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.setTitle(`Desktop for Claude v${version}`); mainWindow.setProgressBar(-1); }
    showCustomMessageBox({
      type: 'info', title: t('Update bereit', 'Update ready', 'Mise à jour prête', 'Aggiornamento pronto'),
      message: `v${info.version} ${t('heruntergeladen. Jetzt neu starten?', 'downloaded. Restart now?', 'téléchargée. Redémarrer maintenant ?', 'scaricato. Riavviare ora?')}`,
      buttons: [t('Neu starten', 'Restart', 'Redémarrer', 'Riavvia'), t('Sp\u00e4ter', 'Later', 'Plus tard', 'Più tardi')], defaultId: 0, cancelId: 1
    }).then(r => { if (!isQuitting && r.response === 0) autoUpdater.quitAndInstall(); });
  });

  autoUpdater.on('error', (err) => {
    failures++;
    if (isDev) console.error(`Update-Fehler (${failures}x):`, err.message);
    if (isQuitting) return;
    if (manualUpdateCheck) {
      manualUpdateCheck = false;
      const short = (err.message || '').split('\n')[0].slice(0, 200);
      showCustomMessageBox({ type: 'error', title: t('Update-Fehler', 'Update Error', 'Erreur de mise à jour', 'Errore di aggiornamento'), message: t('Update-Pr\u00fcfung fehlgeschlagen.', 'Update check failed.', 'Échec de la vérification des mises à jour.', 'Controllo aggiornamenti non riuscito.'), detail: short });
    }
  });

  autoUpdater.checkForUpdates().catch(() => {});
  updateCheckInterval = setInterval(() => {
    if (failures > 0) {
      const skip = (1 << Math.min(failures, 5)) - 1;
      if (Math.random() < skip / (skip + 1)) return;
    }
    autoUpdater.checkForUpdates().catch(() => {});
  }, UPDATE_CHECK_MS);
}

// Session Security

// Snap-Befehl, den der User im Terminal ausführen kann, falls keine GUI greift.
const SNAP_CONNECT_CMD = 'sudo snap connect claude-ai-desktop:audio-record';

// Versucht in Reihenfolge: snap-store → gnome-software → plasma-discover → xdg-open.
// Umgeht den xdg-open-Chooser-Dialog auf Systemen mit mehreren snap://-Handlern.
function openSnapStorePage() {
  if (!isSnap) {
    openExternalSafe('snap://claude-ai-desktop');
    return;
  }
  const candidates = [
    { bin: 'snap-store',      args: ['snap://claude-ai-desktop'] },
    { bin: 'gnome-software',  args: ['--details=claude-ai-desktop'] },
    { bin: 'plasma-discover', args: ['snap://claude-ai-desktop'] }
  ];
  const tryNext = (i) => {
    if (i >= candidates.length) {
      openExternalSafe('snap://claude-ai-desktop');
      return;
    }
    const c = candidates[i];
    execFile('which', [c.bin], { timeout: 1500 }, (err) => {
      if (err) return tryNext(i + 1);
      try {
        const child = spawn(c.bin, c.args, { detached: true, stdio: 'ignore' });
        child.on('error', () => tryNext(i + 1));
        child.unref();
      } catch { tryNext(i + 1); }
    });
  };
  tryNext(0);
}

// Liefert 'connected' | 'disconnected' | 'unknown' asynchron via callback.
// snapctl liegt fix unter /usr/bin/snapctl im Snap-Confinement; Exit-Code 0 = connected.
// Asynchron damit das 1.5s-Polling den Main-Thread nicht blockiert.
function checkSnapAudioRecordStatus(cb) {
  if (!isSnap) return cb('connected');
  execFile('snapctl', ['is-connected', 'audio-record'], { timeout: 1500 }, (err) => {
    if (!err) return cb('connected');
    if (err && typeof err.code === 'number') return cb('disconnected');
    cb('unknown');
  });
}

// Defensives JSON-Embedding für Inline-<script>-Blöcke: </script>-Sequenzen
// in JSON-Strings escapen, damit der HTML-Parser sie nicht als Tag-Ende erkennt.
// Gemeinsames CSS für Dialog-Fenster (showCustomMessageBox + requestMicrophoneConsent).
function sharedDialogCSS() {
  const th = subTheme();
  const ac = accent();
  return `
    *{box-sizing:border-box}
    html,body{height:100%;margin:0;padding:0}
    body{background:${th.bg};color:${th.textActive};font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:14px;user-select:none;-webkit-user-select:none}
    .btn{background:${th.bgHover};color:${th.textActive};border:1px solid ${th.border};border-radius:6px;padding:7px 16px;font-size:13px;cursor:pointer;font-family:inherit;min-width:80px}
    .btn:hover:not(:disabled){background:${th.bgActive}}
    .btn.primary{background:linear-gradient(135deg,${ac.from},${ac.to});color:#fff;border-color:transparent;font-weight:500}
    .btn.primary:hover:not(:disabled){filter:brightness(1.08)}
    .btn:focus{outline:2px solid ${ac.from};outline-offset:2px}
    .btn:disabled{opacity:.5;cursor:not-allowed}
  `;
}

// Hol-oder-starte den Consent-Dialog. Mehrere parallele Aufrufer (Settings-Toggle
// + claude.ai-Mic-Click) bekommen denselben Promise; nur EIN Modal-Fenster oeffnet sich.
function getOrStartMicConsent() {
  if (consentInflight) return consentInflight;
  consentInflight = requestMicrophoneConsent()
    .finally(() => { consentInflight = null; });
  return consentInflight;
}

// Liefert 'granted' | 'denied' | 'dismissed'.
// 'dismissed' = User schloss Fenster ohne Klick → consentAsked NICHT setzen
// (d.h. nächste Mikrofon-Anfrage zeigt den Dialog wieder).
async function requestMicrophoneConsent() {
  const id = ++_msgboxCounter;
  const respondChannel = `msgbox-respond-${id}`;
  const snapOpenChannel = `mic-consent-open-snap-${id}`;
  const statusChannel = `mic-consent-status-${id}`;
  const snapNeeded = isSnap;
  const showSnapPanel = snapNeeded;
  const initialStatus = snapNeeded ? 'unknown' : 'connected';

  const copyCmdChannel = `mic-consent-copy-cmd-${id}`;

  return new Promise((resolve) => {
    let settled = false;
    let pollHandle = null;
    let respondHandler, snapOpenHandler, copyCmdHandler;

    const finish = (reason) => {
      if (settled) return;
      settled = true;
      if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
      ipcMain.removeListener(respondChannel, respondHandler);
      ipcMain.removeListener(snapOpenChannel, snapOpenHandler);
      ipcMain.removeListener(copyCmdChannel, copyCmdHandler);
      resolve(reason);
    };

    const win = createDialogWindow({
      width: 520,
      height: showSnapPanel ? 480 : 240,
      title: t('Mikrofon-Zugriff', 'Microphone access', 'Accès au microphone', 'Accesso al microfono')
    });

    respondHandler = (_, idx) => {
      finish(idx === 0 ? 'granted' : 'denied');
      if (!win.isDestroyed()) win.close();
    };
    snapOpenHandler = () => openSnapStorePage();
    copyCmdHandler = () => { clipboard.writeText(SNAP_CONNECT_CMD).catch(() => {}); };
    ipcMain.once(respondChannel, respondHandler);
    ipcMain.on(snapOpenChannel, snapOpenHandler);
    ipcMain.on(copyCmdChannel, copyCmdHandler);

    win.on('closed', () => finish('dismissed'));

    const sendStatus = (s) => {
      if (win.isDestroyed()) return;
      try { win.webContents.send(statusChannel, s); } catch {}
    };

    if (showSnapPanel) {
      // Sofort einmal asynchron prüfen, dann alle 1.5s pollen.
      checkSnapAudioRecordStatus(sendStatus);
      pollHandle = setInterval(() => {
        if (win.isDestroyed()) return;
        checkSnapAudioRecordStatus(sendStatus);
      }, 1500);
    }

    const html = getMicConsentHTML({
      respondChannel, snapOpenChannel, statusChannel, copyCmdChannel,
      showSnapPanel, initialStatus
    });
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  });
}

function getMicConsentHTML({ respondChannel, snapOpenChannel, statusChannel, copyCmdChannel, showSnapPanel, initialStatus }) {
  const th = subTheme();
  const ac = accent();
  const i18n = {
    title: t('Mikrofon-Zugriff', 'Microphone access', 'Accès au microphone', 'Accesso al microfono'),
    message: t(
      'Desktop for Claude möchte auf dein Mikrofon zugreifen, um Spracheingaben zu ermöglichen.',
      'Desktop for Claude wants to access your microphone to enable voice input.',
      'Desktop for Claude souhaite accéder à votre microphone pour permettre la saisie vocale.',
      'Desktop for Claude vuole accedere al microfono per consentire l\'input vocale.'
    ),
    hint: t(
      'Du kannst diese Erlaubnis jederzeit in den App-Einstellungen unter „Mikrofon" widerrufen.',
      'You can revoke this permission anytime in the app settings under “Microphone”.',
      'Vous pouvez révoquer cette autorisation à tout moment dans les paramètres de l\'application, sous « Microphone ».',
      'È possibile revocare questa autorizzazione in qualsiasi momento nelle impostazioni dell\'app, alla voce "Microfono".'
    ),
    snapTitle: t('Snap-Berechtigung', 'Snap permission', 'Autorisation Snap', 'Autorizzazione Snap'),
    snapConnected: t('Verbunden', 'Connected', 'Connecté', 'Connesso'),
    snapDisconnected: t('Nicht verbunden', 'Not connected', 'Non connecté', 'Non connesso'),
    snapUnknown: t('Status wird geprüft…', 'Checking status…', 'Vérification du statut…', 'Verifica dello stato…'),
    snapButton: t('Im Snap-Store öffnen', 'Open in Snap Store', 'Ouvrir dans le Snap Store', 'Apri nello Snap Store'),
    snapButtonHint: t(
      'Öffnet die Snap-Detailseite. Dort auf „Permissions" → „Audio Record" aktivieren – dieser Dialog erkennt es automatisch.',
      'Opens the Snap detail page. Go to “Permissions” → enable “Audio Record” – this dialog detects it automatically.',
      'Ouvre la page de détails du Snap. Activez-y « Permissions » → « Audio Record », cette fenêtre le détecte automatiquement.',
      'Apre la pagina dei dettagli dello Snap. Attiva "Permissions" → "Audio Record", questa finestra lo rileva automaticamente.'
    ),
    snapOrCmd: t('Oder im Terminal ausführen:', 'Or run in a terminal:', 'Ou exécuter dans un terminal :', 'Oppure esegui in un terminale:'),
    snapCmdCopy: t('Befehl kopieren', 'Copy command', 'Copier la commande', 'Copia comando'),
    snapCmdCopied: t('Kopiert ✓', 'Copied ✓', 'Copié ✓', 'Copiato ✓'),
    snapNeedConnect: t('Aktiviere zuerst die Snap-Berechtigung, um „Erlauben" auszuwählen.', 'Enable the Snap permission first to choose “Allow”.', 'Activez d’abord l’autorisation Snap pour choisir « Autoriser ».', 'Attiva prima l’autorizzazione Snap per scegliere "Consenti".'),
    allow: t('Erlauben', 'Allow', 'Autoriser', 'Consenti'),
    deny: t('Ablehnen', 'Deny', 'Refuser', 'Rifiuta')
  };
  const snapPanel = showSnapPanel ? `
    <div class="snap" id="snap-panel" data-status="${escapeHtml(initialStatus)}">
      <div class="snap-head">
        <span class="dot"></span>
        <span class="snap-title">${i18n.snapTitle}</span>
        <span class="snap-status" id="snap-status-text"></span>
      </div>
      <div class="snap-body">
        <button class="btn-snap" id="open-snap">${i18n.snapButton}</button>
        <div class="snap-hint">${i18n.snapButtonHint}</div>
        <div class="snap-or">${i18n.snapOrCmd}</div>
        <div class="snap-cmd-row">
          <code class="snap-cmd" id="snap-cmd">${escapeHtml(SNAP_CONNECT_CMD)}</code>
          <button class="btn-snap snap-cmd-copy" id="snap-cmd-copy">${i18n.snapCmdCopy}</button>
        </div>
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(i18n.title)}</title>
<style>
${sharedDialogCSS()}
body{font-size:13.5px;display:flex;flex-direction:column}
.container{padding:22px;flex:1;display:flex;flex-direction:column;gap:14px;overflow:hidden}
.head{display:flex;gap:14px;align-items:flex-start}
.icon{color:${ac.from};flex:0 0 auto;line-height:0}
.text .msg{font-weight:500;margin:0 0 6px;line-height:1.4}
.text .hint{color:${th.text};font-size:12.5px;line-height:1.5}
.snap{background:${th.bgHover};border:1px solid ${th.border};border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.snap-head{display:flex;align-items:center;gap:8px}
.snap-body{display:flex;flex-direction:column;gap:7px}
.snap[data-status="connected"] .snap-body{display:none}
.dot{width:9px;height:9px;border-radius:50%;background:${th.text};flex:0 0 auto;transition:background .2s}
.snap[data-status="connected"] .dot{background:#3fb96e}
.snap[data-status="disconnected"] .dot{background:#e05e3e}
.snap[data-status="unknown"] .dot{background:${warnColor().fg}}
.snap-title{font-weight:600;font-size:12.5px}
.snap-status{color:${th.text};font-size:12px;flex:1}
.btn-snap{background:${th.bg};color:${th.textActive};border:1px solid ${th.border};border-radius:6px;padding:7px 12px;font-size:12.5px;font-family:inherit;cursor:pointer;font-weight:500;align-self:flex-start}
.btn-snap:hover{background:${th.bgActive}}
.snap-hint{color:${th.text};font-size:11.5px;line-height:1.4}
.snap-or{color:${th.text};font-size:11.5px;margin-top:2px;font-weight:500}
.snap-cmd-row{display:flex;gap:6px;align-items:center}
.snap-cmd{flex:1;background:${th.bg};border:1px solid ${th.border};border-radius:6px;padding:6px 9px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:${th.textActive};user-select:text;-webkit-user-select:text;overflow-x:auto;white-space:nowrap}
.snap-cmd-copy{padding:6px 10px;font-size:11.5px;flex:0 0 auto}
.allow-blocker{color:${warnColor().fg};font-size:11.5px;line-height:1.4;margin-top:2px;display:none}
.snap[data-status="disconnected"] ~ .allow-blocker{display:block}
.snap[data-status="unknown"] ~ .allow-blocker{display:block}
.buttons{padding:14px 22px;border-top:1px solid ${th.border};display:flex;gap:8px;justify-content:flex-end}
.btn{min-width:90px}
.btn.pulse{animation:btnpulse 1.6s ease-in-out 3;outline:0}
@keyframes btnpulse{0%{box-shadow:0 0 0 0 rgba(232,82,79,.55)}50%{box-shadow:0 0 0 10px rgba(232,82,79,0)}100%{box-shadow:0 0 0 0 rgba(232,82,79,0)}}
</style></head><body>
<div class="container">
  <div class="head">
    <div class="icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
    </div>
    <div class="text">
      <div class="msg">${i18n.message}</div>
      <div class="hint">${i18n.hint}</div>
    </div>
  </div>
  ${snapPanel}
  ${showSnapPanel ? `<div class="allow-blocker" id="allow-blocker">${i18n.snapNeedConnect}</div>` : ''}
</div>
<div class="buttons">
  <button class="btn" id="deny">${i18n.deny}</button>
  <button class="btn primary" id="allow">${i18n.allow}</button>
</div>
<script>
(function(){
  const respondChannel = ${safeJson(respondChannel)};
  const snapOpenChannel = ${safeJson(snapOpenChannel)};
  const statusChannel = ${safeJson(statusChannel)};
  const copyCmdChannel = ${safeJson(copyCmdChannel || '')};
  const respond = (i) => { try { window.msgboxAPI.respond(respondChannel, i); } catch {} };
  const allowBtn = document.getElementById('allow');
  const denyBtn = document.getElementById('deny');
  let allowEnabled = ${showSnapPanel ? 'false' : 'true'};

  const setAllowEnabled = (v) => {
    allowEnabled = !!v;
    allowBtn.disabled = !allowEnabled;
  };
  setAllowEnabled(allowEnabled);

  allowBtn.addEventListener('click', () => { if (allowEnabled) respond(0); });
  denyBtn.addEventListener('click', () => respond(1));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); window.close(); }
    else if (e.key === 'Enter' && allowEnabled) { e.preventDefault(); respond(0); }
  });
  setTimeout(() => (allowEnabled ? allowBtn : denyBtn).focus(), 50);

  const snapPanel = document.getElementById('snap-panel');
  if (snapPanel) {
    const statusText = document.getElementById('snap-status-text');
    const labels = ${safeJson({ connected: i18n.snapConnected, disconnected: i18n.snapDisconnected, unknown: i18n.snapUnknown })};
    let lastStatus = snapPanel.dataset.status || 'unknown';
    let pulseTimer = null;
    const apply = (s) => {
      snapPanel.dataset.status = s;
      statusText.textContent = labels[s] || labels.unknown;
      setAllowEnabled(s === 'connected');
      if (s === 'connected' && lastStatus !== 'connected') {
        allowBtn.classList.add('pulse');
        try { allowBtn.focus(); } catch {}
        clearTimeout(pulseTimer);
        pulseTimer = setTimeout(() => allowBtn.classList.remove('pulse'), 5000);
      }
      lastStatus = s;
    };
    apply(lastStatus);
    document.getElementById('open-snap').addEventListener('click', () => {
      try { window.msgboxAPI.openSnapPermissions(snapOpenChannel); } catch {}
    });
    const copyBtn = document.getElementById('snap-cmd-copy');
    const copyLabels = ${safeJson({ idle: i18n.snapCmdCopy, done: i18n.snapCmdCopied })};
    let copyResetTimer = null;
    if (copyBtn && copyCmdChannel) {
      copyBtn.addEventListener('click', () => {
        try { window.msgboxAPI.copySnapCmd(copyCmdChannel); } catch {}
        copyBtn.textContent = copyLabels.done;
        clearTimeout(copyResetTimer);
        copyResetTimer = setTimeout(() => { copyBtn.textContent = copyLabels.idle; }, 1800);
      });
    }
    if (window.msgboxAPI.onStatusUpdate) {
      window.msgboxAPI.onStatusUpdate(statusChannel, (s) => apply(s));
    }
  }
})();
</script>
</body></html>`;
}

// Live Notifications (GitHub-hosted JSON, polled + on-demand)

// Test-Override-Pfad für lokale Entwicklung. Hat Vorrang vor dem GitHub-Fetch.
// Setze CLAUDE_NOTIFICATIONS_OVERRIDE auf einen absoluten Pfad zu einer JSON-Datei.
// In dev (npm start, !app.isPackaged) wird zusätzlich automatisch ./notifications.json
// im Projektroot probiert, falls die ENV-Var nicht gesetzt ist.
function getNotificationsOverridePath() {
  if (process.env.CLAUDE_NOTIFICATIONS_OVERRIDE) return process.env.CLAUDE_NOTIFICATIONS_OVERRIDE;
  if (!app.isPackaged) {
    const local = path.join(__dirname, 'notifications.json');
    if (fs.existsSync(local)) return local;
  }
  return null;
}

function fetchNotificationsRemote() {
  return new Promise((resolve) => {
    const req = net.request({ method: 'GET', url: NOTIFICATIONS_URL, redirect: 'follow', cache: 'no-cache' });
    let body = '';
    let aborted = false;
    const timeout = setTimeout(() => { aborted = true; try { req.abort(); } catch {}; resolve(null); }, 10000);
    req.on('response', (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        clearTimeout(timeout);
        try { req.abort(); } catch {}
        return resolve(null);
      }
      res.on('data', (chunk) => { body += chunk.toString('utf8'); if (body.length > 256 * 1024) { try { req.abort(); } catch {}; } });
      res.on('end', () => {
        clearTimeout(timeout);
        if (aborted) return resolve(null);
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
      res.on('error', () => { clearTimeout(timeout); resolve(null); });
    });
    req.on('error', () => { clearTimeout(timeout); resolve(null); });
    req.end();
  });
}

function loadNotificationsLocal(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}


function pushNotificationsToTabBar() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send('notifications-update', activeNotifications.slice(0, MAX_NOTIFICATIONS_VISIBLE));
  } catch {}
  // View neu positionieren, da der Banner-Bereich Höhe geändert haben könnte.
  lastViewBounds = '';
  resizeActiveView();
}

function getNotificationBarHeight() {
  if (!activeNotifications || activeNotifications.length === 0) return 0;
  return NOTIFICATION_BANNER_HEIGHT * Math.min(activeNotifications.length, MAX_NOTIFICATIONS_VISIBLE);
}

async function refreshNotifications() {
  const override = getNotificationsOverridePath();
  let payload = null;
  if (override) {
    payload = loadNotificationsLocal(override);
  } else {
    payload = await fetchNotificationsRemote();
  }
  activeNotifications = filterNotifications(payload, { appVersion: version, isSnap, dismissedIds: dismissedNotificationIds });
  pushNotificationsToTabBar();
}

function setupNotifications() {
  // Override (Dev / lokale Datei): kürzer warten, Banner soll beim Testen schnell erscheinen.
  const delay = getNotificationsOverridePath() ? 1500 : NOTIFICATIONS_FIRST_FETCH_DELAY_MS;
  setTimeout(() => { refreshNotifications().catch(() => {}); }, delay);
  notificationsFetchInterval = setInterval(() => {
    refreshNotifications().catch(() => {});
  }, NOTIFICATIONS_FETCH_MS);
}

function dismissNotification(id) {
  if (typeof id !== 'string' || !id) return;
  if (!dismissedNotificationIds.includes(id)) {
    dismissedNotificationIds.push(id);
    if (dismissedNotificationIds.length > MAX_DISMISSED_IDS) dismissedNotificationIds = dismissedNotificationIds.slice(-MAX_DISMISSED_IDS);
    saveWindowState();
  }
  activeNotifications = activeNotifications.filter(n => n.id !== id);
  pushNotificationsToTabBar();
}

function setupSession() {
  const ses = session.fromPartition('persist:claude');
  const allowed = new Set(['clipboard-read', 'clipboard-sanitized-write', 'notifications', 'fullscreen']);

  ses.setPermissionRequestHandler((_, perm, cb, details) => {
    if (perm === 'media') {
      // getDisplayMedia ("Screenshot erstellen") kommt mit leerem mediaTypes, die Quelle
      // waehlt setDisplayMediaRequestHandler unten.
      if (details && Array.isArray(details.mediaTypes) && details.mediaTypes.length === 0) {
        return cb(isClaudeAiOrigin(details.requestingUrl));
      }
      // Mikrofon nur für claude.ai zulassen — claudeusercontent.com (Artifact-iframes)
      // explizit ausschließen, damit User-generierter Code keinen Mic-Zugriff erbt.
      if (!isClaudeAiOrigin(details && details.requestingUrl)) return cb(false);
      const wantsAudio = !details || !details.mediaTypes || details.mediaTypes.includes('audio');
      if (!wantsAudio) return cb(false);
      if (microphoneEnabled) return cb(true);
      if (microphoneConsentAsked) return cb(false);
      getOrStartMicConsent().then(reason => {
        if (reason !== 'dismissed') {
          microphoneConsentAsked = true;
          microphoneEnabled = reason === 'granted';
          saveWindowState();
        }
        cb(reason === 'granted');
      }).catch(() => cb(false));
      return;
    }
    cb(allowed.has(perm));
  });
  ses.setPermissionCheckHandler((_, perm, requestingOrigin) => {
    if (perm === 'media') {
      if (!isClaudeAiOrigin(requestingOrigin)) return false;
      return microphoneEnabled;
    }
    return allowed.has(perm);
  });

  // Unter Wayland zeigt getSources den Auswahldialog des Portals. X11 hat keinen Picker,
  // dort nehmen wir den Bildschirm, auf dem das App-Fenster liegt.
  ses.setDisplayMediaRequestHandler((req, cb) => {
    if (!isClaudeAiOrigin(req.securityOrigin)) return cb({});
    desktopCapturer.getSources({ types: ['screen'] }).then(sources => {
      const disp = mainWindow && !mainWindow.isDestroyed() ? screen.getDisplayMatching(mainWindow.getBounds()) : null;
      const src = sources.find(x => disp && x.display_id === String(disp.id)) || sources[0];
      cb(src ? { video: src } : {});
    }).catch(() => cb({}));
  });

  ses.setUserAgent(chromeUA);

  // Keine eigenen Sec-Ch-Ua-Header: Chromium setzt sie passend zu navigator.userAgentData.
  // Feste Werte liefen bei jedem Electron-Update auseinander (die GREASE-Marke haengt an
  // der Hauptversion), und dieser Widerspruch ist ein CF-Turnstile-Bot-Signal.

  // Preconnect (mehr Sockets für schnellere erste Requests)
  ses.preconnect({ url: 'https://claude.ai', numSockets: 6 });
  ses.preconnect({ url: 'https://cdn.claude.ai', numSockets: 2 });
  ses.preconnect({ url: 'https://api.claude.ai', numSockets: 2 });
}

// IPC-Handler

// Linux Autostart: schreibt eine .desktop-Datei.
// AppImage: ~/.config/autostart/claude-ai-desktop.desktop (echtes Home).
// Snap: $SNAP_USER_DATA/.config/autostart/claude-ai-desktop.desktop. snapd-userd
// liest die Datei beim Login und startet die App über den command-wrapper aus
// snapcraft.yaml (autostart-Direktive). Kein personal-files-Plug nötig.
const isSnap = !!(process.env.SNAP_NAME || process.env.SNAP);
// SNAP_USER_DATA fehlt in exotischen Confinement-Setups; ohne Fallback wirft path.join
// schon beim Modul-Load und die App startet gar nicht erst.
const AUTOSTART_BASE = isSnap
  ? (process.env.SNAP_USER_DATA || app.getPath('userData'))
  : app.getPath('home');
const AUTOSTART_DIR = path.join(AUTOSTART_BASE, '.config', 'autostart');
const AUTOSTART_FILE = path.join(AUTOSTART_DIR, 'claude-ai-desktop.desktop');

function getAutostartExec() {
  if (process.env.APPIMAGE) return `"${process.env.APPIMAGE}" --no-sandbox`;
  if (isSnap) return '/snap/bin/claude-ai-desktop';
  return null;
}

function getAutostart() {
  if (process.platform !== 'linux') {
    try { return !!app.getLoginItemSettings().openAtLogin; } catch { return false; }
  }
  try { return fs.existsSync(AUTOSTART_FILE); } catch { return false; }
}

// Liefert eine der Konstanten:
//   'ok'       — Autostart-Status erfolgreich gesetzt
//   'denied'   — Schreibzugriff verweigert (sollte unter normalen Bedingungen nicht passieren)
//   'failed'   — sonstiger Fehler
function setAutostart(enabled) {
  enabled = !!enabled;
  if (process.platform !== 'linux') {
    try { app.setLoginItemSettings({ openAtLogin: enabled }); return 'ok'; }
    catch { return 'failed'; }
  }
  try {
    if (enabled) {
      const exec = getAutostartExec();
      if (!exec) return 'failed';
      fs.mkdirSync(path.dirname(AUTOSTART_FILE), { recursive: true });
      fs.writeFileSync(AUTOSTART_FILE,
`[Desktop Entry]
Type=Application
Name=Desktop for Claude
Comment=Unofficial desktop app for Claude AI
Exec=${exec}
Icon=claude-ai-desktop
Terminal=false
X-GNOME-Autostart-enabled=true
`, { mode: 0o644 });
    } else {
      try { fs.unlinkSync(AUTOSTART_FILE); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    return 'ok';
  } catch (e) {
    if (e && (e.code === 'EACCES' || e.code === 'EPERM' || e.code === 'EROFS')) return 'denied';
    return 'failed';
  }
}

// .desktop-Self-Heal: electron-updater ersetzt die AppImage durch eine mit neuer
// Versionsnummer im Dateinamen (~/Apps/Claude-Desktop-1.3.X.AppImage). Die im
// Installer geschriebene applications/.desktop-Datei zeigt aber weiter auf den
// alten Pfad und der Menü-Eintrag startet nach jedem Auto-Update ins Leere.
// Lösung: bei jedem Start prüfen, ob der Exec= im .desktop-File mit dem aktuellen
// process.env.APPIMAGE übereinstimmt; wenn nicht, beide Files (Menü + Autostart,
// falls aktiv) rewriten und update-desktop-database triggern.
function selfHealDesktopFiles() {
  if (process.platform !== 'linux') return;
  if (isSnap) return;
  const appImagePath = process.env.APPIMAGE;
  if (!appImagePath) return;

  // Zwei Kandidaten: der aktuelle Dateiname und der aus Builds vor der Umbenennung.
  // Bestandsnutzer haben claude-desktop.desktop integriert und wuerden sonst nach dem
  // ersten Auto-Update ins Leere starten.
  const appsDir = path.join(app.getPath('home'), '.local', 'share', 'applications');
  const desktopCandidates = ['desktop-for-claude.desktop', 'claude-desktop.desktop']
    .map((f) => path.join(appsDir, f));
  let appsChanged = false;

  for (const file of desktopCandidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const updated = content
        .replace(/^Exec=.*$/m, () => `Exec="${appImagePath}" --no-sandbox %U`)
        .replace(/^X-AppImage-Version=.*$/m, () => `X-AppImage-Version=${version}`)
        .replace(/^StartupWMClass=.*$/m, () => `StartupWMClass=${APP_ID}`);
      if (updated !== content) {
        fs.writeFileSync(file, updated);
        appsChanged = true;
      }
    } catch (_) {}
  }

  // Starter mit fremdem Namen (AppImageLauncher, Gear Lever) erkennt man am Exec. Dort nur die
  // Fensterzuordnung nachziehen, ihr Exec gehoert dem Werkzeug.
  try {
    for (const f of fs.readdirSync(appsDir)) {
      const file = path.join(appsDir, f);
      if (!f.endsWith('.desktop') || desktopCandidates.includes(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      if (!content.includes(appImagePath)) continue;
      const updated = content.replace(/^StartupWMClass=.*$/m, () => `StartupWMClass=${APP_ID}`);
      if (updated !== content) { fs.writeFileSync(file, updated); appsChanged = true; }
    }
  } catch (_) {}

  // Das Wayland-Portal sucht eine .desktop-Datei, die genau wie die App-ID heisst. Versteckt und
  // ohne StartupWMClass, damit ein angehefteter Starter von oben die Fensterzuordnung behaelt.
  const idFile = path.join(appsDir, `${APP_ID}.desktop`);
  const idEntry = ['[Desktop Entry]', 'Type=Application', 'Name=Desktop for Claude',
    `Exec="${appImagePath}" --no-sandbox %U`, `Icon=${isBeta ? 'desktop-for-claude-beta' : 'desktop-for-claude'}`,
    'NoDisplay=true', ''].join('\n');
  try {
    if (!fs.existsSync(idFile) || fs.readFileSync(idFile, 'utf8') !== idEntry) {
      fs.mkdirSync(appsDir, { recursive: true });
      fs.writeFileSync(idFile, idEntry, { mode: 0o644 });
      appsChanged = true;
    }
  } catch (_) {}

  try {
    if (fs.existsSync(AUTOSTART_FILE)) {
      const content = fs.readFileSync(AUTOSTART_FILE, 'utf8');
      const updated = content.replace(/^Exec=.*$/m, () => `Exec="${appImagePath}" --no-sandbox`);
      if (updated !== content) fs.writeFileSync(AUTOSTART_FILE, updated, { mode: 0o644 });
    }
  } catch (_) {}

  if (appsChanged) {
    execFile('update-desktop-database', [appsDir], { timeout: 5000 }, () => {});
  }
}

ipcMain.handle('settings-get', () => ({
  minimizeOnClose,
  hotkey: currentHotkey,
  clipboardHotkey: currentClipboardHotkey,
  bgNotifications: bgNotificationsEnabled,
  microphoneEnabled,
  isSnap,
  templates: promptTemplates.map(t => ({ id: t.id, name: t.name, prefix: t.prefix })),
  autostart: getAutostart()
}));
ipcMain.on('settings-minimize', (_, v) => {
  minimizeOnClose = v === true;
  saveWindowState();
});
ipcMain.handle('settings-autostart', (_, v) => setAutostart(v === true));

ipcMain.handle('settings-hotkey', (_, accel) => {
  const value = validateAccelerator(accel);
  const res = registerHotkey(value);
  if (res === 'ok') saveWindowState();
  return res;
});
ipcMain.handle('settings-clipboard-hotkey', (_, accel) => {
  const value = validateAccelerator(accel);
  const res = registerClipboardHotkey(value);
  if (res === 'ok') saveWindowState();
  return res;
});
ipcMain.on('settings-bg-notifications', (_, v) => {
  bgNotificationsEnabled = v === true;
  saveWindowState();
});

ipcMain.on('settings-microphone', (_, v) => {
  microphoneEnabled = v === true;
  microphoneConsentAsked = true;
  saveWindowState();
});

// Snap-aware Mic-Toggle: bei ON auf Snap mit disconnected Plug zeigt
// requestMicrophoneConsent() den Wizard. Bei !isSnap oder bereits connected
// verhaelt es sich wie der direkte Toggle.
ipcMain.handle('settings-microphone-with-consent', async (_, v) => {
  const want = v === true;
  if (!want) {
    microphoneEnabled = false;
    microphoneConsentAsked = true;
    saveWindowState();
    return { applied: false, status: 'connected' };
  }
  if (!isSnap) {
    microphoneEnabled = true;
    microphoneConsentAsked = true;
    saveWindowState();
    return { applied: true, status: 'connected' };
  }
  // Snap: Plug-Status pruefen
  const status = await new Promise(resolve => checkSnapAudioRecordStatus(resolve));
  if (status === 'connected') {
    microphoneEnabled = true;
    microphoneConsentAsked = true;
    saveWindowState();
    return { applied: true, status };
  }
  // Plug nicht verbunden -> Consent-Dialog mit Snap-Wizard.
  // Geht ueber den Modul-weiten Mutex, damit ein paralleler claude.ai-Mic-Trigger
  // nicht ein zweites Modal aufmacht.
  const reason = await getOrStartMicConsent();
  if (reason !== 'dismissed') microphoneConsentAsked = true;
  microphoneEnabled = reason === 'granted';
  saveWindowState();
  const newStatus = await new Promise(resolve => checkSnapAudioRecordStatus(resolve));
  return { applied: microphoneEnabled, status: newStatus };
});

ipcMain.handle('settings-mic-snap-status', () => {
  if (!isSnap) return Promise.resolve('connected');
  return new Promise(resolve => checkSnapAudioRecordStatus(resolve));
});

ipcMain.on('settings-microphone-reset', () => {
  microphoneEnabled = false;
  microphoneConsentAsked = false;
  saveWindowState();
});
ipcMain.on('settings-open-snap-permissions', () => openSnapStorePage());
ipcMain.on('settings-copy-snap-cmd', () => { clipboard.writeText(SNAP_CONNECT_CMD).catch(() => {}); });

// Live-Notifications (Tab-Bar-Banner)
ipcMain.on('notification-dismiss', (_, id) => dismissNotification(id));
ipcMain.on('notification-link', (_, payload) => {
  if (!payload || typeof payload !== 'object') return;
  const url = typeof payload.url === 'string' ? payload.url : '';
  if (!/^https:\/\//i.test(url)) return;
  openExternalSafe(url);
});
ipcMain.on('notifications-request', () => pushNotificationsToTabBar());

ipcMain.handle('settings-add-template', (_, tpl) => {
  if (!tpl || typeof tpl.name !== 'string' || typeof tpl.prefix !== 'string') return { error: 'invalid' };
  const name = tpl.name.trim().slice(0, 40);
  const prefix = tpl.prefix.slice(0, 2000);
  if (!name || !prefix.trim()) return { error: 'invalid' };
  if (promptTemplates.length >= 50) return { error: 'limit' };
  if (promptTemplates.some(t => t.name.toLowerCase() === name.toLowerCase())) return { error: 'dup' };
  const id = 'tpl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  promptTemplates.push({ id, name, prefix });
  saveWindowState();
  return { templates: promptTemplates.slice() };
});
ipcMain.handle('settings-delete-template', (_, id) => {
  if (typeof id === 'string') {
    promptTemplates = promptTemplates.filter(t => t.id !== id);
    saveWindowState();
  }
  return { templates: promptTemplates.slice() };
});

ipcMain.on('design-set-mode', (event, mode) => {
  if (!designWindow || designWindow.isDestroyed() || event.sender !== designWindow.webContents) return;
  setThemeMode(mode);
});
ipcMain.on('design-set-design', (event, style) => {
  if (!designWindow || designWindow.isDestroyed() || event.sender !== designWindow.webContents) return;
  setDesignStyle(style);
});
ipcMain.on('design-set-matrix-rain', (event, on) => {
  if (!designWindow || designWindow.isDestroyed() || event.sender !== designWindow.webContents) return;
  matrixRain = on === true;
  applyThemeToAllViews();
  saveWindowState();
});
ipcMain.on('design-set-tray-mono', (event, on) => {
  if (!designWindow || designWindow.isDestroyed() || event.sender !== designWindow.webContents) return;
  trayMono = on === true;
  refreshTrayImage();
  saveWindowState();
});
ipcMain.on('design-set-rounded-corners', (event, on) => {
  if (!designWindow || designWindow.isDestroyed() || event.sender !== designWindow.webContents) return;
  roundedCorners = on === true;
  saveWindowState();
});
ipcMain.on('design-close', (event) => {
  if (designWindow && !designWindow.isDestroyed() && event.sender === designWindow.webContents) designWindow.close();
});

ipcMain.on('settings-close', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close();
});

// Background-Notification von der claude.ai-Seite (via preload-content.js)
ipcMain.on('claude-response-done', (event, payload) => {
  if (!bgNotificationsEnabled) return;
  // Senderview ermitteln
  const senderWc = event.sender;
  const idx = tabs.findIndex(tb => tb.view && tb.view.webContents === senderWc);
  if (idx < 0) return;
  // Nur Notification, wenn Tab nicht aktiv ODER Hauptfenster nicht sichtbar/fokussiert
  const mainVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && mainWindow.isFocused() && !mainWindow.isMinimized();
  if (idx === activeTabIndex && mainVisible) return;
  const tab = tabs[idx];
  const title = (tab.title || 'Claude').slice(0, 80);
  const body = typeof payload === 'object' && payload && typeof payload.preview === 'string'
    ? payload.preview.slice(0, 140)
    : t('Antwort fertig', 'Response ready', 'Réponse prête', 'Risposta pronta');
  try {
    const n = new Notification({ title, body, silent: false });
    n.on('click', () => {
      showMainWindow();
      if (idx >= 0 && idx < tabs.length) switchToTab(idx);
    });
    n.show();
  } catch {}
});

ipcMain.on('cd-offline-retry', (event) => {
  // Zurueck auf den Chat dieses Tabs, nicht auf einen neuen. Sender-Lookup, weil der
  // Nutzer waehrend der Offline-Seite den Tab gewechselt haben kann.
  const fromTab = tabs.find(tb => tb.view && tb.view.webContents === event.sender);
  if (!fromTab || !alive(fromTab.view)) return;
  fromTab.view.webContents.loadURL(fromTab.url || 'https://claude.ai');
});

ipcMain.on('claude-reset-verification', (event) => {
  // Nur aus einer echten Tab-View akzeptieren; den Reset auf genau diesen Tab anwenden,
  // nicht auf den aktiven (der Nutzer kann waehrend des Bestaetigungsdialogs wechseln).
  const fromTab = tabs.find(tb => tb.view && tb.view.webContents === event.sender);
  if (!fromTab) return;
  resetClaudeVerification(fromTab);
});

// Reset-Button in der Tab-Bar-Toolbar (eigener Kanal, da die Tab-Bar-View nicht in `tabs`
// steht und der Handler oben sie sonst verwirft). Wirkt auf den aktiven Tab.
ipcMain.on('tabbar-reset-verification', () => resetClaudeVerification());

ipcMain.on('quickprompt-submit', (event, text) => {
  if (!quickPromptWindow || quickPromptWindow.isDestroyed() || event.sender !== quickPromptWindow.webContents) return;
  quickPromptWindow.close();
  if (typeof text !== 'string' || text.length > MAX_PROMPT_CHARS) return;
  submitQuickPrompt(text);
});
ipcMain.on('quickprompt-cancel', (event) => {
  if (!quickPromptWindow || quickPromptWindow.isDestroyed() || event.sender !== quickPromptWindow.webContents) return;
  quickPromptWindow.close();
});

ipcMain.on('whatsnew-close', () => {
  if (whatsNewWindow && !whatsNewWindow.isDestroyed()) whatsNewWindow.close();
});
ipcMain.on('whatsnew-open-support', () => openExternalSafe(SUPPORT_URL));
ipcMain.on('whatsnew-open-settings', () => {
  if (whatsNewWindow && !whatsNewWindow.isDestroyed()) whatsNewWindow.close();
  openSettingsWindow();
});

ipcMain.on('about-close', () => {
  if (aboutWindow && !aboutWindow.isDestroyed()) aboutWindow.close();
});
ipcMain.on('about-open-whatsnew', () => {
  if (aboutWindow && !aboutWindow.isDestroyed()) aboutWindow.close();
  openWhatsNewWindow(true);
});
ipcMain.on('about-open-external', (_event, url) => {
  if (typeof url === 'string' && /^https:\/\//i.test(url)) openExternalSafe(url);
});

function sendWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send('win-state', { maximized: mainWindow.isMaximized() });
  } catch (_) {}
}
function fromMainWindow(event) {
  return mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;
}
ipcMain.on('win-minimize', (event) => { if (fromMainWindow(event)) mainWindow.minimize(); });
ipcMain.on('win-toggle-maximize', (event) => {
  if (!fromMainWindow(event)) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('win-close', (event) => { if (fromMainWindow(event)) mainWindow.close(); });
ipcMain.on('win-state-request', (event) => { if (fromMainWindow(event)) sendWindowState(); });

ipcMain.on('tab-new', () => createTab());
ipcMain.on('tab-switch', (_, i) => {
  if (typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < tabs.length) switchToTab(i);
});
ipcMain.on('tab-close', (_, i) => {
  if (typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < tabs.length) closeTab(i);
});
// Die (ausgeblendete) Pille in der Tab-Leiste schaltet weiter im Kreis.
ipcMain.on('design-toggle', () => {
  const i = DESIGN_STYLES.indexOf(designStyle);
  setDesignStyle(DESIGN_STYLES[(i + 1) % DESIGN_STYLES.length]);
});
ipcMain.on('official-app-info', () => showOfficialAppInfo());
ipcMain.on('bug-report', showBugReportDialog);
ipcMain.on('export-conversation', () => exportActiveConversation());
ipcMain.on('app-menu-popup', (_event, x, y) => openAppMenu(x, y));
ipcMain.on('appmenu-action', (event, name) => {
  if (!appMenuView || event.sender !== appMenuView.webContents) return;
  closeAppMenu();
  switch (name) {
    case 'new-tab': createTab(); break;
    case 'close-tab': closeTab(activeTabIndex); break;
    case 'export': exportActiveConversation(); break;
    case 'reload':
      if (tabs[activeTabIndex] && alive(tabs[activeTabIndex].view)) tabs[activeTabIndex].view.webContents.reload();
      break;
    case 'design-open': openDesignWindow(); break;
    case 'official-app': showOfficialAppInfo(); break;
    case 'support': showSupportInfo(); break;
    case 'settings': openSettingsWindow(); break;
    case 'check-updates':
      triggerManualUpdateCheck();
      break;
    case 'bug-report': showBugReportDialog(); break;
    case 'copy-diagnostics': copyDiagnosticsInfo(); break;
    case 'reset-verification': resetClaudeVerification(); break;
    case 'whats-new': openWhatsNewWindow(true); break;
    case 'about': openAboutWindow(); break;
    case 'quit': isQuitting = true; app.quit(); break;
  }
});
ipcMain.on('appmenu-close', (event) => {
  if (appMenuView && event.sender === appMenuView.webContents) closeAppMenu();
});
ipcMain.on('theme-toggle', () => {
  const i = THEME_MODES.indexOf(currentThemeMode());
  setThemeMode(THEME_MODES[(i + 1) % THEME_MODES.length]);
});

// Fenster erstellen

function createWindow() {
  const state = loadWindowState();
  // Immer dark: White laeuft ueber den Invert-Filter im injizierten Theme, nicht ueber
  // claude.ais prefers-color-scheme (siehe theme-toggle).
  nativeTheme.themeSource = 'dark';

  // Runde Ecken nur fuer diese Sitzung festlegen: roundedCorners geht nur im Konstruktor, und Rahmen-CSS
  // und Fenster muessen zusammenpassen. Eine Aenderung im App-Theme-Fenster greift beim naechsten Start.
  windowsRounded = roundedCorners;
  mainWindow = new BrowserWindow({
    width: state.width, height: state.height, x: state.x, y: state.y,
    // Mindestmasse gegen die Arbeitsflaeche deckeln: auf einem 1024x600-Netbook liesse
    // sich das Fenster mit starren 600 sonst nie unter Schirmhoehe verkleinern.
    minWidth: Math.min(480, state.width), minHeight: Math.min(600, state.height),
    title: `Desktop for Claude v${version}`,
    icon: icon(),
    backgroundColor: theme().bg,
    autoHideMenuBar: true,
    frame: false, roundedCorners: windowsRounded,
    show: false,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      preload: path.join(__dirname, 'preload-tabbar.js'),
      backgroundThrottling: false,
      spellcheck: false,
    }
  });
  mainWindow.setMenuBarVisibility(false);

  if (state.isMaximized) mainWindow.maximize();

  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(getTabBarHTML()));
  mainWindow.setTitle(`Desktop for Claude v${version}`);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 3000);

  mainWindow.on('resize', () => { saveWindowState(); resizeActiveView(); settleActiveView(); });
  // Das Menue sitzt im Fenster: bei Groessenwechsel stimmt die Lage nicht mehr, und wie ein
  // natives Menue geht es beim Wechsel in eine andere App zu.
  for (const ev of ['resize', 'blur', 'hide', 'minimize']) mainWindow.on(ev, closeAppMenu);
  // Auf X11 bleibt die Compositor-Surface der WebContentsView gelegentlich schwarz stehen,
  // waehrend die Tab-Bar (eigenes WebContents) weiter rendert. Das Bounds-Delta in
  // settleActiveView haengt sie wieder an. Auf 'move' noetig, weil das Ziehen auf einen
  // anderen Monitor kein resize ausloest, solange die Fenstergroesse gleich bleibt.
  mainWindow.on('move', () => { saveWindowState(); settleActiveView(); });
  mainWindow.on('maximize', () => { saveWindowState(); lastViewBounds = ''; resizeActiveView(); sendWindowState(); });
  mainWindow.on('unmaximize', () => { saveWindowState(); lastViewBounds = ''; resizeActiveView(); sendWindowState(); });
  mainWindow.on('enter-full-screen', () => { lastViewBounds = ''; resizeActiveView(); });
  mainWindow.on('leave-full-screen', () => { lastViewBounds = ''; resizeActiveView(); });
  // settleActiveView auch hier: nach Restore/Show haelt die Compositor-Surface auf X11
  // gern veralteten Inhalt fest, und resizeActiveView allein ist bei gleicher Fenstergroesse
  // ein No-op. Debounced, kostet also nichts.
  mainWindow.on('show', () => { lastViewBounds = ''; resizeActiveView(); settleActiveView(); });
  mainWindow.on('restore', () => { focusActiveView(); settleActiveView(); });
  // Online-Status beim Zurueckwechseln sofort pruefen statt bis zu 60s auf den Poll zu
  // warten. handleOnlineChange ist flankengeguarded, also idempotent.
  // settleActiveView auch hier: wird die Flaeche schwarz waehrend die App im Hintergrund
  // liegt, faellt es dem Nutzer erst beim Zurueckkommen auf. Debounced, kein Flackern.
  mainWindow.on('focus', () => { focusActiveView(); settleActiveView(); handleOnlineChange(net.isOnline()); });

  mainWindow.on('close', (e) => {
    if (!isQuitting && minimizeOnClose && tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    tabs.forEach(tab => {
      if (alive(tab.view)) tab.view.webContents.close();
    });
    tabs = [];
    drainPool();
  });

  // Erster Tab + Pool verzögert füllen. Weitere Tabs der letzten Sitzung werden
  // deferred angelegt und laden erst beim Anklicken.
  mainWindow.webContents.once('did-finish-load', () => {
    // Allowlist statt blossem https: stand die App beim Beenden auf einer OAuth-Provider-
    // Seite, wuerde dieser Fremd-Host sonst beim Start automatisch in die claude.ai-
    // Partition geladen.
    const restored = Array.isArray(windowState.tabs)
      ? windowState.tabs.filter(u => typeof u === 'string' && isAllowedDomain(u)).slice(0, 20)
      : [];
    const tab = createTab(restored[0] || 'https://claude.ai');
    for (let i = 1; i < restored.length; i++) createTab(restored[i], true);
    if (tab) {
      tab.view.webContents.once('did-finish-load', () => {
        lastViewBounds = '';
        resizeActiveView();
        setTimeout(fillPool, POOL_REFILL_FIRST_TAB_MS);
      });
    }
  });
}

// App Lifecycle

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) showMainWindow();
  else { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
});

// Webview-Tags blockieren (Security)
app.on('web-contents-created', (_, wc) => {
  wc.on('will-attach-webview', (event) => event.preventDefault());
});

ipcMain.on('bug-report-open-support', () => {
  openExternalSafe('https://support.anthropic.com');
});

// Web3Forms erkennt Origin: null (unser data:-URL-Renderer) als "server-side"
// und antwortet mit 403/Pro-required. Mit einem echten Origin-Header laeuft der
// Submit als regulaerer Client-Call durch. localhost ist im Web3Forms-Dashboard
// als erlaubte Domain registriert.
function setupWeb3FormsHeaderRewrite() {
  try {
    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ['https://api.web3forms.com/*'] },
      (details, callback) => {
        const headers = { ...details.requestHeaders };
        headers['Origin'] = 'https://localhost';
        headers['Referer'] = 'https://localhost/';
        callback({ requestHeaders: headers });
      }
    );
  } catch (_) {}
}

app.whenReady().then(() => {
  selfHealDesktopFiles();
  setupSession();
  setupWeb3FormsHeaderRewrite();
  createWindow();
  // Gleiche Ursache wie der 'move'-Handler: Monitorwechsel, geaenderte Skalierung und ein
  // aufgewachter Bildschirm (DPMS/Sperrbildschirm) lassen die Surface leer zurueck, ohne
  // dass ein Fenster-Event feuert. Einmalig registriert, createWindow kann wiederkehren.
  screen.on('display-metrics-changed', () => settleActiveView());
  screen.on('display-added', () => settleActiveView());
  screen.on('display-removed', () => settleActiveView());
  powerMonitor.on('resume', () => settleActiveView());
  powerMonitor.on('unlock-screen', () => settleActiveView());
  startSurfaceWatchdog();
  updateMenu(true);
  setupDownloadManager();
  setupAutoUpdater();
  setupNotifications();
  setupTray();
  // Scheitert die Anmeldung (Taste belegt, Wayland ohne Portal), bleibt die Einstellung gespeichert,
  // statt beim naechsten saveWindowState still als leer zu landen.
  const hk = currentHotkey, clip = currentClipboardHotkey;
  if (hk && registerHotkey(hk) !== 'ok') currentHotkey = hk;
  if (clip && registerClipboardHotkey(clip) !== 'ok') currentClipboardHotkey = clip;
  handleOnlineChange(net.isOnline());
  onlineCheckInterval = setInterval(() => handleOnlineChange(net.isOnline()), ONLINE_CHECK_MS);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

  // Sonst behalten Dock und Taskleiste nach einem Update mit neuem Icon das alte bis zum
  // naechsten Stilwechsel.
  if (windowState.lastSeenVersion !== version) syncDesktopIcons();

  if (mainWindow && windowState.lastSeenVersion !== version && getFilteredNotes(version, windowState.lastSeenVersion, { isSnap }).length > 0) {
    const showWhatsNew = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      openWhatsNewWindow();
      windowState.lastSeenVersion = version;
      saveWindowStateSync();
    };
    waitForFirstTabInterval = setInterval(() => {
      const firstTab = tabs[0];
      if (firstTab && alive(firstTab.view)) {
        clearInterval(waitForFirstTabInterval);
        waitForFirstTabInterval = null;
        firstTab.view.webContents.once('did-finish-load', () => setTimeout(showWhatsNew, 600));
      }
    }, 100);
    setTimeout(() => {
      if (waitForFirstTabInterval) { clearInterval(waitForFirstTabInterval); waitForFirstTabInterval = null; }
    }, 15000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (updateCheckInterval) { clearInterval(updateCheckInterval); updateCheckInterval = null; }
  if (onlineCheckInterval) { clearInterval(onlineCheckInterval); onlineCheckInterval = null; }
  if (waitForFirstTabInterval) { clearInterval(waitForFirstTabInterval); waitForFirstTabInterval = null; }
  if (notificationsFetchInterval) { clearInterval(notificationsFetchInterval); notificationsFetchInterval = null; }
  saveWindowStateSync();
});

app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch {}
  if (tray) { try { tray.destroy(); } catch {} tray = null; }
});