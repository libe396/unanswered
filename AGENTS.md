# UNANSWERED Development Rules

## Project
UNANSWERED is an interactive online exhibition built with React, TypeScript, and Vite.

This project is frequently edited alternately by Claude Code and OpenAI Codex.
The highest priority is preserving existing work and preventing conflicts or accidental regressions.

---

## 1. Before Every Task

Before modifying any file:

1. Run `git status`.
2. Inspect the current working tree.
3. Read the relevant existing files before editing.
4. Assume existing uncommitted changes may have been made by another AI agent.
5. Never overwrite, discard, reset, or revert existing changes unless the user explicitly asks.

If there are existing uncommitted changes:
- Preserve them.
- Modify only the files necessary for the requested task.
- If the requested task conflicts with existing changes, stop and explain the conflict before editing.

---

## 2. Editing Rules

Make the smallest possible change required to complete the request.

Do NOT:
- rewrite unrelated components
- refactor unrelated code
- rename or move files unless necessary
- change the project architecture without explicit permission
- replace existing implementations just because another approach seems cleaner
- remove existing interactions, animations, scenes, or visual behavior
- modify unrelated copy or styling

Preserve the existing visual language and interaction behavior unless the user explicitly requests a change.

---

## 3. Scene Safety

UNANSWERED is a scene-based interactive exhibition.

When editing one Scene:
- modify that Scene only whenever possible
- preserve transitions into and out of the Scene
- preserve existing Zustand/store behavior unless state behavior is part of the task
- verify that the next Scene still opens correctly
- verify that Landing still works

Do not change global scene flow for a local visual adjustment.

---

## 4. Git Safety

Never run these commands unless the user explicitly requests them:

`git reset`
`git reset --hard`
`git restore`
`git checkout -- <file>`
`git clean`
`git stash`
`git stash apply`
`git stash pop`
`git rebase`
`git merge`

Never automatically commit or push.

Do NOT run:
`git commit`
`git push`

unless the user explicitly asks.

Another AI agent may have created the current changes.

---

## 5. Conflict Prevention

Claude Code and Codex may work on this repository at different times.

Therefore:

- Treat the current filesystem as the source of truth.
- Do not assume the latest Git commit represents the latest work.
- Never restore a file to an older Git version without explicit permission.
- Never apply old stashes automatically.
- Never resolve merge conflicts by choosing an entire side without inspecting both versions.

If conflict markers such as

`<<<<<<<`
`=======`
`>>>>>>>`

are found, STOP editing and report the conflict to the user.

---

## 6. Testing

After making changes:

1. Run `npm run build`.
2. Report whether the build passes.
3. When relevant, verify the affected interaction/Scene.
4. Run `git diff --stat`.
5. Run `git status`.

Do not fix unrelated warnings or errors unless they prevent verification of the requested task.

---

## 7. Completion Report

After every task, report:

### Changed
- files modified
- what changed

### Preserved
- important existing behavior that was intentionally left untouched

### Verification
- build result
- interaction checks performed

### Git
- current git status
- confirm whether commit/push was performed

Keep this report concise.

---

## 8. UNANSWERED Project Priorities

When choices are ambiguous, prioritize:

1. Existing working interactions
2. Exhibition narrative continuity
3. Visual consistency
4. User experience
5. Minimal code changes
6. Technical elegance

A working exhibition is more important than unnecessary architectural perfection.

---

## 9. Browser-First Workflow

The user evaluates this project primarily through the rendered browser experience, not through source code.

When implementing visual or interaction changes:

1. Preserve the running Vite development environment whenever possible.
2. Evaluate success based on what appears in the browser.
3. Do not consider a task complete merely because the code compiles.
4. For visual changes, verify the actual rendered result whenever browser inspection is available.
5. For interaction changes, verify the complete user path affected by the change.

The primary local preview is:

`http://localhost:5173/unanswered/`

---

## 10. Current Core Experience

The intended beginning of the experience is:

Landing
→ Elevator / Intro
→ Investigation Letter
→ Registration
→ Exhibition investigation scenes

A fresh page load or reopening the site must begin from Landing.

Do not bypass the Elevator / Investigation Letter flow unless explicitly requested.

---

## Golden Rule

When uncertain whether a change might destroy, overwrite, or conflict with existing work:

STOP.

Inspect first and ask the user before proceeding.