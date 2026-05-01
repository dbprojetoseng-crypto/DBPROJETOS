import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Save, Loader2, AlertCircle, Trash2, PenLine } from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  onSnapshot, query, serverTimestamp 
} from 'firebase/firestore';
import { cn } from '../lib/utils';

interface ManualEntryModalProps {
  projectId: string;
  clientId: string;
  ownerId: string;
  onClose: () => void;
}

interface TaskForm {
  id?: string; // firestore doc id for edit
  name: string;
  month: string;
  bac: string;
  ac: string;
  plannedProgress: string;
  progress: string;
  plannedWeight: string;
  actualWeight: string;
  unidade: string;
  mpStatus: string;
  isCritical: boolean;
}

const EMPTY_FORM: TaskForm = {
  name: '',
  month: '',
  bac: '',
  ac: '',
  plannedProgress: '',
  progress: '',
  plannedWeight: '',
  actualWeight: '',
  unidade: 'TON',
  mpStatus: '',
  isCritical: false,
};

const MONTHS = [
  'jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.',
  'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'
];

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  projectId, clientId, ownerId, onClose
}) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tab, setTab] = useState<'list' | 'form'>('list');

  // Load existing tasks
  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, 'projects', projectId, 'tasks'));
    const unsub = onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [projectId]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
  };

  const handleEdit = (task: any) => {
    setForm({
      id: task.firestoreId,
      name: task.name || '',
      month: task.month || '',
      bac: String(task.bac || ''),
      ac: String(task.ac || ''),
      plannedProgress: String(task.plannedProgress || ''),
      progress: String(task.progress || ''),
      plannedWeight: String(task.plannedWeight || ''),
      actualWeight: String(task.actualWeight || ''),
      unidade: task.unidade || 'TON',
      mpStatus: String(task.mpStatus || ''),
      isCritical: task.isCritical || false,
    });
    setEditingId(task.firestoreId);
    setTab('form');
  };

  const handleDelete = async (firestoreId: string) => {
    if (!confirm('Excluir esta atividade permanentemente?')) return;
    setDeleting(firestoreId);
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'tasks', firestoreId));
    } catch(e: any) {
      setError('Erro ao excluir: ' + e.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Nome da atividade é obrigatório.'); return; }
    if (!form.month) { setError('Selecione o mês de referência.'); return; }

    setSaving(true);
    setError(null);

    const bac = parseFloat(form.bac) || 0;
    const ac = parseFloat(form.ac) || 0;
    const plannedProgress = parseFloat(form.plannedProgress) || 0;
    const progress = parseFloat(form.progress) || 0;
    const plannedWeight = parseFloat(form.plannedWeight) || 0;
    const actualWeight = parseFloat(form.actualWeight) || 0;
    const mpStatus = parseFloat(form.mpStatus) || 0;

    const situation = progress > plannedProgress ? 'ADIANTADO'
      : progress < plannedProgress && plannedProgress > 0 ? 'ATRASO'
      : 'NO PRAZO';

    const taskData = {
      name: form.name.trim(),
      month: form.month,
      bac,
      ac,
      plannedProgress,
      progress,
      plannedWeight,
      actualWeight,
      unidade: form.unidade,
      mpStatus,
      isCritical: form.isCritical,
      situation,
      status: progress >= 100 ? 'CONCLUÍDO' : progress > 0 ? 'EM ANDAMENTO' : 'NÃO INICIADO',
      statusKanban: progress >= 100 ? 'concluido' : progress > 0 ? 'em_andamento' : 'nao_iniciado',
      clientId,
      ownerId,
      projectId,
      sourceType: 'manual',
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'projects', projectId, 'tasks', editingId), taskData);
      } else {
        await addDoc(collection(db, 'projects', projectId, 'tasks'), {
          ...taskData,
          createdAt: serverTimestamp(),
        });
      }

      // Update financials for this month
      await updateFinancials(form.month, projectId, clientId, ownerId);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      resetForm();
      setTab('list');
    } catch(e: any) {
      setError('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Recalculate and save financials for a given month
  const updateFinancials = async (month: string, projectId: string, clientId: string, ownerId: string) => {
    const { getDocs, setDoc, doc: firestoreDoc } = await import('firebase/firestore');
    const snap = await getDocs(collection(db, 'projects', projectId, 'tasks'));
    const monthTasks = snap.docs.map(d => d.data()).filter((t: any) => t.month === month);

    let pv = 0, ev = 0, ac = 0, bac = 0;
    for (const t of monthTasks as any[]) {
      const b = Number(t.bac) || 0;
      const a = Number(t.ac) || 0;
      const pp = Number(t.plannedProgress) || 0;
      const rp = Number(t.progress) || 0;
      bac += b;
      pv  += b * (pp / 100);
      ev  += b * (rp / 100);
      ac  += a;
    }

    const monthDate = new Date(`2026-${MONTHS.indexOf(month) + 1}-01`);
    await setDoc(firestoreDoc(db, 'projects', projectId, 'financials', month), {
      pv, ev, ac, bac, month,
      clientId, projectId, ownerId,
      sourceType: 'manual',
      sortOrder: monthDate.getTime(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

  const f = (field: keyof TaskForm, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const inputCls = "w-full px-4 py-3 bg-surface-container-low border border-outline-variant/20 rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-all font-bold";
  const labelCls = "text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-1.5";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        className="bg-surface-container-lowest w-full max-w-3xl rounded-3xl shadow-2xl border border-outline-variant/20 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <PenLine className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-headline font-extrabold text-primary tracking-tight">
                Entrada Manual de Atividades
              </h2>
              <p className="text-xs text-on-surface-variant font-medium">
                Adicione ou edite atividades diretamente sem importar planilha
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant/10">
          <button
            onClick={() => { setTab('list'); resetForm(); }}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all",
              tab === 'list' ? "border-b-2 border-primary text-primary" : "text-on-surface-variant hover:text-primary"
            )}
          >
            Atividades ({tasks.length})
          </button>
          <button
            onClick={() => { setTab('form'); resetForm(); }}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all",
              tab === 'form' ? "border-b-2 border-primary text-primary" : "text-on-surface-variant hover:text-primary"
            )}
          >
            {editingId ? '✏️ Editar Atividade' : '+ Nova Atividade'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* LIST TAB */}
          {tab === 'list' && (
            <div className="p-6">
              {success && (
                <div className="mb-4 p-3 bg-secondary/10 border border-secondary/20 rounded-xl text-secondary text-xs font-bold text-center">
                  ✓ Salvo com sucesso!
                </div>
              )}
              {tasks.length === 0 ? (
                <div className="text-center py-12">
                  <PenLine className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-3" />
                  <p className="text-sm font-bold text-on-surface-variant">Nenhuma atividade ainda.</p>
                  <p className="text-xs text-on-surface-variant/60 mt-1">Clique em "Nova Atividade" para começar.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...tasks].sort((a,b) => (a.month||'').localeCompare(b.month||'')).map(task => (
                    <div key={task.firestoreId}
                      className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 flex items-center justify-between gap-4 hover:border-primary/20 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-black text-primary truncate">{task.name}</span>
                          <span className={cn(
                            "text-[9px] font-black px-2 py-0.5 rounded-full uppercase shrink-0",
                            task.situation === 'ATRASO' ? "bg-error/10 text-error" :
                            task.situation === 'ADIANTADO' ? "bg-secondary/10 text-secondary" :
                            "bg-surface-container-high text-on-surface-variant"
                          )}>
                            {task.situation || 'NO PRAZO'}
                          </span>
                          {task.sourceType === 'manual' && (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase shrink-0">Manual</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-on-surface-variant font-bold">
                          <span>📅 {task.month}</span>
                          <span>Real: {Math.round(task.progress || 0)}%</span>
                          <span>Planejado: {Math.round(task.plannedProgress || 0)}%</span>
                          {task.bac > 0 && <span>BAC: R${(task.bac/1000).toFixed(1)}k</span>}
                          {task.actualWeight > 0 && <span>{task.actualWeight}t/{task.plannedWeight}t</span>}
                        </div>
                        {/* Mini progress bar */}
                        <div className="mt-2 w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", task.progress >= 100 ? "bg-secondary" : "bg-primary")}
                            style={{ width: `${Math.min(task.progress || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleEdit(task)}
                          className="p-2 rounded-xl hover:bg-primary/10 text-primary transition-colors"
                          title="Editar"
                        >
                          <PenLine className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(task.firestoreId)}
                          disabled={deleting === task.firestoreId}
                          className="p-2 rounded-xl hover:bg-error/10 text-error transition-colors disabled:opacity-40"
                          title="Excluir"
                        >
                          {deleting === task.firestoreId
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FORM TAB */}
          {tab === 'form' && (
            <div className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              {/* Nome + Mês */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className={labelCls}>Nome da Atividade *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => f('name', e.target.value)}
                    placeholder="Ex: Montagem Estrutura Eixo A"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Mês de Referência *</label>
                  <select
                    value={form.month}
                    onChange={e => f('month', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Selecione</option>
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Avanço Físico */}
              <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">Avanço Físico (%)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>% Planejado</label>
                    <input type="number" min="0" max="100" value={form.plannedProgress}
                      onChange={e => f('plannedProgress', e.target.value)}
                      placeholder="0 – 100" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>% Real (Executado)</label>
                    <input type="number" min="0" max="100" value={form.progress}
                      onChange={e => f('progress', e.target.value)}
                      placeholder="0 – 100" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Peso */}
              <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">Peso / Quantidade Física</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Peso Planejado</label>
                    <input type="number" min="0" value={form.plannedWeight}
                      onChange={e => f('plannedWeight', e.target.value)}
                      placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Peso Realizado</label>
                    <input type="number" min="0" value={form.actualWeight}
                      onChange={e => f('actualWeight', e.target.value)}
                      placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Unidade</label>
                    <select value={form.unidade} onChange={e => f('unidade', e.target.value)} className={inputCls}>
                      <option>TON</option>
                      <option>M²</option>
                      <option>M³</option>
                      <option>ML</option>
                      <option>UN</option>
                      <option>KG</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Custos */}
              <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">Dados Financeiros (opcional)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Custo Planejado / BAC (R$)</label>
                    <input type="number" min="0" value={form.bac}
                      onChange={e => f('bac', e.target.value)}
                      placeholder="0,00" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Custo Real / AC (R$)</label>
                    <input type="number" min="0" value={form.ac}
                      onChange={e => f('ac', e.target.value)}
                      placeholder="0,00" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* MP + Crítica */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Status MP — Matéria-Prima (%)</label>
                  <input type="number" min="0" max="100" value={form.mpStatus}
                    onChange={e => f('mpStatus', e.target.value)}
                    placeholder="0 – 100" className={inputCls} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => f('isCritical', !form.isCritical)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        form.isCritical ? "bg-error" : "bg-surface-container-high"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm",
                        form.isCritical ? "left-6" : "left-0.5"
                      )} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-on-surface">Atividade Crítica</p>
                      <p className="text-[9px] text-on-surface-variant">Impacta o prazo final da obra</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Preview situação */}
              {(form.progress || form.plannedProgress) && (
                <div className={cn(
                  "p-3 rounded-xl text-xs font-bold flex items-center gap-2",
                  parseFloat(form.progress) > parseFloat(form.plannedProgress) ? "bg-secondary/10 text-secondary" :
                  parseFloat(form.progress) < parseFloat(form.plannedProgress) ? "bg-error/10 text-error" :
                  "bg-surface-container-high text-on-surface-variant"
                )}>
                  {parseFloat(form.progress) > parseFloat(form.plannedProgress) ? "✓ Adiantado" :
                   parseFloat(form.progress) < parseFloat(form.plannedProgress) ? "⚠ Em atraso" :
                   "→ No prazo"}
                  {" — "}Real: {form.progress || 0}% / Planejado: {form.plannedProgress || 0}%
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === 'form' && (
          <div className="p-6 border-t border-outline-variant/10 flex gap-3">
            <button
              onClick={() => { resetForm(); setTab('list'); }}
              className="flex-1 py-3 border border-outline-variant/20 rounded-xl font-bold text-sm hover:bg-surface-container-low transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-60"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : <><Save className="w-4 h-4" /> {editingId ? 'Salvar Alterações' : 'Adicionar Atividade'}</>
              }
            </button>
          </div>
        )}

        {tab === 'list' && (
          <div className="p-6 border-t border-outline-variant/10">
            <button
              onClick={() => { resetForm(); setTab('form'); }}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" /> Nova Atividade
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
