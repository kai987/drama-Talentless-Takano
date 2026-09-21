import { readFile } from 'node:fs/promises';
import { validateLesson } from '../src/core.js';
const registry = JSON.parse(await readFile(new URL('../data/episodes.json', import.meta.url), 'utf8'));
if (registry.schemaVersion !== 1 || !registry.episodes.some(x => x.id === registry.defaultEpisode && x.status === 'published')) throw new Error('Invalid registry/default episode');
const ids = new Set(); let count = 0;
for (const entry of registry.episodes) {
  if (!/^\d{2}$/.test(entry.id) || ids.has(entry.id) || !Number.isInteger(entry.number) || !['published','planned'].includes(entry.status)) throw new Error('Invalid/duplicate registry entry');
  ids.add(entry.id);
  if (entry.status === 'planned') { if (entry.file) throw new Error('Unpublished entries must not have a lesson file'); continue; }
  if (!/^episodes\/[\w-]+\.json$/.test(entry.file)) throw new Error('Invalid lesson path');
  const lesson = JSON.parse(await readFile(new URL(`../data/${entry.file}`, import.meta.url), 'utf8'));
  validateLesson(lesson, entry); count += lesson.terms.length;
}
console.log(`Validated ${registry.episodes.length} episode entries and ${count} published expressions.`);
