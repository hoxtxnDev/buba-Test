import { useState } from 'react'
import { useProjectStore, type FileEntry } from '../store/projectStore'
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen, Layers } from 'lucide-react'
import { cn } from '../utils/cn'

interface FileTreeProps {
  onSelectFile: (path: string) => void
}

interface TreeNodeProps {
  node: FileEntry
  depth: number
  onSelectFile: (path: string) => void
}

function TreeNode({ node, depth, onSelectFile }: TreeNodeProps): JSX.Element {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = node.children.length > 0
  const selectedFile = useProjectStore((s) => s.selectedFile)
  const isSelected = selectedFile === node.path

  if (!hasChildren) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 cursor-pointer text-sm hover:bg-dark-surface transition-colors',
          isSelected ? 'bg-dark-card text-accent-blue' : 'text-gray-300'
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={(): void => onSelectFile(node.path)}
      >
        <FileCode size={14} className="shrink-0 text-accent-blue" />
        <span className="truncate">{node.name}</span>
        <span className={`ml-auto text-[10px] ${getLayerColor(node.layer)}`}>
          {node.layer}
        </span>
      </div>
    )
  }

  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-2 py-1 cursor-pointer text-sm hover:bg-dark-surface transition-colors text-gray-300"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={(): void => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {expanded ? <FolderOpen size={14} className="text-accent-blue shrink-0" /> : <Folder size={14} className="text-accent-blue shrink-0" />}
        <span className="truncate font-medium">{node.name}</span>
      </div>
      {expanded &&
        node.children.map((child: FileEntry): JSX.Element => (
          <TreeNode key={child.path} node={child} depth={depth + 1} onSelectFile={onSelectFile} />
        ))}
    </div>
  )
}

function getLayerColor(layer: string): string {
  switch (layer) {
    case 'CONTROLLER': return 'text-green-400'
    case 'SERVICE': return 'text-blue-400'
    case 'REPOSITORY': return 'text-amber-400'
    case 'ENTITY': return 'text-purple-400'
    default: return 'text-gray-500'
  }
}

export function FileTree({ onSelectFile }: FileTreeProps): JSX.Element {
  const fileTree = useProjectStore((s) => s.fileTree)

  if (!fileTree) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm p-4 text-center">
        <div>
          <Layers size={32} className="mx-auto mb-2 opacity-40" />
          <p>Abre un proyecto Java para comenzar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto py-2">
      <div className="px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-dark-border mb-1">
        Explorador
      </div>
      <TreeNode node={fileTree} depth={0} onSelectFile={onSelectFile} />
    </div>
  )
}
