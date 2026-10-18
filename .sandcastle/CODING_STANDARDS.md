# Coding Standards (distilled from AGENTS.md — reviewer loads this file)

站点：玉机子（yujizi.org），Jekyll 静态站，GitHub Pages 托管，内容是中文修行典籍与音频资料。

## Architecture — 这个仓库的形状

- **页面是手写的 HTML**：根目录的 `index.html` 与各 `.html` 就是站点页面。没有生成器批量产出它们，改动必须落在具体页面上，不要为了「统一」而引入布局系统。
- `_layouts/`、`_includes/` 只服务少数带 YAML front matter 的页面。**有 front matter 的页面要走 Jekyll；没有的页面 Jekyll 原样复制。**
- `js/`、`css/`、`style.css`、`album.css` 手写维护。
- `js/bootstrap*`、`js/jquery-*`、`js/js.cookie.js`、`js/vendor/` = vendored 第三方包，**只读，永不修改**。
- `玉机子/`、`经典读诵/`、`体真山人语录/`、`downloads/` = 内容资产（音频、文档、APK），git 跟踪、原样发布。**可读不可改**。
- `openwiki/` 是机器生成的文档，`_config.yml` 里被 `exclude:` 排除。不要手改——下次生成会被覆盖。
- `_config.yml` 的 `exclude:` 必须同时覆盖 `openwiki/` 和 `node_modules/`。前者漏掉会导致整站 Liquid 渲染失败，后者漏掉会让 Jekyll 把依赖目录复制进产物。
- `docs/` 放站点自身的说明。

## Style

- 做满足 issue 的**最小改动**，贴着页面既有写法走（这个站点大量页面是 2023 年风格，不要顺手现代化）。
- 不重构无关代码、不批量格式化、不给没坏的东西「优化」。审查时把这类 diff 视为缺陷。
- 中文文件名是正常的，不要改成 ASCII；百分比编码与原始中文写法都能解析，不要「统一」它们。
- 注释只在解释非显然原因时写（本站 `_config.yml` 的注释就是范例：写清故障现象 + 定位命令）。

## Verification（本站没有测试框架，两个门禁就是全部）

```bash
jekyll build --trace -d /tmp/_site
python3 .sandcastle/check_site.py /tmp/_site --baseline .sandcastle/known-broken.txt
```

- 两条都必须 exit 0。
- `check_site.py` 报「基线内」的死链 = 既有历史问题，放行并记录数量；报「新增死链」= 本次回归，必须修。
- 构建失败（Liquid / YAML）一律是回归，不允许带病合并。
- 沙箱内无法验证的：真实浏览器渲染与移动端布局、Cloudflare Worker 留言后端（`~/work/yujizi-comments`，不在本仓）、Pages 自建构建（Jekyll 3.9.3，版本差异不算缺陷）、音频播放、CNAME/DNS。这些在 issue 评论里显式声明「由人验证」，不要猜。

## Done Criteria

- `jekyll build` 干净通过，`check_site.py` 无新增问题
- diff 只覆盖 issue 要求的范围；内容资产目录没有出现在 diff 里
- 提交只 stage 有意修改的文件（`git add <paths>`，禁止 `git add -A`）
- issue 无法完成的部分在评论里写清剩余项
- `AGENTS.md` 里的说明与实际保持一致（改了结构/命令就同步更新它）
