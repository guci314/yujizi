<!-- OPENWIKI:START -->

## OpenWiki

This repository has a generated `openwiki/` evidence index. It is optional just-in-time context, not required startup reading.

- Do not enumerate, preload, or search wikis at task start. Use retrieval when the user asks for it, when unfamiliar architecture or dependency behavior materially affects the task, or when source inspection leaves an important uncertainty. Stop once the question is grounded.
- When those conditions apply and OpenWiki retrieval tools are available, use `openwiki_search` for just-in-time context and `openwiki_read` for the relevant complete sections. If search returns `workspace_required`, ask which listed workspace to use and retry with its ID.
- Use `openwiki_list_workspaces` or `openwiki_list_wikis` when workspace membership itself needs to be discovered.
- If the retrieval tools are unavailable, read `openwiki/quickstart.md` and follow its links to the relevant pages.
- Treat source code and tests as authoritative. A brief's unknowns and review items are verification gaps, not automatic requirements.
- Prefer the narrowest quiet validation that proves the changed behavior. Preserve complete failure output.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->

## 这是什么仓库

玉机子（yujizi.org）：Jekyll 静态站，GitHub Pages 托管，内容是中文修行典籍、音频与 Android APK 下载页。**没有测试框架、没有 lint 配置、没有前端构建链。**

## 验证命令（唯一权威口径）

改动前后都要跑，两条都必须 exit 0：

```bash
jekyll build --trace -d /tmp/_site
python3 .sandcastle/check_site.py /tmp/_site --baseline .sandcastle/known-broken.txt
```

- `jekyll build` 抓 Liquid / YAML / front matter 错误。历史上真实故障：`openwiki/` 里的 `{{ }}` 被 Jekyll 当模板渲染，整站 Pages 构建失败而 push 看起来正常。
- `check_site.py` 抓「产物里的死链」与「未渲染的 Liquid 残留」。它对**基线**对齐：`known-broken.txt` 里的既有死链不算本次回归；新增死链必须修。
- 沙箱里没有 Node、没有浏览器。真实浏览器/移动端渲染、Cloudflare Worker 留言后端（`~/work/yujizi-comments`）、Pages 自建构建（Jekyll 3.9.3，与本地 4.3.4 的版本差异不算缺陷）、音频播放、CNAME/DNS —— 一律声明「由人验证」，不许猜。

## 模块边界

| 路径 | 性质 |
|---|---|
| 根目录 `*.html`、`index.html` | 手写页面，主要改动面 |
| `_layouts/`、`_includes/` | 仅服务带 front matter 的页面 |
| `js/`、`css/`、`style.css`、`album.css` | 手写资产 |
| `js/bootstrap*`、`js/jquery-*`、`js/vendor/` | vendored 第三方包 —— **永不修改** |
| `玉机子/`、`经典读诵/`、`体真山人语录/`、`downloads/` | 内容资产（约 1.5GB，git 跟踪、原样发布）—— **可读不可改** |
| `openwiki/` | 机器生成，`_config.yml` 已排除 —— **不要手改** |
| `.sandcastle/` | 无人值守流水线配置（prompt / Dockerfile / 门禁脚本） |

## 禁止事项

- **不要 `git add -A`。** 只 stage 有意修改的文件。内容资产目录出现在 diff 里几乎一定是误操作。
- 不要修改或删除 `玉机子/`、`经典读诵/`、`体真山人语录/`、`downloads/` 里的任何文件。
- 不要编辑 vendored 包与 `openwiki/`。
- 不要为了「统一风格」批量格式化或重构无关页面。
- 不要把 `openwiki/` 或 `node_modules/` 从 `_config.yml` 的 `exclude:` 里拿掉 —— 前者会让整站构建失败，后者会把依赖目录复制进产物。
- 不要把中文文件名改成 ASCII：原始中文与百分比编码都能解析。

## 无人值守流水线（Sandcastle）

`.sandcastle/` 下是「issue 进、main 出」的四 agent 流水线配置。人工喂工单：

```bash
gh issue create --label Sandcastle --title "..." --body "## 需求 ... ## 验收标准 ..."
npm run sandcastle
```

只处理带 `Sandcastle` 标签的 open issue；其余是人类 backlog，流水线不会碰。
