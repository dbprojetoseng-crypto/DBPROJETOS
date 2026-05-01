import React from 'react';
import { FileText, Send, Clock } from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { BMSView } from './BMSView';

export const ContratadaView: React.FC = () => {
  const { myEmpresa, workspace } = useWorkspace();

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 flex items-center gap-4">
        <div className="p-2 bg-primary/10 rounded-xl">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
            {workspace?.name}
          </p>
          <p className="text-sm font-black text-primary">{myEmpresa} — Portal de Medição</p>
        </div>
      </div>
      <BMSView />
    </div>
  );
};
