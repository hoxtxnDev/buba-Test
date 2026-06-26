import { useState } from 'react'
import type React from 'react'
import { useProjectStore, type AnalysisResult, type Toast } from '../store/projectStore'
import { SeverityBadge } from './SeverityBadge'
import { Bug, Wand2, CheckCircle, Loader2, AlertTriangle, Info } from 'lucide-react'
import { cn } from '../utils/cn'

export function BugPanel(): JSX.Element {
  const analysisResult = useProjectStore((s) => s.analysisResult)
  const projectAnalysis = useProjectStore((s) => s.projectAnalysis)
  const selectedIssueIndex = useProjectStore((s) => s.selectedIssueIndex)
  const setSelectedIssueIndex = useProjectStore((s) => s.setSelectedIssueIndex)
  const isAnalyzing = useProjectStore((s) => s.isAnalyzing)
  const setToast = useProjectStore((s) => s.setToast)
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null)

  const handleApplyFix = async (file: string, line: number, codeFix: string, idx: number): Promise<void> => {
    setApplyingIdx(idx)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('apply_fix', { path: file, line, fix: codeFix })
      const res = await invoke<AnalysisResult>('analyze_file', { path: file })
      useProjectStore.getState().setAnalysisResult(res)
      setToast({ message: 'Fix aplicado correctamente', type: 'success' })
    } catch (e: unknown) {
      console.error('Error al aplicar fix:', e)
      setToast({ message: 'Error al aplicar fix', type: 'error' })
    } finally {
      setApplyingIdx(null)
    }
  }

  const handleAiAnalysis = async (): Promise<void> => {
    const state = useProjectStore.getState()
    if (!state.fileContent) return
    useProjectStore.getState().setIsAnalyzing(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const context = JSON.stringify(state.analysisResult?.issues ?? [])
      const output = await invoke<string>('run_opencode', {
        fileContent: state.fileContent,
        context,
      })
      useProjectStore.getState().setOpencodeOutput(output)
    } catch (e: unknown) {
      console.error('Error en análisis IA:', e)
    } finally {
      useProjectStore.getState().setIsAnalyzing(false)
    }
  }

  const countCritical = projectAnalysis?.issues_by_severity.critical ?? analysisResult?.issues.filter(i => i.severity === 'CRITICAL').length ?? 0
  const countWarning = projectAnalysis?.issues_by_severity.warning ?? analysisResult?.issues.filter(i => i.severity === 'WARNING').length ?? 0
  const countInfo = projectAnalysis?.issues_by_severity.info ?? analysisResult?.issues.filter(i => i.severity === 'INFO').length ?? 0
  const totalIssues = countCritical + countWarning + countInfo

  const issues = analysisResult?.issues ?? []

  return (
    <div className="h-full flex flex-col">
      {/* Summary row */}
      <div className="p-3 border-b border-dark-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-200">
            Análisis
          </h3>
          <button
            onClick={handleAiAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-accent-purple text-white rounded hover:bg-purple-600 disabled:opacity-50 transition-colors"
          >
            <Wand2 size={12} />
            {isAnalyzing ? 'Analizando...' : 'IA'}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {countCritical > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-red-900/40 text-severity-critical border border-red-800/30">
              <AlertTriangle size={10} /> {countCritical} CRITICAL
            </span>
          )}
          {countWarning > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-amber-900/40 text-severity-warning border border-amber-800/30">
              <AlertTriangle size={10} /> {countWarning} WARNING
            </span>
          )}
          {countInfo > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-blue-900/40 text-severity-info border border-blue-800/30">
              <Info size={10} /> {countInfo} INFO
            </span>
          )}
          {totalIssues === 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-green-900/40 text-severity-pass border border-green-800/30">
              <CheckCircle size={10} /> Sin problemas
            </span>
          )}
        </div>
      </div>

      {/* Bug list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {issues.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm p-4 text-center">
            <CheckCircle size={32} className="mb-2 opacity-40 text-severity-pass" />
            <p>Sin issues detectados</p>
          </div>
        )}
        {issues.map((issue, idx) => {
          const severityColor = issue.severity === 'CRITICAL' ? '#ef4444' : issue.severity === 'WARNING' ? '#f59e0b' : '#3b82f6'
          return (
            <div
              key={idx}
              className={cn(
                'rounded border transition-colors cursor-pointer',
                selectedIssueIndex === idx
                  ? 'border-accent-blue bg-dark-card'
                  : 'border-dark-border bg-dark-card hover:border-dark-border-active'
              )}
              style={{ borderLeftColor: severityColor, borderLeftWidth: selectedIssueIndex === idx ? 3 : 2 }}
              onClick={() => setSelectedIssueIndex(idx)}
            >
              <div className="p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <SeverityBadge severity={issue.severity} />
                  <span className="text-xs text-gray-500 font-mono">L{issue.line}</span>
                  <span className="text-[10px] font-mono text-gray-600 ml-auto">{issue.rule}</span>
                </div>
                <p className="text-sm text-gray-200 mb-1 leading-snug">{issue.message}</p>
                <p className="text-xs text-gray-500 italic mb-2">{issue.suggestion}</p>
                {issue.code_fix && (
                  <button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation()
                      handleApplyFix(issue.file, issue.line, issue.code_fix!, idx)
                    }}
                    disabled={applyingIdx === idx}
                    className="flex items-center gap-1 text-xs text-accent-blue hover:text-blue-300 transition-colors font-medium"
                  >
                    {applyingIdx === idx ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <CheckCircle size={12} />
                    )}
                    {applyingIdx === idx ? 'Aplicando...' : 'Aplicar fix'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
