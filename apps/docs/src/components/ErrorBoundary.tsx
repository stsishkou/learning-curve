import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** What to show instead of the children once they threw; `retry` renders them again */
  renderFallback: (retry: () => void) => ReactNode
  onError?: ((error: unknown, info: ErrorInfo) => void) | undefined
  children: ReactNode
}

/** Keeps a failure inside the part of the page that failed. A class: React offers boundaries no other way. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError?.(error, info)
  }

  override render() {
    return this.state.failed ? this.props.renderFallback(() => this.setState({ failed: false })) : this.props.children
  }
}
