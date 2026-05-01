import React, { useEffect, useState } from 'react';
import { Users, Truck, Zap, AlertCircle, ChevronRight, Loader2, Boxes, HardHat } from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  LabelList
} from 'recharts';
import { motion } from 'motion/react';
import { useLanguage } from './LanguageContext';
import { db, OperationType, handleFirestoreError } from './firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from './components/AuthWrapper';
import { cn } from './lib/utils';

import { useProject } from './ProjectContext';

export const ResourcesView: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeProjectId } = useProject();
  
  const [resourceData, setResourceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    if (!activeProjectId) {
      setResourceData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'projects', activeProjectId, 'resources'),
      orderBy('sortOrder', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log("[DEBUG] ResourcesView - activeProjectId:", activeProjectId);
      console.log("[DEBUG] ResourcesView - Docs returned:", snapshot.size);
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fallback: If no resources found in 'resources' collection, try to sum from 'tasks'
      if (data.length === 0) {
        console.log("[DEBUG] ResourcesView - Fallback: Checking tasks collection...");
        const { getDocs, collection: fsColl } = await import('firebase/firestore');
        const tasksSnap = await getDocs(fsColl(db, 'projects', activeProjectId, 'tasks'));
        
        const taskResources: { [key: string]: { engineers: number, laborers: number, operators: number, month: string, sortOrder: number, montadores: number, ajudantes: number, soldadores: number } } = {};
        
        tasksSnap.docs.forEach(doc => {
          const t = doc.data();
          const m = t.month || 'Geral';
          if (!taskResources[m]) {
            taskResources[m] = { engineers: 0, laborers: 0, operators: 0, month: m, sortOrder: t.updatedAt?.seconds || Date.now(), montadores: 0, ajudantes: 0, soldadores: 0 };
          }
          taskResources[m].engineers += Number(t.engineers || t.eng) || 0;
          taskResources[m].laborers += Number(t.laborers || t.workers || t.lab) || 0;
          taskResources[m].operators += Number(t.operators || t.opt) || 0;
          taskResources[m].montadores += Number(t.montadores) || 0;
          taskResources[m].ajudantes += Number(t.ajudantes) || 0;
          taskResources[m].soldadores += Number(t.soldadores) || 0;
        });
        
        data = Object.values(taskResources).map(r => ({ id: r.month, ...r })).sort((a, b) => a.sortOrder - b.sortOrder);
        console.log("[DEBUG] ResourcesView - Fallback data found:", data.length);
      }

      if (data.length > 0) {
        console.log("[DEBUG] ResourcesView - First doc data:", data[0]);
      } else {
        console.log("[DEBUG] ResourcesView - No documents found for this project.");
      }
      setResourceData(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'resources'));

    return () => unsubscribe();
  }, [activeProjectId]);

  const availableMonths = resourceData.map(r => r.month).filter(Boolean);
  
  const selectedResource = (selectedMonth 
    ? resourceData.find(r => r.month === selectedMonth) 
    : resourceData[resourceData.length - 1]) || { engineers: 0, laborers: 0, operators: 0, montadores: 0, ajudantes: 0, soldadores: 0 };

  // Fallback: se os campos detalhados não vieram do Firestore, usa laborers no total
  const montadoresVal = selectedResource.montadores || 0;
  const ajudantesVal = selectedResource.ajudantes || 0;
  const soldadoresVal = selectedResource.soldadores || 0;
  const temBreakdown = montadoresVal + ajudantesVal + soldadoresVal > 0;

  const chartData = selectedMonth 
    ? resourceData.filter(r => r.month === selectedMonth) 
    : resourceData;

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!activeProjectId) {
    return (
      <div className="h-96 flex flex-col items-center justify-center bg-surface-container-lowest rounded-3xl border-2 border-dashed border-outline-variant/20 text-center p-12">
        <Boxes className="w-16 h-16 text-on-surface-variant/20 mb-4" />
        <h2 className="text-2xl font-headline font-extrabold text-primary mb-2">Nenhum Projeto Ativo</h2>
        <p className="text-on-surface-variant max-w-md mx-auto">
          Selecione uma obra no menu superior ou importe um novo cronograma na aba Financeiro para visualizar a gestão de recursos.
        </p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-24"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-secondary font-bold text-sm tracking-widest uppercase mb-1">{t('utilizationMetrics')}</p>
          <h1 className="text-4xl font-extrabold text-primary tracking-tight font-headline">Gestão de Recursos</h1>
        </div>
      </div>

      {/* Improvement 4: Month Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Filtrar por mês:</span>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedMonth('')}
            className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${!selectedMonth ? 'bg-primary text-white border-primary' : 'bg-transparent text-on-surface-variant border-outline-variant/30 hover:border-primary'}`}
          >
            Todos
          </button>
          {availableMonths.map(m => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${selectedMonth === m ? 'bg-primary text-white border-primary' : 'bg-transparent text-on-surface-variant border-outline-variant/30 hover:border-primary'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)] border-l-4 border-primary">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg"><Users className="w-5 h-5 text-primary" /></div>
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{t('engineers')}</p>
          </div>
          <span className="text-3xl font-black text-primary">{selectedResource.engineers}</span>
          <p className="text-[10px] text-on-surface-variant mt-1 font-bold">Alocados em {selectedResource.month || 'Geral'}</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)] border-l-4 border-secondary">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-secondary/10 rounded-lg"><HardHat className="w-5 h-5 text-secondary" /></div>
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{t('laborers')}</p>
          </div>
          <span className="text-3xl font-black text-primary">{selectedResource.laborers}</span>
          <p className="text-[9px] text-on-surface-variant mt-2 font-semibold leading-relaxed">
            {temBreakdown 
              ? `Montadores: ${montadoresVal} | Ajudantes: ${ajudantesVal} | Soldadores: ${soldadoresVal}`
              : `Total: ${selectedResource.laborers} (reimporte a planilha para ver o detalhamento)`
            }
          </p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)] border-l-4 border-tertiary-fixed-dim">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-lg"><Truck className="w-5 h-5" /></div>
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">EQUIPAMENTOS</p>
          </div>
          <span className="text-3xl font-black text-primary">{selectedResource.operators}</span>
          <p className="text-[10px] text-on-surface-variant mt-1 font-bold">Alocados em {selectedResource.month || 'Geral'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-surface-container-lowest p-8 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)]">
          <h3 className="text-primary font-headline font-extrabold text-xl mb-8">{t('resourceHistogram')}</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#4b5563' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#4b5563' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#064e3b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 600, paddingBottom: '20px' }} />
                <Bar dataKey="engineers" fill="#064e3b" radius={[4,4,0,0]} name="Engenheiro">
                  <LabelList dataKey="engineers" position="top" style={{ fontSize: '10px', fontWeight: 700, fill: '#064e3b' }} formatter={(v: number) => v > 0 ? `Eng: ${v}` : ''} />
                </Bar>
                <Bar dataKey="montadores" fill="#10b981" radius={[4,4,0,0]} name="Montador">
                  <LabelList dataKey="montadores" position="top" style={{ fontSize: '10px', fontWeight: 700, fill: '#059669' }} formatter={(v: number) => v > 0 ? `Mont: ${v}` : ''} />
                </Bar>
                <Bar dataKey="ajudantes" fill="#34d399" radius={[4,4,0,0]} name="Ajudante">
                  <LabelList dataKey="ajudantes" position="top" style={{ fontSize: '10px', fontWeight: 700, fill: '#047857' }} formatter={(v: number) => v > 0 ? `Ajud: ${v}` : ''} />
                </Bar>
                <Bar dataKey="soldadores" fill="#6ee7b7" radius={[4,4,0,0]} name="Soldador">
                  <LabelList dataKey="soldadores" position="top" style={{ fontSize: '10px', fontWeight: 700, fill: '#065f46' }} formatter={(v: number) => v > 0 ? `Sold: ${v}` : ''} />
                </Bar>
                <Bar dataKey="operators" fill="#d1d5db" radius={[4,4,0,0]} name="Equipamento">
                  <LabelList dataKey="operators" position="top" style={{ fontSize: '10px', fontWeight: 700, fill: '#6b7280' }} formatter={(v: number) => v > 0 ? `Equip: ${v}` : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">

          <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10">
            <h3 className="font-bold text-primary mb-4 font-headline">{t('resourceHealth')}</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-on-surface-variant">{t('equipmentUptime')}</span>
                <span className="text-sm font-bold text-secondary">98.2%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-on-surface-variant">{t('safetyCompliance')}</span>
                <span className="text-sm font-bold text-secondary">100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
