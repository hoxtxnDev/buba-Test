import { useProjectStore } from '../store/projectStore'
import { Download, FileJson } from 'lucide-react'

export function TestOutput(): JSX.Element {
  const opencodeOutput = useProjectStore((s) => s.opencodeOutput)
  const generatedTest = useProjectStore((s) => s.generatedTest)
  const selectedFile = useProjectStore((s) => s.selectedFile)

  const handleDownload = async (): Promise<void> => {
    if (!generatedTest) return
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      const dest = await save({
        defaultPath: selectedFile?.replace('.java', 'Test.java') || 'GeneratedTest.java',
        filters: [{ name: 'Java', extensions: ['java'] }],
      })
      if (dest) {
        await writeTextFile(dest, generatedTest)
      }
    } catch (e: unknown) {
      console.error('Error al guardar:', e)
    }
  }

  const handleGenerateTest = async (): Promise<void> => {
    if (!selectedFile) return
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const state = useProjectStore.getState()
      const testCode = await invoke<string>('generate_test', {
        path: selectedFile,
        layer: state.analysisResult?.layer || '',
      })
      useProjectStore.getState().setGeneratedTest(testCode)
    } catch (e: unknown) {
      console.error('Error al generar test:', e)
    }
  }

  if (!opencodeOutput && !generatedTest) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm p-4 text-center">
        <div>
          <FileJson size={32} className="mx-auto mb-2 opacity-40" />
          <p>Ejecuta un análisis con IA o genera tests para ver resultados aquí</p>
          {selectedFile && (
            <button
              onClick={handleGenerateTest}
              className="mt-3 px-3 py-1.5 bg-accent-blue text-white text-xs rounded hover:bg-blue-600 transition-colors"
            >
              Generar test para archivo actual
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-dark-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Salida</h3>
        {generatedTest && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-accent-blue text-white rounded hover:bg-blue-600 transition-colors"
          >
            <Download size={12} />
            Descargar .java
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {opencodeOutput && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase">Análisis IA</h4>
            <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono bg-dark-surface p-3 rounded">
              {opencodeOutput}
            </pre>
          </div>
        )}
        {generatedTest && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase">Test generado</h4>
            <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono bg-dark-surface p-3 rounded">
              {generatedTest}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
