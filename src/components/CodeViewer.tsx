import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import type { EditorView } from '@codemirror/view'
import { java } from '@codemirror/lang-java'
import { useProjectStore } from '../store/projectStore'

interface CodeViewerProps {
  filePath: string | null
  onLineClick?: (line: number) => void
}

export function CodeViewer({ filePath, onLineClick }: CodeViewerProps): JSX.Element {
  const [content, setContent] = useState('')

  useEffect(() => {
    if (!filePath) return
    const loadFile = async (): Promise<void> => {
      try {
        const { readTextFile } = await import('@tauri-apps/plugin-fs')
        const text = await readTextFile(filePath)
        setContent(text)
        useProjectStore.getState().setFileContent(text)
      } catch (e: unknown) {
        console.error('Error al leer archivo:', e)
        setContent('// Error al leer el archivo')
      }
    }
    loadFile()
  }, [filePath])

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
        extensions={[java()]}
        theme="dark"
        height="100%"
        readOnly
        onChange={(val: string): void => {
          useProjectStore.getState().setFileContent(val)
        }}
        onCreateEditor={(view: EditorView): void => {
          if (onLineClick) {
            view.dom.addEventListener('click', (): void => {
              const pos = view.state.selection.main.head
              const line = view.state.doc.lineAt(pos).number
              onLineClick(line)
            })
          }
        }}
      />
    </div>
  )
}
