'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { RELEASE_NOTES, getFilteredNotes } = require('../release-notes');
const { version } = require('../package.json');

// Das "Was ist neu"-Fenster entscheidet hierueber, was ein Nutzer nach dem Update sieht.
// Ein Fehler hier zeigt entweder nichts oder die halbe Versionshistorie.

test('RELEASE_NOTES: aktuelle package.json-Version hat Notes', () => {
  assert.ok(Array.isArray(RELEASE_NOTES[version]), `keine Release-Notes fuer v${version}`);
  assert.ok(RELEASE_NOTES[version].length > 0);
});

test('RELEASE_NOTES: jeder Slide hat title und text', () => {
  for (const [v, notes] of Object.entries(RELEASE_NOTES)) {
    for (const n of notes) {
      assert.ok(n.title, `${v}: Slide ohne title`);
      assert.ok(n.text, `${v}: Slide ohne text`);
    }
  }
});

test('getFilteredNotes: Erstinstallation zeigt nur die aktuelle Version', () => {
  const out = getFilteredNotes('1.4.17', null, {});
  assert.deepEqual(out, RELEASE_NOTES['1.4.17']);
});

test('getFilteredNotes: Upgrade zeigt alle Versionen dazwischen', () => {
  const out = getFilteredNotes('1.4.17', '1.4.14', {});
  const erwartet = ['1.4.15', '1.4.16', '1.4.17']
    .reduce((s, v) => s + (RELEASE_NOTES[v] || []).length, 0);
  assert.equal(out.length, erwartet);
});

test('getFilteredNotes: force zeigt nur die aktuelle Version', () => {
  assert.deepEqual(getFilteredNotes('1.4.17', '1.4.14', { force: true }), RELEASE_NOTES['1.4.17']);
});

test('getFilteredNotes: unbekannte Version ergibt leere Liste', () => {
  assert.deepEqual(getFilteredNotes('9.9.9', null, {}), []);
});

test('getFilteredNotes: gleiche Version zeigt nichts Neues', () => {
  assert.deepEqual(getFilteredNotes('1.4.17', '1.4.17', {}), []);
});

// 1.4.2 und 1.4.3 tragen Snap-only-Slides. Auf AppImage muessen sie verschwinden.
test('getFilteredNotes: Plattform-Filter greift', () => {
  const snap = getFilteredNotes('1.4.3', '1.4.1', { isSnap: true });
  const appimage = getFilteredNotes('1.4.3', '1.4.1', { isSnap: false });
  assert.ok(snap.length > appimage.length, 'Snap-Slides werden auf AppImage nicht gefiltert');
  assert.ok(appimage.every(n => n.if !== 'snap'));
});

// RELEASE_NOTES_REVISIT['1.4.1'] zieht 1.4.0 nach, weil dessen Notes damals falsch erschienen.
test('getFilteredNotes: Revisit-Map zieht aeltere Version nach', () => {
  const out = getFilteredNotes('1.4.1', null, {});
  const nur141 = RELEASE_NOTES['1.4.1'].length;
  assert.ok(out.length > nur141, 'Revisit greift nicht');
});
