import { useRef } from 'react'
import { useTasks } from '../../hooks/use-tasks'
import { getLocalDateKey, addDaysToDateKey } from '../../shared/date'
import TaskDetailSheet, { type TaskDetailSheetHandle } from '../../components/task-detail-sheet'
import { isTaskActiveOnDate } from '../../domain/recurrence'
import { getPlannedLoad } from '../../domain/capacity'
import styles from './styles.module.css'

const Planner = () => {
  const { tasks, preferences, loading, runAction } = useTasks()
  const detailSheetRef = useRef<TaskDetailSheetHandle>(null)
  const today = getLocalDateKey(new Date(), preferences.timezone)
  const days = Array.from({ length: 7 }, (_, index) => addDaysToDateKey(today, index))
  const planned = tasks.filter((task) => task.status === 'planned')
  return <main className='page'><header className='page-heading'><div><p className='eyebrow'>给未来留一点空间</p><h1>计划</h1><p className='page-subtitle'>容量只是参考，安排可以随时调整。</p></div></header>
    <div className={styles['week-strip']}>{days.map((day, index) => <div className={`${styles['week-day']}${day === today ? ` ${styles['is-today']}` : ''}`} key={day}><small>{['今天','明天'][index] || new Intl.DateTimeFormat('zh-CN', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))}</small><strong>{Number(day.slice(-2))}</strong></div>)}</div>
    {loading ? <p className='loading-state'>正在加载…</p> : days.map((day) => <section className={styles['planner-day']} key={day}><div className='section-heading'><h2>{day === today ? '今天' : day === addDaysToDateKey(today, 1) ? '明天' : day}</h2><span>{getPlannedLoad(tasks, day)} / {preferences.dailyCapacity} 点</span></div>{planned.filter((task) => isTaskActiveOnDate(task, day)).map((task) => <button className='task-row' key={task.id} onClick={() => detailSheetRef.current?.open(task)}><span className='task-row__dot'>○</span><span className='task-row__body'><strong>{task.title}</strong><small>{task.load ?? '未估算'} 点</small></span><span className='row-chevron'>›</span></button>)}</section>)}
    <TaskDetailSheet ref={detailSheetRef} onAction={runAction} />
  </main>
}
export default Planner
