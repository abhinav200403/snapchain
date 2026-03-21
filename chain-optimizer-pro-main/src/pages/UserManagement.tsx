import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/roles';
import type { AppRole } from '@/types/roles';
import { Plus, Search, Edit2, UserX, UserCheck } from 'lucide-react';
import { CreateUserDialog } from '@/components/modals/CreateUserDialog';
import { toast } from 'sonner';
import api from '@/lib/api';

const UserManagement = () => {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/users/${id}`, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User status updated');
    },
    onError: () => toast.error('Failed to update user'),
  });

  const filtered = users.filter((u: any) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Header title="User Management" subtitle="Create, update, and manage users" />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />Create User</Button>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/40 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filtered.map((u: any) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                          {u.name?.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <span className="font-medium text-foreground">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_COLORS[u.role as AppRole] ?? 'bg-secondary text-foreground'}`}>
                        {ROLE_LABELS[u.role as AppRole] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        u.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                      }`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          onClick={() => toggleActiveMutation.mutate({ id: u.id, isActive: !u.is_active })}
                        >
                          {u.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })} />
    </div>
  );
};

export default UserManagement;
