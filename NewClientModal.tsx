import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, UserPlus, Building2, Target } from 'lucide-react';

interface NewClientModalProps {
  onClose: () => void;
  onConfirm: (data: { name: string; obra: string; segment: string; city?: string }) => Promise<any>;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({ onClose, onConfirm }) => {
  const [name, setName] = useState('');
  const [obra, setObra] = useState('');
  const [segment, setSegment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !obra) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm({ name, obra, segment });
      onClose();
    } catch (err: any) {
      console.error('Error creating client:', err);
      setError(err.message || 'Erro ao cadastrar cliente. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl border border-outline-variant/20 overflow-hidden"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-headline font-extrabold text-primary">Novo Cliente</h3>
                <p className="text-xs text-on-surface-variant">Cadastre uma nova obra ou cliente</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
              <X className="w-5 h-5 text-on-surface-variant" />
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-xl text-error text-[10px] font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Nome do Cliente</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                <input 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Construtora Alpha"
                  className="w-full pl-11 pr-4 py-3 bg-surface-container-low border border-outline-variant/20 rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-all font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Nome da Obra</label>
              <div className="relative">
                <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                <input 
                  required
                  value={obra}
                  onChange={(e) => setObra(e.target.value)}
                  placeholder="Ex: Residencial Horizonte"
                  className="w-full pl-11 pr-4 py-3 bg-surface-container-low border border-outline-variant/20 rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-all font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Segmento (Opcional)</label>
              <input 
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="Ex: Industrial, Residencial..."
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/20 rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-all font-bold"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                type="button"
                onClick={onClose} 
                className="flex-1 py-3 rounded-xl border border-outline-variant/20 font-bold text-xs hover:bg-surface-container-high transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isSubmitting || !name || !obra}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-xs shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Salvando...' : 'Cadastrar Cliente'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
