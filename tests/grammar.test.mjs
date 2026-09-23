import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attachGrammar, grammarCardText } from '../src/grammar.js';
import { defaults, lessonItems, reviewItems, sanitizeStore, parseRoute, filterTerms, validateLesson } from '../src/core.js';
import { buildKnowledgeIndex, searchKnowledge } from '../src/search.js';
import { mainView, episodeURL } from '../src/views.js';
import { resultMarkup } from '../src/search-ui.js';
const json = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const base = await json('../data/episodes/04.json');
const supplement = await json('../data/grammar/04.json');
const registry = await json('../data/episodes.json');
const lesson = attachGrammar(base, supplement);
const index = buildKnowledgeIndex(registry, new Map([['04', lesson]]));
const context = () => ({ registry, lessons: new Map([['04', lesson]]), allTerms: lessonItems(lesson), route: { view: 'episode', id: '04', tab: 'grammar', scope: 'terms' }, store: defaults(), query: '', category: 'all', filter: 'all', expanded: new Set(['04-g01']), review: { queue: ['04-g01'], index: 0, flipped: false } });

test('18 vocabulary items are preserved, with 12 separate grammar items', () => { assert.equal(base.terms.length, 18); assert.equal(lesson.grammar.length, 12); assert.equal(lessonItems(lesson).length, 30); assert.equal(new Set(lessonItems(lesson).map(t => t.id)).size, 30); assert.deepEqual(lesson.terms, base.terms); });
test('grammar source data is optional and does not mutate older lessons', () => { assert.equal(attachGrammar(base), base); assert.equal(base.grammar, undefined); assert.equal(lessonItems(base).length, 18); assert.deepEqual(lessonItems(undefined), []); });
test('registry points to the separate grammar file', () => assert.equal(registry.episodes.find(x => x.id === '04').grammarFile, 'grammar/04.json'));
test('all 12 requested grammar points have connections, bilingual examples and interview uses', () => { assert.deepEqual(lesson.grammar.map(x => x.id), Array.from({length:12}, (_,i)=>`04-g${String(i+1).padStart(2,'0')}`)); for (const g of lesson.grammar) { assert.ok(g.connections.length); assert.equal(g.work.length, 2); assert.ok(g.interview.ja && g.interview.zh && g.related.ja && g.contrast); } });
test('supplement marks learning adaptation and non-official levels', () => { assert.ok(supplement.notice.includes('不是逐字字幕')); assert.ok(supplement.levelNotice.includes('不是官方定级')); assert.ok(supplement.items.every(g=>g.sourceType==='learning-adaptation'&&g.jlptRef.note.includes('不是JLPT官方'))); });
test('each related example exists verbatim in the previously published learning notes', () => { for (const g of supplement.items) { const v=base.terms.find(t=>t.id===g.related.termId); assert.ok(v.work.concat(v.interview).some(p=>p.ja===g.related.ja),g.id); } });
for (const [name, mutate] of [
 ['wrong episode', s=>s.episodeId='05'],
 ['wrong schema', s=>s.schemaVersion=999],
 ['duplicate ID', s=>s.items.push(s.items[0])],
 ['invalid ID', s=>s.items[0].id='04-x01'],
 ['wrong kind', s=>s.items[0].type='vocabulary'],
 ['missing connection', s=>s.items[0].connections=[]],
 ['missing translation', s=>delete s.items[0].interview.zh],
 ['unknown reference', s=>s.items[0].related.termId='04-99'],
 ['unsafe source', s=>s.sources[0].url='javascript:alert(1)'],
 ['missing level note', s=>delete s.items[0].jlptRef.note]
]) test(`supplement rejects ${name}`, () => { const s=structuredClone(supplement);mutate(s);assert.throws(()=>attachGrammar(base,s)); });
test('original vocabulary validation still passes', () => assert.equal(validateLesson(base,registry.episodes.find(e=>e.id==='04')),true));
test('old v1 records and new grammar bookmarks coexist without migration', () => { const state={...defaults(),bookmarks:['04-01','04-g01'],mastered:['04-02','04-g02'],notes:{'04-01':'旧例句','04-g01':'新的个人例句'}}; assert.deepEqual(sanitizeStore(state,lessonItems(lesson).map(t=>t.id)),state); });
test('grammar deep links resolve to the new tab; vocabulary links stay unchanged', () => { assert.equal(episodeURL('04','read','04-06'),'#/episode/04?term=04-06');assert.equal(episodeURL('04','read','04-g06'),'#/episode/04?tab=grammar&term=04-g06');assert.equal(parseRoute('#/episode/04?term=04-g06',registry).tab,'grammar');assert.equal(parseRoute('#/episode/04?tab=grammar',registry).tab,'grammar'); });
test('review scope can be refreshed and keeps grammar separate from vocabulary', () => { const route=parseRoute('#/episode/04?tab=review&scope=grammar',registry);assert.equal(route.tab,'review');assert.equal(route.scope,'grammar');assert.equal(reviewItems(lesson,route.scope).length,12);assert.equal(reviewItems(lesson).length,18);assert.equal(reviewItems(lesson,'all').length,30);assert.equal(reviewItems(base,'grammar').length,0); });
test('global index includes both types, without indexing planned episodes', () => { assert.equal(index.length,30);assert.equal(index.filter(x=>x.type==='grammar').length,12);assert.ok(index.every(x=>x.episodeId==='04')); });
test('global autocomplete searches Japanese, kana, Chinese, connections and types', () => { for (const q of ['に応じて','におうじて','相应调整','名詞 に応じて','第4集 语法 N2']) assert.ok(searchKnowledge(index,q).some(x=>x.id==='04-g06'),q); });
test('local grammar search matches conjugation rules and contrasts', () => { assert.ok(filterTerms(lesson.grammar,{query:'辞書形'}).some(x=>x.id==='04-g02'));assert.ok(filterTerms(lesson.grammar,{query:'传闻'}).some(x=>x.id==='04-g12')); });
test('search results identify grammar separately from vocabulary', () => { const html=resultMarkup(searchKnowledge(index,'に応じて'),'に応じて');assert.ok(html.includes('第4集 · 语法')); });
test('future published episodes can add optional grammar without UI changes', () => { const b=structuredClone(base);b.id='05';b.number=5;b.terms.forEach(t=>t.id=t.id.replace('04-','05-'));const s=structuredClone(supplement);s.episodeId='05';s.items.forEach(t=>{t.id=t.id.replace('04-','05-');t.related.termId=t.related.termId.replace('04-','05-')});const l=attachGrammar(b,s);const r=structuredClone(registry);Object.assign(r.episodes[4],{status:'published',file:'episodes/05.json',grammarFile:'grammar/05.json'});assert.equal(buildKnowledgeIndex(r,new Map([['04',lesson],['05',l]])).filter(x=>x.type==='grammar').length,24); });
test('grammar view contains all sections and can render an older episode without grammar', () => { const c=context();const html=mainView(c); for(const text of ['语法整理','接续怎么用','本集学习笔记例句','易混辨析','面试这样说','非逐字台词','语法自测']) assert.ok(html.includes(text),text);c.lessons.set('04',base);assert.ok(mainView(c).includes('本集语法尚未整理')); });
test('saved grammar cards, hidden translations and hostile notes render safely', () => { const c=context();c.route.view='saved';c.store.bookmarks=['04-g01'];c.store.notes['04-g01']='<script>bad()</script>';const html=mainView(c);assert.ok(html.includes('04-g01'));assert.ok(html.includes('接续怎么用'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>bad')); });
test('grammar review includes connection after flipping, not before', () => { const c=context();c.route.tab='review';c.route.scope='grammar';assert.ok(!mainView(c).includes('class="review-connection"'));c.review.flipped=true;assert.ok(mainView(c).includes('class="review-connection"')); });
test('copying a grammar card includes connections, related examples, contrasts and reference disclaimer', () => { const text=grammarCardText(lesson.grammar[0]);for(const t of ['接续','学习笔记相关例句','非逐字台词','非官方定级','易混辨析']) assert.ok(text.includes(t)); });
