# Mobile Balloon Todo Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reviewable, mobile-first H5 prototype for today, inbox, review, and weekly planning, centered on a balloon container and the confirmed daily-cycle completion interaction.

**Architecture:** Keep the existing React entry point, replace the placeholder shell with bottom navigation and focused page components, and move task/capacity/cycle/action rules into domain utilities. Pages call a repository interface; H5 uses IndexedDB, while Tauri calls Rust commands backed by SQLite transactions. A shared responsive layout serves H5 and the mobile app webview.

**Tech Stack:** React 18, TypeScript, existing Wasp bootstrap/router, Matter.js 0.20.x, Tailwind CSS, existing Musae dependency, browser IndexedDB, Tauri 2, Rust `rusqlite` with bundled SQLite.

**Spec:** `docs/todo-capacity-app-technical-design.md` sections 3–10, especially 3.1, 3.3–3.5, 4, 5, 6, 7, 8, and 10.

**Prototype scope:** Implement the four core pages and the task/cycle/capacity flows needed to review them. Account sync, notifications, analytics, JSON backup UI, and full settings are outside this prototype; the technical design remains the source for later MVP work.

## Global Constraints

- The app targets H5 and mobile app first; use a single-column layout and fixed bottom navigation.
- The four primary pages are 今日、收件箱、复盘、计划.
- A cycle is a local calendar day in the configured IANA timezone; MVP day boundary is local midnight.
- A missed planned date increments `carryoverCount` exactly once and transitions the task to `review`; tasks never roll forward automatically.
- `level = min(carryoverCount, 4)` and balloon diameter is `56 + 14 × level` CSS px, capped at 112 px.
- The balloon container uses Matter.js circle bodies, gravity, friction, and static side/floor colliders; balls start at slightly randomized non-overlapping positions, settle naturally, and touch the visible inner wall when at rest.
- Balloon size never changes task load, priority, or capacity totals.
- Delete is a soft delete with an undo action; splitting removes the parent from capacity and counts only child tasks.
- Completion requires an explicit second confirmation. Persist `completed` and `completedAt` before playing the approximately 300 ms shrink/fade animation.
- Snoozed (`someday`) tasks do not accumulate missed cycles while outside the plan; rescheduling preserves the existing count.
- H5 uses IndexedDB and Tauri uses SQLite through Rust commands; UI code must not access storage directly.
- The prototype must remain usable at a 320 CSS px viewport width; physical circles do not overlap, their DOM diameter matches the collider, and task text stays inside each circle.

## Review Focus

- Same-day repeated app launches and refreshes must not increment a missed task more than once; persist a `missed_cycle` decision atomically with the transition.
- Tasks missed while the app is closed transition once for their originally planned date; do not synthesize missed days while the task was not scheduled.
- Completing a task from review releases the original planned date's active load and does not replay completion on reload.
- Undo after completion restores a past-due task to review and a future task to planned without changing `carryoverCount`.
- Tasks with missing load remain valid in inbox but cannot be scheduled until assigned a load value.

---

### Task 1: Define task, capacity, and local-cycle domain rules

**Files:**
- Create: `src/domain/task.ts`
- Create: `src/domain/capacity.ts`
- Create: `src/domain/review.ts`
- Create: `src/domain/task-actions.ts`
- Create: `src/shared/date.ts`

**Interfaces:**
- Produce `Task`, `TaskStatus`, `TaskDecision`, `UserPreferences`, and a discriminated `TaskAction` union matching section 6 of the spec. Actions are `reschedule` (`taskId`, `plannedDate`, `load`), `split` (`taskId`, child title/load pairs), `someday` (`taskId`), `delete` (`taskId`), `complete` (`taskId`), and `undo` (`taskId`, `decisionId`). `missed_cycle` is system-generated only.
- Produce `applyTaskAction(tasks, decisions, action, todayLocalDate, processedAt)` returning changed tasks and one decision; decision metadata stores the prior task snapshot needed for undo.
- Produce `getBalloonLevel(carryoverCount: number): number`, `getBalloonDiameter(carryoverCount: number): number`, `getPlannedLoad(tasks: Task[], date: string): number`, and `getCapacitySummary(tasks: Task[], date: string, capacity: number)`.
- Produce `getLocalDateKey(now: Date, timezone: string): string` and a pure `transitionMissedTasks(tasks, todayLocalDate, processedAt)` function that returns transitioned tasks plus `missed_cycle` decisions.
- All date comparisons use `YYYY-MM-DD` local date keys, not UTC truncation.

