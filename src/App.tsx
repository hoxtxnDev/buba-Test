import { useState, useCallback, useEffect } from 'react'
import { FileTree } from './components/FileTree'
import { CodeViewer } from './components/CodeViewer'
import { BugPanel } from './components/BugPanel'
import { Dashboard } from './components/Dashboard'
import { TestOutput } from './components/TestOutput'
import { ArchitectureView } from './components/ArchitectureView'
import { useFileTree } from './hooks/useFileTree'
import { useProjectStore, type AnalysisResult, type ArchitectureGraph, type Toast } from './store/projectStore'
import { FolderOpen, FlaskConical, Bug, PanelRightClose, PanelRightOpen, Menu, Settings, HelpCircle, X, CheckCircle, AlertCircle, Network, FileCode, Layers, FileText } from 'lucide-react'
import { cn } from './utils/cn'

type RightPanel = 'bugs' | 'tests'
type ViewMode = 'code' | 'architecture'

function ToastBar(): JSX.Element | null {
  const toast = useProjectStore((s) => s.toast)
  const setToast = useProjectStore((s) => s.setToast)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast, setToast])

  if (!toast) return null

  return (
    <div className={cn(
      'fixed top-3 right-3 z-50 flex items-center gap-2 px-4 py-2 rounded text-sm shadow-lg transition-all',
      toast.type === 'success' ? 'bg-green-700 text-white' : 'bg-red-700 text-white'
    )}>
      {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      <span>{toast.message}</span>
      <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
        <X size={12} />
      </button>
    </div>
  )
}

