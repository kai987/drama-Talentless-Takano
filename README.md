# 無能の鷹 · IT职场日语学习笔记

一个清晰、克制、适合长时间阅读的日中双语学习网站。首批收录第4集的18个表达、5句面试重点和完整用法说明；全剧8集采用独立数据文件扩展，未整理内容明确标记为待整理。

## 功能

- 全剧目录、表达精读、面试速记、自测翻卡和跨集收藏。
- 搜索日语、假名、中文及例句；主题、面试推荐、语气注意和未掌握筛选。
- 可展开学习卡：读音、释义、搭配、IT例句及译文、面试改写、使用提醒、个人例句。
- 浅色/深色、16–22px字号、中文译文与假名显示开关；桌面与手机布局。
- 收藏、掌握标记和个人例句保存在当前浏览器；可导出/导入JSON备份，不自动跨设备同步。
- 日语语音依赖浏览器/系统提供的日语声音，不提供原剧音频；设备没有日语声音时会明确提示。
- 原生ES Modules，无第三方运行依赖、CDN字体、数据库或账号系统；页面、数据和路由均兼容GitHub Pages仓库子路径。

## 本地开发

需要Node.js 20或更高版本。无需安装第三方依赖。

```sh
npm run dev          # http://127.0.0.1:4173
npm test             # 数据、搜索、状态、输入安全与路由测试
npm run build        # 校验后复制静态资源到dist/
npm run preview      # 预览dist/，同样使用4173端口
```

开发服务与预览服务不要同时占用同一端口。可通过环境变量`PORT`设置其他端口。不要直接双击`index.html`（file://）；JSON与模块需要HTTP服务。

## GitHub Pages

本仓库已包含`.github/workflows/pages.yml`，每次向main推送时执行测试、验证数据并部署。

首次发布需由仓库管理员在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。连接器无法代替管理员更改这一设置。如果初次部署因Pages未启用而失败，启用后到Actions重新运行工作流。

预期站点地址（只有工作流部署成功后才可访问）：
https://kai987.github.io/drama-Talentless-Takano/

默认进入第4集；直接定位示例：`#/episode/04?term=04-06`。Hash路由不依赖服务器重写，刷新深链接不会产生路径404。

## 新增一集

1. 在`data/episodes/`下新增对应JSON，例如`05.json`，参考`04.json`的结构。
2. 保留唯一的表达ID（例如`05-01`），不要复用或改掉已发布ID，否则本地收藏、笔记和定位链接会失去对应关系。
3. 更新`data/episodes.json`中的集数条目，将`status`从`planned`改为`published`并加入`file: "episodes/05.json"`，填写真实课程标题。
4. 每条表达包含`term/reading/meaning/category/usage/explanation/collocations/work/interview/question/tip/sourceType`。`usage`可取`面试推荐`、`职场常用`、`语气注意`、`理解即可`。所有日中例句均用`{ja,zh}`。
5. 填写该集的`context/notice/sources/highlights/takeaways`；例句默认标记`learning-adaptation`，不要把原创例句称为逐字台词。
6. 运行`npm test && npm run build`，提交后由工作流发布。页面自动载入所有已发布集数，收藏也会按表达ID跨集汇总。

## 目录

```
data/episodes.json       全剧目录与发布状态
data/episodes/04.json    第4集独立学习内容
src/app.js               交互、路由、语音、剪贴板、导入导出
src/core.js              内容验证、筛选、状态净化与存储
src/views.js             语义化视图模板
src/icons.js             本地图标
assets/style.css         阅读设计系统、深色主题与响应式样式
scripts/                 零依赖验证、构建和预览
tests/                   Node原生测试
```

## 内容来源与边界

剧情背景参考电视朝日第4集简介：
https://www.tv-asahi.co.jp/muno_no_taka/story/0004/

第8集为最终集的官方页面：
https://www.tv-asahi.co.jp/muno_no_taka/story/0008/

本项目是非官方学习笔记，不提供视频、完整字幕或原剧音轨。日语例句和面试回答为学习用改写或原创拓展，不是已核实的逐字台词。页面中的N1/N2等仅标为「JLPT参考」，用于学习难度提示，不声称为官方JLPT词汇定级。面试模板必须结合真实经历使用。

## 隐私与数据

学习数据仅保存在浏览器localStorage（`takano-study:v1`）。个人例句输入会短暂延迟自动保存，也可点击保存例句。没有分析追踪或后端上传；设备的语音服务是否联网由操作系统/浏览器实现决定。导出文件可能包含个人笔记，请自行妥善保管。导入经过格式验证并二次确认，之后替换当前本地记录；建议先导出备份。版本1导入时只保留当前已发布课程中的有效表达ID。

## 设计与兼容性

浅灰白/鼠尾草绿、低刺激强调色、细边框、充分行距与留白；不用海报和装饰性大图抢占阅读空间。移动端用抽屉目录，桌面保留课程导航与本集索引。键盘焦点、模态对话框、减少动态偏好和错误提示均有处理。浏览器差异主要在系统日语语音和剪贴板授权；不能保证所有设备都具备日语声音。
