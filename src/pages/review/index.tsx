import { useTasks } from '../../hooks/use-tasks'
import type { Task } from '../../domain/task'
import { getLocalDateKey, addDaysToDateKey } from '../../shared/date'
import styles from './styles.module.css'

const Review = () => {
  const { tasks, preferences, loading, runAction } = useTasks()
  const today = getLocalDateKey(new Date(), preferences.timezone)
  const reviewTasks = tasks.filter((task) => task.status === 'review').sort((a, b) => a.sortOrder - b.sortOrder)
  const decide = async (task: Task, action: 'reschedule' | 'someday' | 'delete') => {
    if (action === 'reschedule') await runAction({ action, taskId: task.id, plannedDate: addDaysToDateKey(today, 1), load: task.load || 1 })
    else await runAction({ action, taskId: task.id })
  }
  return <main className='page'><header className='page-heading'><div><p className='eyebrow'>温和地重新选择</p><h1>复盘一下</h1><p className='page-subtitle'>没完成不代表失败，只是给你一次重新安排的机会。</p></div></header>
    {loading ? <p className='loading-state'>正在整理…</p> : reviewTasks.length ? <div className={styles['review-stack']}>{reviewTasks.map((task) => <article className={styles['review-card']} key={task.id}><span className='status-pill'>待重新决定 · {task.carryoverCount} 个周期</span><h2>{task.title}</h2><p>上次安排：{task.plannedDate || '日期未记录'} · 容量 {task.load ?? '未估算'} 点</p><div className={styles['review-card__actions']}><button className='button button--primary' onClick={() => void decide(task, 'reschedule')}>安排到明天</button><button className='button button--outline' onClick={() => void decide(task, 'someday')}>放到以后</button><button className={styles['text-button']} onClick={() => void decide(task, 'delete')}>删除</button></div></article>)}</div> : <div className='empty-state'><span>🌿</span><h3>暂时没有需要复盘的待办</h3><p>每天结束时，未完成的事项会来到这里。</p></div>}
  </main>
}
export default Review
