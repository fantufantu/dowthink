import type { Task } from './task'
import { isTaskActiveOnDate } from './recurrence'

export interface CapacitySummary {
  capacity: number
  plannedLoad: number
  remaining: number
  overflow: number
}

export const getBalloonLevel = (carryoverCount: number): number =>
  Math.min(4, Math.max(0, Math.floor(Number.isFinite(carryoverCount) ? carryoverCount : 0)))

export const getBalloonDiameter = (carryoverCount: number): number => 56 + 14 * getBalloonLevel(carryoverCount)

export const getPlannedLoad = (tasks: Task[], date: string): number =>
  tasks.reduce((total, task) => {
    if (!isTaskActiveOnDate(task, date) || task.load === null) return total
    return total + task.load
  }, 0)

export const getCapacitySummary = (tasks: Task[], date: string, capacity: number): CapacitySummary => {
  const plannedLoad = getPlannedLoad(tasks, date)
  return {
    capacity,
    plannedLoad,
    remaining: capacity - plannedLoad,
    overflow: Math.max(0, plannedLoad - capacity)
  }
}
