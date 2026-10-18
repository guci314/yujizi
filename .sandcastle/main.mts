// Parallel Planner with Review — four-phase orchestration loop
//
// 玉机子网站（Jekyll 静态站）适配版。相对脚手架默认值的改动：
//   ① 删除 hooks(`npm install`) 与 copyToWorktree(["node_modules"]) —— 本仓无 Node 项目，
//      沙箱里跑的是 jekyll + python3，没有任何要装的依赖。
//   ② implementer maxIterations 100 → 6 —— 轮数即钱，静态站的小改动 1-2 轮足够。
//   ③ docker() 显式指定 imageName，避免回落到「按目录名推导」。
//   ④ reviewer 显式传 TARGET_BRANCH=main（脚手架漏传，会把 `git diff ...{{BRANCH}}` 渲染成空）。
//   ⑤ **完成判据从「本次 run 有新 commit」改为「分支领先 main」** —— 脚手架用
//      `run.commits.length` 判断，而 run() 只返回本次迭代产生的 commit。进程被杀后
//      重跑时 worktree 复用、分支上已有上一轮的 RALPH 提交，本轮不再提交 →
//      commits 为空 → 永远进不了 merge，issue 永远 open，外循环空转到 MAX_ITERATIONS。
//      实测踩中：issue #1 的分支早有 5c5b330，10 轮全部「0 branch(es) with commits」。
//   ⑥ 加 no-progress 守卫：同一批 issue 连续两轮没有任何分支推进 → 直接退出，
//      不让外循环把钱烧在同一个死结上。
//
// This template drives a multi-phase workflow:
//   Phase 1 (Plan):             A planner agent analyzes open issues, builds a
//                               dependency graph, and outputs a <plan> JSON
//                               listing unblocked issues with branch names.
//                               Capped at 3 parallel issues (each worktree is ~1.5GB here).
//   Phase 2 (Execute + Review): For each issue, a sandbox is created via
//                               createSandbox(). The implementer runs first
//                               (6 iterations). If the branch has commits
//                               (this run or a previous one), a reviewer runs
//                               in the same sandbox on the same branch.
//   Phase 3 (Merge):            A single agent merges every branch that is
//                               ahead of main, then closes the issues.
//
// Usage:
//   npx tsx .sandcastle/main.mts

import { execSync } from "node:child_process";
import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { z } from "zod";

// The planner emits its plan as JSON inside <plan> tags; Output.object extracts
// and validates it against this schema.
const planSchema = z.object({
  issues: z.array(
    z.object({ id: z.string(), title: z.string(), branch: z.string() }),
  ),
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum number of plan→execute→merge cycles before stopping.
const MAX_ITERATIONS = 10;

// 沙箱镜像：ruby:3.2 + jekyll 4.3.4 + gh + python3（见 .sandcastle/Dockerfile）。
// 镜像名显式给出，不用「按目录名推导」的默认值。
const IMAGE_NAME = "sandcastle:yujizi-web";

// 模型：写码走 opencode-go 的 flash 档（与 dev-team 的 glm-5.3-flash 同池）。
const MODEL = "opencode-go/glm-5.3-flash";

const sandbox = () => docker({ imageName: IMAGE_NAME });

// 分支相对 main 是否已有提交 —— 「这个 issue 是否真的产出了活」的唯一判据。
// 不能用 run.commits：它只记本次迭代的提交，续作时会误判成「没干活」。
function branchHasCommits(branch: string): boolean {
  try {
    const out = execSync(`git rev-list --count main..${branch}`, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return Number(out) > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

let lastPlanKey = "";

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // -------------------------------------------------------------------------
  // Phase 1: Plan
  // -------------------------------------------------------------------------
  const plan = await sandcastle.run({
    sandbox: sandbox(),
    name: "planner",
    maxIterations: 1,
    agent: sandcastle.opencode(MODEL),
    promptFile: "./.sandcastle/plan-prompt.md",
    output: sandcastle.Output.object({ tag: "plan", schema: planSchema }),
  });

  const issues = plan.output.issues;

  if (issues.length === 0) {
    console.log("No unblocked issues to work on. Exiting.");
    break;
  }

  console.log(
    `Planning complete. ${issues.length} issue(s) to work in parallel:`,
  );
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Execute + Review
  //
  // Promise.allSettled means one failing pipeline doesn't cancel the others.
  // -------------------------------------------------------------------------
  const settled = await Promise.allSettled(
    issues.map(async (issue) => {
      const issueSandbox = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: sandbox(),
      });

      try {
        let implementCommits: unknown[] = [];
        try {
          const implement = await issueSandbox.run({
            name: "implementer",
            maxIterations: 6,
            agent: sandcastle.opencode(MODEL),
            promptFile: "./.sandcastle/implement-prompt.md",
            promptArgs: {
              TASK_ID: issue.id,
              ISSUE_TITLE: issue.title,
              BRANCH: issue.branch,
            },
          });
          implementCommits = implement.commits;
        } catch (err) {
          // 实现器崩了不代表分支上没有可用的提交（可能是上一轮留下的）。
          // 继续走下面的「分支是否有提交」判断，别把已完成的活丢掉。
          console.error(`  ! ${issue.id} implementer threw: ${err}`);
        }

        // 关键：判据是分支状态，不是本次 run 的 commits。
        if (branchHasCommits(issue.branch)) {
          const review = await issueSandbox.run({
            name: "reviewer",
            maxIterations: 1,
            agent: sandcastle.opencode(MODEL),
            promptFile: "./.sandcastle/review-prompt.md",
            promptArgs: {
              BRANCH: issue.branch,
              TARGET_BRANCH: "main",
            },
          });
          return { commits: [...implementCommits, ...review.commits] };
        }

        return { commits: implementCommits };
      } finally {
        await issueSandbox.close();
      }
    }),
  );

  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      console.error(
        `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
      );
    }
  }

  // 分支领先 main = 有东西可合。不看 run 结果，只看分支事实。
  const completedIssues = issues.filter((issue) =>
    branchHasCommits(issue.branch),
  );
  const completedBranches = completedIssues.map((i) => i.branch);

  console.log(
    `\nExecution complete. ${completedBranches.length} branch(es) ahead of main:`,
  );
  for (const branch of completedBranches) {
    console.log(`  ${branch}`);
  }

  if (completedBranches.length === 0) {
    console.log("No branches ahead of main. Nothing to merge.");

    // no-progress 守卫：同一批 issue 连续两轮没有任何分支推进 → 死结，退出。
    const planKey = issues.map((i) => i.id).sort().join(",");
    if (planKey === lastPlanKey) {
      console.error(
        `\nNo progress on the same issue set (${planKey}) across two rounds — aborting instead of burning iterations.`,
      );
      break;
    }
    lastPlanKey = planKey;
    continue;
  }

  // -------------------------------------------------------------------------
  // Phase 3: Merge
  // -------------------------------------------------------------------------
  await sandcastle.run({
    sandbox: sandbox(),
    name: "merger",
    maxIterations: 1,
    agent: sandcastle.opencode(MODEL),
    promptFile: "./.sandcastle/merge-prompt.md",
    promptArgs: {
      BRANCHES: completedBranches.map((b) => `- ${b}`).join("\n"),
      ISSUES: completedIssues.map((i) => `- ${i.id}: ${i.title}`).join("\n"),
    },
  });

  console.log("\nBranches merged.");
  lastPlanKey = "";
}

console.log("\nAll done.");
