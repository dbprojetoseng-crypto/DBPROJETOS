import React, { useEffect, useState } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { db } from './firebase';
import { collection, query, onSnapshot, doc, updateDoc, where } from 'firebase/firestore';
import { cn } from './lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Info, MoreVertical, Trello } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Task {
  id: string;
  name: string;
  progress: number;
  mpStatus?: number;
  plannedWeight: number;
  actualWeight: number;
  unidade: string;
  statusKanban: string;
  situation: string;
  month: string;
}

const COLUMNS = [
  { id: 'nao_iniciado', title: 'NÃO INICIADO', color: 'border-outline-variant' },
  { id: 'em_andamento', title: 'EM ANDAMENTO', color: 'border-primary' },
  { id: 'concluido', title: 'CONCLUÍDO', color: 'border-secondary' },
];

import { useProject } from './ProjectContext';

export function KanbanView() {
  const { activeProjectId } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!activeProjectId) {
      setTasks([]);
      return;
    }

    const q = query(
      collection(db, 'projects', activeProjectId, 'tasks')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          progress: typeof data.progress === 'number' ? data.progress : 0,
          actualWeight: typeof data.actualWeight === 'number' ? data.actualWeight : 0,
          plannedWeight: typeof data.plannedWeight === 'number' ? data.plannedWeight : 0,
          unidade: data.unidade || 'TON',
          statusKanban: data.statusKanban || 'nao_iniciado',
          situation: data.situation || 'NORMAL',
          month: data.month || 'N/A'
        };
      }) as Task[];
      setTasks(taskList);
    });
    return () => unsubscribe();
  }, [activeProjectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // If dropping over a column
    const overColumn = COLUMNS.find(c => c.id === overId);
    if (overColumn) {
      if (activeTask.statusKanban !== overColumn.id) {
        setTasks(prev => prev.map(t => 
          t.id === activeId ? { ...t, statusKanban: overColumn.id } : t
        ));
      }
      return;
    }

    // If dropping over another task
    const overTask = tasks.find(t => t.id === overId);
    if (overTask && activeTask.statusKanban !== overTask.statusKanban) {
      setTasks(prev => prev.map(t => 
        t.id === activeId ? { ...t, statusKanban: overTask.statusKanban } : t
      ));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    let newStatus = activeTask.statusKanban;

    const overColumn = COLUMNS.find(c => c.id === overId);
    if (overColumn) {
      newStatus = overColumn.id;
    } else {
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) {
        newStatus = overTask.statusKanban;
      }
    }

    if (activeTask.statusKanban !== newStatus) {
      try {
        await updateDoc(doc(db, 'projects', activeProjectId!, 'tasks', activeId), {
          statusKanban: newStatus
        });
      } catch (error) {
        console.error("Error updating task status:", error);
      }
    }
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  if (!activeProjectId) {
    return (
      <div className="h-96 flex flex-col items-center justify-center bg-surface-container-lowest rounded-3xl border-2 border-dashed border-outline-variant/20 text-center p-12">
        <Trello className="w-16 h-16 text-on-surface-variant/20 mb-4" />
        <h2 className="text-2xl font-headline font-extrabold text-primary mb-2">Nenhum Projeto Ativo</h2>
        <p className="text-on-surface-variant max-w-md mx-auto">
          Selecione uma obra no menu superior ou importe um novo cronograma na aba Financeiro para visualizar o quadro Kanban.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-headline font-extrabold text-primary tracking-tight">
          Quadro Kanban
        </h2>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-[600px]">
          {COLUMNS.map(column => (
            <KanbanColumn 
              key={column.id} 
              column={column} 
              tasks={tasks.filter(t => t.statusKanban === column.id)}
              onCardClick={setSelectedTask}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}>
          {activeTask ? (
            <div className="w-[300px]">
              <TaskCard task={activeTask} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {selectedTask && (
          <TaskDetailModal 
            task={selectedTask} 
            onClose={() => setSelectedTask(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface ColumnProps {
  key?: string;
  column: typeof COLUMNS[0];
  tasks: Task[];
  onCardClick: (task: Task) => void;
}

function KanbanColumn({ column, tasks, onCardClick }: ColumnProps) {
  const { setNodeRef } = useSortable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  });

  return (
    <div 
      ref={setNodeRef}
      className="flex flex-col gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 min-h-[500px]"
    >
      <div className={cn(
        "flex items-center justify-between pb-2 border-b-2",
        column.color
      )}>
        <h3 className="font-headline font-bold text-sm tracking-wider text-on-surface">
          {column.title}
        </h3>
        <span className="bg-surface-container-high px-2 py-0.5 rounded-full text-[10px] font-black text-on-surface-variant">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <SortableContext 
          items={tasks.map(t => t.id)} 
          strategy={verticalListSortingStrategy}
        >
          {tasks.map(task => (
            <SortableTaskCard 
              key={task.id} 
              task={task} 
              onClick={() => onCardClick(task)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

interface TaskCardProps {
  key?: string;
  task: Task;
  isOverlay?: boolean;
  onClick?: () => void;
}

function SortableTaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className="h-[120px] rounded-xl bg-surface-container-high border-2 border-dashed border-outline-variant opacity-50"
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onClick={onClick} />
    </div>
  );
}

function TaskCard({ task, isOverlay, onClick }: TaskCardProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-grab active:cursor-grabbing group",
        isOverlay && "shadow-xl border-primary ring-2 ring-primary/20 rotate-3"
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-headline font-bold text-sm text-primary leading-tight group-hover:text-primary-container transition-colors">
            {task.name}
          </h4>
          <div className={cn(
            "shrink-0 w-2 h-2 rounded-full mt-1.5",
            task.situation === 'ATRASO' ? "bg-error animate-pulse" : "bg-secondary"
          )} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter text-on-surface-variant">
            <span>Progresso Real</span>
            <div className="flex gap-2">
              {task.mpStatus !== undefined && task.mpStatus !== null && task.mpStatus > 0 && (
                <span className="text-primary font-bold">MP: {Math.round(task.mpStatus)}%</span>
              )}
              <span>{Math.round(task.progress)}%</span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-surface-container-low rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                task.progress >= 100 ? "bg-secondary" : "bg-primary"
              )}
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] font-bold text-on-surface-variant/70 uppercase">
            {task.actualWeight?.toFixed(0)} / {task.plannedWeight?.toFixed(0)} {task.unidade}
          </span>
          <div className={cn(
            "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter",
            task.situation === 'ATRASO' ? "bg-error/10 text-error" : "bg-secondary/10 text-secondary"
          )}>
            {task.situation}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskDetailModal({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl border border-outline-variant/20 overflow-hidden"
      >
        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-headline font-extrabold text-primary tracking-tight">
                Detalhes da Atividade
              </h3>
              <p className="text-sm text-on-surface-variant font-medium mt-1">
                ID: {task.id}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
            >
              <Clock className="w-6 h-6 text-on-surface-variant rotate-45" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/5">
              <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-1">
                Nome da Atividade
              </label>
              <p className="text-lg font-bold text-on-surface">
                {task.name}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/5">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-1">
                  Mês de Referência
                </label>
                <p className="text-lg font-bold text-primary">
                  {task.month}
                </p>
              </div>
              <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/5">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-1">
                  Situação
                </label>
                <div className={cn(
                  "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-tighter mt-1",
                  task.situation === 'ATRASO' ? "bg-error/10 text-error" : "bg-secondary/10 text-secondary"
                )}>
                  {task.situation === 'ATRASO' ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                  {task.situation}
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/5">
              <div className="flex justify-between items-end mb-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                  Progresso Físico
                </label>
                <span className="text-xl font-black text-primary">
                  {Math.round(task.progress)}%
                </span>
              </div>
              <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${task.progress}%` }}
                  className={cn(
                    "h-full rounded-full",
                    task.progress >= 100 ? "bg-secondary" : "bg-primary"
                  )}
                />
              </div>
              <p className="text-[11px] font-bold text-on-surface-variant mt-3 text-center uppercase tracking-wider">
                {task.actualWeight?.toFixed(0)} / {task.plannedWeight?.toFixed(0)} {task.unidade} MONTADOS
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full py-4 bg-primary text-on-primary font-headline font-bold rounded-2xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            Fechar Detalhes
          </button>
        </div>
      </motion.div>
    </div>
  );
}
