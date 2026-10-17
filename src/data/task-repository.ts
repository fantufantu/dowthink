import { isTauri } from '@tauri-apps/api/core'
import type { Task, TaskAction, TaskDecision, UserPreferences } from '../domain/task'
import { IndexedDbTaskRepository } from './indexeddb/task-repository'
import { TauriSqliteTaskRepository } from './tauri-sqlite/task-repository'
import { createSampleTasks } from './sample-data'

export interface TaskRepository {
  listTasks(): Promise<Task[]>
  listDecisions(): Promise<TaskDecision[]>
  getPreferences(): Promise<UserPreferences>
  savePreferences(preferences: UserPreferences): Promise<void>
  saveTask(task: Task): Promise<void>
  applyTaskAction(action: TaskAction): Promise<Task[]>
  processMissedTasks(todayLocalDate: string): Promise<void>
  seedSampleData(tasks: Task[], preferences: UserPreferences): Promise<void>
}

export const createDefaultPreferences = (): UserPreferences => ({
  dailyCapacity: 8,
  capacityUnit: 'points',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
  dayBoundaryHour: 0,
  weekStartsOn: 1
})

export const createTaskRepository = async (): Promise<TaskRepository> => {
  const repository: TaskRepository = isTauri()
    ? new TauriSqliteTaskRepository()
    : new IndexedDbTaskRepository()
  const preferences = await repository.getPreferences()
  await repository.seedSampleData(createSampleTasks(new Date(), preferences), preferences)
  return repository
}
