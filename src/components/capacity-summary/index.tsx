import type { CapacitySummary as CapacitySummaryData } from '../../domain/capacity'

interface CapacitySummaryProps {
  summary: CapacitySummaryData
  onClick?: () => void
}

const CapacitySummary = ({ summary, onClick }: CapacitySummaryProps) => {
  const width = summary.capacity > 0
    ? Math.min(100, Math.round((summary.plannedLoad / summary.capacity) * 100))
    : 100
  const content = (
    <>
      <div className='capacity-summary__topline'>
        <span className='capacity-summary__label'>今日容量</span>
        <strong>{summary.plannedLoad} / {summary.capacity} 点</strong>
      </div>
      <div className={`capacity-summary__track${summary.overflow ? ' is-overflow' : ''}`} aria-hidden='true'>
        <span style={{ width: `${width}%` }} />
      </div>
      <div className={`capacity-summary__foot${summary.overflow ? ' is-overflow' : ''}`}>
        {summary.overflow > 0 ? `超出 ${summary.overflow} 点` : `还可安排 ${summary.remaining} 点`}
      </div>
    </>
  )

  return onClick ? (
    <button className='capacity-summary' type='button' onClick={onClick}>
      {content}
    </button>
  ) : (
    <section className='capacity-summary' aria-label={`今日已安排 ${summary.plannedLoad} 点，共 ${summary.capacity} 点`}>
      {content}
    </section>
  )
}

export default CapacitySummary
