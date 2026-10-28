# Phase workflow

Read PROJECT.md for current scope and [.agents/skills/next-phase/SKILL.md](.agents/skills/next-phase/SKILL.md)
for the task router. HANDOFF.md records current recovery context; OpenSpec owns task status.

Read `AI_OPS.md` and `.agents/skills/leadflow-ai-ai-ops/SKILL.md` for model, prompt,
evaluation, retrieval, agent-runtime, state, monitoring, or provider changes.

## Delivery

Public GitHub repository planned; no remote exists yet. Do not run `git push` or `gh` until the
owner authorizes repository creation/publication. Once a remote exists, push phase branches and
open PRs at the points below; nothing goes straight to main, and merge only after review and the
owner's go-ahead.
Use Conventional Commits: docs for planning, feat/fix/refactor for implementation, chore for
setup/archive. Preserve spec-first history, task commits and archive-before-merge with a
merge commit (`git merge --no-ff`, or GitHub's "Create a merge commit"; never squash or
rebase-merge). Preserve unrelated work; do not reset or stash it automatically.
Commits and PR bodies carry no Claude session links; `.claude/settings.json` turns them off.

## Pull requests and code review

One phase is one branch, merged into main only after review and the owner's go-ahead. With a
GitHub remote that branch is one PR, as below. Without a remote, follow the same steps locally:
the review runs on the branch diff and the merge is `git merge --no-ff`.

Every PR body opens with a **TL;DR**: two to four plain sentences a non-engineer can follow,
naming things by what they do. It says what changed, why, and what the owner needs to do (often
nothing, or approve the merge); if the PR changes what the app shows, it says how. Keep it
current as the PR changes, with the technical detail below it.

1. Spec ready: after the spec-only `docs:` commit, push the branch and open a **draft** PR
   titled `Phase N: <deliverable>`. The body links the OpenSpec change, lists the ⛔ gates the
   phase touches and holds a checklist of its tasks. The owner reviews the proposal there.
2. Building: push task commits as they land. The PR stays draft while tasks remain open.
3. Code review: when every task passes and the local gate is green, review the PR before
   marking it ready. Run `/code-review` on the PR for correctness and check the diff against
   the change's requirements and tasks and the design's non-negotiables check. Add the domain
   review skill, if any, when the PR changes the outputs it covers. Fix findings in new commits
   or answer them on the PR, and record the outcome in the PR body.
4. Ready: archive on the branch (`chore:`), rerun validation and the gate, push, mark ready.
5. Merge: only on the owner's go-ahead, with a merge commit. Then pull main, confirm the merge
   landed, and delete the branch locally and on GitHub. The phase is now at its clean
   checkpoint (below).

Docs- or process-only PRs get a read-through instead of a code review. `/code-review ultra`
is billed and user-triggered: suggest it for high-stakes PRs, never launch it.

## Fresh session per phase

Each phase starts in a fresh agent session. A conversation left over from the last phase
crowds the context and lets stale details leak into new decisions (context rot), so nothing
the next phase needs may live only in the chat.

- **Before the PR is marked ready:** move what the conversation decided or learned into the
  repo: decisions to PROJECT.md and the design, findings and the next action to HANDOFF.md.
  Word the next action so it is still true after the merge.
- **Clean checkpoint:** the phase branch and any process branch opened alongside it are
  merged and deleted locally and on any remote, main is current and the tree is clean.
  Stop there and tell the owner the context can be cleared. Don't start the next phase's
  grilling in the same session unless the owner asks.
- **Next phase:** the owner clears the context (`/clear` in Claude Code, a new session in other harnesses) and runs
  `/next-phase`, which rebuilds the picture from PROJECT.md, HANDOFF.md, OpenSpec and Git.
- **Mid-phase:** if a session must end before its phase does, first commit (and push, with a remote) a HANDOFF
  update naming the branch, the finished and open tasks and the next step.

## Phase loop

Keep each phase plan lean: normally no more than nine implementation tasks, with a smaller cap when
the phase allows it. A task should produce one reviewable outcome rather than split implementation,
tests, documentation, and evidence into parallel bookkeeping tasks. Run focused checks while building
and one clean full gate at completion; repeat the full gate only when a failure or material fix makes
another run necessary. Required safety evidence, code review, owner gates, and archive checks are not
optional and must not be removed merely to meet the task budget. Follow § Efficient execution.

