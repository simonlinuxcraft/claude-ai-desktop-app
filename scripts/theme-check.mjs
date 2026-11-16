// Prueft die laufende Dev-App (npm run dev -- --remote-debugging-port=9222) auf graue Flaechen,
// die das Theme-Sheet nicht erwischt und die erst das Sicherheitsnetz (healGrey) reparieren musste.
// Aufruf: node scripts/theme-check.mjs [port] [/pfad ...], z.B. 9222 /new /recents /projects.
// Ohne Pfade wird die aktuelle Seite geprueft. Exit 1, wenn das Netz irgendwo eingreifen musste.
// Waehrend des Laufs wechselt nur die Seite das Theme; Tab-Leiste und Akzent bleiben beim App-Theme.
const [port = '9222', ...paths] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = list.find(p => p.type === 'page' && p.url.startsWith('https://claude.ai'));
if (!target) { console.error('Keine claude.ai-Seite auf Port ' + port); process.exit(2); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = {};
ws.onmessage = m => { const d = JSON.parse(m.data); if (pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
await new Promise(r => { ws.onopen = r; });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const run = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value;
const wait = ms => new Promise(r => setTimeout(r, ms));

// Aus der Session gestartete Fenster haben oft Viewport 0x0, dann zeigt claude.ai das Handy-Layout.
await send('Emulation.setDeviceMetricsOverride', { width: 1521, height: 840, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
const startUrl = target.url;
let orig = null, fails = 0;
try {
  for (const path of paths.length ? paths : [null]) {
    if (path) await send('Page.navigate', { url: 'https://claude.ai' + path }); else await send('Page.reload');
    await wait(9000);
    orig = orig || await run('JSON.stringify(window._cdTheme)');
    for (const mode of ['oled', 'midnight', 'matrix']) {
      await run(`window._cdHealLog = []; document.querySelectorAll('[data-cd-heal]').forEach(e => e.removeAttribute('data-cd-heal'));
        window._cdSetTheme(Object.assign(${orig}, { mode: '${mode}' }))`);
      await wait(6000);
      const log = await run('window._cdHealLog || []');
      console.log(`${path || 'aktuelle Seite'} ${mode}: ${log.length ? log.length + ' Flaeche(n) vom Netz repariert' : 'ok'}`);
      for (const line of log) console.log('  ' + line);
      if (log.length) fails++;
    }
  }
} finally {
  // Auch bei einem Fehler unterwegs: Seite zurueck ins App-Theme, Emulation aus.
  if (orig) await run(`window._cdSetTheme(${orig})`);
  await send('Emulation.setFocusEmulationEnabled', { enabled: false });
  await send('Emulation.clearDeviceMetricsOverride');
  if (paths.length) await send('Page.navigate', { url: startUrl });
  ws.close();
}
process.exit(fails ? 1 : 0);
