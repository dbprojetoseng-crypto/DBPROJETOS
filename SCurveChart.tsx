import React from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  Area,
  ReferenceLine
} from 'recharts';

interface SCurveChartProps {
  data: any[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ backgroundColor: '#064e3b', borderRadius: 8, padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#fff' }}>
      <p style={{ marginBottom: 4, opacity: 0.7 }}>{label}</p>
      {payload.map((p: any) => (
        p.value !== null && p.value !== undefined && (
          <p key={p.name} style={{ color: p.color || '#fff' }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}%
          </p>
        )
      ))}
    </div>
  );
};

export const SCurveChart: React.FC<SCurveChartProps> = ({ data }) => {
  const hasData = data && data.length > 0;

  return (
    <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)] h-full flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-on-surface-variant font-bold text-xs tracking-widest uppercase mb-1">Desempenho Acumulado</p>
          <h3 className="text-primary font-headline font-extrabold text-xl tracking-tight">Curva S — Planejado vs. Real</h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 bg-gray-300 inline-block rounded" />
            Planejado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 bg-emerald-500 inline-block rounded" />
            Real
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-0.5 inline-block rounded" style={{ background: 'repeating-linear-gradient(90deg,#10b981 0,#10b981 4px,transparent 4px,transparent 8px)' }} />
            Tendência
          </span>
        </div>
      </div>

      {!hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-on-surface-variant/30 text-5xl mb-3">📈</div>
          <p className="text-sm font-bold text-on-surface-variant">Sem dados para exibir</p>
          <p className="text-xs text-on-surface-variant/60 mt-1">Importe uma planilha na aba Financeiro</p>
        </div>
      ) : (
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%" minHeight={220}>
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradScheduled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d1d5db" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#d1d5db" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#4b5563' }}
              />
              <YAxis 
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fontWeight: 700, fill: '#9ca3af' }}
                tickFormatter={(v) => `${v}%`}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={100} stroke="#e2e8f0" strokeDasharray="4 4" />
              <Area 
                type="monotone" 
                dataKey="scheduled" 
                stroke="#9ca3af" 
                fill="url(#gradScheduled)"
                strokeWidth={2}
                name="Planejado"
                dot={false}
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#10b981"
                fill="url(#gradActual)"
                strokeWidth={3}
                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
                name="Real"
                connectNulls
              />
              <Line 
                type="monotone" 
                dataKey="trend" 
                stroke="#10b981" 
                strokeWidth={2} 
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 4 }}
                name="Tendência"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
