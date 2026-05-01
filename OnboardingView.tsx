import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HardHat, Building2, Target, MapPin, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { useProject } from './ProjectContext';

export const OnboardingView: React.FC = () => {
  const { addClient } = useProject();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('');
  const [obra, setObra] = useState('');
  const [city, setCity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    { number: 1, label: 'Sua Empresa' },
    { number: 2, label: 'A Obra' },
    { number: 3, label: 'Confirmar' },
  ];

  const handleSubmit = async () => {
    if (!name || !obra) {
      setError('Por favor, preencha o nome da empresa e da obra.');
      return;
    }
    const { auth } = await import('./firebase');
    if (!auth.currentUser) {
      setError('Faça login novamente.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await addClient({ name, obra, segment, city });
      window.location.reload();
    } catch (err: any) {
      setError('Falha ao criar o projeto: ' + (err.message || 'Erro desconhecido'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-surface to-surface">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/20">
            <HardHat className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-primary tracking-tighter font-headline mb-1">
            DB Projetos e Engenharia
          </h1>
          <p className="text-on-surface-variant text-sm font-medium">
            Configure sua primeira obra em menos de 1 minuto
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((s, i) => (
            <React.Fragment key={s.number}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${
                  step > s.number ? 'bg-secondary text-white' :
                  step === s.number ? 'bg-primary text-white shadow-lg shadow-primary/30' :
                  'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {step > s.number ? <CheckCircle2 className="w-4 h-4" /> : s.number}
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${
                  step === s.number ? 'text-primary' : 'text-on-surface-variant/50'
                }`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mb-4 rounded-full transition-all duration-500 ${step > s.number ? 'bg-secondary' : 'bg-surface-container-high'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-3xl shadow-2xl border border-outline-variant/10 overflow-hidden">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                className="p-8 space-y-6"
              >
                <div>
                  <h2 className="text-xl font-black text-primary tracking-tight font-headline mb-1">Sua Empresa</h2>
                  <p className="text-sm text-on-surface-variant">Quem está executando a obra?</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-2">
                      Nome da Empresa / Prestadora *
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ex: Empresa ABC Montagens"
                        className="w-full pl-11 pr-4 py-4 bg-surface-container-low border border-outline-variant/20 rounded-2xl text-sm focus:outline-none focus:border-primary/50 transition-all font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-2">
                      Segmento
                    </label>
                    <div className="relative">
                      <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                      <select
                        value={segment}
                        onChange={e => setSegment(e.target.value)}
                        className="w-full pl-11 pr-4 py-4 bg-surface-container-low border border-outline-variant/20 rounded-2xl text-sm focus:outline-none focus:border-primary/50 transition-all font-bold appearance-none"
                      >
                        <option value="">Selecione o segmento</option>
                        <option value="Montagem Industrial">Montagem Industrial</option>
                        <option value="Construção Civil">Construção Civil</option>
                        <option value="Infraestrutura">Infraestrutura</option>
                        <option value="Óleo e Gás">Óleo e Gás</option>
                        <option value="Energia">Energia</option>
                        <option value="Mineração">Mineração</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { if (name.trim()) setStep(2); else setError('Preencha o nome da empresa.'); }}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 group"
                >
                  Próximo <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                className="p-8 space-y-6"
              >
                <div>
                  <h2 className="text-xl font-black text-primary tracking-tight font-headline mb-1">A Obra</h2>
                  <p className="text-sm text-on-surface-variant">Qual projeto você vai gerenciar?</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-2">
                      Nome da Obra / Projeto *
                    </label>
                    <div className="relative">
                      <HardHat className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                      <input
                        type="text"
                        value={obra}
                        onChange={e => setObra(e.target.value)}
                        placeholder="Ex: Contratante S.A. Cidade/SP — Módulo 3"
                        className="w-full pl-11 pr-4 py-4 bg-surface-container-low border border-outline-variant/20 rounded-2xl text-sm focus:outline-none focus:border-primary/50 transition-all font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-2">
                      Cidade / Estado
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                      <input
                        type="text"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="Ex: Cidade/SP, SP"
                        className="w-full pl-11 pr-4 py-4 bg-surface-container-low border border-outline-variant/20 rounded-2xl text-sm focus:outline-none focus:border-primary/50 transition-all font-bold"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 border border-outline-variant/20 text-on-surface-variant rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-surface-container-low transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </button>
                  <button
                    onClick={() => { if (obra.trim()) { setError(null); setStep(3); } else setError('Preencha o nome da obra.'); }}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 group"
                  >
                    Próximo <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                className="p-8 space-y-6"
              >
                <div>
                  <h2 className="text-xl font-black text-primary tracking-tight font-headline mb-1">Tudo certo!</h2>
                  <p className="text-sm text-on-surface-variant">Confirme os dados antes de criar o projeto.</p>
                </div>
                <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/10 space-y-4">
                  {[
                    { label: 'Empresa', value: name },
                    { label: 'Segmento', value: segment || '—' },
                    { label: 'Obra', value: obra },
                    { label: 'Localização', value: city || '—' },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center border-b border-outline-variant/5 pb-3 last:border-0 last:pb-0">
                      <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{item.label}</span>
                      <span className="text-sm font-bold text-primary">{item.value}</span>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-4 border border-outline-variant/20 text-on-surface-variant rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-surface-container-low transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-60"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <><CheckCircle2 className="w-4 h-4" /> Criar Projeto</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-8 text-center text-[10px] text-on-surface-variant/40 uppercase font-black tracking-widest">
          © 2025 DB Projetos e Engenharia • Desenvolvido por Daiane Bianco
        </p>
      </motion.div>
    </div>
  );
};
