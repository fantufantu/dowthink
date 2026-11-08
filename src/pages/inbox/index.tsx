import { useRef } from 'react'
import { useTasks } from '../../hooks/use-tasks'
import TaskDetailSheet, { type TaskDetailSheetHandle } from '../../components/task-detail-sheet'

const Inbox = () => {
  const { tasks, loading, runAction } = useTasks()
  const detailSheetRef = useRef<TaskDetailSheetHandle>(null)
  const inbox = tasks.filter((task) => task.status === 'inbox').sort((a, b) => a.sortOrder - b.sortOrder)
  return <main className='page'><header className='page-heading'><div><p className='eyebrow'>先收好，不必现在安排</p><h1>备选事项</h1><p className='page-subtitle'>想到的事情先放这里，之后再决定何时做。</p></div></header>
    <section className='task-list-section'><div className='section-heading'><h2>尚未安排 <span className='count-badge'>{inbox.length}</span></h2></div>{loading ? <p className='loading-state'>正在加载…</p> : inbox.length ? inbox.map((task) => <button key={task.id} className='task-row' onClick={() => detailSheetRef.current?.open(task)}><span className='task-row__dot'>＋</span><span className='task-row__body'><strong>{task.title}</strong><small>{task.load === null ? '容量待估算' : `${task.load} 点`}</small></span><span className='row-chevron'>›</span></button>) : <div className='empty-state empty-state--compact'><span>📥</span><h3>暂无备选事项</h3><p>点击底部“添加”记录新待办。</p></div>}</section>
    <TaskDetailSheet ref={detailSheetRef} onAction={runAction} />
  </main>
}
export default Inbox
