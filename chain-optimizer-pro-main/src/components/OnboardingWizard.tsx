import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Brain, Package, Users, ShoppingCart, BarChart3, CheckCircle2, X, ArrowRight, ArrowLeft } from 'lucide-react';
import { ROLE_LABELS } from '@/types/roles';
import { cn } from '@/lib/utils';

interface Step {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: { label: string; path: string };
}

const STEPS_BY_ROLE: Record<string, Step[]> = {
  admin: [
    { icon: Brain, title: 'Welcome to NeuroChain AI', description: 'You\'re logged in as Administrator. You have full access to all features — inventory, orders, suppliers, users, analytics, and AI predictions.' },
    { icon: Users, title: 'Set Up Your Team', description: 'Go to User Management to invite team members and assign roles. You can add operations managers, suppliers, and analysts.', action: { label: 'Go to User Management', path: '/users' } },
    { icon: Package, title: 'Add Your Inventory', description: 'Start by adding your products to the Inventory module. You can also import in bulk using a CSV file.', action: { label: 'Go to Inventory', path: '/inventory' } },
    { icon: ShoppingCart, title: 'Create Your First Order', description: 'Once suppliers and inventory are set up, create purchase orders and track them through the order lifecycle.', action: { label: 'Go to Orders', path: '/orders' } },
    { icon: BarChart3, title: 'Explore Analytics & AI', description: 'Use Analytics for KPIs and trends, and AI Predictions for demand forecasting and risk assessment.', action: { label: 'Go to Analytics', path: '/analytics' } },
  ],
  operations_manager: [
    { icon: Brain, title: 'Welcome, Operations Manager', description: 'You manage the day-to-day operations — inventory levels, orders, shipments, and supplier coordination.' },
    { icon: Package, title: 'Monitor Inventory', description: 'Keep an eye on stock levels. Use the Low Stock tab to quickly see products that need restocking.', action: { label: 'Go to Inventory', path: '/inventory' } },
    { icon: ShoppingCart, title: 'Manage Orders', description: 'Create and track purchase orders. Advance order statuses as they progress through the fulfillment process.', action: { label: 'Go to Orders', path: '/orders' } },
    { icon: Users, title: 'Coordinate Suppliers', description: 'View supplier details, ratings, and lead times. Use the Scorecard tab to compare supplier performance.', action: { label: 'Go to Suppliers', path: '/suppliers' } },
  ],
  supplier: [
    { icon: Brain, title: 'Welcome, Supplier', description: 'You can view and manage orders assigned to you, track shipments, and acknowledge incoming orders.' },
    { icon: ShoppingCart, title: 'View Your Orders', description: 'Check orders placed with you. Click "Acknowledge" on pending orders to confirm you\'ll fulfill them.', action: { label: 'Go to Orders', path: '/orders' } },
    { icon: Package, title: 'Track Shipments', description: 'Monitor the status of your shipments from preparation through delivery.', action: { label: 'Go to Shipments', path: '/shipments' } },
  ],
  business_analyst: [
    { icon: Brain, title: 'Welcome, Business Analyst', description: 'You have access to analytics dashboards, AI predictions, and report exports.' },
    { icon: BarChart3, title: 'Explore Analytics', description: 'View monthly orders, revenue trends, top products, and supplier rankings. Use date range filters for custom periods.', action: { label: 'Go to Analytics', path: '/analytics' } },
    { icon: Brain, title: 'Run AI Predictions', description: 'Use the AI Predictions module to run demand forecasts and view inventory risk assessments.', action: { label: 'Go to Predictions', path: '/predictions' } },
  ],
};

const STORAGE_KEY = 'onboarding_completed';

export const useOnboarding = () => {
  const completed = localStorage.getItem(STORAGE_KEY) === 'true';
  const dismiss = () => localStorage.setItem(STORAGE_KEY, 'true');
  return { showOnboarding: !completed, dismiss };
};

interface Props {
  onClose: () => void;
}

export const OnboardingWizard: React.FC<Props> = ({ onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const steps = STEPS_BY_ROLE[user?.role ?? 'admin'] ?? STEPS_BY_ROLE.admin;
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const Icon = current.icon;

  const handleAction = () => {
    if (current.action) {
      navigate(current.action.path);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-8 shadow-2xl mx-4 animate-scale-in">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-6">
          {steps.map((_, i) => (
            <div key={i} className={cn('h-1.5 rounded-full transition-all duration-300', i === step ? 'bg-primary w-6' : i < step ? 'bg-primary/40 w-1.5' : 'bg-border w-1.5')} />
          ))}
        </div>

        {/* Icon */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-5">
          <Icon className="h-7 w-7 text-primary" />
        </div>

        {/* Role badge (step 0 only) */}
        {step === 0 && user && (
          <span className="inline-flex mb-3 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {ROLE_LABELS[user.role]}
          </span>
        )}

        <h2 className="text-xl font-bold text-foreground mb-2">{current.title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">{current.description}</p>

        {/* Completed steps */}
        {step > 0 && (
          <div className="mb-5 space-y-1">
            {steps.slice(0, step).map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                <span>{s.title}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />Back
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
              Skip tour
            </Button>
          </div>
          <div className="flex gap-2">
            {current.action && !isLast && (
              <Button variant="outline" size="sm" onClick={handleAction}>
                {current.action.label}
              </Button>
            )}
            <Button size="sm" onClick={() => isLast ? onClose() : setStep(s => s + 1)}>
              {isLast ? (
                <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Get Started</>
              ) : (
                <>Next<ArrowRight className="h-3.5 w-3.5 ml-1" /></>
              )}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Step {step + 1} of {steps.length}
        </p>
      </div>
    </div>
  );
};
