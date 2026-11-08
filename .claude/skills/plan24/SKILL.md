---
name: plan24
description: "Runs the modernstudio step plan, one step per invocation. Use only when the user invokes /plan24 or asks to run the next plan24 step."
version: 1.0.0
---

# plan24

The project is built in numbered steps. The plan lives in [docs/plan24.md](../../../docs/plan24.md), a file dedicated to this plan and nothing else. Each invocation **builds one step**. When the last completed step is a multiple of 3 (or there is no plan yet, which counts as 0), it **replans first**, then builds the next step in the same invocation.

The step numbers are plan24's own, starting at 1. They have nothing to do with the older branches `00-overall` to `04-guitars`; the matching numbers are a coincidence.

**Git needs no permission.** The user has authorized every git operation this skill describes: creating a branch, switching branches (including back to `development`), staging, committing, merging into `development` and pushing. Run them through the Bash tool without asking first or confirming afterwards. `.claude/settings.json` allows these commands so no permission prompt appears. Force-pushes stay denied.

**Ask freely.** At any point, while planning or while building a step, use AskUserQuestion as many times as needed. Never guess at something that is the user's to decide.

## Procedure

### 1. Read

Read `README.md`, `docs/README.md` and, if it exists, `docs/plan24.md`. Follow the links the work needs (`open-items.md`, `design.md`, `page-designs.md`, and so on).

### 2. Decide the mode

| Situation | Mode |
| --- | --- |
| `docs/plan24.md` does not exist (first invocation) | Replan (last completed step is 0), then build step 1 |
| The last completed step is a multiple of 3 (or 0) **and** "Replanned after step" is not equal to it | Replan, then build the next step |
| Anything else | Build the next uncompleted step (no replan) |

"Last completed step" is the highest step marked done. "Replanned after step" is a header line in the plan doc. It stops the same replan running twice: if the step built right after a replan ended up blocked, the next invocation resumes that step instead of replanning again.

If every step is done and none is left to build, replan (the plan may be extended) and build the first new step, or, if the user says the project is finished, report that.

### 3a. Replan (only when the mode says so)

Do this first, on `development`, creating no branch. Then go on to 3b in the same invocation.

1. **Next three steps, in a bit of detail.** For each: what it produces, which docs it relies on, what "done" looks like, and the decisions it may need from the user. A step should be small enough for one invocation.
2. **Steps from there to the horizon, in broad strokes.** One or two vague lines each: the area of work, not the specifics. Do not plan these as precisely as the next three.
3. **Check the mapping up to the horizon.** The horizon starts at 24 and is not fixed: move steps, replan them, merge or split them, and raise or lower the horizon (25, 26, 30, and so on) when the work calls for it. Only steps that are not yet done may change; done steps are history. Record any change to the horizon in the plan.
4. Set "Replanned after step" to the last completed step (0 on the first invocation).
5. On the first invocation, create `docs/plan24.md` in the structure below and add it to the reading order in `docs/README.md`. Derive the opening plan from the docs (the "Next" paragraph of `docs/README.md` and `open-items.md`). Ask the user about anything the docs do not settle.
6. Update other docs only if the replan makes them wrong (for example the "Next" paragraph of `docs/README.md`).
7. Commit to `development` (named files only, with the trailer) and push, so the plan is on `development` before the step branch is cut. Remember what changed for the final report.

### 3b. Build one step

1. Take the next uncompleted step. If a branch for it already exists and is not merged (a step left blocked earlier), check it out and resume it. Otherwise branch from `development`: `git switch development && git switch -c NN-slug`, where `NN` is the two-digit step number and `slug` is one or two lowercase words for the work (`05-backend`, `16-repurpose`). If that exact branch name is taken, pick another slug.
2. Complete the step. Follow the step's detail in the plan and the decided docs (`design.md`, `page-designs.md`, `open-items.md`). Where something is undecided, ask with AskUserQuestion; if you proceed on an assumption instead, record it in `open-items.md`.
   - **Do not use Playwright** or any browser testing or screenshots. Verify with static means only: linters, syntax checks, type checks, running scripts.
   - **Do not invoke the brainstorming skill.** Planning is this skill's own job.
   - If the step cannot be finished (waiting on the user, on a tool, on a decision), do all that can be done, mark it `blocked: <reason>` in the plan, commit on the step branch, do **not** merge or push, and report what is needed.
3. Update the docs the step changed, `docs/plan24.md` first: mark the step done and set "Last completed step".
4. Commit on the step branch. Stage named files only; never `git add -A` or `git add .` (the working tree holds untracked files that are not part of the step). End the message with the Co-Authored-By trailer the session specifies.
5. Merge into development: `git switch development && git merge --no-ff NN-slug`. Push `development` and the step branch (`git push -u origin development NN-slug`). Do not delete the step branch.
6. Report: the step, what changed, assumptions made, and what the next step is. If the invocation replanned, also report the three detailed steps and any change to the horizon or the order.

## Plan doc structure

```markdown
# plan24

Horizon: 24
Last completed step: 0
Replanned after step: 0

## Next three steps
### Step N: title
Detail ...

## Later steps
- N: one vague line
```

Below those, keep a one-line-per-step table (`#`, title, status `todo` / `blocked: reason` / `done`, branch) for every step up to the horizon. It is the single source for "last completed step".

## Never

- Never force-push, skip hooks, or resolve a merge conflict blindly. On a conflict or a failed push, stop and report.
- Never touch steps already marked done when replanning.
- Never run two steps in one invocation.
