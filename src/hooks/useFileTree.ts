import { useState, useCallback } from 'react'
import { useProjectStore, type FileEntry, type ProjectAnalysis } from '../store/projectStore'

export function useFileTree(): { openFolder: () => Promise<void>; loading: boolean } {
  const [loading, setLoading] = useState(false)
  const { setFileTree, setProjectRoot, setProjectAnalysis } = useProjectStore()

  const openFolder = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const tree = await invoke<FileEntry>('open_folder')
      setFileTree(tree)
      setProjectRoot(tree.path)
      const analysis = await invoke<ProjectAnalysis>('analyze_project', { root: tree.path })
      setProjectAnalysis(analysis)
    } catch (e: unknown) {
      console.error('Error al abrir carpeta:', e)
    } finally {
      setLoading(false)
    }
  }, [setFileTree, setProjectRoot, setProjectAnalysis])

  return { openFolder, loading }
}
