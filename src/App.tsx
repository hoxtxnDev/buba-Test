import { useState, useCallback } from 'react'
import { FileTree } from './components/FileTree'
import { CodeViewer } from './components/CodeViewer'
import { BugPanel } from './components/BugPanel'
import { Dashboard } from './components/Dashboard'
import { TestOutput } from './components/TestOutput'
import { useFileTree } from './hooks/useFileTree'
import { useProjectStore, type AnalysisResult } from './store/projectStore'
import { FolderOpen, FlaskConical, Bug, PanelRightClose, PanelRightOpen, Menu } from 'lucide-react'
import { cn } from './utils/cn'

type RightPanel = 'bugs' | 'tests'

export default function App(): JSX.Element {
  const { openFolder, loading } = useFileTree()
  const selectedFile = useProjectStore((s) => s.selectedFile)
  const setSelectedFile = useProjectStore((s) => s.setSelectedFile)
  const setAnalysisResult = useProjectStore((s) => s.setAnalysisResult)
  const setSelectedIssueIndex = useProjectStore((s) => s.setSelectedIssueIndex)

  const [rightPanel, setRightPanel] = useState<RightPanel>('bugs')
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)

  const handleSelectFile = useCallback(async (path: string): Promise<void> => {
    setSelectedFile(path)
    setSelectedIssueIndex(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<AnalysisResult>('analyze_file', { path })
      setAnalysisResult(result)
    } catch (e: unknown) {
      console.error('Error al analizar:', e)
      setAnalysisResult(null)
    }
  }, [setSelectedFile, setSelectedIssueIndex, setAnalysisResult])

  return (
    <div className="h-screen flex flex-col bg-dark-base text-gray-100">
      <header className="h-10 flex items-center px-4 border-b border-dark-border bg-dark-surface shrink-0">
        <button
          onClick={(): void => setLeftOpen(!leftOpen)}
          className="mr-3 text-gray-400 hover:text-white transition-colors"
        >
          <Menu size={16} />
        </button>
        <h1 className="text-sm font-bold tracking-wide">
          <span className="text-accent-blue">Java</span>Lens
        </h1>
        <div className="ml-6 flex items-center gap-2">
          <button
            onClick={openFolder}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1 text-xs bg-accent-blue text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            <FolderOpen size={14} />
            {loading ? 'Abriendo...' : 'Abrir proyecto'}
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={(): void => setRightPanel('bugs')}
            className={cn(
              'p-1.5 rounded transition-colors',
              rightPanel === 'bugs' ? 'text-accent-blue bg-dark-card' : 'text-gray-400 hover:text-white'
            )}
            title="Panel de bugs"
          >
            <Bug size={14} />
          </button>
          <button
            onClick={(): void => setRightPanel('tests')}
            className={cn(
              'p-1.5 rounded transition-colors',
              rightPanel === 'tests' ? 'text-accent-blue bg-dark-card' : 'text-gray-400 hover:text-white'
            )}
            title="Tests e IA"
          >
            <FlaskConical size={14} />
          </button>
          <button
            onClick={(): void => setRightOpen(!rightOpen)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors ml-2"
          >
            {rightOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={cn(
            'border-r border-dark-border bg-dark-surface transition-all duration-200 overflow-hidden shrink-0',
            leftOpen ? 'w-[260px]' : 'w-0'
          )}
        >
          <FileTree onSelectFile={handleSelectFile} />
        </aside>

        <main className="flex-1 overflow-hidden">
          {selectedFile ? (
            <CodeViewer filePath={selectedFile} />
          ) : (
            <Dashboard />
          )}
        </main>

        <aside
          className={cn(
            'border-l border-dark-border bg-dark-surface transition-all duration-200 overflow-hidden shrink-0',
            rightOpen ? 'w-[320px]' : 'w-0'
          )}
        >
          {rightPanel === 'bugs' ? <BugPanel /> : <TestOutput />}
        </aside>
      </div>
    </div>
  )
}
