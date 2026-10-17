import type { Task, TaskRecurrence } from './task'
import { addDaysToDateKey, addMonthsToDateKey } from '../shared/date'

export const getCycleBoundary = (
  startDate: string,
  recurrence: TaskRecurrence,
  cycleNumber: number
): string => {
  if (!Number.isInteger(recurrence.interval) || recurrence.interval < 1) {
    throw new RangeError('Cycle interval must be a positive integer')
  }
  if (!Number.isInteger(cycleNumber) || cycleNumber < 1) {
    throw new RangeError('Cycle number must be a positive integer')
  }

  const offset = recurrence.interval * cycleNumber
  if (recurrence.unit === 'day') return addDaysToDateKey(startDate, offset)
  if (recurrence.unit === 'week') return addDaysToDateKey(startDate, offset * 7)
  return addMonthsToDateKey(startDate, offset)
}

export const getElapsedCycleBoundaries = (
  startDate: string,
  recurrence: TaskRecurrence,
  lastProcessedDate: string | null,
  today: string
): string[] => {
  const boundaries: string[] = []
  const processedThrough = lastProcessedDate || startDate

  for (let cycleNumber = 1; ; cycleNumber += 1) {
    const boundary = getCycleBoundary(startDate, recurrence, cycleNumber)
    if (boundary > today) break
    if (boundary > processedThrough) boundaries.push(boundary)
  }

  return boundaries
}

export const isTaskActiveOnDate = (task: Task, date: string): boolean => {
  if (task.status !== 'planned' || task.deletedAt != null || task.completedAt != null) return false
  if (!task.plannedDate) return false
  if (task.recurrence) return date >= task.plannedDate
  return task.plannedDate === date
}
