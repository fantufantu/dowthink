import { applyTaskAction } from '../../domain/task-actions'
import type { Task, TaskAction, TaskDecision, UserPreferences } from '../../domain/task'
import { transitionMissedTasks } from '../../domain/review'
import { getLocalDateKey } from '../../shared/date'
import { createDefaultPreferences, type TaskRepository } from '../task-repository'
import { DATABASE_NAME, DATABASE_VERSION, STORE_NAMES, type StoredPreferences } from './schema'

const requestResult = <T,>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })

const transactionResult = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAMES.tasks)) {
        const tasks = database.createObjectStore(STORE_NAMES.tasks, { keyPath: 'id' })
        tasks.createIndex('status', 'status', { unique: false })
        tasks.createIndex('plannedDate', 'plannedDate', { unique: false })
      }
      if (!database.objectStoreNames.contains(STORE_NAMES.decisions)) {
        const decisions = database.createObjectStore(STORE_NAMES.decisions, { keyPath: 'id' })
        decisions.createIndex('taskId', 'taskId', { unique: false })
        decisions.createIndex('createdAt', 'createdAt', { unique: false })
      }
      if (!database.objectStoreNames.contains(STORE_NAMES.preferences)) {
        database.createObjectStore(STORE_NAMES.preferences, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'))
  })

const changedTasks = (before: Task[], after: Task[]): Task[] => {
  const previous = new Map(before.map((task) => [task.id, JSON.stringify(task)]))
  return after.filter((task) => previous.get(task.id) !== JSON.stringify(task))
}

const changedDecisions = (before: TaskDecision[], after: TaskDecision[]): TaskDecision[] => {
  const known = new Set(before.map((decision) => decision.id))
  return after.filter((decision) => !known.has(decision.id))
}

export class IndexedDbTaskRepository implements TaskRepository {
  private databasePromise = openDatabase()

  async listTasks(): Promise<Task[]> {
    const database = await this.databasePromise
    const transaction = database.transaction(STORE_NAMES.tasks, 'readonly')
    const request = transaction.objectStore(STORE_NAMES.tasks).getAll() as IDBRequest<Task[]>
    return requestResult(request)
  }

  async listDecisions(): Promise<TaskDecision[]> {
    const database = await this.databasePromise
    const transaction = database.transaction(STORE_NAMES.decisions, 'readonly')
    const request = transaction.objectStore(STORE_NAMES.decisions).getAll() as IDBRequest<TaskDecision[]>
    return requestResult(request)
  }

  async getPreferences(): Promise<UserPreferences> {
    const database = await this.databasePromise
    const transaction = database.transaction(STORE_NAMES.preferences, 'readonly')
    const record = await requestResult(transaction.objectStore(STORE_NAMES.preferences).get('default') as IDBRequest<StoredPreferences | undefined>)
    return record?.value ?? createDefaultPreferences()
  }

  async savePreferences(preferences: UserPreferences): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(STORE_NAMES.preferences, 'readwrite')
    transaction.objectStore(STORE_NAMES.preferences).put({ id: 'default', value: preferences } satisfies StoredPreferences)
    await transactionResult(transaction)
  }

  async saveTask(task: Task): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(STORE_NAMES.tasks, 'readwrite')
    transaction.objectStore(STORE_NAMES.tasks).put(task)
    await transactionResult(transaction)
  }

  async applyTaskAction(action: TaskAction): Promise<Task[]> {
    const preferences = await this.getPreferences()
    const today = getLocalDateKey(new Date(), preferences.timezone)
    await this.updateState((tasks, decisions) =>
      applyTaskAction(tasks, decisions, action, today, new Date().toISOString())
    )
    return this.listTasks()
  }

  async processMissedTasks(todayLocalDate: string): Promise<void> {
    const processedAt = new Date().toISOString()
    await this.updateState((tasks) => transitionMissedTasks(tasks, todayLocalDate, processedAt))
  }

  async seedSampleData(tasks: Task[], preferences: UserPreferences): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction(
      [STORE_NAMES.tasks, STORE_NAMES.preferences],
      'readwrite'
    )
    const taskStore = transaction.objectStore(STORE_NAMES.tasks)
    const preferencesStore = transaction.objectStore(STORE_NAMES.preferences)
    let tasksReady = false
    let preferencesReady = false
    let existingTasks: Task[] = []
    let existingPreferences: StoredPreferences | undefined

    const seedWhenReady = () => {
      if (!tasksReady || !preferencesReady) return
      const existingIds = new Set(existingTasks.map((task) => task.id))
      tasks.filter((task) => task.id.startsWith('sample-') && !existingIds.has(task.id))
        .forEach((task) => taskStore.put(task))
      if (!existingPreferences) preferencesStore.put({ id: 'default', value: preferences } satisfies StoredPreferences)
    }

    taskStore.getAll().onsuccess = (event) => {
      existingTasks = (event.target as IDBRequest<Task[]>).result
      tasksReady = true
      seedWhenReady()
    }
    preferencesStore.get('default').onsuccess = (event) => {
      existingPreferences = (event.target as IDBRequest<StoredPreferences | undefined>).result
      preferencesReady = true
      seedWhenReady()
    }
    await transactionResult(transaction)
  }

  private async updateState(
    transitionState: (tasks: Task[], decisions: TaskDecision[]) => { tasks: Task[]; decisions: TaskDecision[] }
  ): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction([STORE_NAMES.tasks, STORE_NAMES.decisions], 'readwrite')
    const tasksStore = transaction.objectStore(STORE_NAMES.tasks)
    const decisionsStore = transaction.objectStore(STORE_NAMES.decisions)
    let tasksReady = false
    let decisionsReady = false
    let beforeTasks: Task[] = []
    let beforeDecisions: TaskDecision[] = []
    let transitionError: unknown

    const writeTransition = () => {
      if (!tasksReady || !decisionsReady) return
      try {
        const next = transitionState(beforeTasks, beforeDecisions)
        changedTasks(beforeTasks, next.tasks).forEach((task) => tasksStore.put(task))
        changedDecisions(beforeDecisions, next.decisions).forEach((decision) => decisionsStore.put(decision))
      } catch (error) {
        transitionError = error
        transaction.abort()
      }
    }

    tasksStore.getAll().onsuccess = (event) => {
      beforeTasks = (event.target as IDBRequest<Task[]>).result
      tasksReady = true
      writeTransition()
    }
    decisionsStore.getAll().onsuccess = (event) => {
      beforeDecisions = (event.target as IDBRequest<TaskDecision[]>).result
      decisionsReady = true
      writeTransition()
    }
    try {
      await transactionResult(transaction)
    } catch (error) {
      throw transitionError ?? error
    }
  }
}
