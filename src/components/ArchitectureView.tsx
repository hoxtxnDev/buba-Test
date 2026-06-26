import { useState, useMemo, useCallback } from 'react'
import { useProjectStore, type ArchNode, type ArchEdge } from '../store/projectStore'
import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react'

const NODE_W = 190
const NODE_H = 52
const COL_W = 210
const COL_GAP = 30
const ROW_HEIGHT = NODE_H + 10
const LAYER_HEADER_HEIGHT = 24
const START_X = 20
const START_Y = 55
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

function routeEdge(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const x1 = from.x + NODE_W
  const y1 = from.y + NODE_H / 2
  const x2 = to.x
  const y2 = to.y + NODE_H / 2

  // Same column — vertical connection, exit bottom / enter top
  if (Math.abs(x1 - x2) < NODE_W + 20) {
    const exitX = from.x + NODE_W / 2
    const exitY = from.y + NODE_H
    const entX = to.x + NODE_W / 2
    const entY = to.y
    const mid = (exitY + entY) / 2
    return `M${exitX},${exitY} C${exitX},${mid} ${entX},${mid} ${entX},${entY}`
  }

  // Cross-column: cubic bezier with control points at 40%
  const dx = Math.abs(x2 - x1) * 0.4
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
}

export function ArchitectureView(): JSX.Element {
  const graph = useProjectStore((s) => s.architectureGraph)
  const setSelectedFile = useProjectStore((s) => s.setSelectedFile)
  const setScrollToLine = useProjectStore((s) => s.setScrollToLine)
  const setActiveIssue = useProjectStore((s) => s.setActiveIssue)
  const setView = useProjectStore((s) => s.setView)
  const setToast = useProjectStore((s) => s.setToast)
  const analysisResult = useProjectStore((s) => s.analysisResult)

  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 })

  const layout = useMemo(() => {
    if (!graph || graph.nodes.length === 0) {
      return { layoutMap: new Map(), edges: [] as ArchEdge[], microserviceRects: [] as { name: string; x: number; y: number; width: number; height: number }[], layerGroups: [] as { layer: string; x: number; y: number }[], totalW: 600, totalH: 400 }
    }

    const nodes = graph.nodes
    const edges = graph.edges
    const layoutMap = new Map<string, { x: number; y: number }>()
    const layerGroups: { layer: string; x: number; y: number }[] = []

    const byService = new Map<string, ArchNode[]>()
    nodes.forEach(n => {
      if (!byService.has(n.microservice)) byService.set(n.microservice, [])
      byService.get(n.microservice)!.push(n)
    })

    const colSizes: number[] = []
    let colIndex = 0
    byService.forEach((serviceNodes) => {
      const byLayer = new Map<string, ArchNode[]>()
      serviceNodes.forEach(n => {
        if (!byLayer.has(n.layer)) byLayer.set(n.layer, [])
        byLayer.get(n.layer)!.push(n)
      })

      let currentY = START_Y
      const colX = START_X + colIndex * (COL_W + COL_GAP)

      LAYER_ORDER.forEach(layer => {
        const layerNodes = byLayer.get(layer)
        if (!layerNodes || layerNodes.length === 0) return

        currentY += LAYER_HEADER_HEIGHT
        layerGroups.push({ layer, x: colX + 5, y: currentY - 8 })

        layerNodes.forEach(node => {
          layoutMap.set(node.id, { x: colX, y: currentY })
          currentY += ROW_HEIGHT
        })

        currentY += 8
      })

      colSizes.push(serviceNodes.length)
      colIndex++
    })

    const microserviceCount = byService.size
    const totalW = microserviceCount * (COL_W + COL_GAP) + START_X
    const maxNodesInCol = Math.max(...colSizes, 1)
    const totalH = START_Y + maxNodesInCol * (ROW_HEIGHT + LAYER_HEADER_HEIGHT + 8) + 80

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

    return { layoutMap, edges, microserviceRects, layerGroups, totalW, totalH }
  }, [graph])

  const handleViewFile = useCallback((node: ArchNode): void => {
    setSelectedFile(node.path)
    setView('code')
    // Find first critical issue, else first issue
    const critical = node.issues.find(i => i.severity === 'CRITICAL')
    const first = node.issues[0]
    if (critical || first) {
      const target = critical || first!
      setScrollToLine(target.line)
      setActiveIssue(target)
    } else {
      setScrollToLine(null)
      setActiveIssue(null)
    }
    setSelectedNode(null)
  }, [setSelectedFile, setView, setScrollToLine, setActiveIssue])

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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => Math.min(Math.max(z * delta, 0.3), 3))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsPanning(true)
    setLastMouse({ x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    setPan(p => ({
      x: p.x + (e.clientX - lastMouse.x),
      y: p.y + (e.clientY - lastMouse.y),
    }))
    setLastMouse({ x: e.clientX, y: e.clientY })
  }, [isPanning, lastMouse])

  const handleMouseUp = useCallback(() => setIsPanning(false), [])

  const handleNodeEnter = useCallback((id: string) => setHoveredNode(id), [])
  const handleNodeLeave = useCallback(() => setHoveredNode(null), [])

  if (!graph || graph.nodes.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: 14 }}>
        Sin datos de arquitectura. Abre un proyecto Java.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#0d0f14' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, padding: '6px 14px', background: '#0d0f14', borderBottom: '0.5px solid #1e2330', alignItems: 'center', flexShrink: 0 }}>
        {Object.entries(LAYER_STYLES).filter(([k]) => k !== 'UNKNOWN').map(([layer, s]) => (
          <div key={layer} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.accent }} />
            <span style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 14, background: '#2a2f3d', margin: '0 4px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 12, height: 3, background: '#ef4444', borderRadius: 1 }} /><span style={{ fontSize: 11, color: '#6b7280' }}>Faltante</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 12, height: 3, background: '#534AB7', borderRadius: 1 }} /><span style={{ fontSize: 11, color: '#6b7280' }}>Feign</span></div>
      </div>

      {/* SVG canvas */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <svg
          width="100%" height="100%"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isPanning ? 'grabbing' : 'grab', display: 'block' }}
        >
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 Z" fill="#2a2f3d" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            <rect x={0} y={0} width={layout.totalW} height={layout.totalH} fill="#0d0f14" />

            {/* Microservice containers */}
            {layout.microserviceRects.map((ms) => (
              <g key={ms.name}>
                <rect x={ms.x} y={ms.y} width={ms.width} height={ms.height} rx={8} fill="none" stroke="#1e2330" strokeWidth={1} strokeDasharray="4 3" />
                <text x={ms.x + 10} y={ms.y + 16} fontSize={10} fill="#4b5563" fontWeight={600} style={{ letterSpacing: 1 }}>
                  {ms.name.toUpperCase()}
                </text>
              </g>
            ))}

            {/* Layer group labels */}
            {layout.layerGroups.map((lg, i) => (
              <text key={i} x={lg.x} y={lg.y} fontSize={9} fill="#374151" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {lg.layer}
              </text>
            ))}

            {/* Edges */}
            {layout.edges.map((edge) => {
              const from = layout.layoutMap.get(edge.from)
              const to = layout.layoutMap.get(edge.to)
              if (!from || !to) return null

              const color = edge.type === 'MISSING' ? '#ef4444' : edge.type === 'FEIGN' ? '#534AB7' : '#2a2f3d'
              const dash = edge.type === 'MISSING' ? '5 4' : edge.type === 'FEIGN' ? '3 2' : undefined
              const edgeOpacity =
                !hoveredNode || hoveredNode === edge.from || hoveredNode === edge.to
                  ? 0.6
                  : 0.15

              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={routeEdge(from, to)}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.2}
                  strokeDasharray={dash}
                  markerEnd="url(#arr)"
                  style={{ opacity: edgeOpacity, transition: 'opacity 0.15s' }}
                />
              )
            })}

            {/* Nodes */}
            {Array.from(layout.layoutMap.entries()).map(([id, pos]) => {
              const node = graph.nodes.find(n => n.id === id)
              if (!node) return null
              const style = LAYER_STYLES[node.layer] || LAYER_STYLES.UNKNOWN
              const badge = getIssueBadge(node)

              return (
                <g
                  key={id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedNode(node)}
                  onMouseEnter={() => handleNodeEnter(id)}
                  onMouseLeave={handleNodeLeave}
                >
                  <title>{node.name} — {node.pkg}</title>

                  <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={6} fill={style.bg} stroke={selectedNode?.id === id ? style.accent : style.border} strokeWidth={selectedNode?.id === id ? 2 : 1} />
                  <rect x={pos.x} y={pos.y} width={4} height={NODE_H} rx={2} fill={style.accent} />

                  <text x={pos.x + 14} y={pos.y + 20} fontSize={12} fontWeight={500} fill={style.textColor}>
                    {truncate(node.name, 22)}
                  </text>
                  <text x={pos.x + 14} y={pos.y + 34} fontSize={10} fill="#4b5563">
                    {style.label}
                  </text>

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
          </g>
        </svg>

        {/* Zoom controls */}
        <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
          <button onClick={() => setZoom(z => Math.min(z * 1.2, 3))} style={{ width: 28, height: 28, background: '#1a1e28', border: '0.5px solid #2a2f3d', borderRadius: 4, color: '#9ca3af', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} style={{ width: 28, height: 28, background: '#1a1e28', border: '0.5px solid #2a2f3d', borderRadius: 4, color: '#9ca3af', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⊙</button>
          <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.3))} style={{ width: 28, height: 28, background: '#1a1e28', border: '0.5px solid #2a2f3d', borderRadius: 4, color: '#9ca3af', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
        </div>
        <div style={{ position: 'absolute', bottom: 14, left: 12, fontSize: 10, color: '#374151' }}>
          {Math.round(zoom * 100)}%
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div style={{ position: 'absolute', top: 10, right: 10, width: 240, background: '#1a1e28', border: '0.5px solid #2a2f3d', borderRadius: 8, padding: 14, zIndex: 10, fontSize: 12, color: '#9ca3af', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            <button onClick={() => setSelectedNode(null)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 2, lineHeight: 0 }}>
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
                    <span style={{ padding: '0 4px', borderRadius: 2, fontWeight: 600, marginRight: 4, color: ep.method === 'GET' ? '#4ade80' : ep.method === 'POST' ? '#60a5fa' : ep.method === 'PUT' ? '#fbbf24' : '#f87171', background: ep.method === 'GET' ? 'rgba(74,222,128,0.15)' : ep.method === 'POST' ? 'rgba(96,165,250,0.15)' : ep.method === 'PUT' ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)' }}>
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
                  {selectedNode.issues.length > 5 && <p style={{ margin: 0, fontSize: 10, color: '#4b5563' }}>… y {selectedNode.issues.length - 5} más</p>}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={() => handleViewFile(selectedNode)} style={{ flex: 1, padding: '5px 8px', background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
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
