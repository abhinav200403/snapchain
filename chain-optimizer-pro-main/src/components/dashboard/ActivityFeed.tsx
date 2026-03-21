import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const TYPE_COLORS: Record<string, string> = {
  order: 'bg-info',
  shipment: 'bg-primary',
  inventory: 'bg-warning',
  user: 'bg-accent',
};

export const ActivityFeed = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-feed'],
    queryFn: () => api.get('/audit', { params: { limit: 6 } }).then(r => r.data),
  });

  const activities = data?.logs ?? [];

  if (isLoading) return <div className="text-xs text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-3">
      {activities.map((a: any, i: number) => (
        <div key={a.id} className="flex gap-3">
          <div className="relative flex flex-col items-center">
            <div className={`h-2 w-2 rounded-full mt-1.5 ${TYPE_COLORS[a.resource_type] ?? 'bg-muted-foreground'}`} />
            {i < activities.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
          </div>
          <div className="pb-4">
            <p className="text-sm text-foreground">{a.action}</p>
            <p className="text-[11px] text-muted-foreground">{a.user_name} · {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      ))}
      {activities.length === 0 && <p className="text-xs text-muted-foreground">No recent activity</p>}
    </div>
  );
};
