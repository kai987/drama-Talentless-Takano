export const STORAGE_KEY = 'takano-study:v1';
export const USAGES = ['面试推荐', '职场常用', '语气注意', '理解即可'];
export const defaults = () => ({ version: 1, theme: 'light', fontSize: 18, chinese: true, reading: true, bookmarks: [], mastered: [], notes: {} });

export function normalize(text = '') {
  return String(text).normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/\s+/g, '');
}
export function filterTerms(terms, { query = '', category = 'all', filter = 'all' } = {}, store = defaults()) {
  const q = normalize(query);
  return terms.filter(t => {
    if (category !== 'all' && t.category !== category) return false;
    if (filter === 'interview' && t.usage !== '面试推荐') return false;
    if (filter === 'caution' && !['语气注意', '理解即可'].includes(t.usage)) return false;
    if (filter === 'unmastered' && store.mastered.includes(t.id)) return false;
    if (filter === 'saved' && !store.bookmarks.includes(t.id)) return false;
    return !q || normalize([t.term, t.reading, t.meaning, t.category, t.explanation, t.jlptRef?.label || '', t.jlptRef?.note || '', ...t.collocations, ...t.work.flatMap(x => [x.ja, x.zh]), t.interview.ja, t.interview.zh].join(' ')).includes(q);
  });
}
export function sanitizeStore(raw, validIds) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) throw new Error('不支持的学习记录格式，请导入本站导出的版本1 JSON文件。');
  const s = defaults();
  const ids = validIds instanceof Set ? validIds : new Set(validIds);
  const array = value => Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string' && ids.has(x)))] : [];
  s.bookmarks = array(raw.bookmarks);
  s.mastered = array(raw.mastered);
  s.theme = raw.theme === 'dark' ? 'dark' : 'light';
  s.fontSize = Number.isFinite(raw.fontSize) ? Math.min(22, Math.max(16, Math.round(raw.fontSize))) : 18;
  s.chinese = typeof raw.chinese === 'boolean' ? raw.chinese : true;
  s.reading = typeof raw.reading === 'boolean' ? raw.reading : true;
  if (raw.notes && typeof raw.notes === 'object' && !Array.isArray(raw.notes)) {
    for (const [id, note] of Object.entries(raw.notes)) if (ids.has(id) && typeof note === 'string') s.notes[id] = note.slice(0, 5000);
  }
  return s;
}
export function loadStore(storage, validIds) {
  try { const raw = storage.getItem(STORAGE_KEY); return { store: raw ? sanitizeStore(JSON.parse(raw), validIds) : defaults(), error: false }; }
  catch { return { store: defaults(), error: true }; }
}
export function saveStore(storage, store) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(store)); return true; } catch { return false; }
}
export function toggleId(array, id) { return array.includes(id) ? array.filter(x => x !== id) : [...array, id]; }
export function escapeHTML(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
export function parseRoute(hash, registry) {
  const [path, search = ''] = hash.replace(/^#\/?/, '').split('?');
  const [view, id] = path.split('/');
  if (view === 'episodes' || view === 'saved') return { view, id: null, tab: 'read', term: null };
  const episode = registry.episodes.find(e => e.id === id);
  const params = new URLSearchParams(search);
  const tab = ['read', 'interview', 'review'].includes(params.get('tab')) ? params.get('tab') : 'read';
  return { view: 'episode', id: episode ? episode.id : registry.defaultEpisode, tab, term: params.get('term') };
}
export function validateLesson(lesson, entry) {
  if (lesson.schemaVersion !== 1 || lesson.id !== entry.id || lesson.number !== entry.number) throw new Error(`课程标识不匹配：${entry.id}`);
  for (const key of ['title', 'japaneseTitle', 'description', 'context', 'notice']) if (typeof lesson[key] !== 'string' || !lesson[key].trim()) throw new Error(`缺少 ${key}`);
  if (!Array.isArray(lesson.terms) || !lesson.terms.length || !Array.isArray(lesson.highlights) || !Array.isArray(lesson.sources) || !Array.isArray(lesson.takeaways)) throw new Error('课程结构不完整');
  const ids = new Set();
  const pair = p => p && typeof p.ja === 'string' && p.ja.trim() && typeof p.zh === 'string' && p.zh.trim();
  for (const t of lesson.terms) {
    if (typeof t.id !== 'string' || !t.id.startsWith(`${entry.id}-`) || ids.has(t.id)) throw new Error(`重复或无效的表达ID：${t.id}`);
    ids.add(t.id);
    for (const key of ['term', 'reading', 'meaning', 'category', 'explanation', 'tip', 'question']) if (typeof t[key] !== 'string' || !t[key].trim()) throw new Error(`${t.id} 缺少 ${key}`);
    if (!USAGES.includes(t.usage) || t.sourceType !== 'learning-adaptation' || !pair(t.interview) || !Array.isArray(t.work) || !t.work.length || !t.work.every(pair) || !Array.isArray(t.collocations) || !t.collocations.length || !t.collocations.every(x => typeof x === 'string')) throw new Error(`${t.id} 用例或来源标记无效`);
    if (!t.jlptRef || !['jlpt', 'workplace'].includes(t.jlptRef.kind) || typeof t.jlptRef.label !== 'string' || !t.jlptRef.label.trim() || typeof t.jlptRef.note !== 'string' || !t.jlptRef.note.trim()) throw new Error(`${t.id} 缺少有效的JLPT参考信息`);
  }
  if (!lesson.highlights.every(h => ids.has(h.termId) && pair(h) && typeof h.question === 'string' && typeof h.prompt === 'string')) throw new Error('面试重点引用无效');
  if (!lesson.sources.every(s => typeof s.label === 'string' && typeof s.url === 'string' && /^https:\/\//.test(s.url))) throw new Error('来源链接必须使用HTTPS');
  return true;
}
