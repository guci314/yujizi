# Sandcastle 无人值守流水线

「issue 进、main 出」：只处理带 `Sandcastle` 标签的 open issue（不带该标签的是人类 backlog，流水线不会碰）。四个 agent —— planner / implementer / reviewer / merger —— 在 Docker 沙箱里选单、实现、审查、合并，配置全在 `.sandcastle/`。

## 怎么喂工单

在宿主机跑（需要 Node + gh 登录；沙箱里没有 Node，流水线本体不在沙箱里跑）：

```bash
gh issue create --label Sandcastle --title "..." --body "## 需求 ... ## 验收标准 ..."
npm run sandcastle
```

- `npm run sandcastle` 即 `npx tsx .sandcastle/main.mts`，外循环最多 10 轮。
- 每轮：planner 选**最多 3 个**无依赖的 Sandcastle issue → 各开一个沙箱，implementer 最多 6 轮实现，分支有提交则 reviewer 审查 → merger 把领先 main 的分支合回 main 并关 issue。
- 同一批 issue 连续两轮零推进，流水线会自动退出（no-progress 守卫），不会空转烧钱。

## 沙箱镜像

`sandcastle:yujizi-web`（见 `.sandcastle/Dockerfile`）：ruby:3.2-bookworm + jekyll 4.3.4 + gh + python3 + opencode v2，模型 `opencode-go/glm-5.3-flash`。沙箱以 git worktree bind mount 拿到仓库；音频等 1.5GB 大资产被 `.dockerignore` 挡在镜像外，运行时经 worktree 依然可见。

## 门禁（与 AGENTS.md 一字不差）

沙箱里改动前后都要跑，两条都必须 exit 0：

```bash
jekyll build --trace -d /tmp/_site
python3 .sandcastle/check_site.py /tmp/_site --baseline .sandcastle/known-broken.txt
```

`check_site.py` 抓产物里的死链与未渲染的 Liquid，并对基线对齐：`known-broken.txt` 里的既有死链不算回归，**新增**死链必须修。真实浏览器渲染、Pages 自建构建（Jekyll 3.9.3）等一律由人验证，不写进验收。

## 分支与续作

- 分支名固定 `sandcastle/issue-{id}`，无 slug 后缀。确定性命名保证进程被杀后重跑时 worktree 复用、上一轮提交还在，进度不丢。
- 「这个 issue 干完没有」只看分支事实：`git rev-list --count main..<branch>` 大于 0。不能用本次 run 的 commit 列表判断 —— 它只记本次迭代的提交，续作时会误判成「没干活」。

## 已知坑

- **每个 worktree 约 1.5GB**（仓库跟踪音频资产），所以每轮最多并行 3 个 issue，多了白费磁盘和 I/O。
- **`TARGET_BRANCH` / `SOURCE_BRANCH` 是内置 prompt 参数**，值由运行时注入；试图通过 `promptArgs` 覆盖会直接抛 `PromptError`，reviewer 整条管线失败。
- **implementer 每轮最后一行必须输出 `<promise>COMPLETE</promise>`**，不发这个信号，外循环会把已做完的活再跑一遍 —— 纯浪费。
