import { useCallback, useEffect, useState } from 'react'
import type { Task, TaskAction, UserPreferences } from '../domain/task'
import { createDefaultPreferences, createTaskRepository, type TaskRepository } from '../data/task-repository'
import { getLocalDateKey } from '../shared/date'

export const useTasks = () => {
  const [repository, setRepository] = useState<TaskRepository | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [preferences, setPreferences] = useState<UserPreferences>(createDefaultPreferences())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (repo = repository) => {
    if (!repo) return
    const [nextTasks, nextPreferences] = await Promise.all([repo.listTasks(), repo.getPreferences()])
    setTasks(nextTasks)
    setPreferences(nextPreferences)
  }, [repository])

  useEffect(() => {
    let alive = true
    const initialize = async () => {
      try {
        const repo = await createTaskRepository()
        const today = getLocalDateKey(new Date(), (await repo.getPreferences()).timezone)
        await repo.processMissedTasks(today)
        const [nextTasks, nextPreferences] = await Promise.all([repo.listTasks(), repo.getPreferences()])
        if (alive) {
          setRepository(repo)
          setTasks(nextTasks)
          setPreferences(nextPreferences)
          setError(null)
        }
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : '数据加载失败')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void initialize()
    return () => { alive = false }
  }, [])

  const runAction = useCallback(async (action: TaskAction) => {
    if (!repository) throw new Error('数据还在加载，请稍后再试')
    const today = getLocalDateKey(new Date(), preferences.timezone)
    await repository.applyTaskAction(action)
    await repository.processMissedTasks(today)
    await refresh(repository)
  }, [preferences.timezone, refresh, repository])

  const saveTask = useCallback(async (task: Task) => {
    if (!repository) throw new Error('数据还在加载，请稍后再试')
    await repository.saveTask(task)
    await refresh(repository)
  }, [refresh, repository])

  return { tasks, preferences, loading, error, runAction, saveTask, refresh }
}
