import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { Download, FileJson, Loader2, Sparkles, FileCode } from 'lucide-react'

export function TestOutput(): JSX.Element {
  const opencodeOutput = useProjectStore((s) => s.opencodeOutput)
  const generatedTest = useProjectStore((s) => s.generatedTest)
  const selectedFile = useProjectStore((s) => s.selectedFile)
  const analysisResult = useProjectStore((s) => s.analysisResult)
  const setToast = useProjectStore((s) => s.setToast)
  const [generating, setGenerating] = useState(false)

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
        setToast({ message: 'Test guardado exitosamente', type: 'success' })
      }
    } catch (e: unknown) {
      console.error('Error al guardar:', e)
      setToast({ message: 'Error al guardar el test', type: 'error' })
    }
  }

  const handleGenerateTest = async (ai: boolean): Promise<void> => {
    if (!selectedFile) return
    setGenerating(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const state = useProjectStore.getState()
      const testCode = await invoke<string>('generate_test', {
        path: selectedFile,
        layer: state.analysisResult?.layer || '',
      })
      useProjectStore.getState().setGeneratedTest(testCode)
      setToast({ message: 'Test generado exitosamente', type: 'success' })
    } catch (e: unknown) {
      console.error('Error al generar test:', e)
      setToast({ message: 'Error al generar test', type: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  const detectedLayer = analysisResult?.layer

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-dark-border">
        <h3 className="text-sm font-semibold text-gray-200 mb-2">Tests</h3>
        {detectedLayer && (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-700/50 text-gray-400 mb-3">
            Capa detectada: {detectedLayer}
          </span>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => handleGenerateTest(false)}
            disabled={generating || !selectedFile}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-accent-blue text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors font-medium"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <FileCode size={12} />}
            Generar template
          </button>
          <button
            onClick={() => handleGenerateTest(true)}
            disabled={generating || !selectedFile}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-accent-purple text-white rounded hover:bg-purple-600 disabled:opacity-50 transition-colors font-medium"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Generar con IA
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!opencodeOutput && !generatedTest && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm text-center">
            <FileJson size={32} className="mb-2 opacity-30" />
            <p>Genera tests para ver resultados aquí</p>
          </div>
        )}
        {opencodeOutput && (
          <div className="mb-4">
            <h4 className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Análisis IA</h4>
            <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono bg-dark-base p-3 rounded border border-dark-border">
              {opencodeOutput}
            </pre>
          </div>
        )}
        {generatedTest && (
          <div>
            <h4 className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">Test generado</h4>
            <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono bg-dark-base p-3 rounded border border-dark-border overflow-x-auto">
              {generatedTest}
            </pre>
          </div>
        )}
      </div>

      {generatedTest && (
        <div className="p-3 border-t border-dark-border">
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-accent-blue text-white rounded hover:bg-blue-600 transition-colors font-medium"
          >
            <Download size={12} />
            Descargar .java
          </button>
        </div>
      )}
    </div>
  )
}
