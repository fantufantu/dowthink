# 周期待办新建页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立独立周期待办创建页，并让同一条未完成待办按日、周、月周期持续显示和增长气球。

**Architecture:** 在共享 Task 模型中加入可选周期信息，周期日期算法负责活动日期与已跨周期边界；IndexedDB 与 Rust/SQLite 分别按同一规则幂等推进周期。新建页面通过现有 repository 保存，所有新增入口进入此页面；今日与计划视图、容量摘要读取周期活动状态。

**Tech Stack:** React 18、TypeScript、Wasp/Bee Router、IndexedDB、Tauri 2、Rust、SQLite。

**Spec:** `docs/superpowers/specs/2026-10-17-recurring-task-create-design.md`

## Global Constraints

- 周期由正整数间隔及 day/week/month 单位组成，默认每 1 天。
- 开始日期默认用户时区今天；周按 7 个日历日，月按开始日期日号锚定并在短月取月末。
- 周期待办从开始日期起每日显示；未完成跨周期时同一记录推进并增加一次 `carryoverCount`，不生成副本。
- 离线跨过多个周期时补记全部边界；处理必须幂等。
- 无周期字段的既有待办保持旧单日复盘逻辑。
- 完成和删除从活动视图移除，数据按现有完成/软删除规则保留。
- 今日、收件箱、计划及底部导航的添加入口进入同一新建页。
- 浏览器端使用 IndexedDB；Tauri 端使用 SQLite JSON payload；不得添加新的运行时依赖。

## Review Focus

- **未来开始日**：在开始日期之前，待办不出现在今日/计划活动项，也不计今日容量。
- **月末锚点**：1 月 31 日按月周期的边界为 2 月末、3 月 31 日，不因短月持续漂移。
- **离线多周期**：补计所有到期边界，并为每个边界写入唯一决策；重复启动不重复计数。
- **旧记录**：无周期字段的计划待办仍转入旧复盘状态，且重复处理只增加一次。
- **终止状态**：已完成或软删除待办不再推进周期、不显示在活动视图、不占今日容量。

---

### Task 1: 周期领域类型和日期计算

**Files:**
- Modify: `src/domain/task.ts`
- Create: `src/domain/recurrence.ts`
- Modify: `src/shared/date.ts`

**Interfaces:**
- Produces `TaskRecurrence = { interval: number; unit: 'day' | 'week' | 'month' }`；`Task.recurrence?: TaskRecurrence`。
- `getCycleBoundary(startDate: string, recurrence: TaskRecurrence, cycleNumber: number): string` 返回从第 1 个周期起的边界日期。
- `getElapsedCycleBoundaries(startDate: string, recurrence: TaskRecurrence, lastProcessedDate: string | null, today: string): string[]` 返回严格晚于已处理边界且不晚于 today 的周期边界。
- `isTaskActiveOnDate(task: Task, date: string): boolean` 只判断 planned、未删除、未完成任务；周期任务从 `plannedDate` 起每日活动，普通任务仅在 `plannedDate` 活动。

- [ ] 在 `Task` 定义可选 recurrence 字段，旧记录不需要字段迁移。
- [ ] 在 `src/shared/date.ts` 添加基于 UTC date key 的月边界辅助函数，目标月份按原始开始日 clamp 到月末。
- [ ] 在 `src/domain/recurrence.ts` 实现周期边界枚举、活动日期判断；日/周使用日历日，周间隔换算为 7 天。
- [ ] 运行 `pnpm build` 检查类型和导入。

### Task 2: 周期日切与双存储幂等处理

**Files:**
- Modify: `src/domain/review.ts`
- Modify: `src-tauri/src/commands.rs`

**Interfaces:**
- 消费 Task 1 的 `TaskRecurrence` 与 `getElapsedCycleBoundaries`。
- 保留 `transitionMissedTasks(tasks, todayLocalDate, processedAt)` 公共签名。
- 周期任务保持 `planned`；每个到期边界使 `carryoverCount` 加 1、更新 `lastProcessedCycleDate`，并生成 `missed_cycle:<taskId>:<boundaryDate>` 决策。`fromDate` 为前一边界（首次为开始日期），`toDate` 为本次边界，metadata 保存更新后的计数。
- 无 recurrence 任务沿用当前 `review` 转换行为。

