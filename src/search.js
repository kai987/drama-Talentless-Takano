import { normalize, escapeHTML } from './core.js';

/** Pure, in-memory search. Only published lesson content is indexed; never personal notes. */
export function buildKnowledgeIndex(registry, lessons) {
  const records = [];
  for (const entry of registry.episodes) {
    const lesson = lessons.get(entry.id);
    if (entry.status !== 'published' || !lesson) continue;
    const episode = `第${entry.number}集 第${entry.number}话 第${entry.number}話 第${entry.number}回 ep${entry.number} ep${entry.id} episode${entry.number}`;
    for (const term of lesson.terms) {
      const fields = [];
      const add = (text, weight, label, lang = 'zh-CN') => {
        if (typeof text === 'string' && text.trim()) fields.push({ text, normalized: normalize(text), weight, label, lang });
      };
      add(term.term, 120, '表达', 'ja');
      add(term.reading, 100, '读音', 'ja');
      add(term.meaning, 80, '中文释义');
      term.collocations.forEach(text => add(text, 55, '常用搭配', 'ja'));
      add(term.category, 45, '主题');
      add(term.usage, 40, '使用场景');
      add(episode, 25, '所属集数');
      add(term.explanation, 30, '用法说明');
      add(term.question, 30, '面试问题', 'ja');
      term.work.forEach(pair => { add(pair.ja, 35, 'IT职场例句', 'ja'); add(pair.zh, 30, 'IT例句译文'); });
      add(term.interview.ja, 35, '面试回答', 'ja');
      add(term.interview.zh, 30, '面试回答译文');
      add(term.tip, 20, '使用提醒');
      for (const point of lesson.highlights.filter(h => h.termId === term.id)) {
        add(point.ja, 35, '面试速记', 'ja'); add(point.zh, 30, '面试速记译文');
        add(point.question, 30, '面试问题', 'ja'); add(point.label, 35, '面试重点'); add(point.prompt, 20, '练习提示');
      }
      records.push({ id: term.id, term: term.term, reading: term.reading, meaning: term.meaning, episodeId: entry.id, episodeNumber: entry.number, episodeTitle: lesson.title, fields });
    }
  }
  return records;
}

export function queryTokens(query) {
  return [...new Set(String(query).slice(0, 160).normalize('NFKC').trim().split(/\s+/).map(normalize).filter(Boolean))];
}

/** AND between words; rank exact/prefix expression or reading ahead of prose matches. */
export function searchKnowledge(index, query) {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  const results = [];
  for (const record of index) {
    let score = 0, matchesAll = true;
    for (const token of tokens) {
      let best = 0;
      for (const field of record.fields) {
        const position = field.normalized.indexOf(token);
        if (position !== -1) best = Math.max(best, field.weight + (field.normalized === token ? 45 : position === 0 ? 20 : 0));
      }
      if (!best) { matchesAll = false; break; }
      score += best;
    }
    if (!matchesAll) continue;
    const primary = record.fields.slice(0, 3);
    const extraTokens = tokens.filter(t => !primary.some(f => f.normalized.includes(t)));
    const context = record.fields.slice(3).filter(f => f.label !== '所属集数')
      .map(f => ({ ...f, hits: extraTokens.filter(t => f.normalized.includes(t)).length }))
      .filter(f => f.hits).sort((a, b) => b.hits - a.hits || b.weight - a.weight)[0];
    results.push({ ...record, score, context });
  }
  // Do not collapse the same expression from different episodes, or truncate accessible results.
  return results.sort((a, b) => b.score - a.score || a.episodeNumber - b.episodeNumber || a.id.localeCompare(b.id));
}

// Keep original character boundaries for safe width-/kana-insensitive highlighting.
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;
function normalizedMap(text) {
  const segments = segmenter ? [...segmenter.segment(text)] : [...text.matchAll(/\P{M}\p{M}*|\p{M}+/gu)].map(m => ({ segment: m[0], index: m.index }));
  let normalized = ''; const offsets = [];
  for (const { segment, index } of segments) {
    const part = normalize(segment); normalized += part;
    for (let i = 0; i < part.length; i++) offsets.push({ start: index, end: index + segment.length });
  }
  return { normalized, offsets };
}
function matchRanges(text, tokens) {
  const { normalized, offsets } = normalizedMap(text), ranges = [];
  for (const token of tokens) {
    let from = 0, at;
    while ((at = normalized.indexOf(token, from)) !== -1) {
      ranges.push([offsets[at].start, offsets[at + token.length - 1].end]); from = at + token.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  return ranges.reduce((merged, range) => {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]); else merged.push([...range]);
    return merged;
  }, []);
}
export function highlightMatches(text, query) {
  text = String(text);
  const ranges = matchRanges(text, queryTokens(query));
  let html = '', previous = 0;
  for (const [start, end] of ranges) { html += escapeHTML(text.slice(previous, start)) + `<mark>${escapeHTML(text.slice(start, end))}</mark>`; previous = end; }
  return html + escapeHTML(text.slice(previous));
}
export function contextSnippet(text, query, length = 88) {
  if (text.length <= length) return text;
  const first = matchRanges(text, queryTokens(query))[0]?.[0] || 0;
  const start = Math.max(0, first - 18), end = Math.min(text.length, start + length);
  return `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}
