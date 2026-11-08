import { useMemo, useRef, useState } from 'react'
import { useTasks } from '../../hooks/use-tasks'
import BalloonContainer from '../../components/balloon-container'
import CapacitySummary from '../../components/capacity-summary'
import TaskDetailSheet, { type TaskDetailSheetHandle } from '../../components/task-detail-sheet'
import type { Task } from '../../domain/task'
import { getCapacitySummary } from '../../domain/capacity'
import { isTaskActiveOnDate } from '../../domain/recurrence'
import { getLocalDateKey } from '../../shared/date'
import styles from './styles.module.css'

const Today = () => {
  const { tasks, preferences, loading, error, runAction } = useTasks()
  const detailSheetRef = useRef<TaskDetailSheetHandle>(null)
  const [completingTask, setCompletingTask] = useState<Task | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const today = getLocalDateKey(new Date(), preferences.timezone)
  const todayTasks = useMemo(() => {
    const visible = tasks.filter((task) => isTaskActiveOnDate(task, today))
    if (
      completingTask &&
      isTaskActiveOnDate(completingTask, today) &&
      !visible.some((task) => task.id === completingTask.id)
    )
      visible.push(completingTask)
    return visible.sort((a, b) => a.sortOrder - b.sortOrder)
  }, [completingTask, tasks, today])
  const handleAction = async (action: Parameters<typeof runAction>[0]) => {
    if (action.action === 'complete') {
      const task = tasks.find((item) => item.id === action.taskId)
      await runAction(action)
      if (task) setCompletingTask(task)
      setCompletingId(action.taskId)
      window.setTimeout(() => {
        setCompletingId(null)
        setCompletingTask(null)
      }, 320)
      return
    }
    await runAction(action)
  }

  return (
    <main className='page today-page'>
      <header className='page-heading'>
        <div>
          <p className='eyebrow'>
            {new Intl.DateTimeFormat('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
          </p>
          <h1>今天，轻一点</h1>
          <p className='page-subtitle'>气球会提醒你：有些事，已经等了一阵子。</p>
        </div>
        <span className={styles['weather-mark']}>☁️</span>
      </header>
      <CapacitySummary summary={getCapacitySummary(tasks, today, preferences.dailyCapacity)} />
      {error && <div className='notice notice--error'>{error}</div>}
      {loading ? (
        <div className='loading-state'>正在整理今天的待办…</div>
      ) : (
        <>
          <section className={styles['balloon-section']}>
            <div className='section-heading'>
              <h2>今日容器</h2>
              <span>{todayTasks.length} 件</span>
            </div>
            <BalloonContainer
              tasks={todayTasks}
              completingId={completingId}
              onSelect={(task) => detailSheetRef.current?.open(task)}
            />
          </section>
        </>
      )}

      <TaskDetailSheet
        ref={detailSheetRef}
        onAction={handleAction}
      />
    </main>
  )
}
export default Today
