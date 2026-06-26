import { cn } from '../utils/cn'

interface SeverityBadgeProps {
  severity: string
}

const styles: Record<string, string> = {
  CRITICAL: 'bg-red-900/40 text-severity-critical border border-red-800/30',
  WARNING: 'bg-amber-900/40 text-severity-warning border border-amber-800/30',
  INFO: 'bg-blue-900/40 text-severity-info border border-blue-800/30',
}

export function SeverityBadge({ severity }: SeverityBadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded',
        styles[severity] || 'bg-gray-700/40 text-gray-400 border border-gray-600/30'
      )}
    >
      {severity}
    </span>
  )
}
