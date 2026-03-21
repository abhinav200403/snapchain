import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserCircle, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { ROLE_LABELS } from '@/types/roles';
import { toast } from 'sonner';
import api from '@/lib/api';

const ProfilePage = () => {
  const { user } = useAuth();
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { toast.error('New passwords do not match'); return; }
    if (pwForm.next.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await api.patch('/auth/password', { currentPassword: pwForm.current, newPassword: pwForm.next });
      toast.success('Password updated successfully');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Header title="Profile" subtitle="Your account information" />
      <div className="p-6 max-w-2xl space-y-6">

        {/* Account info */}
        <div className="rounded-xl border bg-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '60ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-2 mb-5">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Account Information</h3>
          </div>
          <div className="flex items-center gap-4 mb-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {user ? ROLE_LABELS[user.role] : ''}
              </span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <Input defaultValue={user?.name ?? ''} readOnly className="bg-secondary/40" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input defaultValue={user?.email ?? ''} readOnly className="bg-secondary/40" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Company</label>
              <Input defaultValue={user?.companyName ?? ''} readOnly className="bg-secondary/40" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Role</label>
              <Input defaultValue={user ? ROLE_LABELS[user.role] : ''} readOnly className="bg-secondary/40" />
            </div>
          </div>
        </div>

        {/* Role permissions */}
        <div className="rounded-xl border bg-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '120ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Your Permissions</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {getPermissions(user?.role).map(p => (
              <div key={p} className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="text-foreground">{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Change password */}
        <div className="rounded-xl border bg-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '180ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Change Password</h3>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Current Password</label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="Enter current password"
                  value={pwForm.current}
                  onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                  className="pr-10"
                  required
                />
                <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">New Password</label>
              <div className="relative">
                <Input
                  type={showNext ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  value={pwForm.next}
                  onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                  className="pr-10"
                  required
                />
                <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Confirm New Password</label>
              <div className="relative">
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  className="pr-10"
                  required
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

const getPermissions = (role?: string) => {
  const base = ['View dashboard', 'Access profile', 'View notifications'];
  if (role === 'admin') return [...base, 'Manage inventory', 'Manage orders', 'Manage shipments', 'Manage suppliers', 'Manage users', 'View analytics', 'AI predictions', 'View audit log', 'System settings'];
  if (role === 'operations_manager') return [...base, 'View inventory', 'Manage orders', 'Manage shipments', 'View suppliers'];
  if (role === 'supplier') return [...base, 'View orders', 'View shipments', 'Acknowledge orders'];
  if (role === 'business_analyst') return [...base, 'View analytics', 'AI predictions', 'Export reports'];
  return base;
};

export default ProfilePage;
