import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: string | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(e: Error): State {
    return { hasError: true, error: e.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', color: '#ef4444', fontSize: 13, flexDirection: 'column', gap: 8, padding: 20,
        }}>
          <div style={{ fontSize: 24 }}>⚠</div>
          <div style={{ fontWeight: 600 }}>Error al renderizar</div>
          <div style={{ color: '#6b7280', fontSize: 11, textAlign: 'center', maxWidth: 400 }}>{this.state.error}</div>
        </div>
      )
    }
    return this.props.children
  }
}
