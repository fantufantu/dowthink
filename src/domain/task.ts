export type TaskStatus = 'inbox' | 'planned' | 'review' | 'someday' | 'completed' | 'archived'

export type TaskPriority = 'low' | 'normal' | 'high'

export type TaskCycleUnit = 'day' | 'week' | 'month'

export interface TaskRecurrence {
  interval: number
  unit: TaskCycleUnit
}

export interface Task {
  id: string
  title: string
  notes?: string
  status: TaskStatus
  load: number | null
  plannedDate: string | null
  priority: TaskPriority
  parentId: string | null
  carryoverCount: number
  lastProcessedCycleDate: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  deletedAt: string | null
  sortOrder: number
  recurrence?: TaskRecurrence
}

export interface UserPreferences {
  dailyCapacity: number
  capacityUnit: 'points'
  timezone: string
  dayBoundaryHour: 0
  weekStartsOn: 0 | 1
}

export type TaskDecisionAction =
  | 'missed_cycle'
  | 'reschedule'
  | 'split'
  | 'someday'
  | 'delete'
  | 'complete'
  | 'undo'

export interface TaskDecision {
  id: string
  taskId: string
  action: TaskDecisionAction
  fromDate: string | null
  toDate: string | null
  createdAt: string
  metadata?: Record<string, unknown>
}

export type TaskAction =
  | { action: 'reschedule'; taskId: string; plannedDate: string; load: number }
  | { action: 'split'; taskId: string; children: Array<{ title: string; load: number }> }
  | { action: 'someday'; taskId: string }
  | { action: 'delete'; taskId: string }
  | { action: 'complete'; taskId: string }
  | { action: 'undo'; taskId: string; decisionId: string }

export const makeTaskId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
