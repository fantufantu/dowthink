import { useEffect, useId, useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { Button, Input, Select, Textarea } from 'musae'
import type { Task, TaskCycleUnit } from '../../domain/task'
import { makeTaskId } from '../../domain/task'

interface TaskFormProps {
  onSave: (task: Task) => Promise<void>
  today: string
}

const TaskForm = ({ onSave, today }: TaskFormProps) => {
  const id = useId()
  const titleInput = useRef<ComponentRef<typeof Input>>(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [interval, setInterval] = useState('1')
  const [unit, setUnit] = useState<TaskCycleUnit>('day')
  const [startDate, setStartDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [attempted, setAttempted] = useState(false)
  const parsedInterval = Number(interval)
  const intervalValid = Number.isSafeInteger(parsedInterval) && parsedInterval > 0

  useEffect(() => {
    titleInput.current?.focus?.()
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setAttempted(true)
    if (!title.trim() || !intervalValid || !startDate) return

    const now = new Date().toISOString()
    const task: Task = {
      id: makeTaskId(),
      title: title.trim(),
      notes: notes.trim() || undefined,
      status: 'planned',
      load: 1,
      plannedDate: startDate,
      recurrence: { interval: parsedInterval, unit },
      priority: 'normal',
      parentId: null,
      carryoverCount: 0,
      lastProcessedCycleDate: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      deletedAt: null,
      sortOrder: Date.now()
    }

    setSaving(true)
    setError('')
    try {
      await onSave(task)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请再试一次')
    } finally {
      setSaving(false)
    }
  }

  return <form className='task-form task-form--page' onSubmit={submit}>
    <div className='task-form__field'>
      <label>待办标题
        <Input ref={titleInput} value={title} onChange={setTitle} placeholder='例如：读完这本书' maxLength={120} invalid={attempted && !title.trim()} style={{ width: '100%' }} />
      </label>
    </div>
    <div className='task-form__field'>
      <label>待办明细
        <Textarea value={notes} onChange={(value) => setNotes(value.slice(0, 2000))} placeholder='补充背景、步骤或其他细节…' rows={4} style={{ width: '100%' }} />
      </label>
    </div>
    <fieldset className='task-form__field task-form__cycle'>
      <legend>待办周期</legend>
      <span className='task-form__cycle-controls'>
        <label className='sr-only' htmlFor={`${id}-interval`}>周期次数</label>
        <input id={`${id}-interval`} type='number' min='1' step='1' value={interval} onChange={(event) => setInterval(event.target.value)} aria-invalid={attempted && !intervalValid} aria-describedby={`${id}-interval-error`} />
        <label className='sr-only' htmlFor={`${id}-unit`}>周期单位</label>
        <Select
          value={unit}
          options={[
            { value: 'day', label: '天' },
            { value: 'week', label: '周' },
            { value: 'month', label: '月' }
          ]}
          onChange={(value) => setUnit(String(value) as TaskCycleUnit)}
          style={{ width: '110px' }}
        />
        <span>一次</span>
      </span>
      {attempted && !intervalValid && <small id={`${id}-interval-error`} className='form-error' role='alert'>请输入大于 0 的整数周期。</small>}
    </fieldset>
    <div className='task-form__field'>
      <label htmlFor={`${id}-start`}>开始日期</label>
      <input id={`${id}-start`} type='date' value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
      <small>从开始日期起，这件待办会每天出现在今日页。</small>
    </div>
    {attempted && !title.trim() && <p className='form-error' role='alert'>请填写待办标题。</p>}
    {attempted && !startDate && <p className='form-error' role='alert'>请选择开始日期。</p>}
    {error && <p className='form-error' role='alert'>{error}</p>}
    <Button className='task-form__submit' type='submit' disabled={saving}>
      {saving ? '保存中…' : '创建待办'}
    </Button>
  </form>
}

export default TaskForm
