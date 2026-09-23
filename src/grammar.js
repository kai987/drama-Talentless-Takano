import { USAGES } from './core.js';

/** Optional supplement: older episodes and v1 browser records stay compatible. */
export function attachGrammar(lesson, supplement) {
  if (supplement === undefined || supplement === null) return lesson;
  const pair = value => value && ['ja', 'zh'].every(k => typeof value[k] === 'string' && value[k].trim());
  const nonempty = value => typeof value === 'string' && value.trim();
  if (supplement.schemaVersion !== 1 || supplement.episodeId !== lesson.id || !Array.isArray(supplement.items) || !supplement.items.length) throw new Error('语法材料版本或集数不匹配');
  if (![supplement.notice, supplement.levelNotice].every(nonempty) || !Array.isArray(supplement.sources) || !supplement.sources.length) throw new Error('语法材料缺少说明或来源');
  if (!supplement.sources.every(s => nonempty(s.label) && nonempty(s.purpose) && typeof s.url === 'string' && /^https:\/\//.test(s.url))) throw new Error('语法来源必须为HTTPS链接');
  const vocabIds = new Set(lesson.terms.map(t => t.id));
  const ids = new Set(vocabIds);
  for (const g of supplement.items) {
    if (typeof g.id !== 'string' || !new RegExp(`^${lesson.id}-g[0-9]{2}$`).test(g.id) || ids.has(g.id) || g.type !== 'grammar') throw new Error(`无效或重复的语法ID：${g.id}`);
    ids.add(g.id);
    if (!['term', 'reading', 'meaning', 'category', 'explanation', 'question', 'tip', 'contrast'].every(k => nonempty(g[k]))) throw new Error(`${g.id} 缺少语法讲解`);
    if (!USAGES.includes(g.usage) || g.sourceType !== 'learning-adaptation' || !pair(g.interview) || !Array.isArray(g.work) || !g.work.length || !g.work.every(pair)) throw new Error(`${g.id} 缺少双语用例`);
    if (!Array.isArray(g.connections) || !g.connections.length || !g.connections.every(pair) || !Array.isArray(g.collocations) || !g.collocations.length || !g.collocations.every(nonempty)) throw new Error(`${g.id} 缺少接续规则`);
    if (!pair(g.related) || !vocabIds.has(g.related.termId)) throw new Error(`${g.id} 关联的词汇不存在`);
    if (!g.jlptRef || g.jlptRef.kind !== 'jlpt' || !nonempty(g.jlptRef.label) || !nonempty(g.jlptRef.note)) throw new Error(`${g.id} 缺少非官方难度参考`);
  }
  return { ...lesson, grammar: supplement.items, grammarNotice: supplement.notice, grammarLevelNotice: supplement.levelNotice, grammarSources: supplement.sources };
}

export function grammarCardText(g) {
  const pairs = values => values.map(p => `${p.ja}\n${p.zh}`).join('\n\n');
  return `${g.term}（${g.reading}）\n${g.meaning}\nJLPT参考：${g.jlptRef.label}（非官方定级）\n\n${g.explanation}\n\n接续\n${pairs(g.connections)}\n\n学习笔记相关例句（非逐字台词）\n${pairs([g.related])}\n\nIT职场例句\n${pairs(g.work)}\n\n面试表达\n${pairs([g.interview])}\n\n易混辨析\n${g.contrast}\n\n使用提醒\n${g.tip}`;
}
