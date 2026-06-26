import { useState, useMemo, useCallback } from 'react'
import { useProjectStore, type FileEntry } from '../store/projectStore'
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen, Cpu, Database, Box, File, Layers, Minus, Plus } from 'lucide-react'
import { cn } from '../utils/cn'

interface FileTreeProps {
  onSelectFile: (path: string) => void
}

interface TreeNodeProps {
  node: FileEntry
  depth: number
  onSelectFile: (path: string) => void
  allExpanded: boolean
}

const LAYER_SORT_ORDER: Record<string, number> = {
  controller: 0, controllers: 0, control: 0,
  service: 1, services: 1,
  repository: 2, repositories: 2, repo: 2,
  entity: 3, entities: 3,
  model: 3, models: 3,
  dto: 4, dtos: 4,
  config: 5, configuration: 5,
  util: 6, utils: 6,
  exception: 7, exceptions: 7,
  client: 8, clients: 8,
}

function getSortKey(name: string): number {
  const lower = name.toLowerCase()
  for (const [key, order] of Object.entries(LAYER_SORT_ORDER)) {
    if (lower.includes(key)) return order
  }
  return 99
}

function sortFileTree(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    const aIsDir = a.children.length > 0
    const bIsDir = b.children.length > 0
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
    const aOrder = getSortKey(a.name)
    const bOrder = getSortKey(b.name)
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.name.localeCompare(b.name)
  }).map(entry => ({
    ...entry,
    children: entry.children ? sortFileTree(entry.children) : entry.children,
  }))
}

function getLayerLabel(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower.includes('controller') || lower.includes('control')) return 'Controllers'
  if (lower.includes('service')) return 'Services'
  if (lower.includes('repository') || lower.includes('repositories')) return 'Repositories'
  if (lower.includes('entity') || lower.includes('entities') || lower.includes('model')) return 'Models / Entities'
  if (lower.includes('dto')) return 'DTOs'
  if (lower.includes('config') || lower.includes('configuration')) return 'Configuration'
  if (lower.includes('util') || lower.includes('utils')) return 'Utilities'
  if (lower.includes('exception')) return 'Exceptions'
  if (lower.includes('client') || lower.includes('clients')) return 'Clients'
  return null
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

function TreeNode({ node, depth, onSelectFile, allExpanded }: TreeNodeProps): JSX.Element {
  const [localExpanded, setLocalExpanded] = useState(depth < 1)
  const expanded = allExpanded || localExpanded
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

  const handleToggle = useCallback(() => {
    setLocalExpanded(prev => !prev)
  }, [])

  const sortedChildren = useMemo(() => sortFileTree(node.children), [node.children])

  if (!hasChildren) {
    return (
      <div>
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
      </div>
    )
  }

  return (
    <div>
      <div
        className="flex items-center gap-1.5 h-8 px-2 cursor-pointer text-sm hover:bg-dark-hover transition-colors text-gray-300"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleToggle}
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
        expanded ? 'opacity-100 max-h-[10000px]' : 'opacity-0 max-h-0'
      )}>
        {(() => {
          let lastLabel: string | null = null
          return sortedChildren.map((child, idx) => {
            const label = !child.children.length ? getLayerLabel(child.name) : null
            const showLabel = label && label !== lastLabel
            if (label) lastLabel = label
            return (
              <div key={child.path}>
                {showLabel && (
                  <div style={{
                    fontSize: 9, color: '#374151', padding: '8px 12px 2px',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    {label}
                  </div>
                )}
                <TreeNode node={child} depth={depth + 1} onSelectFile={onSelectFile} allExpanded={allExpanded} />
              </div>
            )
          })
        })()}
      </div>
    </div>
  )
}

export function FileTree({ onSelectFile }: FileTreeProps): JSX.Element {
  const fileTree = useProjectStore((s) => s.fileTree)
  const [allExpanded, setAllExpanded] = useState(true)

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', marginBottom: 2 }}>
        <button
          onClick={() => setAllExpanded(true)}
          style={{ padding: 2, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', lineHeight: 0 }}
          title="Expandir todo"
        >
          <Plus size={12} />
        </button>
        <button
          onClick={() => setAllExpanded(false)}
          style={{ padding: 2, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', lineHeight: 0 }}
          title="Colapsar todo"
        >
          <Minus size={12} />
        </button>
      </div>
      <TreeNode node={fileTree} depth={0} onSelectFile={onSelectFile} allExpanded={allExpanded} />
    </div>
  )
}
