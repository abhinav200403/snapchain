import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Globe, User } from 'lucide-react';

const SettingsPage = () => {
  const { user } = useAuth();

  return (
    <div>
      <Header title="Settings" subtitle="Company configuration" />
      <div className="p-6 max-w-2xl space-y-6">
        <div className="rounded-xl border bg-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Account Information</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input defaultValue={user?.name ?? ''} readOnly />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input defaultValue={user?.email ?? ''} readOnly />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Company Information</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Company Name</label>
              <Input defaultValue={user?.companyName ?? ''} readOnly />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Regional Settings</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Timezone</label>
              <Input defaultValue="UTC" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Currency</label>
              <Input defaultValue="USD ($)" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button>Save Changes</Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
