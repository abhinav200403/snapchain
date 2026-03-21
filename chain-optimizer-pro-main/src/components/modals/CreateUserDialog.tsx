import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_LABELS } from '@/types/roles';
import type { AppRole } from '@/types/roles';
import { toast } from 'sonner';
import api from '@/lib/api';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const ASSIGNABLE_ROLES: AppRole[] = ['operations_manager', 'supplier', 'business_analyst'];

export const CreateUserDialog: React.FC<CreateUserDialogProps> = ({ open, onOpenChange, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', role: '' as AppRole | '', password: '' });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/users', {
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        role: form.role,
        password: form.password,
      });
      toast.success('User created successfully');
      onSuccess?.();
      onOpenChange(false);
      setForm({ firstName: '', lastName: '', email: '', role: '', password: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>Add a user and assign their role.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">First Name</label>
              <Input placeholder="First name" required value={form.firstName} onChange={e => set('firstName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Last Name</label>
              <Input placeholder="Last name" required value={form.lastName} onChange={e => set('lastName', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input type="email" placeholder="user@company.com" required value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Role</label>
            <Select required value={form.role} onValueChange={v => set('role', v)}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map(r => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Temporary Password</label>
            <Input type="password" placeholder="••••••••" required value={form.password} onChange={e => set('password', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create User'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
