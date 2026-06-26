import { cn } from '../utils/cn'

interface SeverityBadgeProps {
  severity: string
}

const colors: Record<string, string> = {
  CRITICAL: 'bg-severity-critical text-white',
  WARNING: 'bg-severity-warning text-black',
  INFO: 'bg-severity-info text-white',
}

export function SeverityBadge({ severity }: SeverityBadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        colors[severity] || 'bg-gray-600 text-white'
      )}
    >
      {severity}
    </span>
  )
}
