import { type ReactNode } from 'react'
import { useProjectStore } from '../store/projectStore'
import type { FileEntry } from '../store/projectStore'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { FileText, Bug, Layers, Code2 } from 'lucide-react'

export function Dashboard(): JSX.Element {
  const fileTree = useProjectStore((s) => s.fileTree)
  const analysis = useProjectStore((s) => s.projectAnalysis)

  if (!fileTree) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <Code2 size={48} className="mx-auto mb-4 opacity-30" />
          <h2 className="text-xl font-semibold mb-2">JavaLens</h2>
          <p className="text-sm">Abre un proyecto Java para comenzar el análisis</p>
        </div>
      </div>
    )
  }

  const totalFiles = countFiles(fileTree)
  const totalLines = countLines(fileTree)

  const severityData = analysis
    ? [
        { name: 'CRITICAL', value: analysis.issues_by_severity.critical, color: '#ef4444' as const },
        { name: 'WARNING', value: analysis.issues_by_severity.warning, color: '#f59e0b' as const },
        { name: 'INFO', value: analysis.issues_by_severity.info, color: '#3b82f6' as const },
      ]
    : []

  const topFiles = analysis?.top_files.slice(0, 5) || []

  return (
    <div className="p-6 overflow-y-auto h-full">
      <h2 className="text-lg font-semibold mb-4">Dashboard del proyecto</h2>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon={<FileText size={20} />} label="Archivos" value={totalFiles} />
        <StatCard icon={<Code2 size={20} />} label="Líneas" value={totalLines} />
        <StatCard icon={<Bug size={20} />} label="Issues totales" value={severityData.reduce((a: number, b): number => a + b.value, 0)} />
        <StatCard icon={<Layers size={20} />} label="Capas detectadas" value={analysis?.layers.length || 0} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-dark-surface rounded p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Issues por severidad</h3>
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {severityData.map((entry, idx): JSX.Element => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm">Sin datos</p>
          )}
        </div>

        <div className="bg-dark-surface rounded p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Top 5 archivos con más issues</h3>
          {topFiles.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topFiles}>
                <XAxis dataKey="file" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#4f8ef7" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm">Sin datos</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  icon: ReactNode
  label: string
  value: number
}

function StatCard({ icon, label, value }: StatCardProps): JSX.Element {
  return (
    <div className="bg-dark-surface rounded p-4 flex items-center gap-3">
      <div className="text-accent-blue">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  )
}

function countFiles(entry: FileEntry): number {
  if (entry.children.length === 0) return 1
  return entry.children.reduce((sum: number, child: FileEntry): number => sum + countFiles(child), 0)
}

function countLines(entry: FileEntry): number {
  if (entry.children.length === 0) return entry.lines
  return entry.children.reduce((sum: number, child: FileEntry): number => sum + countLines(child), 0)
}
