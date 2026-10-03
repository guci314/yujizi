# 文件

- [静态资源、音频资产与缓存击穿约定](assets-and-cache-busting.md) - 运维须知：.gitignore 与 .openwikiignore 两份清单各管一段（版本控制 vs wiki 排除）及逐条覆盖面对照、仓库约 3GB 体积的构成（玉机子/、经典读诵/、体真山人语录/），以及 js/css 受 GitHub Pages max-age=600 与 Cloudflare 约 4 小时双层缓存约束时必须同步 bump ?v= 的硬性约定与当前版本号快照。
- [OpenWiki 与仓库自动化](openwiki-and-repo-automation.md) - 仓库里唯一的自动化流水线 .github/workflows/openwiki-update.yml 的触发、步骤与失败语义，wiki 生成范围由 .openwikiignore 界定（OpenWiki 不读 .gitignore），openwiki/ 下三类状态文件的分工，AGENTS.md 中 OPENWIKI 区块约定的按需检索与「生成页不可手改」规则，以及 OpenWiki 进程需要 .github/openwiki/opencode-go-fetch.mjs 这个 fetch shim 才能调用外部网关的原因。
