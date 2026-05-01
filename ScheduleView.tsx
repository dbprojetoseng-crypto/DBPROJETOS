import React, { useEffect, useState, useRef } from 'react';
import { Calendar, CheckCircle2, Clock, AlertCircle, ChevronRight, Loader2, ChevronLeft, AlertTriangle, List, LayoutGrid } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from './LanguageContext';
import { db, OperationType, handleFirestoreError } from './firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from './components/AuthWrapper';
import { cn } from './lib/utils';
import Gantt from 'frappe-gantt';

import { useProject } from './ProjectContext';

export const ScheduleView: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { activeProjectId } = useProject();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'gantt'>('list');
  const ganttRef = useRef<HTMLDivElement>(null);
  const ganttInstance = useRef<any>(null);

  useEffect(() => {
    if (!activeProjectId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'projects', activeProjectId, 'tasks')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() })) as any[];
      
      // Show ALL tasks — do not filter by month
      const filteredTasks = taskList;
      
      // Sort tasks by ID numerically (handles 1, 2, 10 and also 1.1, 1.2)
      const sortedTasks = [...filteredTasks].sort((a, b) => {
        const parseId = (id: any) => {
          const s = String(id || '').trim();
          // If it's a simple number, return it as a single-element array
          if (/^\d+$/.test(s)) return [parseInt(s)];
          
          // Try to handle hierarchical IDs like 1.1.2 or 1-1-2
          const parts = s.split(/[\.\-]/).map(p => {
            const num = parseInt(p.replace(/\D/g, ''));
            return isNaN(num) ? 0 : num;
          });
          
          // If no numeric parts found, return [0]
          return parts.length > 0 ? parts : [0];
        };

        const partsA = parseId(a.id);
        const partsB = parseId(b.id);

        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
          const valA = partsA[i] || 0;
          const valB = partsB[i] || 0;
          if (valA !== valB) return valA - valB;
        }
        
        // Fallback to string comparison if numeric parts are identical
        return String(a.id).localeCompare(String(b.id));
      });

      console.log("[DEBUG] ScheduleView - Sorted IDs:", sortedTasks.map(t => t.id));

      setTasks(sortedTasks.map(t => ({
        ...t,
        progress: typeof t.progress === 'number' ? t.progress : 0,
        plannedProgress: typeof t.plannedProgress === 'number' ? t.plannedProgress : 0,
        actualWeight: typeof t.actualWeight === 'number' ? t.actualWeight : 0,
        plannedWeight: typeof t.plannedWeight === 'number' ? t.plannedWeight : 0,
      })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    return () => unsubscribe();
  }, [activeProjectId]);

  useEffect(() => {
    if (viewMode === 'gantt' && tasks.length > 0 && ganttRef.current) {
      const ganttTasks = tasks.map(t => ({
        id: t.id,
        name: t.name,
        start: t.start ? t.start.split('T')[0] : t.startDate ? t.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
        end: t.finish ? t.finish.split('T')[0] : t.endDate ? t.endDate.split('T')[0] : new Date().toISOString().split('T')[0],
        progress: t.progress || 0,
        dependencies: t.predecessors || '',
        custom_class: t.isCritical ? 'bar-critical' : t.isMilestone ? 'bar-milestone' : ''
      }));

      if (ganttInstance.current) {
        ganttInstance.current.refresh(ganttTasks);
      } else {
        ganttInstance.current = new Gantt(ganttRef.current, ganttTasks, {
          header_height: 50,
          column_width: 30,
          step: 24,
          view_modes: ['Day', 'Week', 'Month'],
          bar_height: 20,
          bar_corner_radius: 3,
          arrow_curve: 5,
          padding: 18,
          view_mode: 'Day',
          language: 'pt',
          on_click: (task: any) => console.log(task),
          on_date_change: (task: any, start: any, end: any) => console.log(task, start, end),
          on_progress_change: (task: any, progress: any) => console.log(task, progress),
          on_view_change: (mode: any) => console.log(mode),
        });
      }
    }
  }, [viewMode, tasks]);

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
        <Calendar className="w-16 h-16 text-on-surface-variant/20 mb-4" />
        <h2 className="text-2xl font-headline font-extrabold text-primary mb-2">Nenhum Projeto Ativo</h2>
        <p className="text-on-surface-variant max-w-md mx-auto">
          Selecione uma obra no menu superior ou importe um novo cronograma na aba Financeiro para visualizar as atividades.
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
          <p className="text-secondary font-bold text-sm tracking-widest uppercase mb-1">{t('masterSchedule')}</p>
          <h1 className="text-4xl font-extrabold text-primary tracking-tight font-headline">Cronograma de Atividades</h1>
        </div>

        <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-xl border border-outline-variant/10">
          <button 
            onClick={() => setViewMode('list')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              viewMode === 'list' ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"
            )}
          >
            <List className="w-4 h-4" />
            LISTA
          </button>
          <button 
            onClick={() => setViewMode('gantt')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              viewMode === 'gantt' ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            GANTT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {tasks.length === 0 ? (
          <div className="bg-surface-container-lowest p-12 rounded-3xl border-2 border-dashed border-outline-variant/20 text-center">
            <Calendar className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-primary mb-2">Nenhuma atividade encontrada</h3>
            <p className="text-sm text-on-surface-variant">Importe seu cronograma na aba Financeiro para visualizar as atividades.</p>
          </div>
        ) : viewMode === 'gantt' ? (
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_8px_24px_rgba(6,78,59,0.04)] border border-outline-variant/10 overflow-hidden">
            <div className="flex justify-end gap-2 mb-4">
              {['Day', 'Week', 'Month'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => ganttInstance.current?.change_view_mode(mode)}
                  className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-surface-container-low hover:bg-primary hover:text-white rounded transition-colors"
                >
                  {mode === 'Day' ? 'Dia' : mode === 'Week' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <div ref={ganttRef} className="min-w-[800px]" />
            </div>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_8px_24px_rgba(6,78,59,0.04)] border border-outline-variant/10 hover:border-primary/30 transition-all group">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-primary font-headline font-extrabold text-lg">
                      Atividade {task.name}:
                    </h3>
                    {task.hasCalculationError && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-error text-on-error rounded text-[10px] font-black uppercase tracking-tighter animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        ERRO DE CÁLCULO: progresso inconsistente com dados físicos
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-low p-3 rounded-xl border border-outline-variant/5">
                    <span className="text-primary">{task.month}</span>
                    <span className="text-outline-variant">|</span>
                    <span>{task.actualWeight?.toFixed(0)} / {task.plannedWeight?.toFixed(0)} {task.unidade || 'TON'}</span>
                    <span className="text-outline-variant">|</span>
                    {task.mpStatus !== undefined && task.mpStatus !== null && task.mpStatus > 0 && (
                      <>
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">MP: {Math.round(task.mpStatus)}%</span>
                        <span className="text-outline-variant">|</span>
                      </>
                    )}
                    <span className="bg-primary/5 px-2 py-0.5 rounded">REAL: {Math.round(task.progress)}%</span>
                    <span className="text-outline-variant">|</span>
                    <span className="bg-outline-variant/10 px-2 py-0.5 rounded">PLANEJADO: {Math.round(task.plannedProgress)}%</span>
                    <span className="text-outline-variant">|</span>
                    <span className={cn(
                      task.status === 'CONCLUÍDO' ? "text-secondary" : task.status === 'EM ANDAMENTO' ? "text-primary" : "text-on-surface-variant/50"
                    )}>
                      {task.status}
                    </span>
                    <span className="text-outline-variant">|</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded",
                      task.situation === 'ATRASO' ? "bg-error/10 text-error" : 
                      task.situation === 'ADIANTADO' ? "bg-secondary/10 text-secondary" : "bg-surface-container-high text-on-surface-variant"
                    )}>
                      {task.situation}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter text-on-surface-variant">
                      <span>Avanço Físico (Calculado)</span>
                      <span>{task.progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${task.progress}%` }}
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          task.status === 'CONCLUÍDO' ? "bg-secondary" : "bg-primary"
                        )}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter text-on-surface-variant">
                      <span>Planejado (Planilha)</span>
                      <span>{task.plannedProgress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${task.plannedProgress}%` }}
                        className="h-full bg-outline-variant/30 rounded-full transition-all duration-1000"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};
