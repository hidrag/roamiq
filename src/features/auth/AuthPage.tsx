import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Compass, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { errorMessage } from '@/lib/utils'

type AuthMode = 'login' | 'signup'

async function authenticate(mode: AuthMode, email: string, password: string) {
  const { data, error } =
    mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export function AuthPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)

  const mutation = useMutation({
    mutationFn: ({ mode, email, password }: { mode: AuthMode; email: string; password: string }) =>
      authenticate(mode, email, password),
    onSuccess: (data) => {
      if (data.session) {
        setSession(data.session)
        navigate('/', { replace: true })
      }
    },
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>, mode: AuthMode) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    if (!email || !password) return
    mutation.mutate({ mode, email, password })
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Compass className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Welcome to RoamIQ</CardTitle>
          <CardDescription>Sign in to plan, map, and share your trips.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Log in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <AuthForm mode="login" onSubmit={handleSubmit} isPending={mutation.isPending} error={mutation.error} />
            </TabsContent>
            <TabsContent value="signup">
              <AuthForm mode="signup" onSubmit={handleSubmit} isPending={mutation.isPending} error={mutation.error} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

interface AuthFormProps {
  mode: AuthMode
  onSubmit: (event: React.FormEvent<HTMLFormElement>, mode: AuthMode) => void
  isPending: boolean
  error: Error | null
}

function AuthForm({ mode, onSubmit, isPending, error }: AuthFormProps) {
  return (
    <form onSubmit={(e) => onSubmit(e, mode)} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor={`${mode}-email`}>Email</Label>
        <Input
          id={`${mode}-email`}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${mode}-password`}>Password</Label>
        <Input
          id={`${mode}-password`}
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          placeholder="••••••••"
          minLength={6}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{errorMessage(error)}</p>}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === 'login' ? 'Log in' : 'Create account'}
      </Button>
    </form>
  )
}
