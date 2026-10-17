import type { Task, TaskDecision, UserPreferences } from '../../domain/task'

export const DATABASE_NAME = 'todo-capacity'
export const DATABASE_VERSION = 1

export const STORE_NAMES = {
  tasks: 'tasks',
  decisions: 'decisions',
  preferences: 'preferences'
} as const

export type StoredPreferences = { id: 'default'; value: UserPreferences }

export interface IndexedDbSchema {
  tasks: Task
  decisions: TaskDecision
  preferences: StoredPreferences
}
