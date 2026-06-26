import { useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { java } from '@codemirror/lang-java'
import { useProjectStore } from '../store/projectStore'
import { StateEffect, StateField, RangeSetBuilder } from '@codemirror/state'
import { Decoration, DecorationSet } from '@codemirror/view'

interface CodeViewerProps {
  filePath: string | null
}

const severityColors: Record<string, string> = {
  CRITICAL: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#3b82f6',
}

function buildGutterMarkers(issues: { line: number; severity: string }[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const issue of issues) {
    const color = severityColors[issue.severity] || '#6b7280'
    const deco = Decoration.line({
      attributes: {
        style: `background: ${color}15; border-left: 2px solid ${color};`,
      },
    })
    builder.add(issue.line - 1, issue.line, deco)
  }
  return builder.finish()
}

const gutterMarkerEffect = StateEffect.define<{ line: number; severity: string }[]>()

const gutterMarkerField = StateField.define<DecorationSet>({
  create() { return Decoration.none },
  update(markers, tr) {
    for (const e of tr.effects) {
      if (e.is(gutterMarkerEffect)) {
        return buildGutterMarkers(e.value)
      }
    }
    return markers.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f),
})

export function CodeViewer({ filePath }: CodeViewerProps): JSX.Element {
  const [content, setContent] = useState('')
  const editorRef = useRef<EditorView | null>(null)
  const selectedIssueIndex = useProjectStore((s) => s.selectedIssueIndex)
  const analysisResult = useProjectStore((s) => s.analysisResult)
  const setScrollToLine = useProjectStore((s) => s.setScrollToLine)

  useEffect(() => {
    if (!filePath) return
    const loadFile = async (): Promise<void> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const text = await invoke<string>('read_file', { path: filePath })
        setContent(text)
        useProjectStore.getState().setFileContent(text)
      } catch (e: unknown) {
        console.error('Error al leer archivo:', e)
        setContent('// Error al leer el archivo')
      }
    }
    loadFile()
  }, [filePath])

  useEffect(() => {
    if (selectedIssueIndex === null || !analysisResult || !editorRef.current) return
    const issue = analysisResult.issues[selectedIssueIndex]
    if (!issue) return
    const view = editorRef.current
    const doc = view.state.doc
    const line = Math.max(1, Math.min(issue.line, doc.lines))
    const lineStart = doc.line(line).from
    view.dispatch({
      selection: { anchor: lineStart, head: lineStart },
      scrollIntoView: true,
    })
    setScrollToLine(line)
  }, [selectedIssueIndex, analysisResult, setScrollToLine])

  useEffect(() => {
    if (!editorRef.current || !analysisResult) return
    const view = editorRef.current
    view.dispatch({
      effects: gutterMarkerEffect.of(analysisResult.issues.map(i => ({
        line: i.line,
        severity: i.severity,
      }))),
    })
  }, [content, analysisResult])

  const extensions = [
    java(),
    gutterMarkerField,
    EditorView.theme({
      '&': { backgroundColor: '#0d0f14' },
      '.cm-gutters': { backgroundColor: '#0d0f14', borderRight: '1px solid #2a2f3d' },
    }),
  ]

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Selecciona un archivo para visualizar</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden">
      <CodeMirror
        value={content}
        extensions={extensions}
        theme="dark"
        height="100%"
        readOnly
        onChange={(val: string) => {
          useProjectStore.getState().setFileContent(val)
        }}
        onCreateEditor={(view: EditorView) => {
          editorRef.current = view
        }}
      />
    </div>
  )
}
