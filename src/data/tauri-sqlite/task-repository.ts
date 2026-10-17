import { invoke } from '@tauri-apps/api/core'
import { applyTaskAction } from '../../domain/task-actions'
import type { Task, TaskAction, TaskDecision, UserPreferences } from '../../domain/task'
import { getLocalDateKey } from '../../shared/date'
import { createDefaultPreferences, type TaskRepository } from '../task-repository'

const changedTasks = (before: Task[], after: Task[]): Task[] => {
  const previous = new Map(before.map((task) => [task.id, JSON.stringify(task)]))
  return after.filter((task) => previous.get(task.id) !== JSON.stringify(task))
}

const changedDecisions = (before: TaskDecision[], after: TaskDecision[]): TaskDecision[] => {
  const known = new Set(before.map((decision) => decision.id))
  return after.filter((decision) => !known.has(decision.id))
}

export class TauriSqliteTaskRepository implements TaskRepository {
  private actionQueue: Promise<void> = Promise.resolve()

  listTasks(): Promise<Task[]> {
    return invoke<Task[]>('list_tasks')
  }

  listDecisions(): Promise<TaskDecision[]> {
    return invoke<TaskDecision[]>('list_decisions')
  }

  async getPreferences(): Promise<UserPreferences> {
    const preferences = await invoke<UserPreferences | null>('get_preferences')
    return preferences ?? createDefaultPreferences()
  }

  savePreferences(preferences: UserPreferences): Promise<void> {
    return invoke<void>('save_preferences', { preferences })
  }

  saveTask(task: Task): Promise<void> {
    return invoke<void>('save_task', { task })
  }

  applyTaskAction(action: TaskAction): Promise<Task[]> {
    const operation = this.actionQueue.then(() => this.applyQueuedTaskAction(action))
    this.actionQueue = operation.then(() => undefined, () => undefined)
    return operation
  }

  processMissedTasks(todayLocalDate: string): Promise<void> {
    const operation = this.actionQueue.then(() =>
      invoke<void>('process_missed_tasks', {
        todayLocalDate,
        processedAt: new Date().toISOString()
      })
    )
    this.actionQueue = operation.then(() => undefined, () => undefined)
    return operation
  }

  seedSampleData(tasks: Task[], preferences: UserPreferences): Promise<void> {
    return invoke<void>('seed_sample_data', { tasks, preferences })
  }

  private async applyQueuedTaskAction(action: TaskAction): Promise<Task[]> {
    const [tasks, decisions, preferences] = await Promise.all([
      this.listTasks(),
      this.listDecisions(),
      this.getPreferences()
    ])
    const processedAt = new Date().toISOString()
    const todayLocalDate = getLocalDateKey(new Date(processedAt), preferences.timezone)
    const next = applyTaskAction(tasks, decisions, action, todayLocalDate, processedAt)
    const decisionsToSave = changedDecisions(decisions, next.decisions)
    await invoke<void>('commit_state', {
      tasks: changedTasks(tasks, next.tasks),
      decisions: decisionsToSave
    })
    return next.tasks
  }
}