export default function App(): JSX.Element {
  const { openFolder, loading } = useFileTree()
  const selectedFile = useProjectStore((s) => s.selectedFile)
  const setSelectedFile = useProjectStore((s) => s.setSelectedFile)
  const setAnalysisResult = useProjectStore((s) => s.setAnalysisResult)
  const setSelectedIssueIndex = useProjectStore((s) => s.setSelectedIssueIndex)
  const setFileContent = useProjectStore((s) => s.setFileContent)
  const setGeneratedTest = useProjectStore((s) => s.setGeneratedTest)
  const setToast = useProjectStore((s) => s.setToast)
  const sidebarOpen = useProjectStore((s) => s.sidebarOpen)
  const setSidebarOpen = useProjectStore((s) => s.setSidebarOpen)
  const setActiveTab = useProjectStore((s) => s.setActiveTab)
  const fileTree = useProjectStore((s) => s.fileTree)
  const projectAnalysis = useProjectStore((s) => s.projectAnalysis)
  const analysisResult = useProjectStore((s) => s.analysisResult)

  const [rightPanel, setRightPanel] = useState<RightPanel>('bugs')
  const [rightOpen, setRightOpen] = useState(true)
  const [view, setView] = useState<ViewMode>('code')
  const projectRoot = useProjectStore((s) => s.projectRoot)
  const setArchitectureGraph = useProjectStore((s) => s.setArchitectureGraph)

  useEffect(() => {
    if (!projectRoot) return
    ;(async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const graph = await invoke<ArchitectureGraph>('build_architecture', { root: projectRoot })
        setArchitectureGraph(graph)
      } catch (e) {
        console.error('Error building architecture:', e)
      }
    })()
  }, [projectRoot, setArchitectureGraph])

  const handleSelectFile = useCallback(async (path: string): Promise<void> => {
    setSelectedFile(path)
    setSelectedIssueIndex(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const content = await invoke<string>('read_file', { path })
      setFileContent(content)
      const result = await invoke<AnalysisResult>('analyze_file', { path })
      setAnalysisResult(result)
    } catch (e: unknown) {
      console.error('Error al analizar:', e)
      setAnalysisResult(null)
    }
  }, [setSelectedFile, setSelectedIssueIndex, setAnalysisResult, setFileContent])

  const handleGenerateTest = useCallback(async (): Promise<void> => {
    const state = useProjectStore.getState()
    if (!state.selectedFile) return
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const testCode = await invoke<string>('generate_test', {
        path: state.selectedFile,
        layer: state.analysisResult?.layer || '',
      })
      setGeneratedTest(testCode)
      setActiveTab('tests')
      setRightPanel('tests')
      setRightOpen(true)
      setToast({ message: 'Test generado exitosamente', type: 'success' })
    } catch (e: unknown) {
      console.error('Error al generar test:', e)
      setToast({ message: 'Error al generar test', type: 'error' })
    }
  }, [setGeneratedTest, setActiveTab, setToast])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        e.preventDefault()
        openFolder()
      } else if (ctrl && e.key === 'o' && !e.shiftKey) {
        e.preventDefault()
        openFolder()
      } else if (ctrl && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault()
        const state = useProjectStore.getState()
        if (state.selectedFile) handleSelectFile(state.selectedFile)
      } else if (ctrl && e.shiftKey && (e.key === 'T' || e.key === 't')) {
        e.preventDefault()
        handleGenerateTest()
      } else if (ctrl && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        setSidebarOpen(!useProjectStore.getState().sidebarOpen)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openFolder, handleSelectFile, handleGenerateTest, setSidebarOpen])

  const issueCount = projectAnalysis
    ? projectAnalysis.issues_by_severity.critical + projectAnalysis.issues_by_severity.warning + projectAnalysis.issues_by_severity.info
    : (analysisResult?.issues.length ?? 0)

  const fileCount = fileTree ? countAllFiles(fileTree) + 1 : 0

  return (
    <div className="h-screen flex flex-col bg-dark-base text-gray-100 select-none">

      <ToastBar />

      {/* TopBar */}
      <header className="h-10 flex items-center px-3 border-b border-dark-border bg-dark-base shrink-0 z-10">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="mr-3 text-gray-400 hover:text-white transition-colors"
        >
          <Menu size={16} />
        </button>
        <h1 className="text-sm font-semibold tracking-wide">
          <span className="text-accent-blue">Java</span><span className="text-white">Lens</span>
        </h1>
        <div className="ml-5 flex items-center gap-2">
          <button
            onClick={openFolder}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-accent-blue text-white rounded-full hover:bg-blue-600 disabled:opacity-50 transition-colors font-medium"
          >
            <FolderOpen size={13} />
            {loading ? 'Abriendo...' : 'Abrir proyecto'}
          </button>
          {selectedFile && (
            <button
              onClick={handleGenerateTest}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent-purple text-white rounded hover:bg-purple-600 transition-colors font-medium"
            >
              <FlaskConical size={13} />
              Generar test
            </button>
          )}
          {projectRoot && (
            <>
              <div className="w-px h-4 bg-dark-border mx-1" />
              <button
                onClick={() => setView('code')}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-colors font-medium',
                  view === 'code' ? 'bg-dark-card text-accent-blue' : 'text-gray-400 hover:text-white'
                )}
              >
                <FileCode size={13} />
                Código
              </button>
              <button
                onClick={() => setView('architecture')}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-colors font-medium',
                  view === 'architecture' ? 'bg-dark-card text-accent-blue' : 'text-gray-400 hover:text-white'
                )}
              >
                <Network size={13} />
                Arquitectura
              </button>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setRightPanel('bugs')}
            className={cn(
              'p-1.5 rounded transition-colors',
              rightPanel === 'bugs' ? 'text-accent-blue bg-dark-card' : 'text-gray-400 hover:text-white'
            )}
            title="Análisis"
          >
            <Bug size={14} />
          </button>
          <button
            onClick={() => setRightPanel('tests')}
            className={cn(
              'p-1.5 rounded transition-colors',
              rightPanel === 'tests' ? 'text-accent-blue bg-dark-card' : 'text-gray-400 hover:text-white'
            )}
            title="Tests"
          >
            <FlaskConical size={14} />
          </button>
          <div className="w-px h-4 bg-dark-border mx-1" />
          <button
            onClick={() => setRightOpen(!rightOpen)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
          >
            {rightOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
          <button className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Atajos (Ctrl+B toggle sidebar)">
            <HelpCircle size={14} />
          </button>
          <button className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Configuración">
            <Settings size={14} />
          </button>
        </div>
      </header>

      {/* Main 3-column area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'border-r border-dark-border bg-dark-surface transition-all duration-150 ease-out overflow-hidden shrink-0',
            sidebarOpen ? 'w-[260px]' : 'w-0'
          )}
        >
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-[0.1em] border-b border-dark-border">
              Explorador
            </div>
            <div className="flex-1 overflow-y-auto">
              <FileTree onSelectFile={handleSelectFile} />
            </div>
          </div>
        </aside>

        {/* Code Viewer / Architecture View */}
        <main className={cn(
          'flex-1 overflow-hidden flex flex-col',
          view === 'architecture' && 'w-full'
        )}>
          {view === 'architecture' ? (
            <ArchitectureView />
          ) : selectedFile ? (
            <>
              <div className="flex items-center justify-between px-4 py-1.5 text-xs text-gray-500 border-b border-dark-border bg-dark-surface shrink-0">
                <span className="truncate font-mono">{selectedFile}</span>
                <button
                  onClick={() => handleSelectFile(selectedFile)}
                  className="text-gray-400 hover:text-white transition-colors ml-2 shrink-0"
                  title="Recargar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 4v6h6M23 20v-6h-6" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <CodeViewer filePath={selectedFile} />
              </div>
            </>
          ) : (
            <Dashboard />
          )}
        </main>

        {/* Right Panel */}
        <aside
          className={cn(
            'border-l border-dark-border bg-dark-surface transition-all duration-150 ease-out overflow-hidden shrink-0',
            view === 'architecture' ? 'w-0' : rightOpen ? 'w-[340px]' : 'w-0'
          )}
        >
          <div className="h-full flex flex-col">
            {rightPanel === 'bugs' ? <BugPanel /> : <TestOutput />}
          </div>
        </aside>
      </div>

      {/* StatusBar */}
      <footer className="h-6 flex items-center justify-between px-3 border-t border-dark-border bg-[#0a0c10] text-[11px] text-gray-500 shrink-0">
        <div className="flex items-center gap-3">
          {fileTree && <span className="truncate max-w-[200px]">{fileTree.name}</span>}
          {fileTree && <span className="w-px h-3 bg-dark-border" />}
          {fileTree && <span className="flex items-center gap-1"><FileText size={11} /> {fileCount} archivos</span>}
          {issueCount > 0 && <><span className="w-px h-3 bg-dark-border" /><span>{issueCount} issues</span></>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-600">Java</span>
          <span className="text-gray-600">Tauri 2.x</span>
        </div>
      </footer>
    </div>
  )
}

interface Countable { children: Countable[] }
function countAllFiles(entry: Countable): number {
  if (entry.children.length === 0) return 1
  return entry.children.reduce((sum: number, child: Countable) => sum + countAllFiles(child), 0)
}
