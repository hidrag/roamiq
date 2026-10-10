import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches unexpected render crashes and shows a friendly recovery screen
 * instead of a blank page. Resetting re-mounts the subtree fresh.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Component stacks are useful during development; never send keys/headers.
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </span>
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error interrupted this screen. Your saved trips are safe —
          try again, or reload the app.
        </p>
        <p className="max-w-lg break-words rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
          {error.message}
        </p>
        <div className="flex gap-3">
          <Button onClick={this.reset}>
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload app
          </Button>
        </div>
      </div>
    )
  }
}
