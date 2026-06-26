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

export interface ArchitectureGraph {
  nodes: ArchNode[]
  edges: ArchEdge[]
}

export interface ArchNode {
  id: string
  name: string
  layer: 'CONTROLLER' | 'SERVICE' | 'REPOSITORY' | 'ENTITY' | 'DTO' | 'UNKNOWN'
  pkg: string
  path: string
  microservice: string
  lines: number
  issues: Issue[]
  endpoints: Endpoint[]
  dependencies: string[]
}

export interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
}

export interface ArchEdge {
  from: string
  to: string
  type: 'INJECTION' | 'FEIGN' | 'MISSING'
}

interface AppState {
  fileTree: FileEntry | null
  setFileTree: (f: FileEntry | null) => void
  projectRoot: string | null
  setProjectRoot: (r: string | null) => void
  selectedFile: string | null
  setSelectedFile: (f: string | null) => void
  analysisResult: AnalysisResult | null
  setAnalysisResult: (r: AnalysisResult | null) => void
  selectedIssueIndex: number | null
  setSelectedIssueIndex: (i: number | null) => void
  fileContent: string
  setFileContent: (c: string) => void
  generatedTest: string | null
  setGeneratedTest: (t: string | null) => void
  projectAnalysis: ProjectAnalysis | null
  setProjectAnalysis: (a: ProjectAnalysis | null) => void
  sidebarOpen: boolean
  setSidebarOpen: (o: boolean) => void
  activeTab: string
  setActiveTab: (t: string) => void
  toast: Toast | null
  setToast: (t: Toast | null) => void
  architectureGraph: ArchitectureGraph | null
  setArchitectureGraph: (g: ArchitectureGraph | null) => void
  scrollToLine: number | null
  setScrollToLine: (n: number | null) => void
  isAnalyzing: boolean
  setIsAnalyzing: (a: boolean) => void
  opencodeOutput: string | null
  setOpencodeOutput: (o: string | null) => void
  activeIssue: Issue | null
  setActiveIssue: (i: Issue | null) => void
  view: 'code' | 'architecture'
  setView: (v: 'code' | 'architecture') => void
}

export const useProjectStore = create<AppState>((set) => ({
  fileTree: null,
  setFileTree: (f) => set({ fileTree: f }),
  projectRoot: null,
  setProjectRoot: (r) => set({ projectRoot: r }),
  selectedFile: null,
  setSelectedFile: (f) => set({ selectedFile: f }),
  analysisResult: null,
  setAnalysisResult: (r) => set({ analysisResult: r }),
  selectedIssueIndex: null,
  setSelectedIssueIndex: (i) => set({ selectedIssueIndex: i }),
  fileContent: '',
  setFileContent: (c) => set({ fileContent: c }),
  generatedTest: null,
  setGeneratedTest: (t) => set({ generatedTest: t }),
  projectAnalysis: null,
  setProjectAnalysis: (a) => set({ projectAnalysis: a }),
  sidebarOpen: true,
  setSidebarOpen: (o) => set({ sidebarOpen: o }),
  activeTab: 'bugs',
  setActiveTab: (t) => set({ activeTab: t }),
  toast: null,
  setToast: (t) => set({ toast: t }),
  architectureGraph: null,
  setArchitectureGraph: (g) => set({ architectureGraph: g }),
  scrollToLine: null,
  setScrollToLine: (n) => set({ scrollToLine: n }),
  isAnalyzing: false,
  setIsAnalyzing: (a) => set({ isAnalyzing: a }),
  opencodeOutput: null,
  setOpencodeOutput: (o) => set({ opencodeOutput: o }),
  activeIssue: null,
  setActiveIssue: (i) => set({ activeIssue: i }),
  view: 'code',
  setView: (v) => set({ view: v }),
}))
