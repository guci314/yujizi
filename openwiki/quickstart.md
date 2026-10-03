---
type: quickstart
title: 快速上手 · 玉机子站点 wiki 任务路由
description: 玉机子站点 wiki 的入口页：一段话说明仓库是什么（Jekyll 静态站 + 单音频播放器 + 留言板 + 约 3GB 音频资产），一条首次进仓库必须知道的排除清单事实，再把「我想做什么」按任务路由到 architecture / concepts / workflows / operations / integrations / testing 各域页面。
tags: [quickstart, navigation, onboarding, jekyll, static-site]
verified:
  - by: openwiki/0.6.1
    at: 2026-10-03T20:09:52.778Z
sources:
  - id: openwiki-source-96432c8187f1a2124a5afef3
    resource: repo://_config.yml
  - id: openwiki-source-2541a15ff5d50edee2a34c60
    resource: repo://_includes/comments.html
  - id: openwiki-source-4dc0bb289797b45f07ad9b03
    resource: repo://_layouts/music.html
  - id: openwiki-source-6d4b4e707b8d60b6ccfa3425
    resource: repo://.github/workflows/openwiki-update.yml
  - id: openwiki-source-ea70eb6c045047448e446296
    resource: repo://.gitignore
  - id: openwiki-source-e119253b3c3737247dc63f2a
    resource: repo://.openwikiignore
  - id: openwiki-source-7f59378ca30c58e80e8a6d71
    resource: repo://%E9%98%B4%E7%AC%A6%E7%BB%8F.html
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-4d323772649941a55df7f8cd
    resource: repo://CNAME
  - id: openwiki-source-c7c19908357d462241152c8e
    resource: repo://js/comments.js
  - id: openwiki-source-8fa15873f65dfeeb271629c9
    resource: repo://js/keepalive.js
  - id: openwiki-source-e83fc3cbbf9ca4d4da0bff22
    resource: repo://js/musicplayer.js
  - id: openwiki-source-abd217e3e511bdf99a711e7f
    resource: repo://local-test.html
generated: { by: "openwiki/0.6.1", at: "2026-10-03T20:09:52.778Z" }
---

# 快速上手 · 玉机子站点 wiki 任务路由

## 这个仓库是什么

这是一台部署在 GitHub Pages 上的 **Jekyll 静态站**（生产域名 `www.yujizi.org`，见仓库根的 [CNAME](../CNAME)、[_config.yml](../_config.yml)），内容是一批讲经与读诵页面加上它们在浏览器里的播放器，另有约 3GB 讲经音频入库。它**没有构建脚本、没有依赖清单、没有测试框架、没有 lint**：改文件即生效，[.github/workflows/openwiki-update.yml](../.github/workflows/openwiki-update.yml) 是仓库里唯一的自动化，而它只维护这份 wiki，不检查站点。四层边界如下：

