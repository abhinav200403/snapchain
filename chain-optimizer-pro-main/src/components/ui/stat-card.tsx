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
  const isClickable = !!(onClick || clickable);
  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable && onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={cn(
        'group rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md opacity-0 animate-fade-in-up',
        isClickable && 'cursor-pointer hover:border-primary/40 hover:ring-1 hover:ring-primary/20 active:scale-[0.98]',
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
        <div className={cn(
          'rounded-lg bg-secondary p-2.5 transition-colors',
          isClickable && 'group-hover:bg-primary/10'
        )}>
          <Icon className={cn(
            'h-5 w-5 text-muted-foreground transition-colors',
            isClickable && 'group-hover:text-primary'
          )} />
        </div>
      </div>
    </div>
  );
};