**Deliverable:** Pure, UI-independent rules whose outputs match the approved five balloon tiers, capacity rules, and idempotent cycle semantics.

- [ ] Define domain entity/status/action types, including `lastProcessedCycleDate` and the prior-state metadata needed by undo.
- [ ] Implement local date-key generation, planned-load/capacity summaries, and the exact five-step balloon mapping.
- [ ] Implement missed-task transition rules: only overdue `planned` tasks transition to `review`; each original planned date is counted once, even if the app resumes several days later.

---

### Task 2: Implement the task repository and local persistence adapters

**Files:**
- Create: `src/data/task-repository.ts`
- Create: `src/data/indexeddb/task-repository.ts`
- Create: `src/data/tauri-sqlite/task-repository.ts`
- Create: `src-tauri/src/commands.rs`
- Create: `src/data/indexeddb/schema.ts`
- Create: `src-tauri/migrations/001_initial.sql`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- `TaskRepository` provides `listTasks(): Promise<Task[]>`, `listDecisions(): Promise<TaskDecision[]>`, `getPreferences(): Promise<UserPreferences>`, `savePreferences(preferences: UserPreferences): Promise<void>`, `saveTask(task: Task): Promise<void>`, `applyTaskAction(action: TaskAction): Promise<Task[]>`, `processMissedTasks(todayLocalDate: string): Promise<void>`, and `seedSampleData(tasks: Task[], preferences: UserPreferences): Promise<void>`.
- `applyTaskAction` atomically persists the task transition and corresponding `TaskDecision`; `processMissedTasks` atomically persists each missed-cycle transition and audit record.
- H5 computes domain transitions and writes them in one IndexedDB read/write transaction. Tauri computes task actions in shared TypeScript domain code and sends the resulting tasks/decisions to a Rust command that commits them in one SQLite transaction; missed-cycle processing runs directly in a Rust SQLite transaction.
- Select the SQLite adapter only when running inside Tauri; select IndexedDB for H5.
- Seed deterministic sample tasks when the repository is empty and add only missing `sample-` IDs on later launches, so existing demo installs receive expanded content without overwriting edited, completed, or user-created tasks.

**Deliverable:** Shared repository contract with IndexedDB and SQLite implementations. Missed-task updates and user decisions commit atomically in each adapter. Tauri invokes Rust commands backed by `rusqlite`; migrations create task, decision, and preference tables.

- [ ] Upgrade the existing Tauri CLI/core/build dependencies from release candidates to compatible stable Tauri 2 releases and raise `rust-version` to the minimum supported by the selected stable core.
- [ ] Add `rusqlite` with the `bundled` feature and `@tauri-apps/api` for IPC; initialize the SQLite connection path in Tauri setup.
- [ ] Register a versioned SQLite migration from `src-tauri/migrations/001_initial.sql`; create matching IndexedDB stores/indexes for tasks, decisions, and preferences in `src/data/indexeddb/schema.ts`.
- [ ] Implement repository operations; Tauri Rust commands commit decisions with task transitions in one SQLite transaction.
- [ ] Select the adapter by runtime, initialize it before rendering, and insert only missing `sample-` task IDs; never overwrite existing task IDs.

---

### Task 3: Replace placeholder shell with mobile navigation and shared panels

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/layout/index.tsx`
- Modify: `src/index.css`
- Create: `src/components/bottom-navigation/index.tsx`
- Create: `src/components/capacity-summary/index.tsx`
- Create: `src/components/task-detail-sheet/index.tsx`
- Create: `src/components/confirm-completion/index.tsx`

**Interfaces:**
- Define routes `/today`, `/inbox`, `/review`, and `/planner`; `/` redirects or resolves to `/today`.
- Bottom navigation links to those four routes and respects device safe areas.
- Task detail sheet receives a task and action callbacks; completion opens a second confirmation control labeled `确认完成`.
- Completion callback resolves only after repository persistence; then the sheet starts the shrink/fade transition and offers undo.

**Deliverable:** Shared H5/mobile-app shell with consistent page title, capacity summary, bottom navigation, and task action panel.

- [ ] Add the four routes and make `/` resolve to `/today`.
- [ ] Replace the placeholder shell with a single-column frame, safe-area-aware bottom navigation, and a capped 480 px wide-screen content column.
- [ ] Build the shared capacity summary and task detail sheet using repository-backed action callbacks.
- [ ] Add the second completion confirmation; on confirm, wait for the persisted result before starting the shrink/fade transition and undo prompt.

---

### Task 4: Build the today balloon container and completion flow

**Files:**
- Create: `src/pages/today/index.tsx`
- Create: `src/components/balloon-container/index.tsx`
- Create: `src/components/balloon/index.tsx`
- Create: `src/components/task-form/index.tsx`
- Create: `src/features/tasks/use-tasks.ts`
- Modify: `src/main.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Balloon item renders the task name and load inside its circular body; truncate long names to one line while preserving the full title in the accessible task label and detail sheet.
- Container measures its inner width and creates Matter.js circle bodies and static side/floor colliders; circle diameters come from `getBalloonDiameter`, with proportional shrinking only when a single circle cannot fit the available width.
- Today page shows date, capacity summary, balloons, a floating `记一件事` entry point, and task detail/completion actions.
- Add new inbox tasks through the same task form used by the inbox page.

