import type React from 'react'
import { useProjectStore, type AnalysisResult } from '../store/projectStore'
import { SeverityBadge } from './SeverityBadge'
import { Bug, Wand2 } from 'lucide-react'
import { cn } from '../utils/cn'

export function BugPanel(): JSX.Element {
  const analysisResult = useProjectStore((s) => s.analysisResult)
  const selectedIssueIndex = useProjectStore((s) => s.selectedIssueIndex)
  const setSelectedIssueIndex = useProjectStore((s) => s.setSelectedIssueIndex)
  const isAnalyzing = useProjectStore((s) => s.isAnalyzing)

  if (!analysisResult || analysisResult.issues.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm p-4 text-center">
        <div>
          <Bug size={32} className="mx-auto mb-2 opacity-40" />
          <p>Sin issues detectados</p>
        </div>
      </div>
    )
  }

  const handleApplyFix = async (file: string, line: number, codeFix: string): Promise<void> => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('apply_fix', { path: file, line, fix: codeFix })
      const res = await invoke<AnalysisResult>('analyze_file', { path: file })
      useProjectStore.getState().setAnalysisResult(res)
    } catch (e: unknown) {
      console.error('Error al aplicar fix:', e)
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

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-dark-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">
          Issues ({analysisResult.issues.length})
        </h3>
        <button
          onClick={handleAiAnalysis}
          disabled={isAnalyzing}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-accent-blue text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          <Wand2 size={12} />
          {isAnalyzing ? 'Analizando...' : 'IA'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {analysisResult.issues.map((issue, idx) => (
          <div
            key={idx}
            className={cn(
              'p-3 border-b border-dark-border cursor-pointer hover:bg-dark-surface transition-colors',
              selectedIssueIndex === idx ? 'bg-dark-card' : ''
            )}
            onClick={(): void => setSelectedIssueIndex(idx)}
          >
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge severity={issue.severity} />
              <span className="text-xs text-gray-400">línea {issue.line}</span>
            </div>
            <p className="text-sm text-gray-200 mb-1">{issue.message}</p>
            <p className="text-xs text-gray-400 mb-2 italic">{issue.suggestion}</p>
            {issue.code_fix && (
              <button
                onClick={(e: React.MouseEvent<HTMLButtonElement>): void => {
                  e.stopPropagation()
                  handleApplyFix(issue.file, issue.line, issue.code_fix!)
                }}
                className="text-xs text-accent-blue hover:text-blue-300 transition-colors"
              >
                Fix automático
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
