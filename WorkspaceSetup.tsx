import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Building2, Link, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from './components/AuthWrapper';

export const WorkspaceSetup: React.FC = () => {
  const { createWorkspace, acceptInvite } = useWorkspace();
  const { user } = useAuth();
  const [tab, setTab] = useState<'create' | 'join'>('join');
  const [wsName, setWsName] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-detect invite token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite');
    if (inviteToken) {
      setToken(inviteToken);
      setTab('join');
      handleAccept(inviteToken);
    }
  }, []);

  const handleCreate = async () => {
    if (!wsName.trim()) { setError('Informe o nome da empresa/contratante.'); return; }
    setLoading(true); setError('');
    try {
      await createWorkspace(wsName.trim());
      setSuccess('Workspace criado! Redirecionando...');
      setTimeout(() => window.location.reload(), 1500);
    } catch(e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleAccept = async (t?: string) => {
    const tok = t || token;
    if (!tok.trim()) { setError('Cole o link ou token do convite.'); return; }
    const extracted = tok.includes('invite=') ? tok.split('invite=')[1] : tok;
    setLoading(true); setError('');
    try {
      await acceptInvite(extracted.trim());
    } catch(e: any) { setError(e.message); setLoading(false); }
  };

  const inputCls = "w-full px-4 py-3 bg-surface-container-low border border-outline-variant/20 rounded-xl text-sm focus:outline-none focus:border-primary/50 font-bold";

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/20">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-primary tracking-tighter font-headline">
            DB Projetos e Engenharia
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">Bem-vindo, {user?.displayName || user?.email}</p>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl shadow-xl border border-outline-variant/10 overflow-hidden">
          <div className="flex border-b border-outline-variant/10">
            {[{id:'join',label:'Tenho um convite'},{id:'create',label:'Criar workspace'}].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${tab===t.id?'border-b-2 border-primary text-primary':'text-on-surface-variant'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-7 space-y-4">
            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-xl text-secondary text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />{success}
              </div>
            )}

            {tab === 'join' && (
              <>
                <p className="text-xs text-on-surface-variant font-medium">
                  Cole o link de convite que você recebeu por e-mail:
                </p>
                <input value={token} onChange={e => setToken(e.target.value)}
                  placeholder="https://... ou token direto"
                  className={inputCls} />
                <button onClick={() => handleAccept()} disabled={loading}
                  className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-60">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                  {loading ? 'Verificando...' : 'Entrar no Workspace'}
                </button>
              </>
            )}

            {tab === 'create' && (
              <>
                <p className="text-xs text-on-surface-variant font-medium">
                  Você é a contratante? Crie seu workspace e convide suas contratadas:
                </p>
                <input value={wsName} onChange={e => setWsName(e.target.value)}
                  placeholder="Ex: Contratante S.A. Cidade/SP"
                  className={inputCls} />
                <button onClick={handleCreate} disabled={loading}
                  className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-60">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                  {loading ? 'Criando...' : 'Criar Workspace'}
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-on-surface-variant/40 uppercase font-black tracking-widest mt-6">
          © 2025 DB Projetos e Engenharia • Desenvolvido por Daiane Bianco
        </p>
      </motion.div>
    </div>
  );
};
