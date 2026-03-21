import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const Register = () => {
  const [form, setForm] = useState({ companyName: '', companyEmail: '', name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await register(form.companyName, form.companyEmail, form.name, form.email, form.password);
      toast.success('Account created! Welcome to SynapChain.');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Registration failed');
    } finally {
      setLoading(false);
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
          <span className="text-lg font-bold text-background">SynapChain AI</span>
        </div>
        <div className="space-y-6">
          <h2 className="text-4xl font-bold leading-tight text-background" style={{ lineHeight: '1.15' }}>
            Get started in<br />minutes.
          </h2>
          <p className="max-w-md text-base text-background/60">
            Set up your company, invite your team, and start optimizing your supply chain with AI — no setup fees.
          </p>
          <div className="flex gap-8 pt-4">
            {[
              { n: 'Free', l: 'To get started' },
              { n: '5 min', l: 'Setup time' },
              { n: '24/7', l: 'AI-powered insights' },
            ].map(s => (
              <div key={s.l}>
                <p className="text-2xl font-bold text-primary">{s.n}</p>
                <p className="text-sm text-background/50">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-background/30">© 2026 SynapChain AI. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground">SynapChain AI</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline">Sign in</Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Company</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Company Name</label>
              <Input placeholder="Acme Corp" required value={form.companyName} onChange={e => set('companyName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Company Email</label>
              <Input type="email" placeholder="company@acme.com" required value={form.companyEmail} onChange={e => set('companyEmail', e.target.value)} />
            </div>

            <div className="relative pt-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Your account</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <Input placeholder="John Smith" required value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Work Email</label>
              <Input type="email" placeholder="you@acme.com" required value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters" required value={form.password} onChange={e => set('password', e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Confirm Password</label>
              <div className="relative">
                <Input type={showConfirm ? 'text' : 'password'} placeholder="••••••••" required value={form.confirm} onChange={e => set('confirm', e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button className="w-full mt-2" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
