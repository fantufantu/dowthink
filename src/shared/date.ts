export const getLocalDateKey = (now: Date, timezone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export const addDaysToDateKey = (dateKey: string, amount: number): string => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + amount))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export const addMonthsToDateKey = (dateKey: string, amount: number): string => {
  if (!Number.isInteger(amount)) throw new RangeError('Month offset must be an integer')
  const [year, month, day] = dateKey.split('-').map(Number)
  const monthIndex = year * 12 + month - 1 + amount
  const targetYear = Math.floor(monthIndex / 12)
  const targetMonthIndex = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastDay)
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
}

export const getStartOfWeek = (dateKey: string, weekStartsOn: 0 | 1): string => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const dayOfWeek = date.getUTCDay()
  const offset = (dayOfWeek - weekStartsOn + 7) % 7
  return addDaysToDateKey(dateKey, -offset)
}
