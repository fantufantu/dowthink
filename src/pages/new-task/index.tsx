import { useNavigate } from '@aiszlab/bee/router'
import TaskForm from '../../components/task-form'
import { useTasks } from '../../hooks/use-tasks'
import { getLocalDateKey } from '../../shared/date'

const NewTask = () => {
  const { preferences, loading, error, saveTask } = useTasks()
  const navigate = useNavigate()
  const today = getLocalDateKey(new Date(), preferences.timezone)

  const createTask = async (task: Parameters<typeof saveTask>[0]) => {
    await saveTask(task)
    navigate('/today', { replace: true })
  }

  const returnToPreviousPage = () => {
    if (window.history.length > 1) window.history.back()
    else navigate('/today', { replace: true })
  }

  return <main className='page new-task-page'>
    <header className='page-heading new-task-page__heading'>
      <div>
        <p className='eyebrow'>记下想持续完成的事</p>
        <h1>添加待办</h1>
        <p className='page-subtitle'>设定周期后，它会每天陪着你，直到完成。</p>
      </div>
      <button className='button button--outline' type='button' onClick={returnToPreviousPage}>返回</button>
    </header>
    {error && <p className='form-error' role='alert'>{error}</p>}
    {loading ? <p className='loading-state'>正在准备表单…</p> : <TaskForm today={today} onSave={createTask} />}
  </main>
}

export default NewTask
