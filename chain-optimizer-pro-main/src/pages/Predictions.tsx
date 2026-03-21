import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Brain, Play, Clock, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportCSV } from '@/lib/export';
import {
  RadialBarChart, RadialBar, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import api from '@/lib/api';

const riskColor = (level: string) => {
  if (level === 'high') return 'bg-destructive/10 text-destructive';
  if (level === 'medium') return 'bg-warning/10 text-warning';
  return 'bg-success/10 text-success';
};

const riskBg = (level: string) => {
  if (level === 'high') return 'hsl(0, 72%, 51%)';
  if (level === 'medium') return 'hsl(38, 92%, 50%)';
  return 'hsl(160, 84%, 28%)';
};

const Predictions = () => {
  const [demandResult, setDemandResult] = useState<any>(null);

  const { data: riskData, isLoading: riskLoading } = useQuery({
    queryKey: ['predictions-risk'],
    queryFn: () => api.get('/predictions/risk').then(r => r.data),
  });

  const runMutation = useMutation({
    mutationFn: () => api.post('/predictions/demand').then(r => r.data),
    onSuccess: (data) => {
      setDemandResult(data);
      toast.success('Demand forecast updated');
    },
    onError: () => toast.error('Prediction failed — check OpenAI key in backend .env'),
  });

  const predictions = riskData?.products ?? [];
  const highRisk = predictions.filter((p: any) => p.risk_level === 'high');
  const mediumRisk = predictions.filter((p: any) => p.risk_level === 'medium');
  const lowRisk = predictions.filter((p: any) => p.risk_level === 'low');

  const riskSummary = [
    { name: 'High', value: highRisk.length, fill: 'hsl(0, 72%, 51%)' },
    { name: 'Medium', value: mediumRisk.length, fill: 'hsl(38, 92%, 50%)' },
    { name: 'Low', value: lowRisk.length, fill: 'hsl(160, 84%, 28%)' },
  ];

  const handleExport = () => {
    exportCSV('risk-assessment', predictions.map((p: any) => ({
      product: p.name,
      stock_quantity: p.stock_quantity,
      risk_level: p.risk_level,
      risk_score: p.risk_score,
    })));
    toast.success('Risk assessment exported');
  };

  return (
    <div>
      <Header title="AI Predictions" subtitle="Demand forecasting and risk analysis" />
      <div className="p-6 space-y-6">

        {/* Demand forecast section */}
        <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '60ms', animationFillMode: 'forwards' }}>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Demand Prediction Engine</h3>
                <p className="text-xs text-muted-foreground">Uses historical data + OpenAI GPT-4o-mini to forecast demand</p>
              </div>
            </div>
            <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
              {runMutation.isPending ? (
                <><Clock className="h-4 w-4 mr-1 animate-spin" />Running...</>
              ) : (
                <><Play className="h-4 w-4 mr-1" />Run Prediction</>
              )}
            </Button>
          </div>

          {demandResult && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Forecast Result</h4>
              {/* Try to render as chart if it has product forecasts */}
              {Array.isArray(demandResult?.forecasts) ? (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={demandResult.forecasts} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 91%)" />
                      <XAxis dataKey="product" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="predicted_demand" name="Predicted Demand" fill="hsl(160, 84%, 28%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="rounded-lg bg-secondary/50 p-4">
                  <pre className="text-xs text-foreground whitespace-pre-wrap overflow-auto max-h-48">
                    {typeof demandResult === 'string' ? demandResult : JSON.stringify(demandResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Risk summary cards */}
        {!riskLoading && predictions.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'High Risk', count: highRisk.length, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', desc: 'Immediate action needed' },
              { label: 'Medium Risk', count: mediumRisk.length, icon: TrendingDown, color: 'text-warning', bg: 'bg-warning/10', desc: 'Monitor closely' },
              { label: 'Low Risk', count: lowRisk.length, icon: ShieldCheck, color: 'text-success', bg: 'bg-success/10', desc: 'Stock levels healthy' },
            ].map((item, i) => (
              <div key={item.label} className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: `${120 + i * 60}ms`, animationFillMode: 'forwards' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`rounded-lg p-2 ${item.bg}`}>
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <span className={`text-3xl font-bold ${item.color}`}>{item.count}</span>
                </div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* Risk table + radial chart */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Radial chart */}
          {!riskLoading && predictions.length > 0 && (
            <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '360ms', animationFillMode: 'forwards' }}>
              <h3 className="text-sm font-semibold text-foreground mb-4">Risk Distribution</h3>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" data={riskSummary} startAngle={90} endAngle={-270}>
                    <RadialBar dataKey="value" cornerRadius={4} label={{ position: 'insideStart', fill: '#fff', fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Risk assessment table */}
          <div className={`rounded-xl border bg-card overflow-hidden opacity-0 animate-fade-in-up ${predictions.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`} style={{ animationDelay: '420ms', animationFillMode: 'forwards' }}>
            <div className="px-5 py-3 border-b bg-secondary/40 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Inventory Risk Assessment</h3>
              {predictions.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5 mr-1" />Export
                </Button>
              )}
            </div>
            {riskLoading ? (
              <div className="px-5 py-8 text-center text-muted-foreground">Loading...</div>
            ) : predictions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Product</th>
                      <th className="px-5 py-3 font-medium">Stock</th>
                      <th className="px-5 py-3 font-medium">Risk Level</th>
                      <th className="px-5 py-3 font-medium">Risk Score</th>
                      <th className="px-5 py-3 font-medium">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...predictions].sort((a: any, b: any) => b.risk_score - a.risk_score).map((p: any) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-3 font-medium text-foreground">{p.name}</td>
                        <td className="px-5 py-3 tabular-nums text-foreground">{p.stock_quantity} units</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${riskColor(p.risk_level)}`}>
                            {p.risk_level}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-secondary">
                              <div className="h-full rounded-full transition-all" style={{ width: `${p.risk_score}%`, backgroundColor: riskBg(p.risk_level) }} />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground">{p.risk_score}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {p.low_stock
                            ? <TrendingDown className="h-4 w-4 text-destructive" />
                            : <TrendingUp className="h-4 w-4 text-success" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">No products found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Predictions;
