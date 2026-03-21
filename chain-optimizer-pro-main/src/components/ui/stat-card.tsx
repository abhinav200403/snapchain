import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  className?: string;
  delay?: number;
  onClick?: () => void;
  clickable?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label, value, change, changeType = 'neutral', icon: Icon, className, delay = 0, onClick, clickable
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-xl border bg-card p-5 shadow-sm transition-shadow duration-200 hover:shadow-md opacity-0 animate-fade-in-up',
        clickable && 'cursor-pointer hover:border-destructive/60 hover:shadow-destructive/10',
        className
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {change && (
            <p className={cn(
              'text-xs font-medium',
              changeType === 'positive' && 'text-success',
              changeType === 'negative' && 'text-destructive',
              changeType === 'neutral' && 'text-muted-foreground'
            )}>
              {change}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-secondary p-2.5 transition-colors group-hover:bg-primary/10">
          <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>
      </div>
    </div>
  );
};
