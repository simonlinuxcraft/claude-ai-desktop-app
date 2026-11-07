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

test('getFilteredNotes: zeigt nur die Notes der uebergebenen Version', () => {
  assert.deepEqual(getFilteredNotes('1.4.17', false), RELEASE_NOTES['1.4.17']);
});

test('getFilteredNotes: unbekannte Version ergibt leere Liste', () => {
  assert.deepEqual(getFilteredNotes('9.9.9', false), []);
});

// 1.4.3 traegt Snap-only-Slides. Auf AppImage muessen sie verschwinden.
test('getFilteredNotes: Plattform-Filter greift', () => {
  const snap = getFilteredNotes('1.4.3', true);
  const appimage = getFilteredNotes('1.4.3', false);
  assert.ok(snap.length > appimage.length, 'Snap-Slides werden auf AppImage nicht gefiltert');
  assert.ok(appimage.every(n => n.if !== 'snap'));
  assert.ok(snap.every(n => n.if !== 'appimage'));
});
