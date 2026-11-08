import styles from './styles.module.css'

interface ConfirmCompletionProps {
  open: boolean
  taskTitle: string
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: () => void
}

const ConfirmCompletion = ({ open, taskTitle, busy = false, error, onCancel, onConfirm }: ConfirmCompletionProps) => {
  if (!open) return null
  return (
    <div className={`sheet-scrim ${styles['sheet-scrim--nested']}`} role='presentation' onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel()
    }}>
      <section className={styles['confirm-sheet']} role='dialog' aria-modal='true' aria-labelledby='confirm-title'>
        <div className='sheet-handle' />
        <div className={styles['confirm-sheet__balloon']} aria-hidden='true'>🎈</div>
        <h3 id='confirm-title'>这件事完成了吗？</h3>
        <p className={styles['confirm-sheet__task']}>{taskTitle}</p>
        <p className={styles['confirm-sheet__hint']}>确认后，这只气球会缩小并从今日容器中移开。</p>
        {error && <p className='form-error' role='alert'>{error}</p>}
        <div className={styles['confirm-sheet__actions']}>
          <button className='button button--quiet' type='button' onClick={onCancel} disabled={busy}>还没完成</button>
          <button className='button button--primary' type='button' onClick={onConfirm} disabled={busy}>
            {busy ? '正在保存…' : '确认完成'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default ConfirmCompletion
