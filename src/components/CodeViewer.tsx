import { useEffect, useRef, useState, useMemo } from 'react'
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

const flashHighlightEffect = StateEffect.define<number | null>() // line number (1-based)

const flashHighlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none },
  update(markers, tr) {
    for (const e of tr.effects) {
      if (e.is(flashHighlightEffect)) {
        if (e.value === null) return Decoration.none
        const builder = new RangeSetBuilder<Decoration>()
        const deco = Decoration.line({
          attributes: { style: 'background: rgba(255,255,100,0.08); border-left: 2px solid #f59e0b; transition: background 0.5s;' },
        })
        builder.add(e.value - 1, e.value, deco)
        return builder.finish()
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
  const scrollToLine = useProjectStore((s) => s.scrollToLine)
  const activeIssue = useProjectStore((s) => s.activeIssue)
  const setActiveIssue = useProjectStore((s) => s.setActiveIssue)

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
    if (!scrollToLine || !editorRef.current) return
    const view = editorRef.current
    const doc = view.state.doc
    if (scrollToLine > doc.lines) return
    const lineInfo = doc.line(scrollToLine)
    view.dispatch({
      selection: { anchor: lineInfo.from },
      scrollIntoView: true,
    })
    // Flash highlight
    view.dispatch({
      effects: flashHighlightEffect.of(scrollToLine),
    })
    setTimeout(() => {
      view.dispatch({ effects: flashHighlightEffect.of(null) })
    }, 1500)
  }, [scrollToLine, editorRef.current?.state.doc])

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

  const extensions = useMemo(() => [
    java(),
    gutterMarkerField,
    flashHighlightField,
    EditorView.theme({
      '&': { backgroundColor: '#0d0f14' },
      '.cm-gutters': { backgroundColor: '#0d0f14', borderRight: '1px solid #2a2f3d' },
    }),
  ], [])

  useEffect(() => {
    if (!editorRef.current || !content) return
    const view = editorRef.current
    const current = view.state.doc.toString()
    if (current === content) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
    })
  }, [content])

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Selecciona un archivo para visualizar</p>
      </div>
    )
  }

  const isCurrentFile = activeIssue && filePath === activeIssue.file

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          extensions={extensions}
          theme="dark"
          height="100%"
          readOnly
          onChange={(val: string) => {
            useProjectStore.getState().setFileContent(val)
          }}
          onCreateEditor={(view: EditorView) => {
            editorRef.current = view
            if (content) {
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: content },
              })
            }
          }}
        />
      </div>
      {isCurrentFile && (
        <div style={{
          background: '#1a1400', borderTop: '0.5px solid #f59e0b',
          padding: '10px 14px', fontSize: 12, lineHeight: 1.6, flexShrink: 0,
        }}>
          <div style={{ color: '#f59e0b', fontWeight: 500, marginBottom: 4 }}>
            ⚠ {activeIssue.rule} — línea {activeIssue.line}
          </div>
          <div style={{ color: '#9ca3af', marginBottom: 8 }}>{activeIssue.message}</div>
          {activeIssue.suggestion && (
            <div style={{
              color: '#6b7280', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              background: '#0d0f14', padding: '6px 10px', borderRadius: 4, marginBottom: 8,
            }}>
              {activeIssue.suggestion}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {activeIssue.code_fix && (
              <button
                onClick={async () => {
                  try {
                    const { invoke } = await import('@tauri-apps/api/core')
                    await invoke('apply_fix', {
                      path: activeIssue.file,
                      line: activeIssue.line,
                      fix: activeIssue.code_fix,
                    })
                    useProjectStore.getState().setToast({ message: 'Fix aplicado', type: 'success' })
                    setActiveIssue(null)
                  } catch {
                    useProjectStore.getState().setToast({ message: 'Error al aplicar fix', type: 'error' })
                  }
                }}
                style={{
                  padding: '4px 12px', background: '#f59e0b', color: '#0d0f14',
                  border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Aplicar fix
              </button>
            )}
            <button
              onClick={() => setActiveIssue(null)}
              style={{
                padding: '4px 12px', background: 'transparent', color: '#6b7280',
                border: '0.5px solid #2a2f3d', borderRadius: 4, fontSize: 11, cursor: 'pointer',
              }}
            >
              Ignorar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
