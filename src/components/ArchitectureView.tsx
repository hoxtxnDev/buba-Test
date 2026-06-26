import { useState, useMemo, useCallback } from 'react'
import { useProjectStore, type ArchNode } from '../store/projectStore'
import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { cn } from '../utils/cn'

export function ArchitectureView(): JSX.Element {
  const graph = useProjectStore((s) => s.architectureGraph)
  const setSelectedFile = useProjectStore((s) => s.setSelectedFile)
  const setToast = useProjectStore((s) => s.setToast)
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null)

  const layout = useMemo(() => {
    if (!graph) return { positionedNodes: [], edges: [], microservices: [] as { name: string; x: number; w: number; h: number }[] }

    const nodes = graph.nodes
    const edges = graph.edges
    const positionedNodes: (ArchNode & { x: number; y: number })[] = []

    const microserviceNames = Array.from(new Set(nodes.map(n => n.microservice)))
    const LAYER_ORDER = ['CONTROLLER', 'SERVICE', 'REPOSITORY', 'ENTITY', 'DTO', 'UNKNOWN']
    const NODE_W = 170
    const NODE_H = 34
    const COL_W = 220
    const GAP = 40
    const ROW_H = 50

    const positioned: (ArchNode & { x: number; y: number })[] = []

    microserviceNames.forEach((ms, msIdx) => {
      const colX = msIdx * (COL_W + GAP) + 20
      const msNodes = nodes.filter(n => n.microservice === ms)

      LAYER_ORDER.forEach((layer) => {
        const layerNodes = msNodes.filter(n => n.layer === layer)
        layerNodes.forEach((node, nodeIdx) => {
          positioned.push({
            ...node,
            x: colX + (COL_W - NODE_W) / 2,
            y: 60 + LAYER_ORDER.indexOf(layer) * ROW_H + nodeIdx * (NODE_H + 8),
          })
        })
      })
    })

    const msWidth = microserviceNames.length * (COL_W + GAP) + 40
    const totalHeight = Math.max(
      60 + LAYER_ORDER.length * ROW_H + 40,
      positioned.length > 0 ? Math.max(...positioned.map(n => n.y)) + NODE_H + 40 : 400
    )

    const microservices = microserviceNames.map((name, msIdx) => ({
      name,
      x: msIdx * (COL_W + GAP) + 20,
      w: COL_W,
      h: totalHeight,
    }))

    return { positionedNodes: positioned, edges, microservices, totalWidth: msWidth, totalHeight }
  }, [graph])

  const handleViewFile = useCallback((path: string): void => {
    setSelectedFile(path)
    setSelectedNode(null)
  }, [setSelectedFile])

  const handleGenerateTest = useCallback(async (node: ArchNode): Promise<void> => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const testCode = await invoke<string>('generate_test', {
        path: node.path,
        layer: node.layer,
      })
      useProjectStore.getState().setGeneratedTest(testCode)
      useProjectStore.getState().setActiveTab('tests')
      setToast({ message: 'Test generado', type: 'success' })
      setSelectedNode(null)
    } catch {
      setToast({ message: 'Error al generar test', type: 'error' })
    }
  }, [setToast])

  if (!graph || layout.positionedNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Sin datos de arquitectura. Abre un proyecto Java.
      </div>
    )
  }

  const worstNodeIssueColor = (node: ArchNode): string => {
    if (node.issues.length === 0) return '#22c55e'
    if (node.issues.some(i => i.severity === 'CRITICAL')) return '#ef4444'
    if (node.issues.some(i => i.severity === 'WARNING')) return '#f59e0b'
    return '#22c55e'
  }

  const nodeBorderColor = (node: ArchNode): string => {
    const map: Record<string, string> = {
      CONTROLLER: '#4f8ef7', SERVICE: '#7c6af7', REPOSITORY: '#f59e0b', ENTITY: '#22c55e', DTO: '#22c55e',
    }
    return map[node.layer] || '#6b7280'
  }

  return (
    <div className="relative w-full h-full overflow-auto bg-dark-base">
      <svg
        className="w-full"
        style={{ minWidth: `${layout.totalWidth}px`, minHeight: `${layout.totalHeight}px` }}
      >
        <defs>
          <marker id="arr-injection" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#2a2f3d" />
          </marker>
          <marker id="arr-missing" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#ef4444" />
          </marker>
          <marker id="arr-feign" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#534AB7" />
          </marker>
        </defs>

        {layout.microservices.map((ms) => (
          <g key={ms.name}>
            <rect
              x={ms.x} y={30}
              width={ms.w} height={ms.h - 30}
              rx={8} fill="none"
              stroke="#1e2330" strokeWidth={1} strokeDasharray="4 3"
            />
            <text x={ms.x + 10} y={22} fontSize={10} fill="#4b5563" className="uppercase tracking-wider font-semibold">
              {ms.name}
            </text>
          </g>
        ))}

        {layout.edges.map((edge, i) => {
          const fromNode = layout.positionedNodes.find(n => n.id === edge.from)
          const toNode = layout.positionedNodes.find(n => n.id === edge.to)
          if (!fromNode || !toNode) return null

          const markers: Record<string, string> = {
            INJECTION: 'url(#arr-injection)',
            MISSING: 'url(#arr-missing)',
            FEIGN: 'url(#arr-feign)',
          }

          return (
            <line
              key={i}
              x1={fromNode.x + 85} y1={fromNode.y + 17}
              x2={toNode.x + 85} y2={toNode.y + 17}
              stroke={edge.type === 'INJECTION' ? '#2a2f3d' : edge.type === 'FEIGN' ? '#534AB7' : '#ef4444'}
              strokeWidth={edge.type === 'MISSING' ? 1.5 : 1}
              strokeDasharray={edge.type !== 'INJECTION' ? '4 3' : 'none'}
              markerEnd={markers[edge.type] || 'url(#arr-injection)'}
            />
          )
        })}

        {layout.positionedNodes.map((node) => {
          const healthColor = worstNodeIssueColor(node)
          const borderColor = nodeBorderColor(node)
          const issueCount = node.issues.length

          return (
            <g
              key={node.id}
              onClick={() => setSelectedNode(node)}
              className="cursor-pointer"
            >
              <rect
                x={node.x} y={node.y}
                width={170} height={34}
                rx={5} fill="#1a1e28"
                stroke={selectedNode?.id === node.id ? healthColor : borderColor}
                strokeWidth={selectedNode?.id === node.id ? 2 : 1.2}
              />
              <rect
                x={node.x} y={node.y}
                width={5} height={34}
                rx={2} fill={healthColor}
              />
              <text
                x={node.x + 14} y={node.y + 20}
                fontSize={11} fill="#e5e7eb"
                className="pointer-events-none"
              >
                {node.name.length > 18 ? node.name.slice(0, 17) + '…' : node.name}
              </text>

              {issueCount > 0 && (
                <>
                  <circle
                    cx={node.x + 170 - 10} cy={node.y + 8}
                    r={8} fill={healthColor}
                  />
                  <text
                    x={node.x + 170 - 10} y={node.y + 12}
                    fontSize={8} fill="#fff"
                    textAnchor="middle"
                    className="pointer-events-none font-bold"
                  >
                    {issueCount > 9 ? '9+' : issueCount}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>

      {selectedNode && (
        <div className="absolute top-4 right-4 w-72 bg-dark-card border border-dark-border rounded-lg shadow-2xl p-4 text-xs z-20">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-white text-sm">{selectedNode.name}</h3>
              <span className={cn(
                'inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                selectedNode.layer === 'CONTROLLER' ? 'bg-blue-900/50 text-blue-300' :
                selectedNode.layer === 'SERVICE' ? 'bg-purple-900/50 text-purple-300' :
                selectedNode.layer === 'REPOSITORY' ? 'bg-amber-900/50 text-amber-300' :
                'bg-green-900/50 text-green-300'
              )}>
                {selectedNode.layer}
              </span>
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-white p-0.5">
              <X size={14} />
            </button>
          </div>

          <div className="text-gray-400 space-y-0.5 mb-3">
            <p>Package: <span className="text-gray-300">{selectedNode.pkg || '—'}</span></p>
            <p>Lines: <span className="text-gray-300">{selectedNode.lines}</span></p>
          </div>

          {selectedNode.endpoints.length > 0 && (
            <div className="mb-3">
              <h4 className="font-semibold text-gray-300 mb-1 text-[11px] uppercase tracking-wider">Endpoints</h4>
              <div className="space-y-0.5">
                {selectedNode.endpoints.map((ep, i) => (
                  <div key={i} className="font-mono text-[10px]">
                    <span className={cn(
                      'px-1 rounded mr-1.5 font-semibold',
                      ep.method === 'GET' ? 'text-green-400 bg-green-900/30' :
                      ep.method === 'POST' ? 'text-blue-400 bg-blue-900/30' :
                      ep.method === 'PUT' ? 'text-amber-400 bg-amber-900/30' :
                      ep.method === 'DELETE' ? 'text-red-400 bg-red-900/30' :
                      'text-gray-400 bg-gray-700/50'
                    )}>
                      {ep.method}
                    </span>
                    <span className="text-blue-200">{ep.path}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedNode.issues.length > 0 && (
            <div className="mb-3">
              <h4 className="font-semibold text-gray-300 mb-1 text-[11px] uppercase tracking-wider">Issues</h4>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {(() => {
                  const c = selectedNode.issues.filter(i => i.severity === 'CRITICAL').length
                  const w = selectedNode.issues.filter(i => i.severity === 'WARNING').length
                  const inf = selectedNode.issues.filter(i => i.severity === 'INFO').length
                  return <>
                    {c > 0 && <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-red-900/40 text-red-300 rounded-full"><AlertCircle size={9} /> {c} CRITICAL</span>}
                    {w > 0 && <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-amber-900/40 text-amber-300 rounded-full"><AlertTriangle size={9} /> {w} WARNING</span>}
                    {inf > 0 && <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded-full"><Info size={9} /> {inf} INFO</span>}
                  </>
                })()}
              </div>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {selectedNode.issues.slice(0, 5).map((iss, i) => (
                  <p key={i} className="text-gray-400 text-[10px] leading-tight">
                    <span className={cn(
                      'font-semibold mr-1',
                      iss.severity === 'CRITICAL' ? 'text-red-400' :
                      iss.severity === 'WARNING' ? 'text-amber-400' :
                      'text-blue-400'
                    )}>•</span>
                    {iss.message}
                  </p>
                ))}
                {selectedNode.issues.length > 5 && (
                  <p className="text-gray-500 text-[10px]">… y {selectedNode.issues.length - 5} más</p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleViewFile(selectedNode.path)}
              className="flex-1 px-2 py-1.5 bg-accent-blue text-white rounded text-[11px] font-medium hover:bg-blue-600 transition-colors"
            >
              Ver archivo
            </button>
            <button
              onClick={() => handleGenerateTest(selectedNode)}
              className="flex-1 px-2 py-1.5 bg-accent-purple text-white rounded text-[11px] font-medium hover:bg-purple-600 transition-colors"
            >
              Generar test
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