1. Inspect actual branch/tree and active OpenSpec status. Resume an existing authorized
   phase on its branch. Select a bounded task slice; planning readiness is not implementation.
2. Read affected artifacts and PROJECT gates. Explore unresolved feasibility before relying
   on it. Use leadflow-ai-build-safety for relevant engineering boundaries and any
   domain review skill for the outputs it covers.
3. For new phases grill the user on open decisions (see next-phase), then propose a scoped
   change, branch and create a spec-only docs commit, then push and open the draft PR.
   Make the result reviewable. Honor requested review pauses and unresolved material choices;
   an already authorized slice needs no repeated approval for reversible refinements.
4. Implement via the apply workflow, committing tasks or logical groups. Set the phase to
   In progress with its first implementation. Keep future tasks open.
5. Verify the selected scope. Mark only evidenced tasks complete. A completed milestone
   inside an unfinished phase does not authorize archival or marking the whole phase Done.
6. When all requirements/tasks pass, archive on the same branch, sync main specs, update
   phase Done in the archive commit, rerun validation and the local gate, then finish the PR
   (code review, ready, merge on the owner's go-ahead) as above.
   Delete only a verified merged branch. No force deletion to finish a checklist.
7. Update HANDOFF with scope, checks, limitations and the next task; begin a genuinely new
   phase in a fresh session from the clean checkpoint (§ Fresh session per phase).

## Efficient execution

Speed comes from not repeating work, never from skipping required evidence.

- **Check ladder.** While editing, run only the leaf checks for the changed files or workspace
  (format, lint, typecheck, affected tests). Close a task with those plus any probe that task
  specifically needs (emulator, browser, render). Run the full gate once at phase completion, and
  again only after a failure or material fix. Never rerun an identical passing check on the same
  revision.
- **Slices, not micro-tasks.** Commit a coherent group of tasks together when they share a boundary.
  Update HANDOFF at the end of a slice or session, not after every task, and keep each entry to what
  changed, the checks that passed, retained failures, and the next step.
- **Encode rules as checks.** When a skill imposes mechanical rules (layout, naming, budgets,
  contrast, links, drift), put them in the generator, script, or test that produces the artifact so a
  violation fails automatically. Review by eye only what a check cannot see, such as a render.
- **Read once, record once.** Load only the skill references the slice needs, and write the
  decisions derived from them into the design or the generator so later sessions do not re-read them.
- **Fix the environment once.** When a shell, cache, port, or permission problem blocks a command,
  diagnose it once, record the working invocation in the development docs, and reuse it instead of
  retrying variations.
- **Overlap waiting.** Start long checks, probes, or renders in the background and continue with
  independent steps; collect the result before marking the task complete.

## Prerequisites and authority

Technical checks can be established by evidence. Product decisions reuse accepted scope.
PROJECT's explicit `⛔` gates are operator-resolved: surface and stop the dependent action;
never satisfy or waive them yourself. PROJECT.md §5–6 are the constitution: they override the
other project documents, and only the owner amends them (PROJECT.md § Amending the constitution).
Unresolved live access/budget does not block local work.
Skills grant no spending, outreach, deployment or real-data transfer authority.

## Verification by scope

- Planning/skills: frontmatter where relevant, local links, source digests for carryover,
  consistency, strict OpenSpec validation, whitespace and candidate-file inspection.
- Runtime: activate the repository toolchain with `. .\scripts\activate-toolchain.ps1` (macOS:
  `source scripts/activate-toolchain.sh`), then run `pnpm check`. It covers strict OpenSpec validation plus format, lint, type, build, test,
  deterministic evaluation, loopback smoke, constitution-drift, and tracked-file hygiene checks.
  Add meaningful affected boundary tests.
- Results and model behavior: independent checks of outputs, cases fixed before measuring,
  honest run records. No fabricated remote results.
  For AI products, apply the AI-ops evaluation procedure and bind evidence to the complete
  system version; required missing/stale evidence holds promotion. Keep paid provider evals
  separate from ordinary offline CI.
- UI: actual local-flow verification using synthetic scenarios.

Local checks are not hosted CI, live-service access or production evidence. Record failures
and untested boundaries. Reuse still-valid scoped evidence rather than repeatedly running checks.

The initial skill setup may be committed on main. Later process-document changes go through a
small branch (a PR with a remote) like any other, with a read-through. Product phases use their
spec-first branch. Skills installation is setup, not completion of application tasks.