**Deliverable:** Today page accurately demonstrates balloon growth levels, capacity separation, task selection, explicit completion confirmation, persisted completion, shrink/fade, and undo.

- [ ] Build the Matter.js world with randomized non-overlapping initial positions, gravity, sleeping bodies, and wall colliders aligned to the visible inner edge; update DOM transforms without per-frame React renders.
- [ ] Build the Today header with local date and capacity summary, plus the floating quick-add entry.
- [ ] Connect task selection, edit, reschedule, completion, and undo to shared repository actions.
- [ ] Animate completion from the task's current diameter to 56 px and fade it out over approximately 300 ms; leave the persisted status unchanged if animation is interrupted.

---

### Task 5: Build inbox and review workflows

**Files:**
- Create: `src/pages/inbox/index.tsx`
- Create: `src/pages/review/index.tsx`
- Create: `src/components/schedule-sheet/index.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Task form supports required title, optional notes, optional positive integer load, and priority; inbox saves may keep load null.
- Schedule sheet requires a date and a load value before moving a task to planned; show capacity overflow before explicit confirmation.
- Review actions implement reschedule, split, someday, delete, complete, and undo via repository/domain operations.
- `someday` tasks preserve `carryoverCount`; reschedule does not increment it.

**Deliverable:** Users can capture tasks without date/load, schedule them with capacity feedback, and explicitly resolve every review task.

- [ ] Build the shared task form; allow null load in inbox and require a positive load before scheduling.
- [ ] Build the schedule sheet with local-date selection, target-day load summary, and explicit overflow confirmation.
- [ ] Build Inbox create/edit/delete flows and keep inbox tasks outside all planned-load totals.
- [ ] Build Review actions for reschedule, split, someday, delete, complete, and undo; keep undecided tasks in review.
- [ ] Preserve balloon count through reschedule/someday and apply the documented parent/child capacity rule for split tasks.

---

### Task 6: Build the weekly planner and responsive polish

**Files:**
- Create: `src/pages/planner/index.tsx`
- Modify: `src/index.css`
- Modify: `src/layout/index.tsx`

**Interfaces:**
- Planner displays a horizontal current-week date selector and a single-column view for the selected date.
- Each date shows planned load, capacity, overflow, and its tasks; no dense month grid or desktop sidebar.
- On viewports wider than 480 px, center a content column capped at 480 px; preserve bottom navigation and interaction order.

**Deliverable:** All four routes are navigable and consistent at phone and H5 widths, including 320 px screens and safe-area padding.

- [ ] Build the horizontal current-week date selector and selected-day single-column task/load view.
- [ ] Show daily overflow and task load without a dense month grid.
- [ ] Apply shared spacing, typography, touch target, safe-area, and reduced-motion styles to all routes.

---

### Task 7: Integrate app lifecycle and prepare the review build

**Files:**
- Modify: `src/application.tsx`
- Modify: `src/main.tsx`
- Modify: `src-tauri/tauri.conf.json` only if mobile window defaults need adjustment.

**Interfaces:**
- Initialize the selected repository before rendering page data.
- Run `processMissedTasks(todayLocalDate)` once on app start and when the app resumes after the local date changes; the repository operation remains idempotent.
- Keep loading and storage-error states visible and recoverable; do not silently discard writes.

**Deliverable:** A self-contained review prototype with deterministic initial examples, four complete page flows, persistent local data, and platform-adapted storage.

- [ ] Initialize repository and preferences before route content; expose recoverable loading/error states.
- [ ] Process missed tasks at startup and when the app returns to the foreground after a local date change.
- [ ] Prepare the H5 review entry point and a Tauri mobile entry using the same UI and domain behavior.

---
