import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Plus, Copy, CheckCircle2, Send, Building2,
  ChevronRight, X, Loader2, AlertCircle, BarChart3,
  FileText, Clock, Shield
} from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { db } from './firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { cn } from './lib/utils';

const AREAS = ['mecanica', 'eletrica', 'civil', 'eletromecanica', 'geral'];
const ROLES_LABEL = { admin: 'Admin', planejador: 'Planejador', contratada: 'Contratada' };

export const AdminPanel: React.FC = () => {
  const { workspace, members, inviteMember, workspaceId } = useWorkspace();
  const [tab, setTab] = useState<'overview' | 'members' | 'invites'>('overview');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'planejador' | 'contratada'>('contratada');
  const [inviteArea, setInviteArea] = useState('');
  const [inviteEmpresa, setInviteEmpresa] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [allBMS, setAllBMS] = useState<any[]>([]);
  const [selectedContratada, setSelectedContratada] = useState<string | null>(null);

  // Load all BMS across all projects in this workspace
  useEffect(() => {
    if (!workspaceId) return;
    // Load projects of this workspace then their BMS
    const unsub = onSnapshot(
      query(collection(db, 'projects'), where('workspaceId', '==', workspaceId)),
      async snap => {
        const bmsAll: any[] = [];
        for (const proj of snap.docs) {
          const bmsSnap = await getDocs(collection(db, 'projects', proj.id, 'bms'));
          bmsSnap.docs.forEach(d => bmsAll.push({
            id: d.id, projectId: proj.id,
            projectName: proj.data().name, ...d.data()
          }));
        }
        setAllBMS(bmsAll);
      }
    );
    return () => unsub();
  }, [workspaceId]);

  const contratadas = members.filter(m => m.role === 'contratada');
  const planejadores = members.filter(m => m.role === 'planejador');

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { setError('Informe o e-mail.'); return; }
    if (inviteRole === 'planejador' && !inviteArea) { setError('Selecione a área.'); return; }
    if (inviteRole === 'contratada' && !inviteEmpresa.trim()) { setError('Informe o nome da empresa.'); return; }
    setInviting(true); setError('');
    try {
      const link = await inviteMember(
        inviteEmail, inviteRole,
        inviteRole === 'planejador' ? inviteArea : '',
        inviteRole === 'contratada' ? inviteEmpresa : ''
      );
      setInviteLink(link);
    } catch(e: any) { setError(e.message); }
    finally { setInviting(false); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetInvite = () => {
    setShowInviteForm(false);
    setInviteLink('');
    setInviteEmail('');
    setInviteEmpresa('');
    setInviteArea('');
    setError('');
  };

  const inputCls = "w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/20 rounded-xl text-sm focus:outline-none focus:border-primary/50 font-bold";

  // BMS stats by contratada
  const bmsByEmpresa = contratadas.map(c => {
    const bms = allBMS.filter(b => b.contratada === c.empresa);
    return {
      ...c,
      total: bms.length,
      pendentes: bms.filter(b => b.status === 'enviado').length,
      aprovados: bms.filter(b => b.status === 'aprovado' || b.status === 'pago').length,
      valorTotal: bms.filter(b => b.status === 'aprovado' || b.status === 'pago')
        .reduce((a, b) => a + (b.valorBrutoTotal || 0), 0),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-on-surface-variant font-bold text-xs tracking-widest uppercase mb-1">
            {workspace?.name}
          </p>
          <h1 className="text-3xl font-headline font-extrabold tracking-tighter text-primary">
            Painel Administrativo
          </h1>
        </div>
        <button onClick={() => setShowInviteForm(true)}
          className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" /> Convidar Membro
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container-low p-1 rounded-xl w-fit">
        {[
          { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
          { id: 'members', label: `Membros (${members.length})`, icon: Users },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                tab === t.id ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:text-primary"
              )}>
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Contratadas', value: contratadas.length, icon: Building2 },
              { label: 'Planejadores', value: planejadores.length, icon: Users },
              { label: 'BMS Pendentes', value: allBMS.filter(b => b.status === 'enviado').length, icon: Clock },
              { label: 'BMS Aprovados', value: allBMS.filter(b => b.status === 'aprovado' || b.status === 'pago').length, icon: CheckCircle2 },
            ].map(card => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/10 shadow-sm">
                  <Icon className="w-5 h-5 text-primary mb-2" />
                  <p className="text-2xl font-black text-primary">{card.value}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-1">{card.label}</p>
                </div>
              );
            })}
          </div>

          {/* Contratadas list with drill-down */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
            <div className="p-5 border-b border-outline-variant/10">
              <h3 className="font-headline font-extrabold text-primary">Contratadas — Visão Consolidada</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Clique para ver BMS detalhado de cada empresa</p>
            </div>
            {bmsByEmpresa.length === 0 ? (
              <div className="p-10 text-center text-sm text-on-surface-variant font-bold">
                Nenhuma contratada convidada ainda.
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {bmsByEmpresa.map(c => (
                  <div key={c.uid}>
                    <button
                      onClick={() => setSelectedContratada(selectedContratada === c.uid ? null : c.uid)}
                      className="w-full flex items-center justify-between p-5 hover:bg-surface-container-low transition-all text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center font-black text-primary text-sm">
                          {c.empresa?.slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-primary text-sm">{c.empresa}</p>
                          <p className="text-[10px] text-on-surface-variant font-bold">{c.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center hidden md:block">
                          <p className="text-lg font-black text-primary">{c.pendentes}</p>
                          <p className="text-[9px] font-black uppercase tracking-wider text-amber-600">Pendentes</p>
                        </div>
                        <div className="text-center hidden md:block">
                          <p className="text-lg font-black text-primary">{c.aprovados}</p>
                          <p className="text-[9px] font-black uppercase tracking-wider text-secondary">Aprovados</p>
                        </div>
                        {c.valorTotal > 0 && (
                          <div className="text-center hidden md:block">
                            <p className="text-sm font-black text-primary">
                              R${(c.valorTotal/1000).toFixed(0)}k
                            </p>
                            <p className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant">Aprovado</p>
                          </div>
                        )}
                        <ChevronRight className={cn(
                          "w-4 h-4 text-on-surface-variant transition-transform",
                          selectedContratada === c.uid && "rotate-90"
                        )} />
                      </div>
                    </button>

                    {/* Drill-down BMS list */}
                    <AnimatePresence>
                      {selectedContratada === c.uid && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-surface-container-low border-t border-outline-variant/10"
                        >
                          <div className="p-4 space-y-2">
                            {allBMS.filter(b => b.contratada === c.empresa).length === 0 ? (
                              <p className="text-xs text-on-surface-variant text-center py-4 font-bold">
                                Nenhum BMS enviado ainda.
                              </p>
                            ) : (
                              allBMS.filter(b => b.contratada === c.empresa).map(bms => (
                                <div key={bms.id}
                                  className="flex items-center justify-between bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10">
                                  <div>
                                    <span className="text-xs font-black text-primary">
                                      BMS Nº {bms.numero} Rev.{bms.revisao}
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant ml-3">{bms.mes}/{bms.ano}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-black text-primary">
                                      R${((bms.valorBrutoTotal||0)/1000).toFixed(1)}k
                                    </span>
                                    <span className={cn(
                                      "text-[9px] font-black px-2 py-0.5 rounded-full uppercase",
                                      bms.status === 'aprovado' || bms.status === 'pago' ? "bg-secondary/10 text-secondary" :
                                      bms.status === 'enviado' ? "bg-blue-50 text-blue-700" :
                                      bms.status === 'em_revisao' ? "bg-amber-50 text-amber-700" :
                                      "bg-surface-container-high text-on-surface-variant"
                                    )}>
                                      {bms.status}
                                    </span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MEMBERS TAB */}
      {tab === 'members' && (
        <div className="space-y-4">
          {members.map(m => (
            <div key={m.uid}
              className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center font-black text-primary text-sm">
                  {(m.name || m.email).slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-primary text-sm">{m.name || m.email}</p>
                  <p className="text-[10px] text-on-surface-variant">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.empresa && (
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-surface-container-high rounded-full text-on-surface-variant uppercase">
                    {m.empresa}
                  </span>
                )}
                {m.area && (
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full uppercase">
                    {m.area}
                  </span>
                )}
                <span className={cn(
                  "text-[9px] font-black px-2 py-0.5 rounded-full uppercase",
                  m.role === 'admin' ? "bg-primary/10 text-primary" :
                  m.role === 'planejador' ? "bg-purple-50 text-purple-700" :
                  "bg-amber-50 text-amber-700"
                )}>
                  {ROLES_LABEL[m.role]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INVITE MODAL */}
      <AnimatePresence>
        {showInviteForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl border border-outline-variant/20 p-7 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-headline font-extrabold text-primary text-lg">Convidar Membro</h3>
                <button onClick={resetInvite} className="p-1.5 hover:bg-surface-container-high rounded-full">
                  <X className="w-4 h-4 text-on-surface-variant" />
                </button>
              </div>

              {inviteLink ? (
                <div className="space-y-4">
                  <div className="p-4 bg-secondary/10 border border-secondary/20 rounded-2xl">
                    <p className="text-xs font-black text-secondary mb-2">✓ Convite gerado! Copie e envie por e-mail ou WhatsApp:</p>
                    <p className="text-[10px] text-on-surface-variant break-all font-mono bg-surface-container-low p-2 rounded-lg">
                      {inviteLink}
                    </p>
                  </div>
                  <button onClick={copyLink}
                    className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                    {copied ? <><CheckCircle2 className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar Link</>}
                  </button>
                  <button onClick={resetInvite}
                    className="w-full py-2 text-xs font-bold text-on-surface-variant hover:text-primary">
                    Fazer outro convite
                  </button>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold flex gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />{error}
                    </div>
                  )}
                  <div>
                    <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest block mb-1.5">E-mail *</label>
                    <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                      placeholder="email@empresa.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest block mb-1.5">Papel *</label>
                    <div className="flex gap-2">
                      {[{v:'contratada',l:'Contratada'},{v:'planejador',l:'Planejador'}].map(r => (
                        <button key={r.v} onClick={() => setInviteRole(r.v as any)}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all",
                            inviteRole === r.v ? "bg-primary text-white border-primary" : "border-outline-variant/20 text-on-surface-variant hover:border-primary"
                          )}>
                          {r.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {inviteRole === 'planejador' && (
                    <div>
                      <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest block mb-1.5">Área *</label>
                      <select value={inviteArea} onChange={e => setInviteArea(e.target.value)} className={inputCls}>
                        <option value="">Selecione a área</option>
                        {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  )}
                  {inviteRole === 'contratada' && (
                    <div>
                      <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest block mb-1.5">Nome da Empresa *</label>
                      <input value={inviteEmpresa} onChange={e => setInviteEmpresa(e.target.value)}
                        placeholder="Ex: Empresa ABC Montagens" className={inputCls} />
                    </div>
                  )}
                  <button onClick={handleInvite} disabled={inviting}
                    className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-60">
                    {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {inviting ? 'Gerando...' : 'Gerar Link de Convite'}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
