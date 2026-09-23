# 按集扩展语法学习

第4集新增12个语法点，保留原有18个词汇表达与所有稳定ID。语法接入同一套收藏、掌握标记、个人例句、备份与朗读控制器。

## 内容与路由

- `data/episodes.json` 的已发布集数可以添加可选 `grammarFile: "grammar/04.json"`。
- `data/grammar/04.json` 是独立语法材料；未配置 `grammarFile` 的集数仍可正常阅读，语法页显示待整理。
- 语法页：`#/episode/04?tab=grammar`。
- 语法定位：`#/episode/04?tab=grammar&term=04-g06`。原词汇定位格式不变。
- 语法自测：`#/episode/04?tab=review&scope=grammar`。`scope=terms` 和 `scope=all` 分别练习词汇和全部知识点。

## 新增语法文件

顶层字段：`schemaVersion: 1`、`episodeId`、`notice`、`levelNotice`、`sources`、`items`。

每个语法条目使用唯一且稳定的ID，例如 `05-g01`，并设置 `type: "grammar"`。除通用学习卡的 `term/reading/meaning/category/usage/explanation/collocations/work/interview/question/tip/jlptRef/sourceType` 外，还要有：

- `connections: [{ja,zh}]`：具体接续及中文解释。
- `related: {termId,ja,zh}`：对应本集已发布词汇的ID，以及学习笔记相关例句。不是原剧逐字台词。
- `contrast`：易混辨析，注意同形异义用法。

`work`、`interview` 和 `connections` 都保留日中双语。`jlptRef` 仅表示学习难度建议，不声称官方定级。顶部搜索会索引语法、接续、例句和易混说明，并在结果中显示「语法／词汇」。不索引个人笔记。

## 验证

`npm test` 自动运行新增的 `tests/grammar.test.mjs` 和原有测试。`npm run build` 同时校验所有已发布词汇文件及可选语法文件：错误ID、重复ID、错误集数、无效来源、无效词汇关联、缺失译文或接续都会阻止发布。

## 兼容性

浏览器记录仍使用 `takano-study:v1`，无需清空旧记录。校验有效ID时同时包含词汇与语法。以后扩充内容请保留现有ID；旧备份导入仍是替换当前记录，应先导出新备份。语法朗读使用既有浏览器语音控制器，支持播放→暂停→继续；无日语声音时会提示。实际声音与浏览器权限需在使用设备上确认。
