// Parallel Planner with Review — four-phase orchestration loop
//
// 玉机子网站（Jekyll 静态站）适配版。相对脚手架默认值的改动：
//   ① 删除 hooks(`npm install`) 与 copyToWorktree(["node_modules"]) —— 本仓无 Node 项目，
//      沙箱里跑的是 jekyll + python3，没有任何要装的依赖。
//   ② implementer maxIterations 100 → 6 —— 轮数即钱，静态站的小改动 1-2 轮足够。
//   ③ docker() 显式指定 imageName，避免回落到「按目录名推导」。
//   ④ reviewer 显式传 TARGET_BRANCH=main（脚手架漏传，会把 `git diff ...{{BRANCH}}` 渲染成空）。
//
// This template drives a multi-phase workflow:
//   Phase 1 (Plan):             A planner agent analyzes open issues, builds a
//                               dependency graph, and outputs a <plan> JSON
//                               listing unblocked issues with branch names.
//                               Capped at 3 parallel issues (each worktree is ~1.5GB here).
//   Phase 2 (Execute + Review): For each issue, a sandbox is created via
//                               createSandbox(). The implementer runs first
//                               (6 iterations). If it produces commits, a
//                               reviewer runs in the same sandbox on the same
//                               branch (1 iteration). All issue pipelines run
//                               concurrently via Promise.allSettled().
//   Phase 3 (Merge):            A single agent merges all completed branches
//                               into the current branch.
//
// The outer loop repeats up to MAX_ITERATIONS times so that newly unblocked
// issues are picked up after each round of merges.
//
// Usage:
//   npx tsx .sandcastle/main.mts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.mts" }

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

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

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

        // Only review if the implementer produced commits
        if (implement.commits.length > 0) {
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

          // Merge commits from both runs so the merge phase sees all of them.
          return {
            ...review,
            commits: [...implement.commits, ...review.commits],
          };
        }

        return implement;
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

  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
    .filter(
      (entry) =>
        entry.outcome.status === "fulfilled" &&
        entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue);

  const completedBranches = completedIssues.map((i) => i.branch);

  console.log(
    `\nExecution complete. ${completedBranches.length} branch(es) with commits:`,
  );
  for (const branch of completedBranches) {
    console.log(`  ${branch}`);
  }

  if (completedBranches.length === 0) {
    console.log("No commits produced. Nothing to merge.");
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
}

console.log("\nAll done.");
