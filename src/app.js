import { STORAGE_KEY, defaults, loadStore, saveStore, sanitizeStore, toggleId, parseRoute, validateLesson, escapeHTML as e } from './core.js';
import { shell, settingsDialog, termList, resultCount, episodeURL } from './views.js';
import { icon } from './icons.js';
import { buildKnowledgeIndex } from './search.js';
import { createGlobalSearch } from './search-ui.js';
const app = document.querySelector('#app');
const dialogRoot = document.querySelector('#dialog-root');
let c, toastTimer, noteTimer, returnFocus, globalSearch;
function toast(text) { const node = document.querySelector('#toast'); node.textContent = text; node.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('visible'), 4000); }
function storage() { try { return window.localStorage; } catch { return { getItem: () => { throw new Error('Storage blocked'); }, setItem: () => { throw new Error('Storage blocked'); } }; } }
function persist() { if (!saveStore(storage(), c.store)) toast('浏览器未允许保存数据。本次更改仍可使用，请导出记录备份。'); }
function applyPreferences() {
  const root = document.documentElement;
  root.dataset.theme = c.store.theme;
  root.classList.toggle('hide-chinese', !c.store.chinese);
  root.classList.toggle('hide-reading', !c.store.reading);
  root.style.setProperty('--reading-size', `${c.store.fontSize}px`);
  const theme = document.querySelector('.topbar [data-action="theme"]');
  if (theme) { const label = c.store.theme === 'light' ? '切换深色模式' : '切换浅色模式'; theme.innerHTML = icon(c.store.theme === 'light' ? 'moon' : 'sun'); theme.setAttribute('aria-label', label); theme.title = label; }
  const d = document.querySelector('#settings-dialog');
  if (d) {
    d.querySelector('[data-action="theme"]').setAttribute('aria-checked', String(c.store.theme === 'dark'));
    d.querySelectorAll('[data-action="preference"]').forEach(b => b.setAttribute('aria-checked', String(c.store[b.dataset.key])));
    d.querySelector('#font-value').textContent = `${c.store.fontSize}px`;
    d.querySelector('[data-delta="-1"]').disabled = c.store.fontSize <= 16;
    d.querySelector('[data-delta="1"]').disabled = c.store.fontSize >= 22;
  }
}
function focusDescriptor() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.dataset.action) return `[data-action="${CSS.escape(el.dataset.action)}"]${el.dataset.id ? `[data-id="${CSS.escape(el.dataset.id)}"]` : ''}${el.dataset.value ? `[data-value="${CSS.escape(el.dataset.value)}"]` : ''}`;
  return null;
}
function render(preserve = true) {
  const scroll = window.scrollY, focus = preserve ? focusDescriptor() : null;
  app.innerHTML = shell(c);
  globalSearch?.mount(app.querySelector('.topbar'));
  applyPreferences();
  const lesson = c.lessons.get(c.route.id);
  document.title = `${c.route.view === 'episodes' ? '全剧课程' : c.route.view === 'saved' ? '我的收藏' : `第${Number(c.route.id)}集${lesson ? ` · ${lesson.title}` : ' · 待整理'}`} | 無能の鷹`;
  if (focus) document.querySelector(focus)?.focus({ preventScroll: true });
  if (preserve) window.scrollTo({ top: scroll, behavior: 'instant' });
}
function visibleTerms() { return c.route.view === 'saved' ? c.allTerms.filter(t => c.store.bookmarks.includes(t.id)) : c.lessons.get(c.route.id)?.terms || []; }
function refreshList() {
  const list = document.querySelector('#term-list');
  if (!list) return;
  list.innerHTML = termList(c, visibleTerms());
  document.querySelector('#results-count').textContent = resultCount(c, visibleTerms());
}
function resetFilters() { c.query = ''; c.category = 'all'; c.filter = 'all'; c.expandAll = false; }
function jumpToTerm(id) {
  if (!c.termMap.has(id)) return;
  globalSearch?.close();
  resetFilters();
  c.expanded.add(id);
  const next = episodeURL(id.split('-')[0], 'read', id);
  if (location.hash === next) onRoute(); else location.hash = next;
}
function beginReview() {
  const terms = c.lessons.get(c.route.id)?.terms || [];
  const pending = terms.filter(t => !c.store.mastered.includes(t.id));
  c.review = { queue: (pending.length ? pending : terms).map(t => t.id), index: 0, flipped: false };
}
function onRoute() {
  globalSearch?.close();
  window.speechSynthesis?.cancel();
  const previous = c.route;
  c.route = parseRoute(location.hash, c.registry);
  if (previous.id !== c.route.id || previous.view !== c.route.view || c.route.term) resetFilters();
  if (c.route.tab === 'review' && (previous.tab !== 'review' || previous.id !== c.route.id)) beginReview();
  if (c.route.term) c.expanded.add(c.route.term);
  document.body.classList.remove('nav-open');
  render(false);
  if (c.route.term) {
    requestAnimationFrame(() => { const target = document.getElementById(`term-${c.route.term}`); if (target) { target.scrollIntoView({ block: 'start' }); target.querySelector('summary')?.focus({ preventScroll: true }); target.classList.add('located'); } else window.scrollTo(0, 0); });
  } else { window.scrollTo(0, 0); document.querySelector('#main')?.focus({ preventScroll: true }); }
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('已复制'); }
  catch {
    const area = document.createElement('textarea'); area.value = text; area.className = 'clipboard-fallback'; document.body.append(area); area.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* Clipboard permission is optional. */ } area.remove(); toast(ok ? '已复制' : '复制未获浏览器授权，请选中文字后手动复制。');
  }
}
function speak(text) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { toast('此浏览器不支持朗读。可以复制例句到设备的朗读工具。'); return; }
  const voice = speechSynthesis.getVoices().find(v => /^ja(?:-|_|$)/i.test(v.lang));
  if (!voice) { toast('当前设备没有可用的日语语音。安装系统日语语音后可使用朗读。'); return; }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ja-JP'; utterance.voice = voice; utterance.rate = 0.88;
  utterance.onerror = event => { if (!['interrupted', 'canceled'].includes(event.error)) toast('朗读未能启动，请检查设备的语音设置。'); };
  speechSynthesis.speak(utterance);
}
function findText(button) {
  const t = c.termMap.get(button.dataset.id); if (!t) return '';
  switch (button.dataset.kind) {
    case 'work': return t.work[Number(button.dataset.index)]?.ja || '';
    case 'interview': return t.interview.ja;
    case 'term': return t.term;
    default: return `${t.term}（${t.reading}）\n${t.meaning}\n\n${t.explanation}\n\n常用搭配\n${t.collocations.join('\n')}\n\nIT职场用法\n${t.work.map(x => `${x.ja}\n${x.zh}`).join('\n\n')}\n\n面试用法（学习改写）\n${t.interview.ja}\n${t.interview.zh}\n\n使用提醒\n${t.tip}`;
  }
}
function closeDialog() { document.querySelector('#settings-dialog')?.close(); dialogRoot.innerHTML = ''; returnFocus?.focus({ preventScroll: true }); }
function openSettings() {
  returnFocus = document.activeElement;
  dialogRoot.innerHTML = settingsDialog(c);
  const d = document.querySelector('#settings-dialog');
  d.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
  d.addEventListener('click', event => { if (event.target === d) { const r = d.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(); } });
  d.showModal();
}
function closeNavigation() { document.body.classList.remove('nav-open'); document.querySelector('#menu-button')?.setAttribute('aria-expanded', 'false'); document.querySelector('#menu-button')?.focus(); }
function exportData() {
  const text = JSON.stringify({ app: 'takano-study', exportedAt: new Date().toISOString(), data: c.store }, null, 2);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `takano-study-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('已导出学习记录');
}
async function importData(file) {
  try {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) throw new Error('文件过大，请选择本站导出的JSON学习记录（不超过2MB）。');
    const raw = JSON.parse(await file.text());
    if (raw.app !== 'takano-study') throw new Error('这不是本站导出的学习记录。');
    const candidate = sanitizeStore(raw.data, c.termMap.keys());
    if (!window.confirm(`将导入 ${candidate.bookmarks.length} 个收藏、${candidate.mastered.length} 个掌握标记和 ${Object.keys(candidate.notes).length} 条例句，并替换当前记录。建议先导出备份。是否继续？`)) return;
    clearTimeout(noteTimer); c.store = candidate; persist(); closeDialog(); render(); toast('已导入学习记录');
  } catch (error) { toast(error instanceof SyntaxError ? 'JSON格式有误，请使用本站导出的学习记录。' : error.message); }
}
function bindEvents() {
  document.addEventListener('click', event => {
    if (event.target.closest('.sidebar a') && document.body.classList.contains('nav-open')) closeNavigation();
    const button = event.target.closest('[data-action]'); if (!button || !c) return;
    const action = button.dataset.action, id = button.dataset.id;
    if (action === 'jump') {
      event.preventDefault(); jumpToTerm(id);
      return;
    }
    switch (action) {
      case 'skip-main': event.preventDefault(); document.querySelector('#main')?.focus(); document.querySelector('#main')?.scrollIntoView(); break;
      case 'menu': document.body.classList.toggle('nav-open'); button.setAttribute('aria-expanded', String(document.body.classList.contains('nav-open'))); if (document.body.classList.contains('nav-open')) document.querySelector('.sidebar a')?.focus(); break;
      case 'close-nav': closeNavigation(); break;
      case 'settings': openSettings(); break;
      case 'close-dialog': closeDialog(); break;
      case 'theme': c.store.theme = c.store.theme === 'light' ? 'dark' : 'light'; persist(); applyPreferences(); break;
      case 'font': c.store.fontSize = Math.min(22, Math.max(16, c.store.fontSize + Number(button.dataset.delta))); persist(); applyPreferences(); break;
      case 'preference': c.store[button.dataset.key] = !c.store[button.dataset.key]; persist(); applyPreferences(); break;
      case 'filter': c.filter = button.dataset.value; document.querySelectorAll('[data-action="filter"]').forEach(b => { b.classList.toggle('active', b.dataset.value === c.filter); b.setAttribute('aria-pressed', String(b.dataset.value === c.filter)); }); refreshList(); break;
      case 'clear-filters': resetFilters(); render(); document.querySelector('#term-search')?.focus(); break;
      case 'expand-all': c.expandAll = !c.expandAll; visibleTerms().forEach(t => c.expandAll ? c.expanded.add(t.id) : c.expanded.delete(t.id)); button.textContent = c.expandAll ? '收起全部' : '展开全部'; refreshList(); break;
      case 'bookmark': if (c.termMap.has(id)) { c.store.bookmarks = toggleId(c.store.bookmarks, id); persist(); render(); toast(c.store.bookmarks.includes(id) ? '已加入我的收藏' : '已取消收藏'); } break;
      case 'master': if (c.termMap.has(id)) { c.store.mastered = toggleId(c.store.mastered, id); persist(); render(); toast(c.store.mastered.includes(id) ? '已标为掌握，继续保持！' : '已改为未掌握'); } break;
      case 'save-note': { const input = document.getElementById(`note-${id}`); if (input) { clearTimeout(noteTimer); const text = input.value.trim(); if (text) c.store.notes[id] = text; else delete c.store.notes[id]; persist(); toast(text ? '个人例句已保存' : '个人例句已清空'); } break; }
      case 'copy': copy(findText(button)); break;
      case 'speak': speak(findText(button)); break;
      case 'share': copy(`${location.href.split('#')[0]}${episodeURL(id.split('-')[0], 'read', id)}`); break;
      case 'toggle-answers': c.hideAnswers = !c.hideAnswers; render(); break;
      case 'highlight-copy': case 'highlight-speak': { const h = c.lessons.get(c.route.id)?.highlights[Number(button.dataset.index)]; if (h) action === 'highlight-copy' ? copy(h.ja) : speak(h.ja); break; }
      case 'flip-review': c.review.flipped = !c.review.flipped; render(); break;
      case 'rate-review': { if (!c.review.flipped) break; const current = c.review.queue[c.review.index]; const known = button.dataset.rating === 'known'; c.store.mastered = known ? [...new Set([...c.store.mastered, current])] : c.store.mastered.filter(x => x !== current); c.review.index++; c.review.flipped = false; persist(); render(); document.querySelector('.review-section h2')?.scrollIntoView({ block: 'start' }); break; }
      case 'restart-review': beginReview(); render(); break;
      case 'export': exportData(); break;
      case 'import': document.querySelector('#import-file')?.click(); break;
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'term-search') { c.query = event.target.value; refreshList(); }
    if (event.target.dataset.note) { const id = event.target.dataset.note; c.store.notes[id] = event.target.value; clearTimeout(noteTimer); noteTimer = setTimeout(persist, 700); }
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'category-filter') { c.category = event.target.value; refreshList(); }
    if (event.target.id === 'import-file') { importData(event.target.files?.[0]); event.target.value = ''; }
  });
  app.addEventListener('toggle', event => { const id = event.target.dataset.term; if (id) event.target.open ? c.expanded.add(id) : c.expanded.delete(id); }, true);
  window.addEventListener('hashchange', onRoute);
  window.addEventListener('storage', event => { if (event.key !== STORAGE_KEY) return; const loaded = loadStore(storage(), c.termMap.keys()); c.store = loaded.store; render(); applyPreferences(); });
  window.addEventListener('pagehide', () => { if (c) { clearTimeout(noteTimer); saveStore(storage(), c.store); } window.speechSynthesis?.cancel(); });
  document.addEventListener('keydown', event => {
    if (!document.body.classList.contains('nav-open')) return;
    if (event.key === 'Escape') closeNavigation();
    if (event.key === 'Tab') { const elements = [...document.querySelectorAll('.sidebar a, .sidebar button')]; const first = elements[0], last = elements.at(-1); if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); } else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); } }
  });
}
async function start() {
  const getJSON = async url => { const response = await fetch(url, { cache: 'no-cache' }); if (!response.ok) throw new Error(`课程文件读取失败（${response.status}）`); return response.json(); };
  const dataURL = new URL('../data/', import.meta.url);
  const registry = await getJSON(new URL('episodes.json', dataURL));
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.episodes) || !registry.episodes.some(x => x.id === registry.defaultEpisode && x.status === 'published')) throw new Error('课程目录格式有误');
  const published = registry.episodes.filter(x => x.status === 'published');
  const pairs = await Promise.all(published.map(async entry => {
    if (!/^episodes\/[\w-]+\.json$/.test(entry.file)) throw new Error('无效的课程文件路径');
    const lesson = await getJSON(new URL(entry.file, dataURL)); validateLesson(lesson, entry); return [entry.id, lesson];
  }));
  const lessons = new Map(pairs), allTerms = pairs.flatMap(([, lesson]) => lesson.terms), termMap = new Map(allTerms.map(t => [t.id, t]));
  const loaded = loadStore(storage(), termMap.keys());
  c = { registry, lessons, allTerms, termMap, store: loaded.store, route: parseRoute(location.hash, registry), query: '', category: 'all', filter: 'all', expanded: new Set([`${registry.defaultEpisode}-01`]), expandAll: false, hideAnswers: false, review: { queue: [], index: 0, flipped: false } };
  if (!location.hash || location.hash === '#main') history.replaceState(null, '', episodeURL(registry.defaultEpisode));
  globalSearch = createGlobalSearch({ index: buildKnowledgeIndex(registry, lessons), onSelect: jumpToTerm });
  bindEvents();
  if (c.route.tab === 'review') beginReview();
  if (c.route.term) c.expanded.add(c.route.term);
  render(false);
  if (c.route.term) requestAnimationFrame(() => document.getElementById(`term-${c.route.term}`)?.scrollIntoView({ block: 'start' }));
  if (loaded.error) toast('无法读取之前的记录，已使用默认设置；请检查浏览器存储权限或导入备份。');
}
start().catch(error => { app.innerHTML = `<main class="boot"><h1>学习内容暂时未能载入</h1><p>${e(error.message)}</p><p>请通过HTTP网站地址打开，而不是直接双击HTML文件。</p><button class="primary-button" id="retry-load">重新载入</button></main>`; document.querySelector('#retry-load').addEventListener('click', () => location.reload()); });
