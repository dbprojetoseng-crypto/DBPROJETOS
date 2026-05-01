import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Plus, Send, CheckCircle2, RotateCcw,
  ChevronDown, ChevronUp, Printer, ClipboardCheck,
  XCircle, AlertCircle, Loader2
} from 'lucide-react';
import {
  collection, addDoc, updateDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp, getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { useProject } from './ProjectContext';
import { useAuth } from './components/AuthWrapper';
import { cn } from './lib/utils';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface BMSItem {
  taskId: string;
  taskName: string;
  month: string;
  tipoMedicao: 'peso' | 'lump_sum' | 'hora_homem';
  unidade: string;
  // Peso
  pesoMedido?: number;
  precoTon?: number;
  // Lump sum
  valorContratado?: number;
  percentualMedido?: number;
  // H/H
  horasPrevistas?: number;
  horasExecutadas?: number;
  valorHora?: number;
  // Calculated
  valorBruto: number;
}

interface BMS {
  id?: string;
  numero: string;
  revisao: number;
  mes: string;
  ano: number;
  projectId: string;
  clientId: string;
  ownerId: string;
  // Partes
  contratada: string;
  contratante: string;
  obra: string;
  contrato: string;
  // Status
  status: 'rascunho' | 'enviado' | 'em_revisao' | 'aprovado' | 'pago';
  // Itens
  itens: BMSItem[];
  // Totais
  valorBrutoTotal: number;
  // Observações
  observacoesContratada: string;
  observacoesContratante: string;
  historico?: any[];
  // Timestamps
  criadoEm?: any;
  enviadoEm?: any;
  aprovadoEm?: any;
  updatedAt?: any;
}

const STATUS_CONFIG = {
  rascunho:    { label: 'Rascunho',     cor: 'bg-surface-container-high text-on-surface-variant', icon: FileText },
  enviado:     { label: 'Enviado',      cor: 'bg-blue-50 text-blue-700',                          icon: Send },
  em_revisao:  { label: 'Em Revisão',   cor: 'bg-amber-50 text-amber-700',                        icon: RotateCcw },
  aprovado:    { label: 'Aprovado',     cor: 'bg-emerald-50 text-emerald-700',                    icon: CheckCircle2 },
  pago:        { label: 'Pago',         cor: 'bg-primary/10 text-primary',                        icon: ClipboardCheck },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const calcItemValue = (item: Partial<BMSItem>): number => {
  if (item.tipoMedicao === 'peso') {
    return (item.pesoMedido || 0) * (item.precoTon || 0);
  } else if (item.tipoMedicao === 'lump_sum') {
    return (item.valorContratado || 0) * ((item.percentualMedido || 0) / 100);
  } else if (item.tipoMedicao === 'hora_homem') {
    return (item.horasExecutadas || 0) * (item.valorHora || 0);
  }
  return 0;
};

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const nextBMSNumber = (existing: BMS[]): string => {
  const max = existing.reduce((acc, b) => {
    const n = parseInt(b.numero?.replace(/\D/g, '') || '0');
    return n > acc ? n : acc;
  }, 0);
  return String(max + 1).padStart(4, '0');
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export const BMSView: React.FC = () => {
  const { activeProjectId, selectedClientId, projects, clients } = useProject();
  const { user } = useAuth();

  const [boletins, setBoletins] = useState<BMS[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBMS, setEditingBMS] = useState<BMS | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeClient = clients.find(c => c.uid === selectedClientId);

  // Load BMS list
  useEffect(() => {
    if (!activeProjectId) return;
    const q = query(
      collection(db, 'projects', activeProjectId, 'bms'),
      orderBy('criadoEm', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setBoletins(snap.docs.map(d => ({ id: d.id, ...d.data() } as BMS)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [activeProjectId]);

  // Load tasks for auto-fill
  useEffect(() => {
    if (!activeProjectId) return;
    const unsub = onSnapshot(
      collection(db, 'projects', activeProjectId, 'tasks'),
      snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [activeProjectId]);

  const handleNewBMS = () => {
    const months = [...new Set(tasks.map((t: any) => t.month).filter(Boolean))];
    const latestMonth = months.sort().reverse()[0] || '';
    const now = new Date();

    setEditingBMS({
      numero: nextBMSNumber(boletins),
      revisao: 0,
      mes: latestMonth,
      ano: now.getFullYear(),
      projectId: activeProjectId || '',
      clientId: selectedClientId,
      ownerId: user?.uid || '',
      contratada: activeClient?.clientName || '',
      contratante: '',
      obra: activeProject?.name || '',
      contrato: '',
      status: 'rascunho',
      itens: [],
      valorBrutoTotal: 0,
      observacoesContratada: '',
      observacoesContratante: '',
    });
    setShowForm(true);
  };

  const handleStatusChange = async (bmsId: string, newStatus: BMS['status'], obs?: string) => {
    if (!activeProjectId) return;
    const updates: any = { status: newStatus, updatedAt: serverTimestamp() };
    if (newStatus === 'enviado') updates.enviadoEm = serverTimestamp();
    if (newStatus === 'aprovado') updates.aprovadoEm = serverTimestamp();
    if (obs) updates.observacoesContratante = obs;
    await updateDoc(doc(db, 'projects', activeProjectId, 'bms', bmsId), updates);
  };

  const checkCronogramaMatch = async (bms: BMS): Promise<{
    matches: boolean;
    divergencias: Array<{ atividade: string; bmsPercent: number; cronogramaPercent: number }>;
  }> => {
    if (!activeProjectId) return { matches: true, divergencias: [] };

    const tasksSnap = await getDocs(collection(db, 'projects', activeProjectId, 'tasks'));
    const cronogramaTasks = tasksSnap.docs.map(d => d.data());

    const divergencias = [];
    for (const item of bms.itens) {
      const cronTask = cronogramaTasks.find(t =>
        t.name?.toLowerCase().trim() === item.taskName?.toLowerCase().trim()
      );
      if (!cronTask) continue;

      const bmsPercent = item.tipoMedicao === 'lump_sum'
        ? item.percentualMedido || 0
        : item.tipoMedicao === 'peso'
          ? cronTask.plannedWeight > 0 ? ((item.pesoMedido || 0) / cronTask.plannedWeight) * 100 : 0
          : 0;

      const cronPercent = Number(cronTask.progress) || 0;
      const diff = Math.abs(bmsPercent - cronPercent);

      if (diff > 5) { // tolerância de 5%
        divergencias.push({
          atividade: item.taskName,
          bmsPercent: Math.round(bmsPercent),
          cronogramaPercent: Math.round(cronPercent),
        });
      }
    }

    return { matches: divergencias.length === 0, divergencias };
  };

  const handleExportPDF = (bms: BMS) => {
    const itensRows = bms.itens.map(item => {
      let detalhe = '';
      if (item.tipoMedicao === 'peso')
        detalhe = `${item.pesoMedido} ton × ${formatBRL(item.precoTon || 0)}/ton`;
      else if (item.tipoMedicao === 'lump_sum')
        detalhe = `${item.percentualMedido}% de ${formatBRL(item.valorContratado || 0)}`;
      else
        detalhe = `${item.horasExecutadas}h × ${formatBRL(item.valorHora || 0)}/h`;

      return `
        <tr>
          <td>${item.taskName}</td>
          <td>${item.month}</td>
          <td style="text-align:center">${item.tipoMedicao === 'peso' ? 'Peso' : item.tipoMedicao === 'lump_sum' ? 'Lump Sum' : 'H/H'}</td>
          <td>${detalhe}</td>
          <td style="text-align:right;font-weight:900">${formatBRL(item.valorBruto)}</td>
        </tr>
      `;
    }).join('');

    const historicoRows = (bms.historico || []).map((h: any) => `
      <tr>
        <td><strong>${h.acao}</strong></td>
        <td>${h.por || '—'}</td>
        <td>${h.em || '—'}</td>
        <td>${h.obs || '—'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="color:#9ca3af">Sem histórico registrado</td></tr>';

    const html = `
      <!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>BMS ${bms.numero} Rev.${bms.revisao}</title>
      <style>
        * { margin:0;padding:0;box-sizing:border-box }
        body { font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a }
        .header { background:#064e3b;color:white;padding:32px 40px }
        .header h1 { font-size:22px;font-weight:900;letter-spacing:-0.5px;margin-bottom:4px }
        .header p { font-size:11px;opacity:0.7 }
        .badge { display:inline-block;background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;margin-top:8px }
        .section { padding:24px 40px;border-bottom:1px solid #f0fdf4 }
        .section-title { font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#064e3b;margin-bottom:12px }
        .grid-2 { display:grid;grid-template-columns:1fr 1fr;gap:20px }
        .info-item { margin-bottom:8px }
        .info-label { font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:2px }
        .info-value { font-size:12px;font-weight:700;color:#1a1a1a }
        table { width:100%;border-collapse:collapse;font-size:10px }
        th { background:#064e3b;color:white;font-weight:900;font-size:8px;text-transform:uppercase;letter-spacing:0.8px;padding:9px 12px;text-align:left }
        td { padding:9px 12px;border-bottom:1px solid #f0fdf4 }
        tr:nth-child(even) td { background:#fafffe }
        .total-row td { background:#f0fdf4!important;font-weight:900;font-size:12px;color:#064e3b }
        .obs { background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;font-size:10px;margin-top:8px }
        .footer { padding:20px 40px;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af }
        .sign-block { margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px }
        .sign-line { border-top:1px solid #1a1a1a;padding-top:6px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;text-align:center }
        @media print { body{-webkit-print-color-adjust:exact;print-color-adjust:exact} }
      </style></head><body>

      <div class="header">
        <h1>Boletim de Medição de Serviços</h1>
        <p>${bms.obra} &nbsp;•&nbsp; ${bms.contratada} → ${bms.contratante || 'Contratante'}</p>
        <div class="badge">BMS Nº ${bms.numero} &nbsp;|&nbsp; Rev. ${bms.revisao} &nbsp;|&nbsp; ${bms.mes}/${bms.ano}</div>
      </div>

      <div class="section">
        <div class="section-title">Identificação</div>
        <div class="grid-2">
          <div>
            <div class="info-item"><div class="info-label">Contratada</div><div class="info-value">${bms.contratada}</div></div>
            <div class="info-item"><div class="info-label">Contrato Nº</div><div class="info-value">${bms.contrato || '—'}</div></div>
          </div>
          <div>
            <div class="info-item"><div class="info-label">Contratante</div><div class="info-value">${bms.contratante || '—'}</div></div>
            <div class="info-item"><div class="info-label">Período</div><div class="info-value">${bms.mes}/${bms.ano}</div></div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Serviços Medidos</div>
        <table>
          <thead><tr>
            <th>Atividade / Serviço</th>
            <th>Mês</th>
            <th>Tipo</th>
            <th>Memória de Cálculo</th>
            <th style="text-align:right">Valor (R$)</th>
          </tr></thead>
          <tbody>
            ${itensRows}
            <tr class="total-row">
              <td colspan="4"><strong>VALOR BRUTO TOTAL</strong></td>
              <td style="text-align:right">${formatBRL(bms.valorBrutoTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${bms.observacoesContratada ? `
      <div class="section">
        <div class="section-title">Observações da Contratada</div>
        <div class="obs">${bms.observacoesContratada}</div>
      </div>` : ''}

      ${bms.observacoesContratante ? `
      <div class="section">
        <div class="section-title">Observações da Contratante</div>
        <div class="obs" style="border-color:#10b981">${bms.observacoesContratante}</div>
      </div>` : ''}

      <div class="section">
        <div class="section-title">Histórico de Revisões e Aprovações</div>
        <table>
          <thead><tr>
            <th>Ação</th><th>Responsável</th><th>Data/Hora</th><th>Observações</th>
          </tr></thead>
          <tbody>${historicoRows}</tbody>
        </table>
      </div>

      <div class="section">
        <div class="sign-block">
          <div class="sign-line">${bms.contratada}<br/>Contratada</div>
          <div class="sign-line">${bms.contratante || 'Contratante'}<br/>Contratante / Fiscalização</div>
        </div>
      </div>

      <div class="footer">
        <span>DB Projetos e Engenharia — ${bms.obra}</span>
        <span>BMS Nº ${bms.numero} Rev.${bms.revisao} &nbsp;•&nbsp; Gerado em ${new Date().toLocaleDateString('pt-BR')}</span>
      </div>
      </body></html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.onload = () => { setTimeout(() => { win.print(); setTimeout(() => URL.revokeObjectURL(url), 10000); }, 400); };
  };

  if (!activeProjectId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileText className="w-12 h-12 text-on-surface-variant/20 mb-4" />
        <p className="text-sm font-bold text-on-surface-variant">Selecione uma obra para ver os boletins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-on-surface-variant font-bold text-xs tracking-widest uppercase mb-1">Medição Mensal</p>
          <h1 className="text-3xl font-headline font-extrabold tracking-tighter text-primary">
            Boletim de Medição
          </h1>
        </div>
        <button
          onClick={handleNewBMS}
          className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Novo BMS
        </button>
      </div>

      {/* Stats cards */}
      {boletins.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['rascunho','enviado','aprovado','pago'] as const).map(s => {
            const count = boletins.filter(b => b.status === s).length;
            const total = boletins.filter(b => b.status === s).reduce((a,b) => a + (b.valorBrutoTotal||0), 0);
            const cfg = STATUS_CONFIG[s];
            const Icon = cfg.icon;
            return (
              <div key={s} className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{cfg.label}</span>
                </div>
                <p className="text-2xl font-black text-primary">{count}</p>
                {total > 0 && <p className="text-[10px] text-on-surface-variant font-bold mt-1">{formatBRL(total)}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* BMS List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : boletins.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-16 text-center">
          <FileText className="w-12 h-12 text-on-surface-variant/20 mx-auto mb-4" />
          <p className="text-sm font-bold text-on-surface-variant mb-2">Nenhum boletim criado ainda.</p>
          <p className="text-xs text-on-surface-variant/60">Clique em "Novo BMS" para criar o primeiro boletim do mês.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {boletins.map(bms => {
            const cfg = STATUS_CONFIG[bms.status];
            const Icon = cfg.icon;
            const isExpanded = expandedId === bms.id;
            return (
              <div key={bms.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
                {/* Row header */}
                <div className="flex items-center justify-between p-5 gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-xl">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-primary text-sm">BMS Nº {bms.numero}</span>
                        <span className="text-[9px] font-bold text-on-surface-variant">Rev.{bms.revisao}</span>
                        <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full uppercase", cfg.cor)}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant font-bold mt-0.5">
                        {bms.mes}/{bms.ano} &nbsp;•&nbsp; {bms.itens.length} serviço(s) &nbsp;•&nbsp;
                        <span className="text-primary font-black">{formatBRL(bms.valorBrutoTotal)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Actions by status */}
                    {bms.status === 'rascunho' && (
                      <>
                        <button
                          onClick={() => { setEditingBMS(bms); setShowForm(true); }}
                          className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border border-outline-variant/20 rounded-lg hover:bg-surface-container-low transition-all"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleStatusChange(bms.id!, 'enviado')}
                          className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-primary text-white rounded-lg hover:bg-primary/90 transition-all flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> Enviar
                        </button>
                      </>
                    )}
                    {bms.status === 'enviado' && (
                      <>
                        <button
                          onClick={async () => {
                            const obs = prompt('Motivo da revisão (obrigatório):');
                            if (!obs) return;
                            const now = new Date().toLocaleString('pt-BR');
                            await updateDoc(doc(db, 'projects', activeProjectId!, 'bms', bms.id!), {
                              status: 'em_revisao',
                              observacoesContratante: obs,
                              historico: [...(bms.historico || []), {
                                acao: 'REVISÃO SOLICITADA',
                                por: user?.displayName || user?.email,
                                em: now,
                                obs,
                              }],
                              updatedAt: serverTimestamp(),
                            });
                          }}
                          className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-all"
                        >
                          Solicitar Revisão
                        </button>
                        <button
                          onClick={async () => {
                            const { matches, divergencias } = await checkCronogramaMatch(bms);

                            if (!matches) {
                              const msg = divergencias.map(d =>
                                `• ${d.atividade}: BMS=${d.bmsPercent}% vs Cronograma=${d.cronogramaPercent}%`
                              ).join('\n');

                              const confirmar = window.confirm(
                                `⚠️ DIVERGÊNCIAS ENCONTRADAS:\n\n${msg}\n\nDeseja aprovar mesmo assim?`
                              );
                              if (!confirmar) return;
                            }

                            const obs = prompt('Observações da aprovação (opcional):') || '';
                            const now = new Date().toLocaleString('pt-BR');

                            // Save approval history
                            await updateDoc(doc(db, 'projects', activeProjectId!, 'bms', bms.id!), {
                              status: 'aprovado',
                              aprovadoEm: serverTimestamp(),
                              observacoesContratante: obs,
                              historico: [...(bms.historico || []), {
                                acao: 'APROVADO',
                                por: user?.displayName || user?.email,
                                em: now,
                                obs,
                                divergencias: !matches ? divergencias : [],
                              }],
                              updatedAt: serverTimestamp(),
                            });
                          }}
                          className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Aprovar
                        </button>
                      </>
                    )}
                    {bms.status === 'em_revisao' && (
                      <button
                        onClick={() => { 
                          const revised = { ...bms, revisao: bms.revisao + 1, status: 'rascunho' as const };
                          setEditingBMS(revised);
                          setShowForm(true);
                        }}
                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Revisar
                      </button>
                    )}
                    {bms.status === 'aprovado' && (
                      <button
                        onClick={() => handleStatusChange(bms.id!, 'pago')}
                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-primary text-white rounded-lg hover:bg-primary/90 transition-all"
                      >
                        Marcar como Pago
                      </button>
                    )}
                    <button
                      onClick={() => handleExportPDF(bms)}
                      className="p-2 border border-outline-variant/20 rounded-lg hover:bg-surface-container-low transition-all"
                      title="Exportar PDF"
                    >
                      <Printer className="w-4 h-4 text-primary" />
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : bms.id!)}
                      className="p-2 border border-outline-variant/20 rounded-lg hover:bg-surface-container-low transition-all"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-outline-variant/10 overflow-hidden"
                    >
                      <div className="p-5">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-surface-container-low">
                              <th className="text-left p-2 font-black text-primary text-[9px] uppercase tracking-wider">Serviço</th>
                              <th className="text-left p-2 font-black text-primary text-[9px] uppercase tracking-wider">Tipo</th>
                              <th className="text-left p-2 font-black text-primary text-[9px] uppercase tracking-wider">Memória</th>
                              <th className="text-right p-2 font-black text-primary text-[9px] uppercase tracking-wider">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bms.itens.map((item, i) => (
                              <tr key={i} className="border-b border-outline-variant/5">
                                <td className="p-2 font-bold">{item.taskName}</td>
                                <td className="p-2 text-on-surface-variant">
                                  {item.tipoMedicao === 'peso' ? '⚖️ Peso' : item.tipoMedicao === 'lump_sum' ? '📋 Lump Sum' : '⏱️ H/H'}
                                </td>
                                <td className="p-2 text-on-surface-variant">
                                  {item.tipoMedicao === 'peso' && `${item.pesoMedido}t × ${formatBRL(item.precoTon||0)}/t`}
                                  {item.tipoMedicao === 'lump_sum' && `${item.percentualMedido}% de ${formatBRL(item.valorContratado||0)}`}
                                  {item.tipoMedicao === 'hora_homem' && `${item.horasExecutadas}h × ${formatBRL(item.valorHora||0)}/h`}
                                </td>
                                <td className="p-2 text-right font-black text-primary">{formatBRL(item.valorBruto)}</td>
                              </tr>
                            ))}
                            <tr className="bg-primary/5">
                              <td colSpan={3} className="p-2 font-black text-primary">TOTAL</td>
                              <td className="p-2 text-right font-black text-primary text-sm">{formatBRL(bms.valorBrutoTotal)}</td>
                            </tr>
                          </tbody>
                        </table>
                        {bms.observacoesContratante && (
                          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800">
                            💬 Contratante: {bms.observacoesContratante}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && editingBMS && (
          <BMSForm
            bms={editingBMS}
            tasks={tasks}
            onSave={async (data) => {
              setSaving(true);
              setError(null);
              try {
                if (data.id) {
                  await updateDoc(doc(db, 'projects', activeProjectId!, 'bms', data.id), {
                    ...data, updatedAt: serverTimestamp()
                  });
                } else {
                  await addDoc(collection(db, 'projects', activeProjectId!, 'bms'), {
                    ...data, criadoEm: serverTimestamp(), updatedAt: serverTimestamp()
                  });
                }
                setShowForm(false);
                setEditingBMS(null);
              } catch(e: any) {
                setError('Erro ao salvar: ' + e.message);
              } finally {
                setSaving(false);
              }
            }}
            onClose={() => { setShowForm(false); setEditingBMS(null); }}
            saving={saving}
            error={error}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── BMS FORM MODAL ───────────────────────────────────────────────────────────

interface BMSFormProps {
  bms: BMS;
  tasks: any[];
  onSave: (data: BMS) => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}

const TIPO_OPTIONS = [
  { value: 'peso',       label: '⚖️ Peso Montado (R$/ton)' },
  { value: 'lump_sum',   label: '📋 Serviço Fechado (Lump Sum)' },
  { value: 'hora_homem', label: '⏱️ Hora/Homem (H/H)' },
];

const BMSForm: React.FC<BMSFormProps> = ({ bms, tasks, onSave, onClose, saving, error }) => {
  const [form, setForm] = useState<BMS>(bms);

  const f = (field: keyof BMS, value: any) => setForm(p => ({ ...p, [field]: value }));

  const addItem = (task: any) => {
    const peso = Number(task.actualWeight) || 0;
    const newItem: BMSItem = {
      taskId: task.id,
      taskName: task.name,
      month: task.month || '',
      tipoMedicao: peso > 0 ? 'peso' : 'lump_sum',
      unidade: 'TON',
      pesoMedido: peso,
      precoTon: 0,
      valorContratado: Number(task.bac) || 0,
      percentualMedido: Number(task.progress) || 0,
      horasPrevistas: 0,
      horasExecutadas: 0,
      valorHora: 0,
      valorBruto: 0,
    };
    const updated = [...form.itens, newItem];
    setForm(p => ({ ...p, itens: updated, valorBrutoTotal: updated.reduce((a,i) => a + i.valorBruto, 0) }));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = form.itens.map((item, i) => {
      if (i !== idx) return item;
      const newItem = { ...item, [field]: value };
      newItem.valorBruto = calcItemValue(newItem);
      return newItem;
    });
    setForm(p => ({ ...p, itens: updated, valorBrutoTotal: updated.reduce((a,i) => a + i.valorBruto, 0) }));
  };

  const removeItem = (idx: number) => {
    const updated = form.itens.filter((_, i) => i !== idx);
    setForm(p => ({ ...p, itens: updated, valorBrutoTotal: updated.reduce((a,i) => a + i.valorBruto, 0) }));
  };

  const inputCls = "w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/20 rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-all font-bold";
  const labelCls = "text-[9px] font-black text-on-surface-variant uppercase tracking-widest block mb-1";
  const availableTasks = tasks.filter(t => !form.itens.find(i => i.taskId === t.id));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        className="bg-surface-container-lowest w-full max-w-4xl rounded-3xl shadow-2xl border border-outline-variant/20 flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-headline font-extrabold text-primary tracking-tight">
              BMS Nº {form.numero} — Rev. {form.revisao}
            </h2>
            <p className="text-xs text-on-surface-variant font-medium">Boletim de Medição de Serviços</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
            <XCircle className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* Identificação */}
          <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/10">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">Identificação</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>Mês Referência</label>
                <input value={form.mes} onChange={e => f('mes', e.target.value)} className={inputCls} placeholder="fev." />
              </div>
              <div>
                <label className={labelCls}>Ano</label>
                <input type="number" value={form.ano} onChange={e => f('ano', parseInt(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nº Contrato</label>
                <input value={form.contrato} onChange={e => f('contrato', e.target.value)} className={inputCls} placeholder="Ex: 2024/001" />
              </div>
              <div>
                <label className={labelCls}>Contratante</label>
                <input value={form.contratante} onChange={e => f('contratante', e.target.value)} className={inputCls} placeholder="Ex: Contratante S.A." />
              </div>
            </div>
          </div>

          {/* Adicionar atividades */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">Serviços a Medir</p>
              {availableTasks.length > 0 && (
                <select
                  onChange={e => {
                    const t = tasks.find(t => t.id === e.target.value);
                    if (t) addItem(t);
                    e.target.value = '';
                  }}
                  className="text-[10px] font-black text-primary bg-primary/10 border-none rounded-lg px-3 py-1.5 cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>+ Adicionar atividade</option>
                  {availableTasks.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.month})</option>
                  ))}
                </select>
              )}
            </div>

            {form.itens.length === 0 ? (
              <div className="border-2 border-dashed border-outline-variant/20 rounded-2xl p-8 text-center text-on-surface-variant text-xs font-bold">
                Selecione atividades acima para adicionar ao boletim
              </div>
            ) : (
              <div className="space-y-4">
                {form.itens.map((item, idx) => (
                  <div key={idx} className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-black text-primary text-sm">{item.taskName}</span>
                      <button onClick={() => removeItem(idx)} className="p-1 hover:bg-error/10 text-error rounded-lg transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="md:col-span-1">
                        <label className={labelCls}>Tipo de Medição</label>
                        <select value={item.tipoMedicao} onChange={e => updateItem(idx, 'tipoMedicao', e.target.value)} className={inputCls}>
                          {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>

                      {item.tipoMedicao === 'peso' && <>
                        <div>
                          <label className={labelCls}>Peso Medido (ton)</label>
                          <input type="number" min="0" step="0.01" value={item.pesoMedido || ''} onChange={e => updateItem(idx, 'pesoMedido', parseFloat(e.target.value)||0)} className={inputCls} placeholder="0.00" />
                        </div>
                        <div>
                          <label className={labelCls}>Preço / ton (R$)</label>
                          <input type="number" min="0" step="0.01" value={item.precoTon || ''} onChange={e => updateItem(idx, 'precoTon', parseFloat(e.target.value)||0)} className={inputCls} placeholder="0.00" />
                        </div>
                      </>}

                      {item.tipoMedicao === 'lump_sum' && <>
                        <div>
                          <label className={labelCls}>Valor Contratado (R$)</label>
                          <input type="number" min="0" value={item.valorContratado || ''} onChange={e => updateItem(idx, 'valorContratado', parseFloat(e.target.value)||0)} className={inputCls} placeholder="0.00" />
                        </div>
                        <div>
                          <label className={labelCls}>% Executado</label>
                          <input type="number" min="0" max="100" value={item.percentualMedido || ''} onChange={e => updateItem(idx, 'percentualMedido', parseFloat(e.target.value)||0)} className={inputCls} placeholder="0–100" />
                        </div>
                      </>}

                      {item.tipoMedicao === 'hora_homem' && <>
                        <div>
                          <label className={labelCls}>Horas Executadas</label>
                          <input type="number" min="0" value={item.horasExecutadas || ''} onChange={e => updateItem(idx, 'horasExecutadas', parseFloat(e.target.value)||0)} className={inputCls} placeholder="0" />
                        </div>
                        <div>
                          <label className={labelCls}>Valor / Hora (R$)</label>
                          <input type="number" min="0" step="0.01" value={item.valorHora || ''} onChange={e => updateItem(idx, 'valorHora', parseFloat(e.target.value)||0)} className={inputCls} placeholder="0.00" />
                        </div>
                      </>}

                      <div className="flex items-end">
                        <div className="w-full p-3 bg-primary/5 border border-primary/20 rounded-xl text-center">
                          <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">Valor</p>
                          <p className="text-sm font-black text-primary">{formatBRL(item.valorBruto)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total */}
          {form.itens.length > 0 && (
            <div className="bg-primary p-5 rounded-2xl text-white flex items-center justify-between">
              <span className="font-black uppercase tracking-widest text-sm">Valor Bruto Total</span>
              <span className="text-2xl font-black">{formatBRL(form.valorBrutoTotal)}</span>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className={labelCls}>Observações da Contratada</label>
            <textarea
              value={form.observacoesContratada}
              onChange={e => f('observacoesContratada', e.target.value)}
              rows={3}
              className={inputCls + " resize-none"}
              placeholder="Observações, pendências, condicionantes..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-outline-variant/10 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border border-outline-variant/20 rounded-xl font-bold text-sm hover:bg-surface-container-low transition-all">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || form.itens.length === 0}
            className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar Boletim'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
