import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildKnowledgeIndex, searchKnowledge, queryTokens, highlightMatches, contextSnippet } from '../src/search.js';
import { searchField, resultMarkup } from '../src/search-ui.js';
const lesson = JSON.parse(await readFile(new URL('../data/episodes/04.json', import.meta.url)));
const registry = JSON.parse(await readFile(new URL('../data/episodes.json', import.meta.url)));
const index = buildKnowledgeIndex(registry, new Map([['04', lesson]]));
const find = q => searchKnowledge(index, q);

test('indexes all published terms without changing source data', () => {
  assert.equal(index.length, lesson.terms.length);
  assert.ok(index.every(x => x.episodeId === '04'));
  assert.ok(!('fields' in lesson.terms[0]));
});
test('an unpublished lesson is never indexed even when a draft is loaded', () => {
  assert.equal(buildKnowledgeIndex(registry, new Map([['05', { ...lesson, id: '05' }]])).length, 0);
});
test('empty or whitespace input returns no automatic navigation target', () => { assert.equal(find('').length, 0); assert.equal(find('　 ').length, 0); });
test('expression-prefix matches rank ahead of mentions in body copy', () => { assert.equal(find('認識')[0].id, '04-06'); assert.equal(find('根回し')[0].id, '04-05'); });
test('hiragana, katakana, half-width and full-width input are normalized', () => {
  for (const q of ['にんしき', 'ニンシキ', 'ﾆﾝｼｷ']) assert.equal(find(q)[0].id, '04-06');
  for (const q of ['ＣＣ', 'cc', 'ｃｃ']) assert.equal(find(q)[0].id, '04-03');
  for (const q of ['リスケ', 'りすけ', 'ﾘｽｹ']) assert.equal(find(q)[0].id, '04-09');
});
test('Chinese meanings and IT examples are searchable', () => { assert.equal(find('统一认识')[0].id, '04-06'); assert.ok(find('API').some(x => x.id === '04-06')); });
test('search finds tips, collocations, questions and interview highlight text', () => {
  assert.ok(find('默认不存在的词').length === 0);
  assert.ok(find('正式审批').some(x => x.id === '04-05'));
  assert.ok(find('対策を講じる').some(x => x.id === '04-01'));
  assert.ok(find('验收条件').some(x => x.id === '04-06'));
});
test('multiple words combine across fields and can restrict the episode', () => {
  assert.ok(find('第4集 API').some(x => x.id === '04-06'));
  assert.equal(find('第5集 API').length, 0);
  assert.equal(find('第4話 根回し')[0].id, '04-05');
  assert.equal(find('认知根回し不存在').length, 0);
});
test('all matches remain reachable; a broad episode query is not truncated', () => { assert.equal(find('第4集').length, 18); });
test('future published episodes are indexed with distinct IDs even for repeated expressions', () => {
  const nextRegistry = structuredClone(registry); nextRegistry.episodes.find(x => x.id === '05').status = 'published';
  const next = structuredClone(lesson); next.id = '05'; next.number = 5; next.terms = next.terms.map(t => ({ ...t, id: t.id.replace('04-', '05-') }));
  const all = buildKnowledgeIndex(nextRegistry, new Map([['04', lesson], ['05', next]]));
  assert.equal(all.length, 36);
  assert.deepEqual(searchKnowledge(all, '第5集 根回し').map(x => x.id), ['05-05']);
  const repeated = searchKnowledge(all, '認識を合わせる').filter(x => x.term === '認識を合わせる');
  assert.deepEqual(repeated.map(x => x.episodeId), ['04', '05']);
});
test('out-of-card matches contain a useful original-language context snippet', () => {
  const result = find('API').find(x => x.id === '04-06');
  assert.ok(result.context.text.includes('API'));
  assert.ok(['IT职场例句', '用法说明', '面试问题'].includes(result.context.label));
});
test('safe highlighting preserves original kana and width instead of rewriting text', () => {
  assert.equal(highlightMatches('APIの仕様', 'ａｐｉ'), '<mark>API</mark>の仕様');
  assert.equal(highlightMatches('リスケする', 'りすけ'), '<mark>リスケ</mark>する');
  assert.equal(highlightMatches('ｶﾞｲﾄﾞ', 'ガイ'), '<mark>ｶﾞｲ</mark>ﾄﾞ');
});
test('highlight ranges merge and do not produce nested marks', () => { assert.equal(highlightMatches('認識を合わせる', '認識 認識を'), '<mark>認識を</mark>合わせる'); });
test('HTML-looking user input and matched content cannot inject markup', () => {
  const text = '<img src=x onerror=alert(1)> & 認識';
  const html = highlightMatches(text, '<img');
  assert.ok(!html.includes('<img')); assert.ok(html.includes('&lt;img')); assert.ok(html.includes('&amp;'));
  assert.equal(find('<script>alert(1)</script>').length, 0);
});
test('short context remains unchanged and long context is centered on a match', () => {
  assert.equal(contextSnippet('短い説明', '説明'), '短い説明');
  const long = '前'.repeat(150) + 'API' + '後'.repeat(150);
  const snippet = contextSnippet(long, 'api'); assert.ok(snippet.includes('API')); assert.ok(snippet.length <= 90); assert.ok(snippet.startsWith('…'));
});
test('query tokens are de-duplicated and retain separate words', () => { assert.deepEqual(queryTokens('　API ＡＰＩ 第4集　'), ['api','第4集']); });
test('search markup exposes a labelled keyboard-accessible combobox and listbox', () => {
  const html = searchField();
  assert.ok(html.includes('role="combobox"')); assert.ok(html.includes('aria-autocomplete="list"'));
  assert.ok(html.includes('aria-controls="global-search-results"')); assert.ok(html.includes('role="listbox"'));
  assert.ok(html.includes('maxlength="160"'));
});
test('result markup includes episode and safe highlighted original text', () => {
  const html = resultMarkup(find('認識'), '認識');
  assert.ok(html.includes('第4集')); assert.ok(html.includes('<mark>認識</mark>')); assert.ok(html.includes('role="option"'));
});
