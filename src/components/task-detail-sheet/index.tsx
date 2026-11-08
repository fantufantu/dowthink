import { useState } from 'react'
import type { Task, TaskAction } from '../../domain/task'
import ConfirmCompletion from '../confirm-completion'
import styles from './styles.module.css'

interface TaskDetailSheetProps {
  task: Task | null
  onClose: () => void
  onAction: (action: TaskAction) => Promise<void>
  onSchedule: (task: Task) => void
  onSplit: (task: Task) => void
  onSomeday: (task: Task) => void
  onDelete: (task: Task) => void
}

const statusLabels: Record<Task['status'], string> = {
  inbox: '还没安排日期',
  planned: '已安排',
  review: '等你重新决定',
  someday: '以后再说',
  completed: '已完成',
  archived: '已收起'
}

const TaskDetailSheet = ({ task, onClose, onAction, onSchedule, onSplit, onSomeday, onDelete }: TaskDetailSheetProps) => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subflow, setSubflow] = useState<'schedule' | 'split' | null>(null)
  const [plannedDate, setPlannedDate] = useState(task?.plannedDate || new Date().toISOString().slice(0, 10))
  const [load, setLoad] = useState(task?.load || 1)
  const [childTitles, setChildTitles] = useState(['', ''])

  if (!task) return null

  const handleComplete = async () => {
    setBusy(true)
    setError(null)
    try {
      await onAction({ action: 'complete', taskId: task.id })
      setConfirmOpen(false)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请再试一次')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={styles['sheet-scrim']} role='presentation' onMouseDown={(event) => {
        if (event.target === event.currentTarget && !confirmOpen) onClose()
      }}>
        <section className={styles['task-sheet']} role='dialog' aria-modal='true' aria-labelledby='task-sheet-title'>
          <div className='sheet-handle' />
          <div className={styles['task-sheet__eyebrow']}>
            <span className='status-pill'>{statusLabels[task.status]}</span>
            {task.carryoverCount > 0 && <span className={styles['task-sheet__cycles']}>未完成 {task.carryoverCount} 个周期</span>}
          </div>
          <h2 id='task-sheet-title'>{task.title}</h2>
          {task.notes && <p className={styles['task-sheet__notes']}>{task.notes}</p>}
          <div className={styles['task-sheet__meta']}>
            <span>{task.load === null ? '容量待估算' : `容量 ${task.load} 点`}</span>
            {task.plannedDate && <span>{task.plannedDate}</span>}
          </div>
          <div className={styles['task-sheet__actions']}>
            <button className={`button button--primary ${styles['task-sheet__complete']}`} type='button' onClick={() => setConfirmOpen(true)}>
              标记完成
            </button>
            <div className={styles['task-sheet__action-grid']}>
              <button className='button button--outline' type='button' onClick={() => { setSubflow(subflow === 'schedule' ? null : 'schedule'); setError(null) }}>安排日期</button>
              <button className='button button--outline' type='button' onClick={() => { setSubflow(subflow === 'split' ? null : 'split'); setError(null) }}>拆成小步骤</button>
              <button className='button button--outline' type='button' onClick={() => onSomeday(task)}>暂缓</button>
              <button className='button button--outline button--danger' type='button' onClick={() => onDelete(task)}>删除</button>
            </div>
            {subflow === 'schedule' && <div className={styles['sheet-subflow']}><label>安排日期<input type='date' value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} /></label><label>容量点数<input type='number' min='1' max='8' value={load} onChange={(event) => setLoad(Number(event.target.value))} /></label><button className='button button--primary' type='button' onClick={async () => { try { await onAction({ action: 'reschedule', taskId: task.id, plannedDate, load }); onClose() } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败') } }}>保存安排</button></div>}
            {subflow === 'split' && <div className={styles['sheet-subflow']}><p>拆成两个更容易开始的小步骤</p>{childTitles.map((title, index) => <input key={index} placeholder={`步骤 ${index + 1}`} value={title} onChange={(event) => setChildTitles((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />)}<button className='button button--primary' type='button' disabled={childTitles.some((title) => !title.trim())} onClick={async () => { try { await onAction({ action: 'split', taskId: task.id, children: childTitles.map((title) => ({ title: title.trim(), load: 1 })) }); onClose() } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败') } }}>保存步骤</button></div>}
          </div>
        </section>
      </div>
      <ConfirmCompletion
        open={confirmOpen}
        taskTitle={task.title}
        busy={busy}
        error={error}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleComplete}
      />
    </>
  )
}

export default TaskDetailSheet
