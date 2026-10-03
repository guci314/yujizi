# 文件

- [布局与前端 DOM/脚本契约](layout-and-frontend-contract.md) - 记录两个 Jekyll 布局与 js/ 目录之间无类型、无构建期校验的隐式契约：music 布局必须提供的播放器元素 id、页面必须定义的 pageid/musicList 全局、行内 onclick 依赖的全局函数，以及脚本加载顺序硬约束。
- [系统全景与仓库边界](overview.md) - 仓库的权威总览：把站点拆成内容页、Jekyll 布局与 include、浏览器端运行时、仓库外服务四层边界，逐层给出拥有的文件与目录、两份忽略清单排除的路径与理由，以及「想改 X 该动哪些文件」的落点索引。
- [站点构建、布局装配与部署形态](site-build-and-deploy.md) - 记录页面的装配路径（front matter → _layouts → _includes/comments.html → 浏览器脚本）、两套布局的分工、layout/permalink/hide_title 三个 front matter 键的语义与证据，以及 GitHub Pages + CNAME + Cloudflare 的部署形态与「仓库内没有任何构建脚本」这一事实。
