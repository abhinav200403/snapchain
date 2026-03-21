import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle2, Zap, Building2, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

const PLANS = [
  {
    name: 'Starter',
    price: '$0',
    period: 'Free forever',
    description: 'Perfect for small teams getting started with supply chain management.',
    features: ['Up to 3 users', '100 orders/month', 'Basic analytics', 'Email support', '1 supplier integration'],
    cta: 'Current Plan',
    current: true,
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: 'per month',
    description: 'For growing businesses that need advanced AI features and more capacity.',
    features: ['Up to 20 users', 'Unlimited orders', 'AI demand forecasting', 'Priority support', '10 supplier integrations', 'Custom reports', 'Audit logs'],
    cta: 'Upgrade to Pro',
    current: false,
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact sales',
    description: 'For large organizations with complex supply chain needs.',
    features: ['Unlimited users', 'Unlimited everything', 'Dedicated AI models', 'SLA guarantee', 'Unlimited integrations', 'Custom onboarding', 'Dedicated account manager'],
    cta: 'Contact Sales',
    current: false,
    highlight: false,
  },
];

const BillingPage = () => {
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const handleUpgrade = (plan: string) => {
    setUpgrading(plan);
    setTimeout(() => {
      setUpgrading(null);
      toast.success(`Request received! Our team will reach out about the ${plan} plan.`);
    }, 1500);
  };

  return (
    <div>
      <Header title="Billing" subtitle="Manage your subscription and plan" />
      <div className="p-6 space-y-8">

        {/* Current usage */}
        <div className="rounded-xl border bg-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '60ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Current Plan</h3>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-foreground">Starter</span>
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">Active</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Free forever — no credit card required</p>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center">
              {[{ label: 'Users', used: 4, max: 3 }, { label: 'Orders', used: 6, max: 100 }, { label: 'Suppliers', used: 4, max: 1 }].map(u => (
                <div key={u.label}>
                  <p className="text-lg font-bold text-foreground tabular-nums">{u.used}<span className="text-sm text-muted-foreground">/{u.max === 1 ? '1' : u.max}</span></p>
                  <p className="text-[11px] text-muted-foreground">{u.label}</p>
                  <div className="mt-1 h-1 rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min((u.used / u.max) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Plans */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4">Available Plans</h3>
          <div className="grid gap-4 lg:grid-cols-3">
            {PLANS.map((plan, i) => (
              <div
                key={plan.name}
                className={cn(
                  'relative rounded-xl border p-6 opacity-0 animate-fade-in-up transition-shadow hover:shadow-md',
                  plan.highlight && 'border-primary ring-1 ring-primary'
                )}
                style={{ animationDelay: `${120 + i * 80}ms`, animationFillMode: 'forwards' }}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    {plan.name === 'Starter' && <Zap className="h-4 w-4 text-muted-foreground" />}
                    {plan.name === 'Pro' && <Zap className="h-4 w-4 text-primary" />}
                    {plan.name === 'Enterprise' && <Building2 className="h-4 w-4 text-muted-foreground" />}
                    <h4 className="text-sm font-semibold text-foreground">{plan.name}</h4>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{plan.description}</p>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.current ? 'outline' : plan.highlight ? 'default' : 'outline'}
                  disabled={plan.current || upgrading === plan.name}
                  onClick={() => !plan.current && handleUpgrade(plan.name)}
                >
                  {upgrading === plan.name ? 'Processing...' : plan.cta}
                  {!plan.current && <ArrowUpRight className="ml-1 h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice history */}
        <div className="rounded-xl border bg-card overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}>
          <div className="px-5 py-3 border-b bg-secondary/40">
            <h3 className="text-sm font-semibold text-foreground">Invoice History</h3>
          </div>
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No invoices yet — you're on the free plan.
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
