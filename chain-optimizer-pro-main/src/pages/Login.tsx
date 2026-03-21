import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { Brain, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import type { AppRole } from '@/types/roles';
import { ROLE_LABELS } from '@/types/roles';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { login, switchRole } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      toast.error('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: AppRole) => {
    setDemoLoading(role);
    try {
      await switchRole(role);
      navigate('/dashboard');
    } catch {
      toast.error('Demo login failed');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-foreground p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-background">NeuroChain AI</span>
        </div>
        <div className="space-y-6">
          <h2 className="text-4xl font-bold leading-tight text-background" style={{ lineHeight: '1.15' }}>
            Supply chain intelligence,<br />delivered.
          </h2>
          <p className="max-w-md text-base text-background/60">
            Optimize procurement, predict demand, and coordinate suppliers — all from one AI-powered platform.
          </p>
          <div className="flex gap-8 pt-4">
            {[
              { n: '2.4M+', l: 'Orders processed' },
              { n: '340+', l: 'Active suppliers' },
              { n: '18%', l: 'Cost reduction avg' },
            ].map(s => (
              <div key={s.l}>
                <p className="text-2xl font-bold text-primary">{s.n}</p>
                <p className="text-sm text-background/50">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-background/30">© 2026 NeuroChain AI. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground">NeuroChain AI</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your account to continue.{' '}
              <Link to="/register" className="text-primary hover:underline">Create account</Link>
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </form>

          {!email && !password && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Demo Access</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(['admin', 'operations_manager', 'supplier', 'business_analyst'] as AppRole[]).map(role => (
                  <button
                    key={role}
                    onClick={() => handleDemoLogin(role)}
                    disabled={demoLoading !== null}
                    className="group rounded-lg border px-3 py-2.5 text-left transition-all duration-150 hover:border-primary/40 hover:shadow-sm active:scale-[0.98] disabled:opacity-60"
                  >
                    <div className="flex items-center gap-1.5">
                      {demoLoading === role && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                      <p className="text-sm font-medium text-foreground">{ROLE_LABELS[role]}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {demoLoading === role ? 'Signing in...' : 'Click to enter'}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
