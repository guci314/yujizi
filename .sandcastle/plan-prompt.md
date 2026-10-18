# ISSUES

Here are the open issues in the repo (`yujizi` — 玉机子网站, a Jekyll static site):

<issues-json>

!`gh issue list --state open --label Sandcastle --limit 100 --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`

</issues-json>

The list above has already been filtered to issues ready for work: only issues carrying the `Sandcastle` label are listed. Issues without that label are human backlog — never pull them in, never reference them as work to do.

# TASK

Analyze the open issues and build a dependency graph. For each issue, determine whether it **blocks** or **is blocked by** any other open issue.

An issue B is **blocked by** issue A if:

- B requires content or infrastructure that A introduces
- B and A edit the same files (this matters a lot here: the site has a handful of hand-maintained pages — `index.html`, `js/*.js`, `style.css`, `_layouts/*`, `_includes/*` — so two issues touching the same one will conflict)
- B's requirements depend on a decision or markup shape that A will establish

An issue is **unblocked** if it has zero blocking dependencies on other open issues.

**Parallelism cap: select at most 3 unblocked issues per round.** Each sandbox gets its own full git worktree (~1.5 GB, this repo tracks audio assets); more than 3 at once wastes disk and I/O for no throughput gain. If more than 3 are unblocked, take the 3 with the highest priority and let the rest wait for the next round.

For each selected issue, assign a branch name using the exact format `sandcastle/issue-{id}` (no slug or other suffix). This must be deterministic so that re-planning the same issue always produces the same branch name and accumulated progress is preserved.

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags:

<plan>
{"issues": [{"id": "42", "title": "首页源码入口指向失效", "branch": "sandcastle/issue-42"}]}
</plan>

Include only unblocked issues. If every issue is blocked, include the single highest-priority candidate (the one with the fewest or weakest dependencies).

Always emit the `<plan>` tags, even when there is nothing to do. If there are no issues to work on at all, output `<plan>{"issues": []}</plan>` so the run can exit cleanly.
