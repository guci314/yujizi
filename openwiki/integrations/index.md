# 文件

- [外部依赖与服务耦合](external-services.md) - 汇总本仓库依赖但代码不在仓库内的外部面 —— GitHub Pages 托管与 CNAME www.yujizi.org、Cloudflare 边缘的 /api/* 路由与约 4 小时静态缓存、留言后端 Cloudflare Worker 的同源/跨域两种模式与 /api/health、GitHub Releases 分发的 yujizi-listener.apk，以及 GitHub Actions 里的 OpenWiki 更新流水线，并逐项标出耦合点、可安全改动与需外部协调的部分。
