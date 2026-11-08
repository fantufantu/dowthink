import type { Task, TaskAction, TaskDecision } from './task'

export interface TaskActionTransition {
  tasks: Task[]
  decisions: TaskDecision[]
}

const createDecision = (
  task: Task,
  action: TaskDecision['action'],
  fromDate: string | null,
  toDate: string | null,
  processedAt: string,
  sequence: number,
  metadata: Record<string, unknown> = {}
): TaskDecision => ({
  id: `decision:${task.id}:${action}:${processedAt}:${sequence}`,
  taskId: task.id,
  action,
  fromDate,
  toDate,
  createdAt: processedAt,
  metadata: { before: task, ...metadata }
})

const requireTask = (tasks: Task[], taskId: string): Task => {
  const task = tasks.find((candidate) => candidate.id === taskId)
  if (!task) throw new Error('任务不存在或已被移除')
  return task
}

const replaceTask = (tasks: Task[], updated: Task): Task[] =>
  tasks.map((task) => (task.id === updated.id ? updated : task))

export const applyTaskAction = (
  tasks: Task[],
  decisions: TaskDecision[],
  action: TaskAction,
  todayLocalDate: string,
  processedAt: string
): TaskActionTransition => {
  const task = requireTask(tasks, action.taskId)

  if (action.action === 'undo') {
    const target = decisions.find((decision) => decision.id === action.decisionId && decision.taskId === task.id)
    if (!target || target.action === 'undo' || target.action === 'missed_cycle') {
      throw new Error('这项操作无法撤销')
    }
    if (decisions.some((decision) => decision.action === 'undo' && decision.metadata?.undoOf === target.id)) {
      throw new Error('这项操作已经撤销')
    }
    const previous = target.metadata?.before as Task | undefined
    if (!previous) throw new Error('找不到撤销所需的任务记录')

    const restored: Task = {
      ...previous,
      status: previous.status,
      plannedDate:
        previous.status === 'planned' && previous.plannedDate && previous.plannedDate < todayLocalDate
          ? todayLocalDate
          : previous.plannedDate,
      carryoverCount: Math.max(previous.carryoverCount, task.carryoverCount),
      lastProcessedCycleDate: task.lastProcessedCycleDate ?? previous.lastProcessedCycleDate,
      deletedAt: previous.deletedAt,
      updatedAt: processedAt
    }
    let nextTasks = replaceTask(tasks, restored)
    const createdChildIds = target.metadata?.createdChildIds as string[] | undefined
    if (createdChildIds?.length) {
      nextTasks = nextTasks.map((candidate) =>
        createdChildIds.includes(candidate.id)
          ? { ...candidate, status: 'archived', deletedAt: processedAt, plannedDate: null, updatedAt: processedAt }
          : candidate
      )
    }
    const undoDecision = createDecision(task, 'undo', task.plannedDate, restored.plannedDate, processedAt, decisions.length + 1, {
      undoOf: target.id
    })
    return { tasks: nextTasks, decisions: [...decisions, undoDecision] }
  }

  let updated: Task
  let decision: TaskDecision
  switch (action.action) {
    case 'reschedule': {
      if (!Number.isInteger(action.load) || action.load <= 0) throw new Error('安排日期前请填写正整数容量')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(action.plannedDate) || action.plannedDate < todayLocalDate) {
        throw new Error('请选择今天或之后的日期')
      }
      updated = { ...task, status: 'planned', plannedDate: action.plannedDate, load: action.load, updatedAt: processedAt }
      decision = createDecision(task, 'reschedule', task.plannedDate, action.plannedDate, processedAt, decisions.length + 1)
      break
    }
    case 'split': {
      if (!action.children.length || action.children.some((child) => !child.title.trim() || !Number.isInteger(child.load) || child.load <= 0)) {
        throw new Error('请至少填写一个标题和正整数容量的子任务')
      }
      const children: Task[] = action.children.map((child, index) => ({
        id: `${task.id}:child:${processedAt}:${index}`,
        title: child.title.trim(),
        status: 'inbox',
        load: child.load,
        plannedDate: null,
        priority: task.priority,
        parentId: task.id,
        carryoverCount: 0,
        lastProcessedCycleDate: null,
        createdAt: processedAt,
        updatedAt: processedAt,
        completedAt: null,
        deletedAt: null,
        sortOrder: task.sortOrder + index + 1
      }))
      updated = { ...task, status: 'archived', plannedDate: null, load: null, updatedAt: processedAt }
      decision = createDecision(task, 'split', task.plannedDate, null, processedAt, decisions.length + 1, {
        createdChildIds: children.map((child) => child.id)
      })
      return { tasks: [...replaceTask(tasks, updated), ...children], decisions: [...decisions, decision] }
    }
    case 'someday':
      updated = { ...task, status: 'someday', plannedDate: null, updatedAt: processedAt }
      decision = createDecision(task, 'someday', task.plannedDate, null, processedAt, decisions.length + 1)
      break
    case 'delete':
      updated = { ...task, status: 'archived', deletedAt: processedAt, updatedAt: processedAt }
      decision = createDecision(task, 'delete', task.plannedDate, null, processedAt, decisions.length + 1)
      break
    case 'complete':
      if (task.status === 'completed' || task.status === 'archived') throw new Error('这项待办已不在进行中')
      updated = { ...task, status: 'completed', completedAt: processedAt, updatedAt: processedAt }
      decision = createDecision(task, 'complete', task.plannedDate, null, processedAt, decisions.length + 1)
      break
  }

  return { tasks: replaceTask(tasks, updated), decisions: [...decisions, decision] }
}
