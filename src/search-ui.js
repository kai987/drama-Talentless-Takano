import { escapeHTML as e } from './core.js';
import { icon } from './icons.js';
import { searchKnowledge, highlightMatches as mark, contextSnippet } from './search.js';

export function searchField(shortcut = 'Ctrl K') {
  return `<div class="global-search" role="search" aria-label="跨集知识点搜索">
    <div class="global-search-field">
      ${icon('search')}<label class="sr-only" for="global-search-input">搜索全部剧集的知识点</label>
      <input id="global-search-input" type="search" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="global-search-results" aria-describedby="global-search-help" placeholder="搜索全部剧集的知识点…" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="160" enterkeyhint="go">
      <kbd class="global-search-shortcut" aria-hidden="true">${e(shortcut)}</kbd>
      <button type="button" class="global-search-clear" aria-label="清空跨集搜索" title="清空搜索" hidden>${icon('close')}</button>
    </div>
    <div class="global-search-popup" hidden>
      <div class="global-search-heading"><strong>全剧知识点</strong><span class="global-search-count"></span></div>
      <ul id="global-search-results" class="global-search-results" role="listbox" aria-label="知识点联想结果"></ul>
      <div class="global-search-empty"></div>
      <div class="global-search-footer"><span>↑ ↓ 选择 · Enter 打开 · Esc 收起</span><span>仅搜索已整理内容</span></div>
    </div>
    <span id="global-search-help" class="sr-only">输入日语、假名或中文。上下方向键选择，回车跳转到对应剧集的知识点，Escape关闭。</span>
    <span class="sr-only global-search-status" role="status" aria-live="polite" aria-atomic="true"></span>
  </div>`;
}

export function resultMarkup(results, query) {
  return results.map((r, i) => `<li id="global-search-option-${i}" role="option" aria-selected="false" tabindex="-1" data-search-index="${i}">
    <div class="global-result-heading"><strong lang="ja">${mark(r.term, query)}</strong><span class="global-result-episode">第${r.episodeNumber}集 · ${r.type === 'grammar' ? '语法' : '词汇'}</span></div>
    <p class="global-result-reading" lang="ja">${mark(r.reading, query)}</p>
    <p class="global-result-meaning">${mark(r.meaning, query)}</p>
    ${r.context ? `<p class="global-result-context"><span>${e(r.context.label)}</span><span lang="${e(r.context.lang)}">${mark(contextSnippet(r.context.text, query), query)}</span></p>` : ''}
  </li>`).join('');
}

