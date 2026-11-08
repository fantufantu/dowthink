import { useState } from 'react'
import { useTasks } from '../../hooks/use-tasks'
import TaskDetailSheet from '../../components/task-detail-sheet'
import type { Task } from '../../domain/task'
import { getLocalDateKey } from '../../shared/date'

const Inbox = () => {
  const { tasks, preferences, loading, runAction } = useTasks()
  const [selected, setSelected] = useState<Task | null>(null)
  const today = getLocalDateKey(new Date(), preferences.timezone)
  const inbox = tasks.filter((task) => task.status === 'inbox').sort((a, b) => a.sortOrder - b.sortOrder)
  const act = async (action: Parameters<typeof runAction>[0]) => { await runAction(action); setSelected(null) }
  return <main className='page'><header className='page-heading'><div><p className='eyebrow'>先收好，不必现在安排</p><h1>备选事项</h1><p className='page-subtitle'>想到的事情先放这里，之后再决定何时做。</p></div></header>
    <section className='task-list-section'><div className='section-heading'><h2>尚未安排 <span className='count-badge'>{inbox.length}</span></h2></div>{loading ? <p className='loading-state'>正在加载…</p> : inbox.length ? inbox.map((task) => <button key={task.id} className='task-row' onClick={() => setSelected(task)}><span className='task-row__dot'>＋</span><span className='task-row__body'><strong>{task.title}</strong><small>{task.load === null ? '容量待估算' : `${task.load} 点`}</small></span><span className='row-chevron'>›</span></button>) : <div className='empty-state empty-state--compact'><span>📥</span><h3>暂无备选事项</h3><p>点击底部“添加”记录新待办。</p></div>}</section>
    <TaskDetailSheet task={selected} onClose={() => setSelected(null)} onAction={act} onSchedule={(task) => void act({ action: 'reschedule', taskId: task.id, plannedDate: today, load: task.load || 1 })} onSplit={() => {}} onSomeday={(task) => void act({ action: 'someday', taskId: task.id })} onDelete={(task) => void act({ action: 'delete', taskId: task.id })} />
  </main>
}
export default Inbox