| 层 | 拥有什么 | 关键入口 |
|---|---|---|
| 内容页 | 每个 `.html` 的 front matter（`title` / `layout` / `permalink` / `hide_title`）与正文，含正文里定义 `pageid` / `musicList` 的内联脚本 | [index.html](../index.html)、[阴符经.html](../阴符经.html)、[道德经.html](../道德经.html) … |
| Jekyll 布局与包含 | 站点外壳、主题切换、播放器 DOM、留言板挂载点、构建配置 | [_layouts/default.html](../_layouts/default.html)、[_layouts/music.html](../_layouts/music.html)、[_includes/comments.html](../_includes/comments.html)、[_config.yml](../_config.yml) |
| 浏览器端运行时 | 播放状态机、长亮锁、留言板读写、黑匣子日志，以及遗留的旧多音频实现 | [js/musicplayer.js](../js/musicplayer.js)、[js/keepalive.js](../js/keepalive.js)、[js/comments.js](../js/comments.js)、[js/yujizi.js](../js/yujizi.js) |
| 仓库外服务 | 托管与服务端 Jekyll 构建、边缘缓存与 `/api/*` 路由、留言后端 Worker、APK 分发、wiki 自动更新 | GitHub Pages、Cloudflare、[GitHub Releases](https://github.com/guci314/yujizi/releases/tag/v1.0.0) |

只有一块播放器 —— 每个讲经页在自己的内联脚本里声明 `musicList`，布局把这些曲目填进共用的 `<select id="music-select">`，全部页面共用同一个 `<audio id="music-player">`；页面之间彼此独立，靠页内声明的 `pageid` 决定 `localStorage` 键前缀。四层之间的接缝**没有任何构建期校验**，失效方式一律是静默的。

> **首次进仓库需要知道的一件事**：[.openwikiignore](../.openwikiignore) 把音频目录（`玉机子/`、`经典读诵/`、`体真山人语录/`、`downloads/`）与 `*.mp3`、`*.m4a`、`*.apk`、`*.doc`、`*.docx` 全部排除在 wiki 生成范围之外；同一份清单还排除了 `css/bootstrap*`、`js/jquery-3.2.1.slim.min.js`、`js/vendor/` 等 vendor 代码与 `_site/`。**OpenWiki 不读 `.gitignore`，只读 `.openwikiignore`**，所以这两件事互不相干：音频**必须在 git 里**（移出去会让本地与远端再次分叉）、**必须在 wiki 之外**（否则生成会去读 GB 级二进制）。被排除的媒体文件内容不可阅读，wiki 里能看到的只有引用它们的路径；提到 `css/bootstrap.min.css` 一类文件时，也都要理解为「由别处加载进来的第三方件」，不是本项目代码。

## 按任务路由

### 我想理解整体结构

- [系统全景与仓库边界](architecture/overview.md) —— **第一次接触这个仓库从这页开始**：四层边界各自拥有哪些文件与目录、两份忽略清单排除什么及为什么、以及一张「想改 X 该动哪些文件」的落点索引。
- [站点构建、布局装配与部署形态](architecture/site-build-and-deploy.md) —— 一个页面从 front matter 到 URL 的完整装配路径，以及 GitHub Pages + CNAME + Cloudflare 的部署事实。

### 我想改播放器行为

- [布局与前端 DOM/脚本契约](architecture/layout-and-frontend-contract.md) —— **动手前必读**。这里记着那份没人校验的隐式契约：`music-select`、`music-player`、`play-mode`、`myselect`、`remainTime`、`music-download` 这些 id，`pageid` / `musicList` 两个全局，行内 `onclick` 依赖的全局函数，以及脚本加载顺序的硬约束。改 id 或调脚本标签顺序而不读这页，失效是静默的。
- [播放器状态机：播放意图、转场与暂停归因](concepts/player-state-machine.md) —— `pPlayIntent`、`ptrans`、`pExpectedPause`、`pUserPausedUntil`、`pRetry` 与三种播放模式的关系，以及四处「改回去就会静默失效」的反向守卫。
- [连续播放转场全流程](workflows/continuous-playback-transition.md) —— 「一首播完切下一首」端到端经过哪些函数，成功判据为什么是「播放头推进超过 0.5 秒」，以及预取与「时长 0」看门狗。
- [失败恢复与自愈路径](workflows/playback-recovery-and-selfhealing.md) —— 重试阶梯、`error` 自救、两条 `visible-resume`、45 秒看门狗、10 秒「时长 0」看门狗分别何时触发、何时**不**触发。
- [定时关闭与「剩余」时间显示](workflows/timed-stop-and-remaining-time.md) —— 两个停止源如何合成一个 `#remainTime` 读数，`stopAudio(reason)` 作为终态撤销了什么。

### 我想改息屏 / 屏幕长亮逻辑

- [息屏连续播放与屏幕长亮锁](workflows/screen-off-continuous-playback.md) —— 这块最容易改坏：`wakeLock('screen')` 如何靠意图轮询与锁复查维持、为什么策略是「消除熄屏这个触发条件」、以及已明确删除且**不得加回**的 Web Audio 静音导频。

### 我想改样式或主题

- [水墨清静设计系统与主题机制](concepts/design-system.md) —— `style.css` 的令牌体系、`[data-theme="dark"]` 同名覆盖、`localStorage` 键 `yjz-theme` 的持久化与防闪内联脚本、Bootstrap 中和层，以及「新样式只允许用 `var(--*)`」这条铁律。

### 我想加一页讲经

- [讲经页内容模型（pageid / musicList）](concepts/audio-page-model.md) —— front matter 怎么写、内联脚本里的 `pageid` 与 `musicList` 各自决定什么、`pageid` 唯一性为什么只能靠人保证，以及原文页与讲经页之间的互链模式。
- 加音频资产本身涉及体积与版本控制约定：[静态资源、音频资产与缓存击穿约定](operations/assets-and-cache-busting.md) —— 音频已纳入版本控制，**绝不能加回 `.gitignore`**。

### 我想改留言板

- [留言板读写往返与失败分支](workflows/comments-roundtrip.md) —— `data-api` / `data-page` 配置、GET/POST 形状、蜜罐字段 `website` 与 `t`、以及「先取文本再解析 JSON」和 `no-cors` 健康探测这两个失败分支为什么必须保留。

### 我想发布改动、处理缓存

- [静态资源、音频资产与缓存击穿约定](operations/assets-and-cache-busting.md) —— 改 `js/*.js` 必须同步 bump 引用处的 `?v=` 版本号，并在部署后清一次 CDN 缓存。这条不做，回访用户跑的还是旧代码。
- [外部依赖与服务耦合](integrations/external-services.md) —— Cloudflare 对 `/api/*` 的路由与静态资源缓存策略、APK 走 GitHub Releases 而非入库、哪些改动需要外部协调。

### 我要跑真机验证

- [验证与复现手册](testing/verification-playbook.md) —— 没有测试框架时怎么证明改动生效：`local-test.html`（不入版本控制、也不加载 `keepalive.js`）、`?debug` 面板与 `plogCopy` / `plogReset`、`?fast=N` 复现台，以及为什么桌面模拟（CDP、headless）不算证据。媒体资产内容不可读，息屏类改动只能靠真机 + 用户提供的日志截图。

### 我想弄清排障数据从哪来

- [播放记忆与黑匣子日志（localStorage 键）](concepts/player-persistence-and-diagnostics.md) —— `<pageid>_plog`、`_pstats`、`_ptrans`、`_currentMusic`、`_currentTime` 各自存什么、谁写谁读，以及 `plog` 每条记录携带的 `vis` / `rs` 字段为什么是排障关键证据。
- [遗留层：jQuery、yujizi.js 与失效的旧播放器假设](concepts/legacy-multi-audio-player.md) —— 哪些代码仍被加载但已与当前架构脱节，避免把它们误当成活代码。

### 我想理解 OpenWiki 自动化本身

- [OpenWiki 与仓库自动化](operations/openwiki-and-repo-automation.md) —— 每日 08:00 的 cron 加手动 `workflow_dispatch` 触发的那条流水线做了什么（失败也照开 `openwiki/update` PR，只是末尾 `exit 1` 标红）、`AGENTS.md` 的 OPENWIKI 区块约定的使用方式、`.openwikiignore` 如何决定 wiki 能看见什么。
- 一句话版本（同样写在 [AGENTS.md](../AGENTS.md) 的 OPENWIKI 区块里）：这份 wiki 是**按需检索**的可选上下文，不是启动必读；检索工具不可用时才回退到读 `openwiki/quickstart.md` 并跟着它的链接走；源码与测试才是权威，**生成页不要手改**。

## 两条最容易踩的坑

1. **改前端 JS 之后的缓存**。GitHub Pages 给 js/css 设了 `Cache-Control: max-age=600`，Cloudflare 还会把静态资源缓存约 4 小时，所以每个 `<script src>` 都带 `?v=` 版本号，注释明确要求「改了就把版本号加一」。当前三处引用是 [_layouts/music.html](../_layouts/music.html) L119 的 `/js/musicplayer.js?v=4`、同文件 L125 的 `/js/keepalive.js?v=3`、[_includes/comments.html](../_includes/comments.html) L64 的 `/js/comments.js?v=4`（版本号只存在于这三个标签上，没有 manifest、没有指纹流水线）。详见 [静态资源、音频资产与缓存击穿约定](operations/assets-and-cache-busting.md)。
2. **音频不能加回忽略列表**。这是历史上真实造成过本地与远端两条平行历史的事故（2026-09-27 合并，分支 `backup-before-unify-20260927`），[.gitignore](../.gitignore) 顶部的注释专门警告过，并同时说明「同目录的 `.openwikiignore` 是另一回事」——它只管 OpenWiki 读取范围，与 git 跟踪无关。
