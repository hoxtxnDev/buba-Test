import { create } from 'zustand'

export interface FileEntry {
  path: string
  name: string
  lines: number
  layer: string
  children: FileEntry[]
}

export interface Issue {
  file: string
  line: number
  severity: string
  rule: string
  message: string
  suggestion: string
  code_fix: string | null
}

export interface AnalysisResult {
  issues: Issue[]
  class_name: string
  package: string
  layer: string
}

export interface SeverityCount {
  critical: number
  warning: number
  info: number
}

export interface ProjectAnalysis {
  total_files: number
  total_lines: number
  issues_by_severity: SeverityCount
  top_files: { file: string; count: number }[]
  layers: string[]
}

export interface Toast {
  message: string
  type: 'success' | 'error'
}

interface AppState {
  projectRoot: string | null
  fileTree: FileEntry | null
  selectedFile: string | null
  fileContent: string | null
  analysisResult: AnalysisResult | null
  projectAnalysis: ProjectAnalysis | null
  selectedIssueIndex: number | null
  scrollToLine: number | null
  isAnalyzing: boolean
  opencodeOutput: string | null
  generatedTest: string | null
  activeTab: 'analysis' | 'tests'
  sidebarOpen: boolean
  toast: Toast | null

  setProjectRoot: (root: string) => void
  setFileTree: (tree: FileEntry) => void
  setSelectedFile: (path: string | null) => void
  setFileContent: (content: string | null) => void
  setAnalysisResult: (result: AnalysisResult | null) => void
  setProjectAnalysis: (analysis: ProjectAnalysis | null) => void
  setSelectedIssueIndex: (index: number | null) => void
  setScrollToLine: (line: number | null) => void
  setIsAnalyzing: (v: boolean) => void
  setOpencodeOutput: (v: string | null) => void
  setGeneratedTest: (v: string | null) => void
  setActiveTab: (tab: 'analysis' | 'tests') => void
  setSidebarOpen: (open: boolean) => void
  setToast: (toast: Toast | null) => void
}

export const useProjectStore = create<AppState>((set) => ({
  projectRoot: null,
  fileTree: null,
  selectedFile: null,
  fileContent: null,
  analysisResult: null,
  projectAnalysis: null,
  selectedIssueIndex: null,
  scrollToLine: null,
  isAnalyzing: false,
  opencodeOutput: null,
  generatedTest: null,
  activeTab: 'analysis',
  sidebarOpen: true,
  toast: null,

  setProjectRoot: (root) => set({ projectRoot: root }),
  setFileTree: (tree) => set({ fileTree: tree }),
  setSelectedFile: (path) => set({ selectedFile: path }),
  setFileContent: (content) => set({ fileContent: content }),
  setAnalysisResult: (result) => set({ analysisResult: result }),
  setProjectAnalysis: (analysis) => set({ projectAnalysis: analysis }),
  setSelectedIssueIndex: (index) => set({ selectedIssueIndex: index }),
  setScrollToLine: (line) => set({ scrollToLine: line }),
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  setOpencodeOutput: (v) => set({ opencodeOutput: v }),
  setGeneratedTest: (v) => set({ generatedTest: v }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setToast: (toast) => set({ toast }),
}))
