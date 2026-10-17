import type { Task, TaskDecision } from './task'
import { getElapsedCycleBoundaries } from './recurrence'

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

    if (
      missedPlannedDate >= todayLocalDate ||
      task.lastProcessedCycleDate === missedPlannedDate
    ) {
      return task
    }

    const updatedTask: Task = {
      ...task,
      status: 'review',
      carryoverCount: task.carryoverCount + 1,
      lastProcessedCycleDate: missedPlannedDate,
      updatedAt: processedAt
    }
    decisions.push({
      id: `missed_cycle:${task.id}:${missedPlannedDate}`,
      taskId: task.id,
      action: 'missed_cycle',
      fromDate: missedPlannedDate,
      toDate: null,
      createdAt: processedAt,
      metadata: { carryoverCount: updatedTask.carryoverCount }
    })
    return updatedTask
  })

  return { tasks: updatedTasks, decisions }
}
