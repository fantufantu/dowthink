import type { Task, TaskDecision } from './task'
import { getElapsedCycleBoundaries } from './recurrence'
import { addDaysToDateKey } from '../shared/date'

export interface MissedTaskTransition {
  tasks: Task[]
  decisions: TaskDecision[]
}

export const transitionMissedTasks = (
  tasks: Task[],
  todayLocalDate: string,
  processedAt: string
): MissedTaskTransition => {
  const decisions: TaskDecision[] = []
  const updatedTasks = tasks.map((task) => {
    const missedPlannedDate = task.plannedDate
    if (task.status !== 'planned' || !missedPlannedDate || task.deletedAt != null || task.completedAt != null) return task

    if (task.recurrence) {
      const boundaries = getElapsedCycleBoundaries(
        missedPlannedDate,
        task.recurrence,
        task.lastProcessedCycleDate,
        todayLocalDate
      )
      if (!boundaries.length) return task

      let carryoverCount = task.carryoverCount
      let previousBoundary = task.lastProcessedCycleDate || missedPlannedDate
      for (const boundary of boundaries) {
        carryoverCount += 1
        decisions.push({
          id: `missed_cycle:${task.id}:${boundary}`,
          taskId: task.id,
          action: 'missed_cycle',
          fromDate: previousBoundary,
          toDate: boundary,
          createdAt: processedAt,
          metadata: { carryoverCount }
        })
        previousBoundary = boundary
      }

      return {
        ...task,
        carryoverCount,
        lastProcessedCycleDate: boundaries[boundaries.length - 1],
        updatedAt: processedAt
      }
    }

    if (missedPlannedDate >= todayLocalDate) return task

    let carryoverCount = task.carryoverCount
    let missedDate = missedPlannedDate
    while (missedDate < todayLocalDate) {
      if (missedDate > (task.lastProcessedCycleDate || '')) {
        carryoverCount += 1
        decisions.push({
          id: `missed_cycle:${task.id}:${missedDate}`,
          taskId: task.id,
          action: 'missed_cycle',
          fromDate: missedDate,
          toDate: addDaysToDateKey(missedDate, 1),
          createdAt: processedAt,
          metadata: { carryoverCount }
        })
      }
      missedDate = addDaysToDateKey(missedDate, 1)
    }

    return {
      ...task,
      plannedDate: todayLocalDate,
      carryoverCount,
      lastProcessedCycleDate: addDaysToDateKey(todayLocalDate, -1),
      updatedAt: processedAt
    }
  })

  return { tasks: updatedTasks, decisions }
}
