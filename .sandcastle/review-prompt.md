# TASK

Review the changes on branch `{{BRANCH}}` and improve clarity, correctness, and consistency while preserving exact behaviour.

You are reviewing a **Jekyll static site** (玉机子, yujizi.org), not an application. There is no test suite; the gates are `jekyll build` and the internal-link check. Sandbox: Ruby 3.2 + Jekyll 4.3.4 + `gh` + `python3`, no Node.js.

# CONTEXT

## Branch diff

!`git diff {{TARGET_BRANCH}}...{{BRANCH}}`

## Commits on this branch

!`git log {{TARGET_BRANCH}}..{{BRANCH}} --oneline`

# REVIEW PROCESS

1. **Understand the change**: read the diff and commits above to understand the intent, then open the issue (`gh issue view <id>`) it claims to close.

2. **Check that it actually satisfies the issue**: the most common real failure here is a change that looks plausible but does not do what the issue asked (wrong page patched, link pointed at a file that does not exist, copy changed where markup was needed).

3. **Check site-specific hazards**:
   - Internal links and asset paths resolve in the built output (`_site`), including Chinese filenames (raw or percent-encoded)
   - YAML front matter is still valid on any page that has it
   - No unrendered Liquid (`{{` / `{%`) leaked into a page body
   - No edits to vendored bundles (`js/bootstrap*`, `js/jquery*`, `js/vendor/`) or to `openwiki/` (machine-generated)
   - No modification or deletion of content assets (`玉机子/`, `经典读诵/`, `体真山人语录/`, `downloads/`) — a diff that touches them is almost certainly an accident and must be reverted
   - `_config.yml` `exclude:` still covers `openwiki/` and now also `node_modules/` — removing either would break the GitHub Pages build
   - CSS/JS changes are scoped and do not silently change unrelated pages

4. **Apply project standards**: follow `@.sandcastle/CODING_STANDARDS.md`.

5. **Preserve behaviour**: never change what a page does or displays beyond the issue's scope. No drive-by rewording, reformatting, or "improvements" to unrelated copy.

# EXECUTION

If you find real problems:

1. Fix them directly on this branch (smallest correct change)
2. Re-run both gates:
   ```bash
   jekyll build --trace -d /tmp/_site
   python3 .sandcastle/check_site.py /tmp/_site --baseline .sandcastle/known-broken.txt
   ```
3. Commit describing the refinements (prefix `RALPH:`)

If the change is already correct and minimal, do nothing. **Do not invent work** — a reviewer that rewrites working copy to look busy is a defect, not diligence.

Once complete, output <promise>COMPLETE</promise>.
