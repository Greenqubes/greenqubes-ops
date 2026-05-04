'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'

type Props = { children: ReactNode }
type State = { crashed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  componentDidCatch(error: Error, info: ErrorInfo) {
    fetch('/api/crash', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        route:          window.location.pathname,
        errorMessage:   error.message,
        stackTrace:     error.stack,
        componentStack: info.componentStack ?? undefined,
      }),
    }).catch(() => {})

    this.setState({ crashed: true })
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-4">
          <p className="font-display text-2xl text-ink font-medium tracking-tight">
            Something went wrong
          </p>
          <p className="text-sm text-muted text-center max-w-sm">
            This crash has been logged. Reload the page to try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-terracotta underline underline-offset-2"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
