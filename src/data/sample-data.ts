import type { Task, UserPreferences } from '../domain/task'
import { addDaysToDateKey, getLocalDateKey } from '../shared/date'

export const createSampleTasks = (now: Date, preferences: UserPreferences): Task[] => {
  const today = getLocalDateKey(now, preferences.timezone)
  const yesterday = addDaysToDateKey(today, -1)
  const twoDaysAgo = addDaysToDateKey(today, -2)
  const threeDaysAgo = addDaysToDateKey(today, -3)
  const fourDaysAgo = addDaysToDateKey(today, -4)
  const createdAt = now.toISOString()
  const makeTask = (
    id: string,
    title: string,
    status: Task['status'],
    load: number | null,
    plannedDate: string | null,
    carryoverCount: number,
    lastProcessedCycleDate: string | null,
    sortOrder: number,
  ): Task => ({
    id,
    title,
    status,
    load,
    plannedDate,
    priority: 'normal',
    parentId: null,
    carryoverCount,
    lastProcessedCycleDate,
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
    deletedAt: null,
    sortOrder,
  })

  return [
    {
      id: 'sample-today-walk',
      title: '散步 20 分钟',
      status: 'planned',
      load: 1,
      plannedDate: today,
      priority: 'normal',
      parentId: null,
      carryoverCount: 0,
      lastProcessedCycleDate: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      deletedAt: null,
      sortOrder: 0
    },
    {
      id: 'sample-today-report',
      title: '整理项目周报',
      status: 'planned',
      load: 2,
      plannedDate: today,
      priority: 'high',
      parentId: null,
      carryoverCount: 1,
      lastProcessedCycleDate: yesterday,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      deletedAt: null,
      sortOrder: 1
    },
    {
      id: 'sample-today-reply',
      title: '回复小林的消息',
      status: 'planned',
      load: 1,
      plannedDate: today,
      priority: 'normal',
      parentId: null,
      carryoverCount: 2,
      lastProcessedCycleDate: twoDaysAgo,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      deletedAt: null,
      sortOrder: 2
    },
    {
      id: 'sample-review-plan',
      title: '重新看看读书计划',
      status: 'review',
      load: 2,
      plannedDate: yesterday,
      priority: 'low',
      parentId: null,
      carryoverCount: 1,
      lastProcessedCycleDate: yesterday,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      deletedAt: null,
      sortOrder: 3
    },
    {
      id: 'sample-inbox-groceries',
      title: '买水果',
      status: 'inbox',
      load: null,
      plannedDate: null,
      priority: 'normal',
      parentId: null,
      carryoverCount: 0,
      lastProcessedCycleDate: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      deletedAt: null,
      sortOrder: 4
    },
    {
      id: 'sample-inbox-reading',
      title: '把想看的文章存起来',
      status: 'inbox',
      load: 1,
      plannedDate: null,
      priority: 'low',
      parentId: null,
      carryoverCount: 0,
      lastProcessedCycleDate: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      deletedAt: null,
      sortOrder: 5
    },
    makeTask('sample-today-water', '给绿植浇水', 'planned', 1, today, 0, null, 6),
    makeTask('sample-today-bills', '核对本月账单', 'planned', 1, today, 1, yesterday, 7),
    makeTask('sample-today-submit', '提交报销单', 'planned', 1, today, 2, twoDaysAgo, 8),
    makeTask('sample-today-learn', '整理课程笔记', 'planned', 1, today, 3, threeDaysAgo, 9),
    makeTask('sample-today-tax', '处理保险材料', 'planned', 1, today, 4, fourDaysAgo, 10),
    makeTask('sample-review-call', '回电话确认预约', 'review', 1, yesterday, 2, yesterday, 11),
    makeTask('sample-inbox-recipe', '试做一道新菜', 'inbox', null, null, 0, null, 12),
    makeTask('sample-inbox-photos', '整理手机照片', 'inbox', null, null, 0, null, 13),
  ]
}
