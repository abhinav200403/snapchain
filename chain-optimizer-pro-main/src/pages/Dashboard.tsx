import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';
import { ManagerDashboard } from '@/components/dashboards/ManagerDashboard';
import { SupplierDashboard } from '@/components/dashboards/SupplierDashboard';
import { AnalystDashboard } from '@/components/dashboards/AnalystDashboard';
import { OnboardingWizard, useOnboarding } from '@/components/OnboardingWizard';
import { ROLE_LABELS } from '@/types/roles';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const { showOnboarding, dismiss } = useOnboarding();
  const [wizardOpen, setWizardOpen] = useState(showOnboarding);

  if (!user) return null;

  const dashboards = {
    admin: AdminDashboard,
    operations_manager: ManagerDashboard,
    supplier: SupplierDashboard,
    business_analyst: AnalystDashboard,
  };

  const DashComp = dashboards[user.role];

  const handleClose = () => {
    dismiss();
    setWizardOpen(false);
  };

  return (
    <div>
      <Header title={`${ROLE_LABELS[user.role]} Dashboard`} subtitle={`Welcome back, ${user.name.split(' ')[0]}`} />
      <div className="p-6">
        {/* Tour button */}
        <div className="mb-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)} className="text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5 mr-1" />Take a Tour
          </Button>
        </div>
        <DashComp />
      </div>

      {wizardOpen && <OnboardingWizard onClose={handleClose} />}
    </div>
  );
};

export default Dashboard;
