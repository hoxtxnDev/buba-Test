import { useState, useMemo } from 'react'
import { useProjectStore, type FileEntry } from '../store/projectStore'
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen, Cpu, Database, Box, File, Layers } from 'lucide-react'
import { cn } from '../utils/cn'

interface FileTreeProps {
  onSelectFile: (path: string) => void
}

interface TreeNodeProps {
  node: FileEntry
  depth: number
  onSelectFile: (path: string) => void
}

function FileIcon({ layer }: { layer: string }): JSX.Element {
  switch (layer) {
    case 'CONTROLLER': return <FileCode size={14} className="shrink-0 text-accent-blue" />
    case 'SERVICE': return <Cpu size={14} className="shrink-0 text-accent-purple" />
    case 'REPOSITORY': return <Database size={14} className="shrink-0 text-amber-400" />
    case 'ENTITY': return <Box size={14} className="shrink-0 text-green-400" />
    default: return <File size={14} className="shrink-0 text-gray-500" />
  }
}

function LayerBadge({ layer }: { layer: string }): JSX.Element | null {
  if (!layer) return null
  const colorMap: Record<string, string> = {
    CONTROLLER: 'bg-blue-900/50 text-blue-300',
    SERVICE: 'bg-purple-900/50 text-purple-300',
    REPOSITORY: 'bg-amber-900/50 text-amber-300',
    ENTITY: 'bg-green-900/50 text-green-300',
  }
  return (
    <span className={cn(
      'ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-medium',
      colorMap[layer] || 'bg-gray-700/50 text-gray-400'
    )}>
      {layer}
    </span>
  )
}

function TreeNode({ node, depth, onSelectFile }: TreeNodeProps): JSX.Element {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = node.children.length > 0
  const selectedFile = useProjectStore((s) => s.selectedFile)
  const isSelected = selectedFile === node.path
  const architectureGraph = useProjectStore((s) => s.architectureGraph)

  const healthColor = useMemo((): string | null => {
    if (!architectureGraph) return null
    for (const n of architectureGraph.nodes) {
      if (n.path !== node.path || n.issues.length === 0) continue
      if (n.issues.some(i => i.severity === 'CRITICAL')) return '#ef4444'
      if (n.issues.some(i => i.severity === 'WARNING')) return '#f59e0b'
      return '#22c55e'
    }
    return null
  }, [architectureGraph, node.path])

  if (!hasChildren) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 h-8 px-2 cursor-pointer text-sm transition-colors duration-75',
          isSelected
            ? 'bg-dark-selected text-accent-blue border-l-2 border-accent-blue'
            : 'text-gray-300 hover:bg-dark-hover border-l-2 border-transparent'
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelectFile(node.path)}
      >
        {healthColor && <span className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: healthColor }} />}
        <FileIcon layer={node.layer} />
        <span className="truncate">{node.name}</span>
        <LayerBadge layer={node.layer} />
      </div>
    )
  }

  return (
    <div>
      <div
        className="flex items-center gap-1.5 h-8 px-2 cursor-pointer text-sm hover:bg-dark-hover transition-colors text-gray-300"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-gray-500 shrink-0 transition-transform duration-150">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        {expanded
          ? <FolderOpen size={14} className="text-gray-400 shrink-0" />
          : <Folder size={14} className="text-gray-400 shrink-0" />
        }
        {healthColor && <span className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: healthColor }} />}
        <span className="truncate font-medium text-gray-200">{node.name}</span>
      </div>
      <div className={cn(
        'overflow-hidden transition-all duration-150',
        expanded ? 'opacity-100' : 'opacity-0 max-h-0'
      )}>
        {node.children.map((child: FileEntry) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} onSelectFile={onSelectFile} />
        ))}
      </div>
    </div>
  )
}

export function FileTree({ onSelectFile }: FileTreeProps): JSX.Element {
  const fileTree = useProjectStore((s) => s.fileTree)

  if (!fileTree) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm p-4 text-center">
        <div>
          <Layers size={32} className="mx-auto mb-2 opacity-30" />
          <p>Abre un proyecto Java para comenzar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="py-1">
      <TreeNode node={fileTree} depth={0} onSelectFile={onSelectFile} />
    </div>
  )
}
