import { useState, useMemo, useCallback } from 'react'
import { useProjectStore, type ArchNode, type ArchEdge } from '../store/projectStore'
import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react'

const NODE_W = 190
const NODE_H = 52
const COL_WIDTH = 220
const COL_GAP = 40
const ROW_HEIGHT = 68
const START_X = 20
const START_Y = 50
const LAYER_ORDER = ['CONTROLLER', 'SERVICE', 'REPOSITORY', 'ENTITY', 'DTO', 'UNKNOWN']

const LAYER_STYLES: Record<string, { bg: string; border: string; accent: string; textColor: string; label: string }> = {
  CONTROLLER: { bg: '#0f1929', border: '#4f8ef7', accent: '#4f8ef7', textColor: '#93c5fd', label: 'Controller' },
  SERVICE:    { bg: '#120f24', border: '#7c6af7', accent: '#7c6af7', textColor: '#c4b5fd', label: 'Service' },
  REPOSITORY: { bg: '#1a1400', border: '#f59e0b', accent: '#f59e0b', textColor: '#fcd34d', label: 'Repository' },
  ENTITY:     { bg: '#0a1f0f', border: '#22c55e', accent: '#22c55e', textColor: '#86efac', label: 'Entity' },
  DTO:        { bg: '#0a1f0f', border: '#22c55e', accent: '#22c55e', textColor: '#86efac', label: 'DTO' },
  UNKNOWN:    { bg: '#13161d', border: '#374151', accent: '#374151', textColor: '#9ca3af', label: 'Unknown' },
}

function truncate(name: string, max: number): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name
}

function getIssueBadge(node: ArchNode): { count: number; color: string } | null {
  if (!node.issues || node.issues.length === 0) return null
  const hasCritical = node.issues.some(i => i.severity === 'CRITICAL')
  return { count: node.issues.length, color: hasCritical ? '#ef4444' : '#f59e0b' }
}

function drawEdge(edge: ArchEdge, layoutMap: Map<string, { x: number; y: number }>) {
  const from = layoutMap.get(edge.from)
  const to = layoutMap.get(edge.to)
  if (!from || !to) return null

  const x1 = from.x + NODE_W
  const y1 = from.y + NODE_H / 2
  const x2 = to.x
  const y2 = to.y + NODE_H / 2

  const color = edge.type === 'MISSING' ? '#ef4444'
    : edge.type === 'FEIGN' ? '#534AB7'
    : '#2a2f3d'

  const dash = edge.type === 'MISSING' ? '4 3'
    : edge.type === 'FEIGN' ? '3 2'
    : undefined

  const midX = (x1 + x2) / 2
  const d = `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`

  return (
    <path
      key={`${edge.from}-${edge.to}`}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.2}
      strokeDasharray={dash}
      markerEnd="url(#arr)"
    />
  )
}

