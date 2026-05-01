import React, { useState } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { LogIn, ShieldCheck, Mail, Lock, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        const isAdmin = user.email === 'anne.mendis015@gmail.com';
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          role: isAdmin ? 'admin' : 'client',
          displayName: user.displayName || 'Usuário',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) { setEmailError('Preencha e-mail e senha.'); return; }
    setEmailLoading(true); setEmailError('');
    try {
      if (isNewUser) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'auth/user-not-found': 'E-mail não cadastrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/email-already-in-use': 'E-mail já cadastrado. Faça login.',
        'auth/weak-password': 'Senha fraca — mínimo 6 caracteres.',
        'auth/invalid-email': 'E-mail inválido.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
      };
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('domain')) {
        setEmailError('Para usar e-mail/senha, adicione este domínio no Firebase Console → Authentication → Settings → Authorized domains');
      } else {
        setEmailError(msgs[err.code] || `Erro: ${err.code}`);
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setEmailError('Digite seu e-mail primeiro.'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch {
      setEmailError('Não foi possível enviar o e-mail de recuperação.');
    }
  };

  const handleAuthError = (err: any) => {
    console.error('Auth error:', err);
    if (err.code === 'auth/unauthorized-domain') {
      setError('Este domínio não está autorizado no Firebase.');
    } else if (err.code === 'auth/popup-blocked') {
      setError('O popup de login foi bloqueado pelo navegador.');
    } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
      setError('E-mail ou senha incorretos.');
    } else {
      setError(`Falha ao entrar: ${err.message || 'Erro desconhecido'}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface">
      {/* Coluna Esquerda: Hero Visual (60%) */}
      <div className="hidden md:flex md:w-[60%] bg-[#064e3b] p-12 lg:p-20 flex-col justify-between relative overflow-hidden">
        {/* Faixa no topo */}
        <div className="absolute top-0 left-0 right-0 bg-secondary/20 py-2 px-6 flex justify-center">
          <p className="text-white/90 text-[10px] font-black uppercase tracking-[0.2em]">
            ⚡ Feito por quem trabalhou no canteiro de obra
          </p>
        </div>

        {/* Efeito visual de fundo */}
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-20 -right-20 w-60 h-60 bg-secondary/10 rounded-full blur-2xl" />

        <div className="relative z-10 pt-10">
          <div className="flex items-center gap-4 mb-20 animate-fade-in-up">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/20">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter font-headline">
              DB Projetos
            </h1>
          </div>

          <div className="space-y-8">
            <h2 className="text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tighter animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              Do Excel ao relatório <br />
              <span className="text-secondary italic">executivo em 1 clique.</span>
            </h2>
            
            <div className="space-y-5 pt-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              {[
                "Importe cronogramas MS Project ou planilhas Excel",
                "Dashboards com SPI, CPI, Curva S e Histograma de Recursos",
                "Relatórios prontos para apresentar à contratante"
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-4 text-white/80 group">
                  <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center border border-secondary/30 group-hover:bg-secondary/40 transition-colors">
                    <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
                  </div>
                  <p className="text-sm font-medium tracking-tight">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
              Desenvolvido por Daiane Bianco • Planejamento de Obras
            </span>
          </div>
        </div>
      </div>

      {/* Coluna Direita: Formulário (40%) */}
      <div className="flex-1 md:w-[40%] flex flex-col justify-center items-center p-8 lg:p-12 relative">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {/* Logo pequeno para mobile */}
          <div className="md:hidden text-center mb-10">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/20">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-primary mb-1 font-headline tracking-tighter">
              DB Projetos
            </h1>
          </div>

          <div className="mb-10 text-center md:text-left">
            <h3 className="text-2xl font-black text-primary tracking-tighter font-headline mb-2">
              Boas-vindas ao seu Painel
            </h3>
            <p className="text-on-surface-variant text-sm font-medium">
              Entre para gerenciar seus projetos e cronogramas.
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-4 bg-error/10 border border-error/20 rounded-2xl text-error text-xs font-bold flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
              {error}
            </motion.div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 bg-white text-primary border border-outline-variant/20 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-surface transition-all shadow-sm disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Acessar com Google
          </button>

          {/* Divisor */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-outline-variant/20" />
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">ou</span>
            <div className="flex-1 h-px bg-outline-variant/20" />
          </div>

          {/* Formulário e-mail */}
          <div className="space-y-3">
            {emailError && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold">
                {emailError}
              </div>
            )}
            {resetSent && (
              <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-xl text-secondary text-xs font-bold">
                ✓ E-mail de recuperação enviado!
              </div>
            )}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/20 rounded-xl text-sm focus:outline-none focus:border-primary/50 font-bold"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Senha (mín. 6 caracteres)"
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/20 rounded-xl text-sm focus:outline-none focus:border-primary/50 font-bold"
              onKeyDown={e => e.key === 'Enter' && handleEmailAuth()}
            />
            <button
              onClick={handleEmailAuth}
              disabled={emailLoading}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-60"
            >
              {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isNewUser ? 'Criar Conta' : 'Entrar'}
            </button>
            <div className="flex items-center justify-between text-[10px] font-bold text-on-surface-variant">
              <button onClick={() => { setIsNewUser(!isNewUser); setEmailError(''); }}
                className="hover:text-primary transition-colors">
                {isNewUser ? 'Já tenho conta' : 'Criar nova conta'}
              </button>
              {!isNewUser && (
                <button onClick={handleReset} className="hover:text-primary transition-colors">
                  Esqueci minha senha
                </button>
              )}
            </div>
          </div>

          <p className="mt-12 text-center text-[10px] text-on-surface-variant/40 uppercase font-black tracking-widest">
            © 2024 DB Projetos e Engenharia
          </p>
        </motion.div>
      </div>
    </div>
  );
};
