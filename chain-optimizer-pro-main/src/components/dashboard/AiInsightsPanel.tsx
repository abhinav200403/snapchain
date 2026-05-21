import { useQuery } from '@tanstack/react-query';
import { Brain, AlertTriangle, TrendingDown, Package, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

interface RiskItem {
  product_id?: string;
  product_name?: string;
  sku?: string;
  risk_level: 'high' | 'medium' | 'low';
  risk_type?: string;
  message: string;
  recommendation?: string;
  stock_quantity?: number;
  reorder_level?: number;
}

interface RiskAssessment {
  risks: RiskItem[];
  summary?: string;
  generated_at?: string;
}

const riskColors: Record<string, string> = {
  high:   'border-destructive/30 bg-destructive/5 text-destructive',
  medium: 'border-warning/30 bg-warning/5 text-warning',
  low:    'border-info/30 bg-info/5 text-info',
};

const riskIcon = (level: string) => {
  if (level === 'high')   return <AlertTriangle className="h-4 w-4 text-destructive" />;
  if (level === 'medium') return <TrendingDown className="h-4 w-4 text-warning" />;
  return <Package className="h-4 w-4 text-info" />;
};

export const AiInsightsPanel: React.FC = () => {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<RiskAssessment>({
    queryKey: ['ai-risk-assessment'],
    queryFn: () => api.get('/predictions/risk').then(r => r.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const risks = data?.risks ?? [];
  const highRisks   = risks.filter(r => r.risk_level === 'high');
  const mediumRisks = risks.filter(r => r.risk_level === 'medium');
  const topRisks    = [...highRisks, ...mediumRisks].slice(0, 5);

  return (
    <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Risk Insights</h3>
            {data?.generated_at && (
              <p className="text-[10px] text-muted-foreground">
                Updated {new Date(data.generated_at).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
          title="Refresh insights"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Unable to load AI insights
        </div>
      ) : topRisks.length === 0 ? (
        <div className="py-4 text-center">
          <Package className="h-8 w-8 text-success mx-auto mb-2" />
          <p className="text-sm text-success font-medium">No critical risks detected</p>
          <p className="text-xs text-muted-foreground mt-0.5">Supply chain looks healthy</p>
        </div>
      ) : (
        <div className="space-y-2">
          {topRisks.map((risk, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-3 ${riskColors[risk.risk_level] ?? 'border-muted bg-muted/10'}`}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">{riskIcon(risk.risk_level)}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{risk.message}</p>
                  {risk.product_name && (
                    <p className="text-xs mt-0.5 opacity-80">{risk.product_name}</p>
                  )}
                  {risk.recommendation && (
                    <p className="text-xs mt-1 opacity-70 italic">{risk.recommendation}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  risk.risk_level === 'high' ? 'bg-destructive/20' :
                  risk.risk_level === 'medium' ? 'bg-warning/20' : 'bg-info/20'
                }`}>
                  {risk.risk_level}
                </span>
              </div>
            </div>
          ))}
          {risks.length > 5 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              +{risks.length - 5} more risks detected
            </p>
          )}
        </div>
      )}
    </div>
  );
};
