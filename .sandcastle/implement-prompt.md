# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue using `gh issue view {{TASK_ID}}`. If it references a parent doc or a design note in the repo, pull that in too.

Only work on the issue specified.

Work on branch {{BRANCH}}. Make commits and run the gates below.

**完成判据（硬要求）**：你这一轮的**最后一行输出**必须是 `<promise>COMPLETE</promise>`，无论本轮做了什么、无论 issue 是否还需要后续轮次。不发这个信号，循环会把你已经做完的活再跑一遍——那是纯浪费。
- 如果进入时本分支上已有满足 issue 的 commit 且门禁全绿：不要再验证一遍，直接输出信号。
- 如果本轮只完成了一部分：照常提交，然后输出信号（下一轮会接着做，分支名是确定性的）。

# CONTEXT

You are an autonomous web engineer in a Docker sandbox (Debian, Ruby 3.2, Jekyll 4.3.4, `gh`, `python3`). There is **no Node.js** in this sandbox and no build step beyond Jekyll itself.

This repository is 玉机子 (yujizi.org) — a **Jekyll static site served by GitHub Pages**, human-authored HTML/CSS/JS plus large Chinese-language content assets. There is no test framework and no lint config. The gates are: `jekyll build` must succeed, and `.sandcastle/check_site.py` must report zero **new** problems.

The repository contract `AGENTS.md` is authoritative — read it and honor it (module boundaries, verification commands, "do not touch" list).

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information.

Read `AGENTS.md` first, then `_config.yml` (it carries the `exclude:` list and a comments-as-postmortem style worth reading), then the files the issue actually touches.

Note the layout of this repo — it is not a conventional web project:

- `index.html` + the hand-written `.html` pages at the root are the site's pages; there is no generator templating most of them
- `js/`, `css/`, `style.css`, `album.css` are hand-maintained; `js/bootstrap*`, `js/jquery*`, `js/vendor/` are **vendored third-party bundles — never edit them**
- `_layouts/` and `_includes/` are used by the few pages with YAML front matter
- `玉机子/`, `经典读诵/`, `体真山人语录/`, `downloads/` are large content assets (audio, documents, APK). They are tracked in git and served as-is. **You may read them, you must not modify or delete them** — and never `git add -A` blindly, because a stray deletion of these is unrecoverable noise in the merge.
- `openwiki/` is machine-generated documentation, excluded from the Jekyll build in `_config.yml`. Do not hand-edit it.

# EXECUTION

There is no unit-test framework here, so RGR does not apply directly. Use this loop instead:

1. **BASELINE**: before changing anything, run the gates below on the untouched worktree and note the output (how many broken links, whether the build passes).
2. **CHANGE**: make the smallest change that satisfies the issue, in the site's existing style.
3. **RE-GATE**: run the gates again. Any *new* failure is yours to fix.
4. **REPEAT** until the gates are clean.

For content/asset-only issues (the issue asks you to move a file, rename a page, or fix a link), skip straight to verifying with the gates.

# FEEDBACK LOOPS (per AGENTS.md)

Everything runs in this sandbox; the repo root is your working directory.

```bash
# 1. Build — engine-level gate. Catches Liquid/YAML/front-matter errors,
#    including the classic failure mode here: a page adding `{{ }}` or `{% %}` that
#    Jekyll then tries to render.
jekyll build --trace -d /tmp/_site

# 2. Site gate — internal link + unrendered-Liquid check.
#    Baseline-aligned: pre-existing broken links are not counted against you.
python3 .sandcastle/check_site.py /tmp/_site --baseline .sandcastle/known-broken.txt
```

- A full build takes ~20–60 s. That is normal; wait, do not abort.
- Both gates must be clean (exit code 0) before you commit.
- **Sandbox-unverifiable** (say so explicitly in the issue comment instead of guessing): real browser rendering and mobile layout, the Cloudflare Worker comment backend (`comments_api` in `_config.yml`, source lives in ~/work/yujizi-comments outside this repo), GitHub Pages' own build (uses Jekyll 3.9.3 — a version difference that is *not* a defect), DNS/CNAME behavior, and audio playback.
- Chinese filenames are normal and correct. A link like `玉机子/xxx.html` or a percent-encoded `%E7%8E%89...` both resolve. Do not "fix" Chinese filenames into ASCII.

# DOCS-ONLY / CONTENT-ONLY CHANGES

If the issue only touches Markdown, comments, or existing copy: you still must run both gates before committing (they are cheap), but you may skip exploration of JS/CSS.

# COMMIT

Make a git commit. The commit message must:

1. Start with `RALPH:` prefix
2. Include what was done + the issue number
3. Key decisions made
4. Files changed
5. Blockers or notes for the next iteration

Keep it concise. Commit only the files you intentionally changed — `git add <paths>`, never `git add -A`.

# THE ISSUE

If the task is not complete, leave a comment on the issue with what was done and what remains.

Do not close the issue - this will be done later.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.

Every iteration ends with `<promise>COMPLETE</promise>` as the very last line. No exceptions.

