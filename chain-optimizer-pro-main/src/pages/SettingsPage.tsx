import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Globe, User } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

const TIMEZONES = ['UTC', 'UTC+5:30 (IST)', 'UTC-5 (EST)', 'UTC-8 (PST)', 'UTC+8 (SGT)', 'UTC+1 (CET)'];
const CURRENCIES = ['USD ($)', 'EUR (€)', 'GBP (£)', 'INR (₹)', 'SGD (S$)', 'JPY (¥)'];

const SettingsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => api.get('/company').then(r => r.data),
  });

  const [companyName, setCompanyName] = useState('');
  const [timezone, setTimezone] = useState(() => localStorage.getItem('pref_timezone') ?? 'UTC');
  const [currency, setCurrency] = useState(() => localStorage.getItem('pref_currency') ?? 'USD ($)');

  useEffect(() => {
    if (company?.name) setCompanyName(company.name);
  }, [company]);

  const updateCompany = useMutation({
    mutationFn: (name: string) => api.patch('/company', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      toast.success('Settings saved');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to save'),
  });

  const handleSave = () => {
    localStorage.setItem('pref_timezone', timezone);
    localStorage.setItem('pref_currency', currency);
    if (companyName.trim() && companyName !== company?.name) {
      updateCompany.mutate(companyName.trim());
    } else {
      toast.success('Settings saved');
    }
  };

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
              <Input
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Enter company name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Plan</label>
              <Input defaultValue={company?.plan ?? 'free'} readOnly className="capitalize" />
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
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updateCompany.isPending}>
            {updateCompany.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
