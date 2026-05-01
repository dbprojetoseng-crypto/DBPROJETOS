import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { RESOURCE_DATA } from '../constants';

export const ResourceHistogram: React.FC = () => {
  return (
    <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)]">
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-xl font-bold text-primary font-headline">Labor Distribution (Man-Hours)</h2>
      </div>
      
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={RESOURCE_DATA} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="week" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 700, fill: '#4b5563' }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 700, fill: '#4b5563' }}
            />
            <Tooltip 
              cursor={{ fill: '#f0fdf4' }}
              contentStyle={{ 
                backgroundColor: '#064e3b', 
                border: 'none', 
                borderRadius: '8px',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 'bold'
              }}
            />
            <Legend 
              verticalAlign="top" 
              align="right" 
              iconType="circle"
              wrapperStyle={{ fontSize: '10px', fontWeight: 600, paddingBottom: '20px' }}
            />
            <Bar dataKey="engineers" stackId="a" fill="#064e3b" radius={[0, 0, 0, 0]} name="Engineers" />
            <Bar dataKey="laborers" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Laborers" />
            <Bar dataKey="operators" stackId="a" fill="#6ee7b7" radius={[4, 4, 0, 0]} name="Operators" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