- [ ] 修改 `transitionMissedTasks`：分支处理周期任务并保持一次性旧待办原有逻辑。
- [ ] 确认 IndexedDB 现有 `updateState` 已原子写入变更任务与新增决策，并与新的周期 transition 接通。
- [ ] 修改 Rust `process_missed_tasks`：解析可选 recurrence，按相同日/周/月边界算法补记周期，保持任务和决策在 SQLite 同一事务提交。
- [ ] 校验完成、删除、未来开始及无到期边界的任务不推进周期。
- [ ] 运行 `pnpm build` 和 `cargo check --manifest-path src-tauri/Cargo.toml`。

### Task 3: 独立创建页和统一添加入口

**Files:**
- Modify: `src/components/task-form/index.tsx`
- Create: `src/pages/new-task/index.tsx`
- Modify: `src/main.tsx`
- Modify: `src/components/bottom-navigation/index.tsx`
- Modify: `src/pages/inbox/index.tsx`
- Modify: `src/pages/today/index.tsx`
- Modify: `src/pages/planner/index.tsx`
- Modify: `src/index.css`

**Interfaces:**
- 新页面路由 `/tasks/new`，通过 `useTasks().saveTask` 保存并通过 Bee Router `useNavigate` 成功后跳转 `/today`。
- TaskForm 提交 Task：`status: 'planned'`、`plannedDate: startDate`、`recurrence: { interval, unit }`、标题和 notes；容量沿用现有新建默认值 1。

- [ ] 将 TaskForm 改为标题、明细 textarea、正整数周期间隔、日/周/月单位、开始日期表单；默认 1 天和用户本地今天。
- [ ] 增加 `/tasks/new` 页面标题、返回入口、保存错误提示；保存成功后回今日页。
- [ ] 将底部“添加”改为指向 `/tasks/new` 的主按钮，并注册新路由。
- [ ] 将今日、收件箱、计划页的快捷添加表单替换为指向同一新建页的入口。
- [ ] 为新表单和独立页面补充移动端布局、焦点和标签样式。
- [ ] 运行 `pnpm build` 检查路由、组件类型和样式引用。

### Task 4: 今日与计划展示、容量统计

**Files:**
- Modify: `src/domain/capacity.ts`
- Modify: `src/pages/today/index.tsx`
- Modify: `src/pages/planner/index.tsx`

**Interfaces:**
- 消费 Task 1 的 `isTaskActiveOnDate(task, date)`。
- `getPlannedLoad(tasks, date)` 对普通待办保留精确 plannedDate 规则；对 active recurrence 在开始日期及之后每一天计入其 load。

- [ ] 更新 `getPlannedLoad`，周期任务只在 planned 状态及其开始日之后计入每天容量。
- [ ] 更新今日页筛选，使周期任务从开始日期起每天进入气球容器；保留原有普通待办过滤行为。
- [ ] 更新计划周视图，使周期任务出现在开始日期之后相应的每个日期，普通待办仍按 plannedDate 显示。
- [ ] 确保完成和删除状态不显示、不计容量；运行 `pnpm build`。

### Task 5: 集成验收

**Files:** 无新增文件。

- [ ] 运行 `pnpm build` 和 `cargo check --manifest-path src-tauri/Cargo.toml`。
- [ ] 手动验收默认每天一次、每周一次、每月一次及自定义间隔，确认同一 ID 持续存在且不生成副本。
- [ ] 手动验收未来开始日期在开始前隐藏、开始后每日显示，并正确计入今日容量。
- [ ] 手动验收月末序列：1 月 31 日 → 2 月末 → 3 月 31 日。
- [ ] 手动验收离线跨多个边界后每个周期只增加一级，重复启动不会重复增长。
- [ ] 手动验收无周期旧待办仍进入原复盘流程。
- [ ] 手动验收已完成和软删除的周期待办不显示、不计容量、不再推进周期。
- [ ] 手动验收所有添加入口均打开新建页，保存成功返回今日，保存失败保留输入并显示错误。
