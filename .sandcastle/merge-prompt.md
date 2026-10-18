# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

For each branch:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, resolve them by reading both sides and choosing the correct resolution. In this repo conflicts are usually in hand-maintained pages (`index.html`, `style.css`, `js/*.js`) — combine both intents, do not drop one side.
3. Verify with both gates (sandbox: Ruby 3.2 + Jekyll 4.3.4 + `python3`, no Node.js):

   ```bash
   jekyll build --trace -d /tmp/_site
   python3 .sandcastle/check_site.py /tmp/_site --baseline .sandcastle/known-broken.txt
   ```

4. If a gate fails, fix it before proceeding to the next branch.

## Failure classification rule (do not skip)

`jekyll build` must be **clean** — any Liquid/YAML error is a real regression; fix it, never merge past it.

For `check_site.py`, use baseline comparison to decide:

- The gate reports **new** broken links (exit 1, listed as 新增死链) → that is a **regression** caused by these branches. Fix it.
- The gate exits 0 with pre-existing broken links listed as 基线内 → those are **pre-existing environment/history problems**, not caused by this work. Note the count in your commit message and proceed.
- When unsure whether a link was already broken, check it out from the base branch (`git show main:<file> | grep <link>`) rather than guessing.

Never make a branch look green by adding entries to `.sandcastle/known-broken.txt`. That file is a record of pre-existing debt, and growing it by hand is falsifying the gate. New legitimate entries only appear when a *removal or rename* is itself the issue being worked — and then only the affected rows.

# GUARDRAILS

- Do **not** `git add -A`. Stage explicitly. Content assets (`玉机子/`, `经典读诵/`, `体真山人语录/`, `downloads/`) must not appear in the merge diff.
- Do not push. Merging locally is the end of this task.

After all branches are merged, make a single commit summarizing the merge (prefix `RALPH: merge`).

# CLOSE ISSUES

For each branch that was merged, close its issue using:

`gh issue close <ID> --comment "Completed by Sandcastle"`

Here are all the issues:

{{ISSUES}}

Once you've merged everything you can, output <promise>COMPLETE</promise>.
