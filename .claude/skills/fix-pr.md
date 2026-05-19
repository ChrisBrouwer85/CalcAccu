# fix-pr

Ensure exactly one open PR exists for the current branch, targeting `main`, with a clean title and proper markdown body.

## Steps

1. **Find the current branch:**
   Run `git branch --show-current` to get the branch name.

2. **List open PRs for this branch** using `mcp__github__list_pull_requests` filtered to the current head branch (owner: `chrisbrouwer85`, repo: `calcaccu`).

3. **Close duplicates** — if more than one open PR exists for this branch, close all except the one targeting `main`. If none targets `main`, close all and proceed to create one. Use `mcp__github__update_pull_request` with `state: "closed"` to close extras.

4. **Determine title and body** from git context:
   - Title: derive from the most recent commit subject (`git log -1 --format=%s`) or the branch name — whichever is more descriptive. Keep it under 70 characters.
   - Body: write as a plain string (no shell heredoc syntax). Include:
     ```
     ## Summary
     - <bullet points describing what changed and why>

     ## Test plan
     - [ ] <manual check 1>
     - [ ] <manual check 2>
     - [ ] All tests pass (`npm test`)
     ```

5. **Fix or create the PR:**
   - If a PR targeting `main` already exists: call `mcp__github__update_pull_request` with the corrected `base: "main"`, `title`, and `body`.
   - If none exists: call `mcp__github__create_pull_request` with `base: "main"`, the derived `title`, and the plain-string `body`.

6. **Report** the final PR URL to the user.

## Rules
- Always pass `body` as a plain JSON string — never embed shell syntax like `$(cat <<'EOF' ... EOF)`.
- Never push to a different branch or create additional commits.
- The repo scope is `chrisbrouwer85/calcaccu` only.
