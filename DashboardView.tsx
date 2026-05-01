import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Truck, Users, AlertTriangle, Plus, ChevronRight, Loader2, Calendar } from 'lucide-react';
import { SCurveChart } from './components/SCurveChart';
import { ProjectAnalyst } from './components/ProjectAnalyst';
import { ALERTS } from './constants';
import { cn } from './lib/utils';
import { motion } from 'motion/react';
import { useLanguage } from './LanguageContext';
import { db, OperationType, handleFirestoreError } from './firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from './components/AuthWrapper';

import { useProject } from './ProjectContext';

interface DashboardProps {
  setActiveTab?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeProjectId, projects } = useProject();
  const activeProject = projects?.find(p => p.id === activeProjectId);
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [financialData, setFinancialData] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all'); // 'all' ou mês específico ex: 'fev.'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProjectId) {
      setTasks([]);
      setFinancialData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Fetch tasks
    const tasksQuery = query(
      collection(db, 'projects', activeProjectId, 'tasks')
    );
    
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTasks(taskList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    // Fetch financial data for S-Curve
    const finQuery = query(
      collection(db, 'projects', activeProjectId, 'financials'),
      orderBy('month', 'asc')
    );

    const unsubscribeFin = onSnapshot(finQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFinancialData(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'financials'));

    return () => {
      unsubscribeTasks();
      unsubscribeFin();
    };
  }, [activeProjectId]);

  // Available months from financial data sorted
  const sortedMonths = [...financialData]
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(d => d.month)
    .filter(Boolean);

  const latestMonth = sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : null;
  const firstMonth = sortedMonths.length > 0 ? sortedMonths[0] : null;

  // Filter tasks by selected period (or all if 'all')
  const filteredTasks = selectedPeriod === 'all' 
    ? tasks 
    : tasks.filter(t => t.month === selectedPeriod);

  // Filter financialData by selected period (cumulative up to selected month)
  const filteredFinancialData = selectedPeriod === 'all'
    ? [...financialData].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    : [...financialData]
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .filter(d => {
          const idx = sortedMonths.indexOf(d.month);
          const selIdx = sortedMonths.indexOf(selectedPeriod);
          return idx <= selIdx; // cumulative up to selected month
        });

  const currentTasks = filteredTasks;
  const allTasks = filteredTasks;

  // KPIs recalculated for filtered period
  const totalBAC = allTasks.reduce((acc, task) => acc + (Number(task.bac) || 0), 0);
  const totalPV = allTasks.reduce((acc, task) => acc + ((Number(task.bac) || 0) * (Number(task.plannedProgress) || 0) / 100), 0);
  const totalEV = allTasks.reduce((acc, task) => acc + ((Number(task.bac) || 0) * (Number(task.progress) || 0) / 100), 0);
  const totalAC = allTasks.reduce((acc, task) => acc + (Number(task.ac) || 0), 0);
  const totalPlannedWeight = allTasks.reduce((acc, task) => acc + (Number(task.plannedWeight) || 0), 0);
  const totalActualWeight = allTasks.reduce((acc, task) => acc + (Number(task.actualWeight) || 0), 0);
  const mpTasks = allTasks.filter(t => t.mpStatus !== undefined && t.mpStatus !== null && Number(t.mpStatus) > 0);
  const avgMPStatus = mpTasks.length > 0 
    ? mpTasks.reduce((acc, task) => acc + (Number(task.mpStatus) || 0), 0) / mpTasks.length 
    : 0;
  const criticalTasks = allTasks.filter(t => t.isCritical);

  const spi = totalPV > 0 ? (totalEV / totalPV).toFixed(2) : '0.00';
  const cpi = totalAC > 0 ? (totalEV / totalAC).toFixed(2) : '0.00';
  
  // Progress calculation: Use Weight as primary source as requested, fallback to EV/BAC
  const progress = totalPlannedWeight > 0 
    ? ((totalActualWeight / totalPlannedWeight) * 100).toFixed(0) 
    : (totalBAC > 0 ? ((totalEV / totalBAC) * 100).toFixed(0) : '0');

  const completedTasks = tasks.filter(t => t.status === 'Completed').length;

  // EAC = BAC / CPI
  const eac = parseFloat(cpi) > 0 ? (totalBAC / parseFloat(cpi)) : totalBAC;
  const vac = totalBAC - eac;

  // Sort financial data by sortOrder for the chart
  const sortedFinancialData = filteredFinancialData;

  // Build cumulative S-Curve data
  // totalBAC here is from currentTasks (latest month only), so use all tasks BAC
  const allTasksBAC = tasks.reduce((acc, task) => acc + (Number(task.bac) || 0), 0);
  const bacForCurve = allTasksBAC > 0 ? allTasksBAC : 1;

  let cumPV = 0;
  let cumEV = 0;
  const sCurveData: { month: string; scheduled: number; actual: number | null; trend: number | null }[] = 
    sortedFinancialData.map((d) => {
      const pv = typeof d.pv === 'number' ? d.pv : 0;
      const ev = typeof d.ev === 'number' ? d.ev : 0;
      cumPV += pv;
      cumEV += ev;
      const scheduled = Math.min((cumPV / bacForCurve) * 100, 100);
      const actual = cumEV > 0 ? Math.min((cumEV / bacForCurve) * 100, 100) : null;
      return {
        month: d.month,
        scheduled,
        actual,
        trend: null
      };
    });

  // Add trend projection from last actual point to 100%
  if (sCurveData.length > 0) {
    let lastActualIdx = -1;
    for (let i = sCurveData.length - 1; i >= 0; i--) {
      if (sCurveData[i].actual !== null) {
        lastActualIdx = i;
        break;
      }
    }

    if (lastActualIdx !== -1) {
      const lastActual = sCurveData[lastActualIdx].actual || 0;
      const remainingMonths = sCurveData.length - 1 - lastActualIdx;
      sCurveData[lastActualIdx].trend = lastActual;

      if (remainingMonths > 0) {
        const step = (100 - lastActual) / remainingMonths;
        for (let i = 1; i <= remainingMonths; i++) {
          sCurveData[lastActualIdx + i].trend = +(lastActual + step * i).toFixed(1);
        }
      } else if (lastActual < 100) {
        // Only 1 data point — project 2 extra synthetic months
        const syntheticMonths = ['(proj. 1)', '(proj. 2)'];
        const step = (100 - lastActual) / 2;
        syntheticMonths.forEach((label, i) => {
          sCurveData.push({
            month: label,
            scheduled: Math.min(sCurveData[sCurveData.length - 1].scheduled + step, 100),
            actual: null,
            trend: +(lastActual + step * (i + 1)).toFixed(1)
          });
        });
      }
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'In Progress': return t('inProgress');
      case 'Upcoming': return t('upcoming');
      case 'Blocked': return t('blocked');
      case 'Completed': return t('completed');
      default: return status;
    }
  };

  const getAlertTitle = (id: string) => {
    if (id === '1') return t('steelDelayTitle');
    if (id === '2') return t('hvacShortageTitle');
    return '';
  };

  const getAlertDesc = (id: string) => {
    if (id === '1') return t('steelDelayDesc');
    if (id === '2') return t('hvacShortageDesc');
    return '';
  };

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
        <TrendingUp className="w-16 h-16 text-on-surface-variant/20 mb-4" />
        <h2 className="text-2xl font-headline font-extrabold text-primary mb-2">Nenhum Projeto Ativo</h2>
        <p className="text-on-surface-variant max-w-md mx-auto">
          Selecione uma obra no menu superior ou importe um novo cronograma na aba Financeiro para visualizar os indicadores de desempenho.
        </p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-on-surface-variant font-medium tracking-wide text-xs uppercase">
            {activeProject?.segment ? activeProject.segment.toUpperCase() : 'VISÃO GERAL'}
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-primary">
              {activeProject?.name || t('overview')}
            </h1>
          </div>
        </div>
        {sortedMonths.length > 0 && (
          <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/10">
            <Calendar className="w-4 h-4 text-primary ml-2" />
            <button
              onClick={() => setSelectedPeriod('all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                selectedPeriod === 'all' 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Todos
            </button>
            {sortedMonths.map(m => (
              <button
                key={m}
                onClick={() => setSelectedPeriod(m)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedPeriod === m 
                    ? 'bg-primary text-white shadow-sm' 
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* PMBOK KPIs */}
        <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border-l-4 border-primary" title="Schedule Performance Index — mede eficiência de prazo">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">{t('spi')}</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary">{spi}</span>
              {parseFloat(spi) >= 1 ? <TrendingUp className="w-4 h-4 text-secondary" /> : <TrendingDown className="w-4 h-4 text-error" />}
            </div>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border-l-4 border-secondary" title="Cost Performance Index — mede eficiência de custo">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">{t('cpi')}</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-secondary">{cpi}</span>
              {parseFloat(cpi) >= 1 ? <TrendingUp className="w-4 h-4 text-secondary" /> : <TrendingDown className="w-4 h-4 text-error" />}
            </div>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border-l-4 border-tertiary-fixed-dim" title="Estimate at Completion — projeção de custo final">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">{t('eac')}</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary">R$ {(eac / 1000).toFixed(0)}k</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border-l-4 border-primary-container" title="Variance at Completion — diferença orçamento vs projeção">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">{t('vac')}</p>
            <div className="flex items-center gap-2">
              <span className={`text-xl font-bold ${vac < 0 ? 'text-error' : 'text-secondary'}`}>
                R$ {(vac / 1000).toFixed(0)}k
              </span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border-l-4 border-secondary-container">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Peso Montado (Ton)</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary">{totalActualWeight.toFixed(1)}</span>
              <span className="text-[10px] text-on-surface-variant">/ {totalPlannedWeight.toFixed(1)}</span>
              <span className="text-[10px] font-bold text-secondary ml-auto">
                {totalPlannedWeight > 0 ? ((totalActualWeight / totalPlannedWeight) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border-l-4 border-outline">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Status MP</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary">{avgMPStatus.toFixed(1)}%</span>
              <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden ml-2">
                <div 
                  className="h-full bg-primary transition-all duration-500" 
                  style={{ width: `${Math.min(100, avgMPStatus)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Progress Circle KPI */}
        <div className="md:col-span-4 bg-surface-container-lowest p-8 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)] flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-24 h-24" />
          </div>
          <h3 className="text-on-surface-variant font-headline font-bold text-sm tracking-widest uppercase mb-6">{t('totalProgress')}</h3>
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle className="text-surface-container-low" cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" strokeWidth="12" />
              <circle 
                className="text-tertiary-fixed-dim" 
                cx="96" cy="96" fill="transparent" r="88" 
                stroke="currentColor" 
                strokeDasharray="552.92" 
                strokeDashoffset={552.92 * (1 - (parseFloat(progress) / 100))} 
                strokeWidth="12" 
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-5xl font-headline font-extrabold text-primary">{progress}%</span>
              <span className="text-[10px] font-semibold text-tertiary-fixed-dim uppercase tracking-tighter">Concluído</span>
            </div>
          </div>
          <p className="mt-4 text-[11px] font-bold text-on-surface-variant text-center">
            {totalActualWeight.toFixed(1)}t montados de {totalPlannedWeight.toFixed(1)}t previstos
          </p>
          <p className="mt-2 text-[10px] text-on-surface-variant/60 text-center uppercase tracking-widest font-black leading-tight">
            {latestMonth ? `Referência: ${latestMonth}` : 'Importe uma planilha'}
          </p>
        </div>

        {/* S-Curve Analytics */}
        <div className="md:col-span-8">
          <SCurveChart data={sCurveData} />
        </div>

        {/* Alerts */}
        <div className="md:col-span-12 lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-secondary" />
            <h3 className="text-primary font-headline font-extrabold text-xl tracking-tight">{t('criticalAlerts')}</h3>
          </div>
          
          {/* Dynamic Alerts */}
          {criticalTasks.length > 0 && (
            <div className="p-5 rounded-r-xl border-l-4 flex items-start gap-4 bg-secondary-container/10 border-secondary">
              <div className="p-2 rounded-lg bg-secondary/10">
                <AlertTriangle className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold leading-tight text-on-secondary-container">
                    Atividades no Caminho Crítico ({criticalTasks.length})
                  </h4>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-secondary text-white">
                    {t('highPriority')}
                  </span>
                </div>
                <p className="text-sm mt-1 text-on-secondary-container/80">
                  As seguintes atividades estão atrasadas e impactam o cronograma: {criticalTasks.slice(0, 2).map(t => t.name).join(', ')}
                  {criticalTasks.length > 2 && '...'}
                </p>
              </div>
            </div>
          )}

          {parseFloat(spi) < 0.95 && (
            <div className="p-5 rounded-r-xl border-l-4 flex items-start gap-4 bg-secondary-container/10 border-secondary">
              <div className="p-2 rounded-lg bg-secondary/10">
                <Truck className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold leading-tight text-on-secondary-container">
                    Atraso no Cronograma (SPI: {spi})
                  </h4>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-secondary text-white">
                    {t('highPriority')}
                  </span>
                </div>
                <p className="text-sm mt-1 text-on-secondary-container/80">
                  O índice de desempenho de prazo está abaixo do esperado. Verifique o caminho crítico.
                </p>
              </div>
            </div>
          )}

          {parseFloat(cpi) < 0.95 && (
            <div className="p-5 rounded-r-xl border-l-4 flex items-start gap-4 bg-secondary-container/10 border-secondary">
              <div className="p-2 rounded-lg bg-secondary/10">
                <TrendingDown className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold leading-tight text-on-secondary-container">
                    Estouro de Orçamento (CPI: {cpi})
                  </h4>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-secondary text-white">
                    {t('highPriority')}
                  </span>
                </div>
                <p className="text-sm mt-1 text-on-secondary-container/80">
                  O custo real está excedendo o valor agregado. Revise os gastos imediatos.
                </p>
              </div>
            </div>
          )}

          {avgMPStatus < 50 && (
            <div className="p-5 rounded-r-xl border-l-4 flex items-start gap-4 bg-surface-container-low border-primary">
              <div className="p-2 rounded-lg bg-primary/5">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold leading-tight text-primary">
                    Baixa Disponibilidade de MP
                  </h4>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-primary/10 text-primary">
                    {t('advisory')}
                  </span>
                </div>
                <p className="text-sm mt-1 text-on-surface-variant">
                  A disponibilidade de matéria-prima está em {avgMPStatus.toFixed(1)}%. Risco de interrupção.
                </p>
              </div>
            </div>
          )}

          {parseFloat(spi) >= 0.95 && parseFloat(cpi) >= 0.95 && avgMPStatus >= 50 && (
            <div className="p-5 rounded-r-xl border-l-4 flex items-start gap-4 bg-surface-container-low border-primary">
              <div className="p-2 rounded-lg bg-primary/5">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold leading-tight text-primary">Projeto Saudável</h4>
                <p className="text-sm mt-1 text-on-surface-variant">
                  Todos os indicadores principais estão dentro da meta operacional.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Active Work Plan */}
        <div className="md:col-span-12 lg:col-span-7 bg-surface-container-lowest rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)] flex flex-col">
          <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
            <h3 className="text-primary font-headline font-extrabold text-xl tracking-tight">{t('activeWorkPlan')}</h3>
            <button 
              onClick={() => setActiveTab?.('schedule')}
              className="text-secondary font-bold text-sm hover:underline flex items-center gap-1"
            >
              {t('viewGantt')} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">{t('taskDetail')}</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Iniciais</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Progresso</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {currentTasks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-on-surface-variant italic">
                      Nenhuma atividade importada.
                    </td>
                  </tr>
                ) : currentTasks.slice(0, 8).map((task) => (
                  <tr key={task.id} className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-6 py-5">
                      <div className="font-bold text-primary">{task.name}</div>
                      <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">{task.month}</div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary uppercase">
                        {(task.name || '??').slice(0, 2)}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="w-24 space-y-1">
                        <div className="flex justify-between text-[9px] font-black uppercase text-primary">
                          <span>{Math.round(task.progress || 0)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(100, task.progress || 0)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        "px-3 py-1 text-[10px] font-black uppercase rounded-full",
                        task.status === 'In Progress' && "bg-tertiary-fixed text-on-tertiary-fixed-variant",
                        task.status === 'Upcoming' && "bg-surface-container-high text-on-surface-variant",
                        task.status === 'Blocked' && "bg-secondary-container text-on-secondary-container",
                        task.status === 'Completed' && "bg-secondary text-white"
                      )}>
                        {getStatusLabel(task.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Risk Matrix Summary */}
        <div className="md:col-span-12 bg-surface-container-lowest p-6 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)]">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="w-5 h-5 text-secondary" />
            <h3 className="text-primary font-headline font-extrabold text-xl tracking-tight">{t('riskManagement')}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(() => {
              const dynamicRisks = [];
              if (parseFloat(spi) < 0.9)
                dynamicRisks.push({ label: `Atraso Crítico (SPI: ${spi})`, prob: 'ALTO', impact: 'ALTO', level: 'bg-error' });
              else if (parseFloat(spi) < 0.95)
                dynamicRisks.push({ label: `Atenção ao Prazo (SPI: ${spi})`, prob: 'MÉDIO', impact: 'ALTO', level: 'bg-secondary' });

              if (parseFloat(cpi) < 0.9)
                dynamicRisks.push({ label: `Estouro Orçamentário (CPI: ${cpi})`, prob: 'ALTO', impact: 'ALTO', level: 'bg-error' });
              else if (parseFloat(cpi) < 0.95)
                dynamicRisks.push({ label: `Custo Acima do Planejado (CPI: ${cpi})`, prob: 'MÉDIO', impact: 'ALTO', level: 'bg-secondary' });

              if (avgMPStatus < 50 && avgMPStatus > 0)
                dynamicRisks.push({ label: `Baixa Disponibilidade de MP (${avgMPStatus.toFixed(0)}%)`, prob: 'MÉDIO', impact: 'MÉDIO', level: 'bg-secondary' });

              if (criticalTasks.length > 0)
                dynamicRisks.push({ label: `${criticalTasks.length} Atividade(s) em Atraso no Caminho Crítico`, prob: 'ALTO', impact: 'ALTO', level: 'bg-error' });

              if (dynamicRisks.length === 0)
                dynamicRisks.push({ label: 'Nenhum risco crítico identificado', prob: 'BAIXO', impact: 'BAIXO', level: 'bg-tertiary-fixed-dim' });

              return dynamicRisks.map((risk, i) => (
                <div key={i} className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/10">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-primary text-sm">{risk.label}</span>
                    <div className={cn("w-3 h-3 rounded-full", risk.level)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold text-on-surface-variant">
                    <div>Probabilidade: <span className="text-primary">{risk.prob}</span></div>
                    <div>Impacto: <span className="text-primary">{risk.impact}</span></div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* AI Project Analyst */}
        <div className="md:col-span-12">
          <ProjectAnalyst
            projectData={{
              projectName: activeProject?.name || 'Projeto',
              spi,
              cpi,
              eac,
              vac,
              bac: totalBAC,
              progress,
              totalActualWeight,
              totalPlannedWeight,
              avgMPStatus,
              criticalTasksCount: criticalTasks.length,
              criticalTaskNames: criticalTasks.slice(0, 5).map(t => t.name),
              tasks: currentTasks.map(t => ({
                name: t.name || '',
                month: t.month || '',
                progress: Number(t.progress) || 0,
                plannedProgress: Number(t.plannedProgress) || 0,
                situation: t.situation || 'NO PRAZO',
                status: t.status || '',
                actualWeight: Number(t.actualWeight) || 0,
                plannedWeight: Number(t.plannedWeight) || 0,
              })),
              months: [...new Set(tasks.map(t => t.month).filter(Boolean))],
              latestMonth: latestMonth || '',
            }}
          />
        </div>
      </div>
    </motion.div>
  );
};