export function ArchitectureView(): JSX.Element {
  const graph = useProjectStore((s) => s.architectureGraph)
  const setSelectedFile = useProjectStore((s) => s.setSelectedFile)
  const setToast = useProjectStore((s) => s.setToast)
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null)

  const layout = useMemo(() => {
    if (!graph || graph.nodes.length === 0) {
      return { layoutMap: new Map(), edges: [] as ArchEdge[], microserviceRects: [] as { name: string; x: number; y: number; width: number; height: number }[], totalW: 600, totalH: 400 }
    }

    const nodes = graph.nodes
    const edges = graph.edges
    const layoutMap = new Map<string, { x: number; y: number }>()

    const byService = new Map<string, ArchNode[]>()
    nodes.forEach(n => {
      if (!byService.has(n.microservice)) byService.set(n.microservice, [])
      byService.get(n.microservice)!.push(n)
    })

    const colSizes: number[] = []
    let colIndex = 0
    byService.forEach((serviceNodes) => {
      const sorted = [...serviceNodes].sort((a, b) =>
        LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer)
      )
      sorted.forEach((node, rowIndex) => {
        const x = START_X + colIndex * (COL_WIDTH + COL_GAP)
        const y = START_Y + rowIndex * ROW_HEIGHT
        layoutMap.set(node.id, { x, y })
      })
      colSizes.push(sorted.length)
      colIndex++
    })

    const microserviceCount = byService.size
    const totalW = microserviceCount * (COL_WIDTH + COL_GAP) + START_X
    const maxNodesInCol = Math.max(...colSizes, 1)
    const totalH = START_Y + maxNodesInCol * ROW_HEIGHT + 40

    const microserviceRects = Array.from(byService.entries()).map(([name, serviceNodes]) => {
      const positions = serviceNodes.map(n => layoutMap.get(n.id)!).filter(Boolean)
      if (positions.length === 0) return { name, x: 0, y: 0, width: 0, height: 0 }
      const xs = positions.map(p => p.x)
      const ys = positions.map(p => p.y)
      const minY = Math.min(...ys) - 15
      const maxY = Math.max(...ys) + NODE_H + 15
      return {
        name,
        x: Math.min(...xs) - 10,
        y: minY,
        width: NODE_W + 20,
        height: maxY - minY,
      }
    })

    return { layoutMap, edges, microserviceRects, totalW, totalH }
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

  if (!graph || graph.nodes.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: 14 }}>
        Sin datos de arquitectura. Abre un proyecto Java.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#0d0f14' }}>
      {/* Legend Row */}
      <div style={{ display: 'flex', gap: 12, padding: '6px 14px', background: '#0d0f14', borderBottom: '0.5px solid #1e2330', alignItems: 'center' }}>
        {Object.entries(LAYER_STYLES).filter(([k]) => k !== 'UNKNOWN').map(([layer, s]) => (
          <div key={layer} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.accent }} />
            <span style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8 }}>
          <div style={{ width: 12, height: 3, background: '#ef4444', borderRadius: 1 }} />
          <span style={{ fontSize: 11, color: '#6b7280' }}>Faltante</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8 }}>
          <div style={{ width: 12, height: 3, background: '#534AB7', borderRadius: 1 }} />
          <span style={{ fontSize: 11, color: '#6b7280' }}>Feign</span>
        </div>
      </div>

      {/* SVG Container */}
      <div style={{ position: 'relative', flex: 1, overflow: 'auto' }}>
        <svg viewBox={`0 0 ${layout.totalW} ${layout.totalH}`} width="100%" height="100%" style={{ minWidth: layout.totalW, minHeight: layout.totalH }}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 Z" fill="#2a2f3d" />
            </marker>
          </defs>

          {/* Microservice containers */}
          {layout.microserviceRects.map((ms) => (
            <g key={ms.name}>
              <rect x={ms.x} y={ms.y} width={ms.width} height={ms.height} rx={8} fill="none" stroke="#1e2330" strokeWidth={1} strokeDasharray="4 3" />
              <text x={ms.x + 10} y={ms.y + 16} fontSize={10} fill="#4b5563" fontWeight={600} style={{ letterSpacing: 1 }}>
                {ms.name.toUpperCase()}
              </text>
            </g>
          ))}

          {/* Edges (drawn before nodes) */}
          {layout.edges.map((edge) => drawEdge(edge, layout.layoutMap))}

          {/* Nodes */}
          {Array.from(layout.layoutMap.entries()).map(([id, pos]) => {
            const node = graph.nodes.find(n => n.id === id)
            if (!node) return null
            const style = LAYER_STYLES[node.layer] || LAYER_STYLES.UNKNOWN
            const badge = getIssueBadge(node)

            return (
              <g key={id} style={{ cursor: 'pointer' }} onClick={() => setSelectedNode(node)}>
                <title>{node.name} — {node.pkg}</title>

                {/* Node body */}
                <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={6} fill={style.bg} stroke={selectedNode?.id === id ? style.accent : style.border} strokeWidth={selectedNode?.id === id ? 2 : 1} />

                {/* Accent left bar */}
                <rect x={pos.x} y={pos.y} width={4} height={NODE_H} rx={2} fill={style.accent} />

                {/* Class name */}
                <text x={pos.x + 14} y={pos.y + 20} fontSize={12} fontWeight={500} fill={style.textColor}>
                  {truncate(node.name, 22)}
                </text>

                {/* Layer label */}
                <text x={pos.x + 14} y={pos.y + 34} fontSize={10} fill="#4b5563">
                  {style.label}
                </text>

                {/* Issue badge */}
                {badge && (
                  <g>
                    <circle cx={pos.x + NODE_W - 10} cy={pos.y + 10} r={9} fill={badge.color} />
                    <text x={pos.x + NODE_W - 10} y={pos.y + 14} fontSize={9} fontWeight={600} textAnchor="middle" fill="#fff">
                      {badge.count > 9 ? '9+' : badge.count}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>

        {/* Detail Panel */}
        {selectedNode && (
          <div style={{ position: 'absolute', top: 10, right: 10, width: 240, background: '#1a1e28', border: '0.5px solid #2a2f3d', borderRadius: 8, padding: 14, zIndex: 10, fontSize: 12, color: '#9ca3af' }}>
            <button onClick={() => setSelectedNode(null)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 2 }}>
              <X size={14} />
            </button>

            <div style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontWeight: 600, color: '#e5e7eb', fontSize: 14, paddingRight: 20 }}>{selectedNode.name}</h3>
              <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, padding: '1px 8px', borderRadius: 100, fontWeight: 500, background: LAYER_STYLES[selectedNode.layer]?.bg || '#13161d', color: LAYER_STYLES[selectedNode.layer]?.textColor || '#9ca3af' }}>
                {selectedNode.layer}
              </span>
            </div>

            <div style={{ marginBottom: 10, lineHeight: 1.6 }}>
              <p style={{ margin: 0 }}>Package: <span style={{ color: '#d1d5db' }}>{selectedNode.pkg || '—'}</span></p>
              <p style={{ margin: 0 }}>Lines: <span style={{ color: '#d1d5db' }}>{selectedNode.lines}</span></p>
            </div>

            {selectedNode.endpoints.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <h4 style={{ margin: '0 0 4px 0', fontWeight: 600, color: '#d1d5db', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Endpoints</h4>
                {selectedNode.endpoints.map((ep, i) => (
                  <div key={i} style={{ fontFamily: 'monospace', fontSize: 10, marginBottom: 2 }}>
                    <span style={{
                      padding: '0 4px', borderRadius: 2, fontWeight: 600, marginRight: 4,
                      color: ep.method === 'GET' ? '#4ade80' : ep.method === 'POST' ? '#60a5fa' : ep.method === 'PUT' ? '#fbbf24' : '#f87171',
                      background: ep.method === 'GET' ? 'rgba(74,222,128,0.15)' : ep.method === 'POST' ? 'rgba(96,165,250,0.15)' : ep.method === 'PUT' ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)',
                    }}>
                      {ep.method}
                    </span>
                    <span style={{ color: '#93c5fd' }}>{ep.path}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedNode.issues.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <h4 style={{ margin: '0 0 4px 0', fontWeight: 600, color: '#d1d5db', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Issues</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {(() => {
                    const c = selectedNode.issues.filter(i => i.severity === 'CRITICAL').length
                    const w = selectedNode.issues.filter(i => i.severity === 'WARNING').length
                    const inf = selectedNode.issues.filter(i => i.severity === 'INFO').length
                    return <>
                      {c > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, padding: '1px 6px', background: 'rgba(239,68,68,0.25)', color: '#fca5a5', borderRadius: 100 }}><AlertCircle size={9} /> {c} CRITICAL</span>}
                      {w > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, padding: '1px 6px', background: 'rgba(245,158,11,0.25)', color: '#fcd34d', borderRadius: 100 }}><AlertTriangle size={9} /> {w} WARNING</span>}
                      {inf > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, padding: '1px 6px', background: 'rgba(96,165,250,0.25)', color: '#93c5fd', borderRadius: 100 }}><Info size={9} /> {inf} INFO</span>}
                    </>
                  })()}
                </div>
                <div style={{ maxHeight: 96, overflowY: 'auto' }}>
                  {selectedNode.issues.slice(0, 5).map((iss, i) => (
                    <p key={i} style={{ margin: '0 0 2px 0', fontSize: 10, lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 600, marginRight: 4, color: iss.severity === 'CRITICAL' ? '#f87171' : iss.severity === 'WARNING' ? '#fbbf24' : '#60a5fa' }}>•</span>
                      {iss.message}
                    </p>
                  ))}
                  {selectedNode.issues.length > 5 && (
                    <p style={{ margin: 0, fontSize: 10, color: '#4b5563' }}>… y {selectedNode.issues.length - 5} más</p>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={() => handleViewFile(selectedNode.path)} style={{ flex: 1, padding: '5px 8px', background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                Ver archivo
              </button>
              <button onClick={() => handleGenerateTest(selectedNode)} style={{ flex: 1, padding: '5px 8px', background: '#7c6af7', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                Generar test
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