/** A self-contained combobox; remounts when the existing app replaces its shell. */
export function createGlobalSearch({ index, onSelect }) {
  let root, input, popup, list, status, fieldAbort;
  let query = '', results = [], active = -1, open = false, composing = false, compositionEnded = -Infinity;
  const globalAbort = new AbortController();
  const episodeCount = new Set(index.map(r => r.episodeId)).size;
  const shortcut = /Mac|iPhone|iPad/i.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

  function updateActive(scroll = false) {
    list.querySelectorAll('[role="option"]').forEach((node, i) => node.setAttribute('aria-selected', String(i === active)));
    if (open && active >= 0) input.setAttribute('aria-activedescendant', `global-search-option-${active}`);
    else input.removeAttribute('aria-activedescendant');
    const option = list.children[active];
    if (scroll && option) {
      // Scroll only the suggestion list, never move the reading page behind it.
      const item = option.getBoundingClientRect(), viewport = list.getBoundingClientRect();
      if (item.top < viewport.top) list.scrollTop -= viewport.top - item.top;
      else if (item.bottom > viewport.bottom) list.scrollTop += item.bottom - viewport.bottom;
    }
  }
  function update() {
    if (!root?.isConnected) return;
    input.value = query;
    root.querySelector('.global-search-clear').hidden = !query;
    root.querySelector('.global-search-shortcut').hidden = Boolean(query);
    popup.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    if (!open) { input.removeAttribute('aria-activedescendant'); return; }
    results = searchKnowledge(index, query);
    list.innerHTML = resultMarkup(results, query);
    list.hidden = !results.length;
    const hasQuery = Boolean(query.trim());
    root.querySelector('.global-search-count').textContent = hasQuery ? `${results.length} 个匹配` : `${episodeCount} 集 · ${index.length} 个知识点`;
    const empty = root.querySelector('.global-search-empty');
    empty.hidden = Boolean(results.length);
    empty.innerHTML = hasQuery
      ? '<strong>没有找到匹配的知识点</strong><p>试试更短的关键词，或换成日语读音、中文释义。未整理的剧集暂不参与搜索。</p>'
      : '<strong>从一句话，找到整集的学习笔记。</strong><p>输入日语、假名、中文或例句关键词，例如「認識」「にんしき」「提前」。也支持「第4集 API」这样的组合。</p>';
    status.textContent = hasQuery ? `找到${results.length}个知识点${results.length ? '，可用上下方向键选择，回车打开。' : '。请更换关键词。'}` : `可搜索${episodeCount}集、${index.length}个已整理知识点。`;
    active = results.length ? 0 : -1;
    list.scrollTop = 0;
    updateActive();
  }
  function close() { open = false; if (input) { input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); popup.hidden = true; status.textContent = ''; } }
  function show() { open = true; update(); }
  function choose(position) {
    const result = results[position];
    if (!result || composing) return;
    close(); onSelect(result.id);
  }
  function onKey(event) {
    if (composing || event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' && performance.now() - compositionEnded < 100) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const wasOpen = open;
      if (!wasOpen) show();
      if (results.length) {
        active = !wasOpen ? (event.key === 'ArrowDown' ? 0 : results.length - 1) : (active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        updateActive(true);
      }
    } else if (event.key === 'Enter' && open) { event.preventDefault(); choose(active); }
    else if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === 'Tab') close();
  }
  function mount(topbar) {
    fieldAbort?.abort(); fieldAbort = new AbortController();
    topbar.querySelector('.global-search')?.remove();
    topbar.querySelector('.topbar-actions').insertAdjacentHTML('beforebegin', searchField(shortcut));
    root = topbar.querySelector('.global-search'); input = root.querySelector('input');
    popup = root.querySelector('.global-search-popup'); list = root.querySelector('[role="listbox"]'); status = root.querySelector('[role="status"]');
    composing = false;
    const listen = (node, type, fn) => node.addEventListener(type, fn, { signal: fieldAbort.signal });
    listen(input, 'focus', show);
    listen(input, 'click', () => { if (!open && !composing) show(); });
    listen(input, 'input', event => { query = input.value; if (composing || event.isComposing) return; show(); });
    listen(input, 'compositionstart', () => { composing = true; close(); });
    listen(input, 'compositionend', () => { composing = false; compositionEnded = performance.now(); query = input.value; show(); });
    listen(input, 'keydown', onKey);
    listen(root.querySelector('.global-search-clear'), 'click', () => { query = ''; input.focus(); show(); });
    listen(list, 'pointerdown', event => { if (event.pointerType === 'mouse' && event.button === 0) event.preventDefault(); });
    listen(list, 'pointermove', event => { const option = event.target.closest('[data-search-index]'); if (event.pointerType === 'mouse' && option) { active = Number(option.dataset.searchIndex); updateActive(); } });
    listen(list, 'click', event => { const option = event.target.closest('[data-search-index]'); if (option) choose(Number(option.dataset.searchIndex)); });
    listen(root, 'focusout', event => { if (!root.contains(event.relatedTarget)) close(); });
    update();
  }
  document.addEventListener('pointerdown', event => { if (root && !root.contains(event.target)) close(); }, { signal: globalAbort.signal });
  document.addEventListener('keydown', event => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'k' || event.isComposing) return;
    if (document.querySelector('dialog[open]') || document.body.classList.contains('nav-open')) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"]') && event.target !== input) return;
    if (input?.isConnected) { event.preventDefault(); input.focus(); input.select(); show(); }
  }, { signal: globalAbort.signal });
  return { mount, close, dispose() { fieldAbort?.abort(); globalAbort.abort(); root?.remove(); } };
}
