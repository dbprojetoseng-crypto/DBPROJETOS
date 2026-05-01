import React, { useEffect, useState, useRef } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { motion } from 'motion/react';
import { useLanguage } from './LanguageContext';
import { DollarSign, TrendingUp, TrendingDown, Target, Wallet, Plus, CheckCircle2, Loader2, Users, FileSpreadsheet, AlertCircle, CircleDollarSign, Download, FileText } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from './firebase';
import { collection, query, where, onSnapshot, addDoc, getDocs, doc, updateDoc, setDoc, serverTimestamp, orderBy, deleteDoc } from 'firebase/firestore';
import { useAuth } from './components/AuthWrapper';
import * as XLSX from 'xlsx';

interface FinancialRecord {
  id?: string;
  clientId: string;
  month: string;
  pv: number;
  ev: number;
  ac: number;
  bac?: number;
  sortOrder?: number;
  sourceType?: 'excel' | 'msproject';
  projectId?: string;
  projectName?: string;
  updatedAt?: any;
}

interface ClientUser {
  uid: string;
  email: string;
  clientName: string;
}

interface ImportOptionsModalProps {
  onClose: () => void;
  onConfirm: (mode: 'replace' | 'keep' | 'merge') => void;
  projectName: string;
  sourceType: 'excel' | 'msproject';
}

const ImportOptionsModal: React.FC<ImportOptionsModalProps> = ({ onClose, onConfirm, projectName, sourceType }) => {
  const [mode, setMode] = useState<'replace' | 'keep' | 'merge'>('keep');

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl border border-outline-variant/20 p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-headline font-extrabold text-primary">Opções de Importação</h3>
            <p className="text-xs text-on-surface-variant">Como você deseja tratar os dados existentes?</p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <label className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${mode === 'replace' ? 'border-primary bg-primary/5' : 'border-outline-variant/10 hover:border-primary/30'}`}>
            <input type="radio" name="importMode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')} className="w-5 h-5 text-primary" />
            <div>
              <p className="font-bold text-sm text-primary">Substituir projeto atual</p>
              <p className="text-[10px] text-on-surface-variant">Remove todos os dados anteriores desta fonte ({sourceType}) para este cliente.</p>
            </div>
          </label>

          <label className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${mode === 'keep' ? 'border-primary bg-primary/5' : 'border-outline-variant/10 hover:border-primary/30'}`}>
            <input type="radio" name="importMode" value="keep" checked={mode === 'keep'} onChange={() => setMode('keep')} className="w-5 h-5 text-primary" />
            <div>
              <p className="font-bold text-sm text-primary">Manter separado</p>
              <p className="text-[10px] text-on-surface-variant">Cria um novo conjunto de dados sem afetar os existentes.</p>
            </div>
          </label>

          <label className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${mode === 'merge' ? 'border-primary bg-primary/5' : 'border-outline-variant/10 hover:border-primary/30'}`}>
            <input type="radio" name="importMode" value="merge" checked={mode === 'merge'} onChange={() => setMode('merge')} className="w-5 h-5 text-primary" />
            <div>
              <p className="font-bold text-sm text-primary">Mesclar manualmente</p>
              <p className="text-[10px] text-on-surface-variant">Adiciona os novos dados aos existentes (pode gerar duplicatas se não houver IDs únicos).</p>
            </div>
          </label>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-outline-variant/20 font-bold text-xs hover:bg-surface-container-high transition-all">
            Cancelar
          </button>
          <button onClick={() => onConfirm(mode)} className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-xs shadow-lg hover:bg-primary/90 transition-all">
            Confirmar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

import { useProject } from './ProjectContext';
import { useWorkspace } from './WorkspaceContext';
import { ManualEntryModal } from './components/ManualEntryModal';

export const FinanceView: React.FC = () => {
  const { t } = useLanguage();
  const { user, userRole } = useAuth();
  const { workspaceId } = useWorkspace();
  const { activeProjectId, setActiveProjectId, projects, clients, selectedClientId, setSelectedClientId } = useProject();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const msProjectInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [financialData, setFinancialData] = useState<FinancialRecord[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'keep' | 'merge' | null>(null);
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);

  const parseDate = (val: any) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'number') {
      // Excel serial date
      return new Date((val - 25569) * 86400 * 1000);
    }
    if (typeof val === 'string') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const parseNum = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      // Check for status-like strings
      const lowerVal = val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (lowerVal === 'concluido' || lowerVal === 'finalizado' || lowerVal === '100%') return 1;
      if (lowerVal === 'atrasado' || lowerVal === 'pendente') return 0;

      const isPercentage = val.includes('%');
      let cleanVal = val.replace(/[R$\s%]/g, '');
      
      // Handle Brazilian format: 20.000,00 -> 20000.00
      if (cleanVal.includes('.') && cleanVal.includes(',')) {
        cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
      } else if (cleanVal.includes(',')) {
        cleanVal = cleanVal.replace(',', '.');
      } else if (cleanVal.includes('.') && cleanVal.split('.').pop()?.length === 3) {
        // Likely a thousands separator like 20.000
        cleanVal = cleanVal.replace(/\./g, '');
      }
      
      let num = parseFloat(cleanVal) || 0;
      if (isPercentage) num = num / 100;
      return num;
    }
    return parseFloat(val) || 0;
  };

  const getVal = (row: any, keys: string[], possibleNames: string[]) => {
    // First pass: exact matches (case insensitive, no spaces/accents)
    for (const name of possibleNames) {
      const cleanName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
      const foundKey = keys.find(k => {
        const cleanK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
        return cleanK === cleanName;
      });
      
      if (foundKey) {
        const val = row[foundKey];
        if (val !== undefined && val !== null) return parseNum(val);
      }
    }

    // Second pass: fuzzy matches (includes) - only for longer, more specific names
    for (const name of possibleNames) {
      const cleanName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
      // Skip fuzzy matching for very short/generic names to avoid false positives
      if (cleanName.length < 3) continue;

      const foundKey = keys.find(k => {
        const cleanK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
        return cleanK.includes(cleanName) || cleanName.includes(cleanK);
      });
      
      if (foundKey) {
        const val = row[foundKey];
        if (val !== undefined && val !== null) return parseNum(val);
      }
    }
    return 0;
  };

  const deleteExistingData = async (projectId: string) => {
    // Delete financials
    const qFin = query(collection(db, 'projects', projectId, 'financials'));
    const snapsFin = await getDocs(qFin);
    for (const d of snapsFin.docs) await deleteDoc(doc(db, 'projects', projectId, 'financials', d.id));

    // Delete tasks
    const qTasks = query(collection(db, 'projects', projectId, 'tasks'));
    const snapsTasks = await getDocs(qTasks);
    for (const d of snapsTasks.docs) await deleteDoc(doc(db, 'projects', projectId, 'tasks', d.id));
    
    // Delete resources
    const qRes = query(collection(db, 'projects', projectId, 'resources'));
    const snapsRes = await getDocs(qRes);
    for (const d of snapsRes.docs) await deleteDoc(doc(db, 'projects', projectId, 'resources', d.id));
  };

  const handleImportConfirm = async (mode: 'replace' | 'keep' | 'merge') => {
    if (!pendingImportData || !selectedClientId || isImporting) return;

    if (!auth.currentUser) {
      setUploadError("Usuário não autenticado. Por favor, faça login novamente.");
      return;
    }

    setIsImporting(true);
    setUploadError(null);
    setShowImportOptions(false);

    try {
      const ownerId = auth.currentUser.uid;
      const sourceType = pendingImportData.type;
      const projectName = pendingImportData.name;
      const client = clients.find(c => c.uid === selectedClientId);
      const clientName = client?.clientName || 'Cliente Desconhecido';
      
      const projectId = mode === 'keep' 
        ? `${selectedClientId}_${sourceType}_${Date.now()}` 
        : `${selectedClientId}_${sourceType}_current`;

      if (mode === 'replace') {
        await deleteExistingData(projectId);
      }

      if (sourceType === 'msproject') {
        const { tasks } = pendingImportData.data;
        const monthlyTotals: { [key: string]: { pv: number, ev: number, ac: number, bac: number } } = {};
        const monthlySortOrder: { [key: string]: number } = {};

        // 1. Save Project Metadata
        const projectRef = doc(db, 'projects', projectId);
        await setDoc(projectRef, {
          name: projectName,
          clientId: selectedClientId,
          clientName: clientName,
          ownerId: ownerId,
          userId: ownerId,
          workspaceId: workspaceId,
          sourceType: 'msproject',
          projectId: projectId,
          importedAt: serverTimestamp(),
          taskCount: tasks.length
        }, { merge: true });

        // 2. Save Tasks with full EVM fields
        for (const task of tasks) {
          const taskRef = doc(db, 'projects', projectId, 'tasks', `${task.uid}`);

          // Determine month from start date
          let taskMonth = '';
          const dateStr = task.start || task.actualStart;
          if (dateStr) {
            try {
              const d = new Date(dateStr);
              if (!isNaN(d.getTime())) {
                taskMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d);
                if (!monthlySortOrder[taskMonth]) {
                  monthlySortOrder[taskMonth] = d.getTime();
                }
              }
            } catch(e) {}
          }
          if (!taskMonth) taskMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date());

          if (!monthlyTotals[taskMonth]) {
            monthlyTotals[taskMonth] = { pv: 0, ev: 0, ac: 0, bac: 0 };
          }

          const bac = Number(task.bac) || Number(task.cost) || 0;
          const ac  = Number(task.ac) || 0;
          const progress = Number(task.progress) || 0;
          const plannedProgress = Number(task.plannedProgress) || progress;

          const pv = bac * (plannedProgress / 100);
          const ev = bac * (progress / 100);

          monthlyTotals[taskMonth].bac += bac;
          monthlyTotals[taskMonth].pv  += pv;
          monthlyTotals[taskMonth].ev  += ev;
          monthlyTotals[taskMonth].ac  += ac;

          const situation = task.situation ||
            (progress > plannedProgress ? 'ADIANTADO'
              : progress < plannedProgress && plannedProgress > 0 ? 'ATRASO'
              : 'NO PRAZO');

          await setDoc(taskRef, {
            ...task,
            clientId: selectedClientId,
            ownerId: ownerId,
            workspaceId: workspaceId,
            projectName: projectName,
            projectId: projectId,
            sourceType: 'msproject',
            month: taskMonth,
            bac,
            ac,
            plannedProgress,
            plannedWeight: Number(task.plannedWeight) || 0,
            actualWeight: Number(task.actualWeight) || 0,
            isCritical: task.isCritical || false,
            situation,
            updatedAt: serverTimestamp(),
            statusKanban: progress >= 100 ? 'concluido' : progress > 0 ? 'em_andamento' : 'nao_iniciado',
            status: progress >= 100 ? 'CONCLUÍDO' : progress > 0 ? 'EM ANDAMENTO' : 'NÃO INICIADO',
          }, { merge: true });
        }

        // 3. Save Financial Data per month (cumulative-ready)
        for (const [month, totals] of Object.entries(monthlyTotals)) {
          const sortOrder = monthlySortOrder[month] || Date.now();
          const finRef = doc(db, 'projects', projectId, 'financials', month);
          await setDoc(finRef, {
            ...totals,
            clientId: selectedClientId,
            projectId,
            workspaceId: workspaceId,
            sourceType: 'msproject',
            month,
            sortOrder,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      } else if (sourceType === 'excel') {
        const jsonData = pendingImportData.data;
        const rowKeys = pendingImportData.rowKeys;

        // 1. Save Project Metadata
        const projectRef = doc(db, 'projects', projectId);
        await setDoc(projectRef, {
          name: projectName,
          clientId: selectedClientId,
          clientName: clientName,
          ownerId: ownerId,
          userId: ownerId, // Explicitly add userId as requested
          workspaceId: workspaceId,
          sourceType: 'excel',
          projectId: projectId,
          importedAt: serverTimestamp(),
          rowCount: jsonData.length
        }, { merge: true });

        const monthKey = rowKeys.find((k: string) => 
          ['mês', 'mes', 'month', 'data', 'date'].includes(k.toLowerCase().trim())
        ) || rowKeys.find((k: string) => {
          const cleanK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
          return cleanK === 'inicioplanejado' || cleanK === 'inicio' || cleanK === 'dataini' || cleanK === 'datainicio';
        });

        const processExcelData = async (data: any[], month: string, sortOrder: number) => {
          let totalPV = 0, totalEV = 0, totalAC = 0, totalBACForMonth = 0;
          let monthEngineers = 0, monthLaborers = 0, monthOperators = 0;
          let monthMontadores = 0, monthAjudantes = 0, monthSoldadores = 0;
          const uniqueTasks = new Map<string, any>();

          for (const row of data) {
            const idValRaw = getVal(row, rowKeys, ['id', 'atividade id', 'item', 'codigo', 'nº', 'posicao', 'pos']);
            const idVal = idValRaw !== 0 ? String(idValRaw) : '';
            const nameKey = rowKeys.find((k: string) => {
              const cleanK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
              return cleanK === 'atividade' || cleanK === 'nome' || cleanK === 'descricaodaatividade' || cleanK.includes('descricao');
            });
            const nameVal = nameKey ? String(row[nameKey] || '') : '';
            const taskId = idVal || nameVal || 'Tarefa sem nome';
            const name = nameVal || idVal || 'Tarefa sem nome';

            // STRICT RESOURCE MAPPING FROM HEADERS (ONLY JOB TITLES)
            let eng = 0;
            let lab = 0;
            let opt = 0;

            rowKeys.forEach(key => {
              const cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
              
              // Keywords for classification
              const engKeywords = ['engenheiro', 'supervisor', 'encarregado', 'tecnico', 'coordenador'];
              const optKeywords = ['operador', 'guindaste', 'munck', 'maquina', 'equipamento'];
              const labKeywords = [
                'montador', 'ajudante', 'soldador', 'eletricista', 'pintor', 'caldeireiro', 
                'pedreiro', 'servente', 'rigger', 'instalador', 'almoxarife'
              ];

              const isEng = engKeywords.some(k => cleanKey.includes(k));
              const isOpt = optKeywords.some(k => cleanKey.includes(k));
              const isLab = labKeywords.some(k => cleanKey.includes(k));

              // ONLY process if it matches one of the resource keywords
              if (isEng || isOpt || isLab) {
                const val = Number(row[key]) || 0;
                if (val <= 0) return;

                if (isEng) {
                  eng += val;
                } else if (isOpt) {
                  opt += val;
                } else if (isLab) {
                  lab += val;
                }
              }
            });

            monthEngineers += eng; monthLaborers += lab; monthOperators += opt;

            const bac = getVal(row, rowKeys, ['custo planejado', 'custoplanejado', 'plannedcost', 'bac', 'orçamento', 'orcamento', 'valor planejado', 'custo_planejado']);
            const rawPlannedProgress = getVal(row, rowKeys, ['% avanço fisico planejado', 'avanço fisico planejado', 'avanco fisico planejado', '% avanço físico planejado', 'plannedprogress', 'avanço planejado', 'avanco planejado', '% planejado', 'previsto']);
            const plannedProgressPercent = rawPlannedProgress > 1 ? rawPlannedProgress : rawPlannedProgress * 100;
            const actualCost = getVal(row, rowKeys, ['custo real', 'custoreal', 'actualcost', 'ac', 'gasto real', 'valor real', 'custo_real']);
            const plannedWeight = getVal(row, rowKeys, ['plannedweight', 'pesoprevisto', 'peso planejado', 'peso previsto', 'ton planejado', 'peso estimado', 'quantidade planejada']);
            const actualWeight = getVal(row, rowKeys, ['actualweight', 'pesorealizado', 'peso real', 'peso realizado', 'ton realizado', 'peso montado', 'quantidade realizada']);
            
            const mpRaw = getVal(row, rowKeys, ['mp', 'mp %', '% mp', 'materia prima', 'materia-prima', 'matéria prima', 'entrega mp', 'status mp']);
            const mpStatus = mpRaw > 1 ? mpRaw : mpRaw * 100;

            const calculatedRealProgress = plannedWeight > 0 ? (actualWeight / plannedWeight) * 100 : (mpStatus > 0 ? mpStatus : 0);

            if (!uniqueTasks.has(taskId)) {
              uniqueTasks.set(taskId, {
                id: taskId,
                clientId: selectedClientId,
                projectId,
                sourceType: 'excel',
                name,
                month,
                bac,
                ac: actualCost,
                plannedWeight,
                actualWeight,
                engineers: eng,
                laborers: lab,
                operators: opt,
                progress: calculatedRealProgress,
                mpStatus: mpStatus,
                plannedProgress: plannedProgressPercent,
                isCritical: calculatedRealProgress < plannedProgressPercent && plannedProgressPercent > 0,
                situation: calculatedRealProgress > plannedProgressPercent ? 'ADIANTADO' : calculatedRealProgress < plannedProgressPercent && plannedProgressPercent > 0 ? 'ATRASO' : 'NO PRAZO',
                updatedAt: serverTimestamp()
              });
            } else {
              const existing = uniqueTasks.get(taskId);
              existing.ac += actualCost;
              existing.bac = Math.max(existing.bac, bac);
              existing.plannedWeight = Math.max(existing.plannedWeight, plannedWeight);
              existing.actualWeight = Math.max(existing.actualWeight, actualWeight);
              existing.engineers += eng;
              existing.laborers += lab;
              existing.operators += opt;
              existing.mpStatus = Math.max(existing.mpStatus || 0, mpStatus);
              existing.progress = existing.plannedWeight > 0 ? (existing.actualWeight / existing.plannedWeight) * 100 : (existing.mpStatus > 0 ? existing.mpStatus : 0);
              existing.plannedProgress = Math.max(existing.plannedProgress, plannedProgressPercent);
              existing.isCritical = existing.progress < existing.plannedProgress && existing.plannedProgress > 0;
              existing.situation = existing.progress > existing.plannedProgress ? 'ADIANTADO' : existing.progress < existing.plannedProgress && existing.plannedProgress > 0 ? 'ATRASO' : 'NO PRAZO';
            }
          }

          for (const task of uniqueTasks.values()) {
            const pVal = task.bac * (task.plannedProgress / 100);
            const eVal = task.bac * (task.progress / 100);
            totalPV += pVal; totalEV += eVal; totalAC += task.ac; totalBACForMonth += task.bac;
            
            await addDoc(collection(db, 'projects', projectId, 'tasks'), {
              ...task,
              workspaceId: workspaceId,
              status: task.progress >= 100 ? 'CONCLUÍDO' : task.progress > 0 ? 'EM ANDAMENTO' : 'NÃO INICIADO',
              statusKanban: task.progress >= 100 ? 'concluido' : task.progress > 0 ? 'em_andamento' : 'nao_iniciado',
              isCritical: task.isCritical || false,
              situation: task.situation || 'NO PRAZO',
            });
          }

          // If we have separate resources data, process it for this month
          if (pendingImportData.resourcesData && pendingImportData.resourcesData.length > 0) {
            const resData = pendingImportData.resourcesData;
            const resKeys = Object.keys(resData[0]);
            
            // Bug 3 Fix: Prioritize INICIO PLANEJADO for month detection and handle various formats
            const resMonthKey = resKeys.find(k => {
              const cleanK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
              return cleanK === 'inicioplanejado';
            }) || resKeys.find(k => {
              const cleanK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
              return cleanK.includes('mes') || cleanK.includes('data') || cleanK.includes('inicio');
            });

            resData.forEach(row => {
              let m = "";
              if (resMonthKey) {
                const rawVal = row[resMonthKey];
                const d = parseDate(rawVal);
                if (d) {
                  m = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d);
                } else {
                  m = String(rawVal || "");
                }
              }
              
              // Normalize month strings for comparison (e.g., "jan." vs "jan")
              const cleanM = m.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, '').trim();
              const cleanTargetMonth = month.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, '').trim();

              if (cleanM === cleanTargetMonth) {
                let rEng = 0, rLab = 0, rOpt = 0;
                let rMontadores = 0, rAjudantes = 0, rSoldadores = 0;
                
                // Bug 1 & 2 Fix: Handle specific EQUIPAMENTO + QUANTIDADE pattern
                const equipKey = resKeys.find(k => k.toUpperCase() === 'EQUIPAMENTO');
                const quantKey = resKeys.find(k => k.toUpperCase() === 'QUANTIDADE');
                
                if (equipKey && quantKey) {
                  const equipValue = String(row[equipKey] || "").toLowerCase();
                  const quantValue = Number(row[quantKey]) || 0;
                  const optKeywordsSpecial = ['guindaste', 'guindauto', 'munck', 'grua', 'caminhao', 'retroescavadeira', 'escavadeira'];
                  
                  if (optKeywordsSpecial.some(k => equipValue.includes(k))) {
                    rOpt += quantValue;
                  }
                }

                resKeys.forEach(key => {
                  const cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
                  
                  // Skip column 'quantidade' and 'equipamento' as they are handled by the special pattern above
                  if (cleanKey === 'quantidade' || cleanKey === 'equipamento') return;

                  const engKeywords = ['engenheiro', 'supervisor', 'encarregado', 'tecnico', 'coordenador'];
                  // Bug 2: Removed 'equipamento' and 'maquina' from generic optKeywords
                  const optKeywords = ['operador']; 
                  const labKeywords = ['montador', 'ajudante', 'soldador', 'eletricista', 'pintor', 'caldeireiro', 'pedreiro', 'servente', 'rigger', 'instalador', 'almoxarife'];

                  const isEng = engKeywords.some(k => cleanKey.includes(k));
                  const isOpt = optKeywords.some(k => cleanKey.includes(k));
                  const isLab = labKeywords.some(k => cleanKey.includes(k));

                  if (isEng || isOpt || isLab) {
                    const val = Number(row[key]) || 0;
                    if (val > 0) {
                      if (isEng) rEng += val;
                      else if (isOpt) rOpt += val;
                      else if (isLab) {
                        rLab += val;
                        // breakdown por função
                        const cleanKeyFn = cleanKey;
                        if (cleanKeyFn.includes('montador')) rMontadores += val;
                        else if (cleanKeyFn.includes('ajudante')) rAjudantes += val;
                        else if (cleanKeyFn.includes('soldador')) rSoldadores += val;
                      }
                    }
                  }
                });
                monthEngineers += rEng;
                monthLaborers += rLab;
                monthOperators += rOpt;
                monthMontadores += rMontadores;
                monthAjudantes += rAjudantes;
                monthSoldadores += rSoldadores;
              }
            });
          }

          // Save resources from the main sheet data
          const resRef = doc(db, 'projects', projectId, 'resources', month);
          const resObj = {
            clientId: selectedClientId,
            projectId,
            workspaceId: workspaceId,
            sourceType: 'excel',
            month,
            engineers: monthEngineers,
            laborers: monthLaborers,
            operators: monthOperators,
            montadores: monthMontadores,
            ajudantes: monthAjudantes,
            soldadores: monthSoldadores,
            sortOrder,
            updatedAt: serverTimestamp()
          };
          console.log("[DEBUG] Saving Resources from Main Sheet:", resObj);
          await setDoc(resRef, resObj, { merge: true });

          return { pv: totalPV, ev: totalEV, ac: totalAC, bac: totalBACForMonth };
        };

        // Save resources from the main sheet processing
        // The processExcelData function now handles the new format mapping per row

        if (monthKey) {
          const grouped: { [key: string]: any[] } = {};
          const monthSortOrder: { [key: string]: number } = {};
          jsonData.forEach((row: any) => {
            let m = '';
            const rawVal = row[monthKey];
            if (typeof rawVal === 'number' || rawVal instanceof Date) {
              const d = parseDate(rawVal);
              if (d) {
                m = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d);
                if (!monthSortOrder[m]) monthSortOrder[m] = d.getTime();
              }
            } else if (typeof rawVal === 'string' && rawVal.trim()) {
              const d = new Date(rawVal);
              if (!isNaN(d.getTime())) {
                m = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d);
                if (!monthSortOrder[m]) monthSortOrder[m] = d.getTime();
              } else {
                m = rawVal.trim();
              }
            }
            if (!m) return;
            if (!grouped[m]) grouped[m] = [];
            grouped[m].push(row);
          });

          for (const m in grouped) {
            const sortOrder = monthSortOrder[m] || Date.now();

            const totals = await processExcelData(grouped[m], m, sortOrder);
            
            const finRef = doc(db, 'projects', projectId, 'financials', m);
            await setDoc(finRef, { 
              ...totals, 
              clientId: selectedClientId, 
              projectId,
              workspaceId: workspaceId,
              sourceType: 'excel',
              month: m, 
              sortOrder,
              updatedAt: serverTimestamp() 
            }, { merge: true });
          }
        } else {
          const currentMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date());
          const totals = await processExcelData(jsonData, currentMonth, Date.now());
          const finRef = doc(db, 'projects', projectId, 'financials', currentMonth);
          await setDoc(finRef, { 
            ...totals, 
            clientId: selectedClientId, 
            projectId,
            sourceType: 'excel',
            month: currentMonth, 
            updatedAt: serverTimestamp() 
          }, { merge: true });
        }
      }

      setUploadSuccess(true);
      setPreviewData(null);
      setPendingImportData(null);
      setActiveProjectId(projectId); // Auto-switch to the new project
      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (error: any) {
      console.error("Erro na importação:", error);
      setUploadError(`Erro na importação: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };
  // Clear upload error when client is selected
  useEffect(() => {
    if (selectedClientId) {
      setUploadError(null);
    }
  }, [selectedClientId]);

  // Fetch financial data for selected project
  useEffect(() => {
    if (!activeProjectId) {
      setFinancialData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'projects', activeProjectId, 'financials'), 
      orderBy('month', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FinancialRecord[];
      setFinancialData(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'financials');
      setLoading(false);
    });

    // Fetch tasks for PDF export
    const tasksQuery = query(collection(db, 'projects', activeProjectId, 'tasks'));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTasks(taskList);
    });

    return () => {
      unsubscribe();
      unsubscribeTasks();
    };
  }, [activeProjectId]);

  const getSheetDataWithHeaders = (worksheet: XLSX.WorkSheet) => {
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    if (rows.length === 0) return [];

    const knownHeaders = [
      'id', 'atividade', 'nome', 'descrição', 'início', 'término', 'custo', 'avanço', 'peso',
      'engenheiros', 'trabalhadores', 'operadores', 'mês', 'data', 'item', 'codigo',
      'eng', 'lab', 'opt', 'mão de obra', 'equipe', 'recursos', 'recurso', 'quantidade', 'qtd',
      'montador', 'ajudante', 'soldador', 'equipamento', 'engenheiro'
    ];

    let bestRowIndex = 0;
    let maxMatches = 0;

    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i];
      if (!row || !Array.isArray(row)) continue;
      
      let matches = 0;
      row.forEach(cell => {
        if (typeof cell === 'string') {
          const cleanCell = cell.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
          if (knownHeaders.some(h => cleanCell.includes(h))) {
            matches++;
          }
        }
      });

      // Special case for vertical resources: if we find "recursos" and "quantidade", that's a good header row
      const rowStr = row.join('|').toLowerCase();
      if (rowStr.includes('recurso') && (rowStr.includes('quant') || rowStr.includes('qtd'))) {
        matches += 5; // Boost matches for resource headers
      }

      if (matches > maxMatches) {
        maxMatches = matches;
        bestRowIndex = i;
      }
    }

    return XLSX.utils.sheet_to_json(worksheet, { range: bestRowIndex });
  };

  const downloadTemplate = () => {
    const mainHeaders = [
      ['ID', 'ATIVIDADE', 'MÊS', 'CUSTO PLANEJADO', 'AVANÇO PLANEJADO', 'PESO PREVISTO']
    ];
    const resourceHeaders = [
      ['ID', 'NOME DA TAREFA', 'INICIO PLANEJADO', 'TERMINO PLANEJADO', 'INICIO REAL', 'TERMINO REAL', 'ENGENHEIRO', 'MONTADOR', 'AJUDANTE', 'SOLDADOR', 'EQUIPAMENTO', 'QUANTIDADE']
    ];
    
    const wb = XLSX.utils.book_new();
    const wsMain = XLSX.utils.aoa_to_sheet(mainHeaders);
    const wsRes = XLSX.utils.aoa_to_sheet(resourceHeaders);
    
    XLSX.utils.book_append_sheet(wb, wsMain, "padrao1");
    XLSX.utils.book_append_sheet(wb, wsRes, "recursos");
    
    XLSX.writeFile(wb, "Modelo_Importacao_Oficial.xlsx");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedClientId) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const mainSheetName = workbook.SheetNames.find(n => {
            const cleanN = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
            return cleanN.includes('padrao1') || cleanN.includes('cronograma') || cleanN.includes('task') || cleanN.includes('atividade') || cleanN.includes('obra') || cleanN.includes('projeto');
          }) || workbook.SheetNames[0];
          
          const mainData = getSheetDataWithHeaders(workbook.Sheets[mainSheetName]);
          
          let resourcesData = null;
          const resSheetName = workbook.SheetNames.find(n => {
            const cleanN = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
            return (cleanN.includes('recurso') || cleanN.includes('resource') || cleanN.includes('equipe') || cleanN.includes('maodeobra') || cleanN.includes('trabalhador')) && n !== mainSheetName;
          });
          
          if (resSheetName) {
            resourcesData = getSheetDataWithHeaders(workbook.Sheets[resSheetName]);
          }

          if (mainData.length === 0) {
            throw new Error('A planilha está vazia ou o cabeçalho não foi encontrado.');
          }

          const rowKeys = Object.keys(mainData[0] as object);
          const resKeys = resourcesData && resourcesData.length > 0 ? Object.keys(resourcesData[0] as object) : [];
          const allKeys = [...rowKeys, ...resKeys];
          
          // Template Validation for Resources
          const mandatoryColumns = ['ENGENHEIRO', 'MONTADOR', 'AJUDANTE', 'SOLDADOR', 'EQUIPAMENTO', 'QUANTIDADE'];
          const missingColumns = mandatoryColumns.filter(col => 
            !allKeys.some(k => k.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '') === col)
          );

          if (missingColumns.length > 0) {
            throw new Error(`Use a planilha modelo oficial para importação automática.`);
          }

          setPendingImportData({
            type: 'excel',
            data: mainData,
            resourcesData: resourcesData,
            name: file.name,
            rowKeys
          });
          setShowImportOptions(true);
        } catch (err: any) {
          setUploadError(`Erro ao processar arquivo: ${err.message}`);
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setUploadError(`Erro ao ler arquivo: ${err.message}`);
      setIsUploading(false);
    }
  };

  const handleMsProjectUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedClientId) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/import-project", {
        method: "POST",
        body: formData,
      });

      let data;
      const contentType = response.headers.get("content-type");
      
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error("Servidor retornou resposta não-JSON:", text);
        
        // Detailed error message for non-JSON response (usually HTML)
        const errorMessage = [
          `Erro inesperado do servidor.`,
          `Status: ${response.status} ${response.statusText}`,
          `Rota: POST /api/import-project`,
          `Causa provável: O servidor retornou HTML em vez de JSON. Isso geralmente acontece quando a rota não é encontrada ou o servidor caiu.`,
        ].join("\n");
        
        throw new Error(errorMessage);
      }

      if (!response.ok) {
        throw new Error(data.error || `Erro do servidor (${response.status}): ${response.statusText}`);
      }

      if (data.success) {
        setPreviewData({
          name: data.projectName,
          tasks: data.tasks
        });
      } else {
        throw new Error(data.error || "A resposta do servidor indica falha no processamento.");
      }
      
      setIsUploading(false);
    } catch (error: any) {
      console.error("Erro ao importar MS Project:", error);
      setUploadError(error.message || "Erro desconhecido ao processar arquivo MS Project.");
      setIsUploading(false);
    } finally {
      if (msProjectInputRef.current) msProjectInputRef.current.value = '';
    }
  };

  const confirmMsProjectImport = async () => {
    if (!previewData || !selectedClientId || isImporting) return;

    setPendingImportData({
      type: 'msproject',
      data: previewData,
      name: previewData.name
    });
    setShowImportOptions(true);
  };

  const sortedFinancialData = [...financialData].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // Build CUMULATIVE values for the EVA chart
  let cumPV = 0, cumEV = 0, cumAC = 0, cumBAC = 0;
  const chartData: any[] = sortedFinancialData.map(d => {
    cumPV  += typeof d.pv  === 'number' ? d.pv  : 0;
    cumEV  += typeof d.ev  === 'number' ? d.ev  : 0;
    cumAC  += typeof d.ac  === 'number' ? d.ac  : 0;
    cumBAC += typeof d.bac === 'number' ? d.bac : 0;
    return {
      month: d.month,
      pv: cumPV,
      ev: cumEV,
      ac: cumAC,
      bac: cumBAC,
      projection: null,
      sortOrder: d.sortOrder
    };
  });

  // KPIs use cumulative totals (all months)
  const totalCumPV  = cumPV;
  const totalCumEV  = cumEV;
  const totalCumAC  = cumAC;
  const totalCumBAC = cumBAC;

  const cpi = totalCumAC > 0 ? (totalCumEV / totalCumAC).toFixed(2) : '0.00';
  const spiFinance = totalCumPV > 0 ? (totalCumEV / totalCumPV).toFixed(2) : '0.00';
  const eac = parseFloat(cpi) > 0 ? (totalCumBAC / parseFloat(cpi)) : totalCumBAC;
  const vac = totalCumBAC - eac;

  // For compatibility with JSX
  const latestData = { pv: totalCumPV, ev: totalCumEV, ac: totalCumAC, bac: totalCumBAC };

  // Add projection point
  if (chartData.length > 0) {
    chartData.push({
      month: 'Projeção',
      pv: totalCumBAC,
      ev: null,
      ac: null,
      bac: totalCumBAC,
      projection: eac,
      sortOrder: (chartData[chartData.length - 1].sortOrder || 0) + 1
    });
  }

  // Tasks for PDF export (all tasks across all months)
  const financialTasksForPDF = [...tasks].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const handleExportPDF = async () => {
    const project = projects.find(p => p.id === activeProjectId);
    const projectName = project?.name || 'Projeto';
    const clientName = project?.clientId || '';
    const today = new Date().toLocaleDateString('pt-BR');
    const todayISO = new Date().toISOString().split('T')[0];

    // Fetch resources data for the report
    let resourcesRows = '';
    try {
      const { getDocs, collection } = await import('firebase/firestore');
      const resSnap = await getDocs(collection(db, 'projects', activeProjectId!, 'resources'));
      const resData = resSnap.docs.map(d => d.data()).sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0));
      resourcesRows = resData.map(r => `
        <tr>
          <td><strong>${r.month || '—'}</strong></td>
          <td>${r.engineers || 0}</td>
          <td>${r.montadores || 0}</td>
          <td>${r.ajudantes || 0}</td>
          <td>${r.soldadores || 0}</td>
          <td>${r.laborers || 0}</td>
          <td>${r.operators || 0}</td>
        </tr>
      `).join('');
    } catch(e) { resourcesRows = '<tr><td colspan="7">Sem dados de recursos</td></tr>'; }

    // Build cumulative EVA data for chart table
    const evaRows = chartData.filter(d => d.month !== 'Projeção').map(d => `
      <tr>
        <td><strong>${d.month}</strong></td>
        <td>R$ ${((d.pv||0)/1000).toFixed(1)}k</td>
        <td>R$ ${((d.ev||0)/1000).toFixed(1)}k</td>
        <td>R$ ${((d.ac||0)/1000).toFixed(1)}k</td>
        <td style="color:${(d.ev||0)>=(d.ac||0)?'#064e3b':'#dc2626'}">
          ${(d.ev||0)>=(d.ac||0)?'✓ Dentro':'⚠ Acima'}
        </td>
      </tr>
    `).join('');

    // Build SVG for EVA chart
    const evaPoints = chartData.filter(d => d.month !== 'Projeção');
    const evaW = 700, evaH = 200;
    const evaPadL = 60, evaPadR = 20, evaPadT = 20, evaPadB = 40;
    const evaChartW = evaW - evaPadL - evaPadR;
    const evaChartH = evaH - evaPadT - evaPadB;

    const maxEVA = Math.max(
      ...evaPoints.map(d => Math.max(d.pv||0, d.ev||0, d.ac||0)),
      eac, 1
    ) * 1.1;

    const evaX = (i: number) => evaPadL + (i / Math.max(evaPoints.length - 1, 1)) * evaChartW;
    const evaY = (val: number) => evaPadT + evaChartH - (val / maxEVA) * evaChartH;

    const evaPVPoints = evaPoints.map((d,i) => `${evaX(i)},${evaY(d.pv||0)}`).join(' ');
    const evaEVPoints = evaPoints.map((d,i) => `${evaX(i)},${evaY(d.ev||0)}`).join(' ');
    const evaACPoints = evaPoints.map((d,i) => `${evaX(i)},${evaY(d.ac||0)}`).join(' ');

    // EAC projection line from last point
    const lastEVAIdx = evaPoints.length - 1;
    const eacLinePoints = `${evaX(lastEVAIdx)},${evaY(evaPoints[lastEVAIdx]?.ac||0)} ${evaX(lastEVAIdx + 1.5)},${evaY(eac)}`;

    // Y axis labels (monetary)
    const evaYLabels = [0, 0.25, 0.5, 0.75, 1].map(pct => {
      const val = maxEVA * pct;
      const label = val >= 1000 ? `R$${(val/1000).toFixed(0)}k` : `R$${val.toFixed(0)}`;
      return `
        <text x="${evaPadL - 6}" y="${evaY(val) + 3}" text-anchor="end" font-size="8" fill="#9ca3af">${label}</text>
        <line x1="${evaPadL}" y1="${evaY(val)}" x2="${evaPadL + evaChartW}" y2="${evaY(val)}" stroke="#f0f0f0" stroke-width="1"/>
      `;
    }).join('');

    // X labels
    const evaXLabels = evaPoints.map((d,i) =>
      `<text x="${evaX(i)}" y="${evaPadT + evaChartH + 18}" text-anchor="middle" font-size="9" font-weight="700" fill="#6b7280">${d.month}</text>`
    ).join('');

    // Dots
    const evaPVDots = evaPoints.map((d,i) =>
      `<circle cx="${evaX(i)}" cy="${evaY(d.pv||0)}" r="3.5" fill="#9ca3af" stroke="white" stroke-width="1.5"/>`
    ).join('');
    const evaEVDots = evaPoints.map((d,i) =>
      `<circle cx="${evaX(i)}" cy="${evaY(d.ev||0)}" r="4" fill="#10b981" stroke="white" stroke-width="2"/>`
    ).join('');
    const evaACDots = evaPoints.map((d,i) =>
      `<circle cx="${evaX(i)}" cy="${evaY(d.ac||0)}" r="4" fill="#ef4444" stroke="white" stroke-width="2"/>`
    ).join('');

    const evaSVG = `
      <svg width="${evaW}" height="${evaH}" xmlns="http://www.w3.org/2000/svg">
        ${evaYLabels}
        ${evaXLabels}
        <!-- VP line (planejado) -->
        <polyline points="${evaPVPoints}" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linejoin="round" stroke-dasharray="5,3"/>
        <!-- EV area -->
        <polygon points="${evaPadL},${evaPadT+evaChartH} ${evaEVPoints} ${evaX(lastEVAIdx)},${evaPadT+evaChartH}" fill="#10b98112"/>
        <!-- EV line (valor agregado) -->
        <polyline points="${evaEVPoints}" fill="none" stroke="#10b981" stroke-width="3" stroke-linejoin="round"/>
        <!-- AC line (custo real) -->
        <polyline points="${evaACPoints}" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linejoin="round"/>
        <!-- EAC projection -->
        <polyline points="${eacLinePoints}" fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="6,4"/>
        <!-- Dots -->
        ${evaPVDots}
        ${evaEVDots}
        ${evaACDots}
        <!-- Legend -->
        <line x1="${evaPadL}" y1="12" x2="${evaPadL+18}" y2="12" stroke="#9ca3af" stroke-width="2" stroke-dasharray="4,3"/>
        <text x="${evaPadL+22}" y="16" font-size="9" font-weight="700" fill="#6b7280">VP (Planejado)</text>
        <line x1="${evaPadL+110}" y1="12" x2="${evaPadL+128}" y2="12" stroke="#10b981" stroke-width="2.5"/>
        <text x="${evaPadL+132}" y="16" font-size="9" font-weight="700" fill="#6b7280">VA (Agregado)</text>
        <line x1="${evaPadL+230}" y1="12" x2="${evaPadL+248}" y2="12" stroke="#ef4444" stroke-width="2"/>
        <text x="${evaPadL+252}" y="16" font-size="9" font-weight="700" fill="#6b7280">CR (Custo Real)</text>
        <line x1="${evaPadL+340}" y1="12" x2="${evaPadL+358}" y2="12" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5,3"/>
        <text x="${evaPadL+362}" y="16" font-size="9" font-weight="700" fill="#6b7280">Tendência (EAC)</text>
      </svg>
    `;

    // SPI from finance view
    const spiVal = spiFinance;
    const cpiVal = cpi;
    const eacVal = eac;
    const vacVal = vac;
    const bacVal = totalCumBAC;

    // Risk analysis
    const risks = [];

    // Only evaluate CPI if there is actual cost data (AC > 0)
    const hasCostData = totalCumAC > 0;
    // Only evaluate SPI if there is planned value data (PV > 0)  
    const hasPlanData = totalCumPV > 0;

    if (hasCostData && parseFloat(cpiVal) < 0.9)
      risks.push({ label: `Estouro Orçamentário (CPI: ${cpiVal})`, nivel: 'CRÍTICO', cor: '#dc2626' });
    else if (hasCostData && parseFloat(cpiVal) < 0.95)
      risks.push({ label: `Custo Acima do Previsto (CPI: ${cpiVal})`, nivel: 'ATENÇÃO', cor: '#d97706' });

    if (hasPlanData && parseFloat(spiVal) < 0.9)
      risks.push({ label: `Atraso no Cronograma (SPI: ${spiVal})`, nivel: 'CRÍTICO', cor: '#dc2626' });
    else if (hasPlanData && parseFloat(spiVal) < 0.95)
      risks.push({ label: `Prazo sob Monitoramento (SPI: ${spiVal})`, nivel: 'ATENÇÃO', cor: '#d97706' });

    if (!hasCostData && !hasPlanData)
      risks.push({ label: 'Sem dados financeiros — importe custos para análise de risco', nivel: 'SEM DADOS', cor: '#6b7280' });
    else if (risks.length === 0)
      risks.push({ label: 'Todos os indicadores dentro da meta operacional', nivel: 'SAUDÁVEL', cor: '#064e3b' });

    const risksRows = risks.map(r => `
      <tr>
        <td><strong>${r.label}</strong></td>
        <td><span style="background:${r.cor}20;color:${r.cor};padding:2px 8px;border-radius:999px;font-size:9px;font-weight:900">${r.nivel}</span></td>
      </tr>
    `).join('');

    // Build SVG S-Curve
    const svgWidth = 700;
    const svgHeight = 220;
    const padL = 50, padR = 20, padT = 20, padB = 40;
    const chartW = svgWidth - padL - padR;
    const chartH = svgHeight - padT - padB;

    const sCurvePoints = chartData.filter(d => d.month !== 'Projeção');
    const totalPoints = sCurvePoints.length;

    // Scale functions
    const xPos = (i: number) => padL + (i / Math.max(totalPoints - 1, 1)) * chartW;
    const yPos = (val: number) => padT + chartH - (Math.min(val, 100) / 100) * chartH;

    // Build polyline points for VP (scheduled) and VA (actual)
    const vpPoints = sCurvePoints.map((d, i) => {
      const pct = bacVal > 0 ? (d.pv / bacVal) * 100 : 0;
      return `${xPos(i)},${yPos(pct)}`;
    }).join(' ');

    const vaPoints = sCurvePoints.map((d, i) => {
      const pct = bacVal > 0 ? (d.ev / bacVal) * 100 : 0;
      return `${xPos(i)},${yPos(pct)}`;
    }).join(' ');

    // Trend: from last VA point to 100% at end
    const lastVAIdx = sCurvePoints.length - 1;
    const lastVAPct = bacVal > 0 ? (sCurvePoints[lastVAIdx]?.ev / bacVal) * 100 : 0;
    const trendPoints = `${xPos(lastVAIdx)},${yPos(lastVAPct)} ${xPos(totalPoints - 1 + 2)},${yPos(100)}`;

    // X axis labels
    const xLabels = sCurvePoints.map((d, i) => 
      `<text x="${xPos(i)}" y="${padT + chartH + 18}" text-anchor="middle" font-size="9" font-weight="700" fill="#6b7280">${d.month}</text>`
    ).join('');

    // Y axis labels
    const yLabels = [0, 25, 50, 75, 100].map(v =>
      `<text x="${padL - 6}" y="${yPos(v) + 3}" text-anchor="end" font-size="8" fill="#9ca3af">${v}%</text>
       <line x1="${padL}" y1="${yPos(v)}" x2="${padL + chartW}" y2="${yPos(v)}" stroke="#f0f0f0" stroke-width="1"/>`
    ).join('');

    // Dots for VA points
    const vaDots = sCurvePoints.map((d, i) => {
      const pct = bacVal > 0 ? (d.ev / bacVal) * 100 : 0;
      return `<circle cx="${xPos(i)}" cy="${yPos(pct)}" r="4" fill="#10b981" stroke="white" stroke-width="2"/>`;
    }).join('');

    const curvaSVG = `
      <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        <!-- Grid -->
        ${yLabels}
        <!-- VP line (planejado) -->
        <polyline points="${vpPoints}" fill="none" stroke="#d1d5db" stroke-width="2" stroke-linejoin="round"/>
        <!-- VA area fill -->
        <polygon points="${padL},${padT + chartH} ${vaPoints} ${xPos(lastVAIdx)},${padT + chartH}" fill="#10b98115"/>
        <!-- VA line (real) -->
        <polyline points="${vaPoints}" fill="none" stroke="#10b981" stroke-width="3" stroke-linejoin="round"/>
        <!-- Trend dashed line -->
        <polyline points="${trendPoints}" fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="6,4"/>
        <!-- Dots -->
        ${vaDots}
        <!-- X labels -->
        ${xLabels}
        <!-- Legend -->
        <line x1="${padL}" y1="10" x2="${padL + 20}" y2="10" stroke="#d1d5db" stroke-width="2"/>
        <text x="${padL + 24}" y="14" font-size="9" font-weight="700" fill="#6b7280">Planejado</text>
        <line x1="${padL + 90}" y1="10" x2="${padL + 110}" y2="10" stroke="#10b981" stroke-width="2"/>
        <text x="${padL + 114}" y="14" font-size="9" font-weight="700" fill="#6b7280">Real</text>
        <line x1="${padL + 150}" y1="10" x2="${padL + 170}" y2="10" stroke="#10b981" stroke-width="2" stroke-dasharray="5,3"/>
        <text x="${padL + 174}" y="14" font-size="9" font-weight="700" fill="#6b7280">Tendência</text>
      </svg>
    `;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório Executivo — ${projectName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #1a1a1a; background: white; font-size: 11px; }
          
          /* CAPA */
          .cover { background: #064e3b; color: white; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 60px 50px; page-break-after: always; }
          .cover-logo { font-size: 13px; font-weight: 900; letter-spacing: 3px; opacity: 0.6; text-transform: uppercase; margin-bottom: 60px; }
          .cover-title { font-size: 42px; font-weight: 900; line-height: 1.1; letter-spacing: -1px; margin-bottom: 16px; }
          .cover-sub { font-size: 16px; opacity: 0.7; margin-bottom: 40px; }
          .cover-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 999px; font-size: 11px; font-weight: 700; }
          .cover-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; }
          .cover-footer { font-size: 11px; opacity: 0.5; }
          
          /* SEÇÕES */
          .section { padding: 32px 50px; border-bottom: 2px solid #f0fdf4; page-break-inside: avoid; }
          .section:last-child { border-bottom: none; }
          .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
          .section-number { width: 28px; height: 28px; background: #064e3b; color: white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; flex-shrink: 0; }
          .section-title { font-size: 16px; font-weight: 900; color: #064e3b; letter-spacing: -0.3px; }
          .section-sub { font-size: 10px; color: #6b7280; font-weight: 600; margin-top: 1px; }
  
          /* KPI GRID */
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 0; }
          .kpi-card { background: #f0fdf4; border-left: 4px solid #064e3b; padding: 14px 16px; border-radius: 8px; }
          .kpi-card.warn { border-left-color: #d97706; background: #fffbeb; }
          .kpi-card.danger { border-left-color: #dc2626; background: #fef2f2; }
          .kpi-label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; margin-bottom: 6px; }
          .kpi-value { font-size: 24px; font-weight: 900; color: #064e3b; line-height: 1; }
          .kpi-value.danger { color: #dc2626; }
          .kpi-sub { font-size: 9px; color: #9ca3af; margin-top: 4px; font-weight: 600; }
  
          /* TABELAS */
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { background: #064e3b; color: white; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; font-size: 8px; padding: 9px 12px; text-align: left; }
          td { padding: 9px 12px; border-bottom: 1px solid #f0fdf4; vertical-align: middle; }
          tr:nth-child(even) td { background: #fafffe; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 8px; font-weight: 900; text-transform: uppercase; }
          .badge-ok { background: #d1fae5; color: #064e3b; }
          .badge-warn { background: #fef3c7; color: #92400e; }
          .badge-err { background: #fee2e2; color: #991b1b; }
  
          /* PROGRESS BAR */
          .progress-bar { background: #e5e7eb; border-radius: 999px; height: 6px; width: 100%; }
          .progress-fill { background: #064e3b; border-radius: 999px; height: 6px; }
  
          /* RESUMO EVM */
          .evm-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .evm-item { background: #f9fafb; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px 16px; }
          .evm-label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 4px; }
          .evm-value { font-size: 18px; font-weight: 900; color: #064e3b; }
  
          /* FOOTER */
          .report-footer { padding: 16px 50px; background: #f9fafb; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #9ca3af; font-weight: 600; }
          
          @media print {
            .cover { min-height: 100vh; }
            .section { page-break-inside: avoid; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
  
        <!-- CAPA -->
        <div class="cover">
          <div class="cover-logo">DB Projetos e Engenharia</div>
          <div>
            <div class="cover-title">Relatório<br/>Executivo<br/>de Obra</div>
            <div class="cover-sub">${projectName}</div>
            <div class="cover-badge">
              <div class="cover-dot"></div>
              Gerado em ${today}
            </div>
          </div>
          <div class="cover-footer">
            Desenvolvido por Daiane Bianco • Planejamento de Obras • DB Projetos e Engenharia
          </div>
        </div>
  
        <!-- SEÇÃO 1: KPIs EVM -->
        <div class="section">
          <div class="section-header">
            <div class="section-number">1</div>
            <div>
              <div class="section-title">Indicadores de Desempenho (EVM)</div>
              <div class="section-sub">Earned Value Management — Valores acumulados do projeto</div>
            </div>
          </div>
          <div class="kpi-grid">
            <div class="kpi-card ${hasPlanData && parseFloat(spiVal)<0.9?'danger':hasPlanData && parseFloat(spiVal)<0.95?'warn':''}">
              <div class="kpi-label">IDE — Índice de Prazo (SPI)</div>
              <div class="kpi-value ${hasPlanData && parseFloat(spiVal)<0.95?'danger':''}">${hasPlanData ? spiVal : '—'}</div>
              <div class="kpi-sub">${!hasPlanData ? 'Sem avanço planejado informado' : parseFloat(spiVal)>=1?'✓ Dentro do prazo':parseFloat(spiVal)>=0.95?'⚠ Atenção':'⚠ Abaixo do planejado'}</div>
            </div>
            <div class="kpi-card ${hasCostData && parseFloat(cpiVal)<0.9?'danger':hasCostData && parseFloat(cpiVal)<0.95?'warn':''}">
              <div class="kpi-label">IDC — Índice de Custo (CPI)</div>
              <div class="kpi-value ${hasCostData && parseFloat(cpiVal)<0.95?'danger':''}">${hasCostData ? cpiVal : '—'}</div>
              <div class="kpi-sub">${!hasCostData ? 'Sem custo real informado' : parseFloat(cpiVal)>=1?'✓ Dentro do orçamento':parseFloat(cpiVal)>=0.95?'⚠ Atenção':'⚠ Acima do orçamento'}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">ONT — Orçamento no Término (BAC)</div>
              <div class="kpi-value">R$ ${(bacVal/1000).toFixed(0)}k</div>
              <div class="kpi-sub">Orçamento total aprovado</div>
            </div>
            <div class="kpi-card ${vacVal<0?'danger':''}">
              <div class="kpi-label">VNT — Variação no Término (VAC)</div>
              <div class="kpi-value ${vacVal<0?'danger':''}">R$ ${(vacVal/1000).toFixed(0)}k</div>
              <div class="kpi-sub">${vacVal<0?'⚠ Projeção de estouro':'✓ Dentro do orçamento'}</div>
            </div>
          </div>
        </div>
  
        <!-- SEÇÃO 2: CURVA S -->
        <div class="section">
          <div class="section-header">
            <div class="section-number">2</div>
            <div>
              <div class="section-title">Curva S — Planejado vs. Realizado</div>
              <div class="section-sub">Avanço físico acumulado com linha de tendência projetada</div>
            </div>
          </div>
          ${curvaSVG}
          <table style="margin-top:16px">
            <thead>
              <tr>
                <th>Mês</th>
                <th>VP Acum. (R$)</th>
                <th>VA Acum. (R$)</th>
                <th>CR Acum. (R$)</th>
                <th>% Planejado</th>
                <th>% Real</th>
                <th>Variação</th>
              </tr>
            </thead>
            <tbody>
              ${chartData.filter(d=>d.month!=='Projeção').map((d,i,arr) => {
                const pct_plan = bacVal > 0 ? ((d.pv||0)/bacVal*100).toFixed(1) : '0.0';
                const pct_real = bacVal > 0 ? ((d.ev||0)/bacVal*100).toFixed(1) : '0.0';
                const vari = (parseFloat(pct_real) - parseFloat(pct_plan)).toFixed(1);
                return `<tr>
                  <td><strong>${d.month}</strong></td>
                  <td>R$ ${((d.pv||0)/1000).toFixed(1)}k</td>
                  <td>R$ ${((d.ev||0)/1000).toFixed(1)}k</td>
                  <td>R$ ${((d.ac||0)/1000).toFixed(1)}k</td>
                  <td>${pct_plan}%</td>
                  <td>${pct_real}%</td>
                  <td style="color:${parseFloat(vari)>=0?'#064e3b':'#dc2626'};font-weight:900">
                    ${parseFloat(vari)>=0?'+':''}${vari}%
                  </td>
                </tr>`;
              }).join('')}
              <tr style="background:#f0fdf4;font-weight:900">
                <td><strong>PROJEÇÃO</strong></td>
                <td colspan="2">—</td>
                <td>R$ ${(eacVal/1000).toFixed(1)}k</td>
                <td>100%</td>
                <td>—</td>
                <td style="color:${vacVal<0?'#dc2626':'#064e3b'};font-weight:900">
                  VAC: R$ ${(vacVal/1000).toFixed(0)}k
                </td>
              </tr>
            </tbody>
          </table>
        </div>
  
        <!-- SEÇÃO 3: ANÁLISE DE VALOR AGREGADO -->
        <div class="section">
          <div class="section-header">
            <div class="section-number">3</div>
            <div>
              <div class="section-title">Análise de Valor Agregado (EVA)</div>
              <div class="section-sub">Comparativo acumulado entre VP, VA e CR com projeção EAC</div>
            </div>
          </div>
          ${evaSVG}
          <table style="margin-top:16px">
            <thead>
              <tr>
                <th>Mês</th>
                <th>VP — Valor Planejado</th>
                <th>VA — Valor Agregado</th>
                <th>CR — Custo Real</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${evaRows}</tbody>
          </table>
        </div>
  
        <!-- SEÇÃO 4: ATIVIDADES -->
        <div class="section">
          <div class="section-header">
            <div class="section-number">4</div>
            <div>
              <div class="section-title">Detalhamento das Atividades</div>
              <div class="section-sub">Status individual de cada atividade do cronograma</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Atividade</th>
                <th>Mês</th>
                <th>% Real</th>
                <th>% Planejado</th>
                <th>Peso Real (t)</th>
                <th>Peso Plan. (t)</th>
                <th>Custo Plan.</th>
                <th>Custo Real</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              ${financialTasksForPDF?.map((t: any) => `
                <tr>
                  <td><strong>${t.name || '—'}</strong></td>
                  <td>${t.month || '—'}</td>
                  <td>${(t.progress || 0).toFixed(1)}%</td>
                  <td>${(t.plannedProgress || 0).toFixed(1)}%</td>
                  <td>${(t.actualWeight || 0).toFixed(0)}</td>
                  <td>${(t.plannedWeight || 0).toFixed(0)}</td>
                  <td>R$ ${((t.bac || 0)/1000).toFixed(1)}k</td>
                  <td>R$ ${((t.ac || 0)/1000).toFixed(1)}k</td>
                  <td>
                    <span class="badge ${t.situation==='ATRASO'?'badge-err':t.situation==='ADIANTADO'?'badge-ok':'badge-warn'}">
                      ${t.situation || 'NO PRAZO'}
                    </span>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="9" style="text-align:center;color:#9ca3af">Sem dados</td></tr>'}
            </tbody>
          </table>
        </div>
  
        <!-- SEÇÃO 5: RECURSOS -->
        <div class="section">
          <div class="section-header">
            <div class="section-number">5</div>
            <div>
              <div class="section-title">Gestão de Recursos Humanos</div>
              <div class="section-sub">Alocação mensal de mão de obra por função</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Engenheiros</th>
                <th>Montadores</th>
                <th>Ajudantes</th>
                <th>Soldadores</th>
                <th>Total Trabalhadores</th>
                <th>Equipamentos</th>
              </tr>
            </thead>
            <tbody>${resourcesRows}</tbody>
          </table>
        </div>
  
        <!-- SEÇÃO 6: GESTÃO DE RISCOS -->
        <div class="section">
          <div class="section-header">
            <div class="section-number">6</div>
            <div>
              <div class="section-title">Gestão de Riscos</div>
              <div class="section-sub">Riscos identificados com base nos indicadores de desempenho</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Risco Identificado</th>
                <th>Nível</th>
              </tr>
            </thead>
            <tbody>${risksRows}</tbody>
          </table>
        </div>
  
        <!-- RODAPÉ -->
        <div class="report-footer">
          <span>DB Projetos e Engenharia — ${projectName}</span>
          <span>Relatório gerado em ${today} • Desenvolvido por Daiane Bianco</span>
        </div>
  
      </body>
      </html>
    `;
  
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => {
        setTimeout(() => {
          win.print();
          setTimeout(() => URL.revokeObjectURL(url), 15000);
        }, 500);
      };
    }
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8 pb-24"
      >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-secondary font-bold text-sm tracking-widest uppercase mb-1">{t('costPerformance')}</p>
          <h1 className="text-4xl font-extrabold text-primary tracking-tight font-headline">{t('budgetVsActual')}</h1>
          {activeProjectId && (
            <div className="flex items-center gap-3 mt-2">
              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-full border border-primary/20">
                Projeto: {projects.find(p => p.id === activeProjectId)?.name || 'Ativo'}
              </span>
              <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border ${
                projects.find(p => p.id === activeProjectId)?.sourceType === 'excel' ? 'bg-green-100 text-green-700 border-green-200' :
                'bg-blue-100 text-blue-700 border-blue-200'
              }`}>
                Fonte: {projects.find(p => p.id === activeProjectId)?.sourceType === 'excel' ? 'Excel' : 'MS Project'}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border border-outline-variant/20 text-primary rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-surface-container-high transition-all"
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>
          {userRole === 'admin' && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs shadow-lg hover:bg-primary/90 transition-all"
              >
                <Plus className="w-4 h-4" />
                IMPORTAR EXCEL
              </button>
              <button 
                onClick={() => msProjectInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-xl font-bold text-xs shadow-lg hover:bg-secondary/90 transition-all"
              >
                <Plus className="w-4 h-4" />
                IMPORTAR MS PROJECT
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : !activeProjectId ? (
        <div className="bg-surface-container-lowest p-12 rounded-3xl border-2 border-dashed border-outline-variant/20 text-center">
          <CircleDollarSign className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-primary mb-2">Nenhum Projeto Ativo</h3>
          <p className="text-sm text-on-surface-variant mb-6">
            {userRole === 'admin' ? 'Selecione um cliente ou faça o upload de um cronograma para iniciar.' : 'Aguarde o administrador realizar o upload dos seus dados.'}
          </p>
          {userRole === 'admin' && (
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg hover:bg-primary/90 transition-all"
              >
                <Plus className="w-5 h-5" />
                IMPORTAR EXCEL
              </button>
              <button 
                onClick={() => msProjectInputRef.current?.click()}
                className="flex items-center gap-2 px-6 py-3 bg-secondary text-white rounded-xl font-bold text-sm shadow-lg hover:bg-secondary/90 transition-all"
              >
                <Plus className="w-5 h-5" />
                IMPORTAR MS PROJECT
              </button>
            </div>
          )}
        </div>
      ) : financialData.length === 0 ? (
        <div className="bg-surface-container-lowest p-12 rounded-3xl border-2 border-dashed border-outline-variant/20 text-center">
          <Target className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-primary mb-2">Sem dados financeiros</h3>
          <p className="text-sm text-on-surface-variant">
            {userRole === 'admin' ? 'Selecione um cliente e faça o upload do cronograma para gerar os indicadores.' : 'Aguarde o administrador realizar o upload dos seus dados.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)] border-l-4 border-primary">
              <p className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-wider mb-2">{t('cpi')}</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">{cpi}</span>
                {parseFloat(cpi) < 1 ? <TrendingDown className="w-4 h-4 text-error" /> : <TrendingUp className="w-4 h-4 text-secondary" />}
              </div>
              <p className={`text-[10px] mt-1 font-bold ${parseFloat(cpi) < 1 ? 'text-error' : 'text-secondary'}`}>
                {parseFloat(cpi) < 1 ? `${((1 - parseFloat(cpi)) * 100).toFixed(0)}% ${t('overBudget')}` : 'Dentro do Orçamento'}
              </p>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)] border-l-4 border-secondary">
              <p className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-wider mb-2">{t('bac')}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-on-surface-variant">R$</span>
                <span className="text-2xl font-bold text-primary">{(latestData.bac / 1000).toFixed(0)}k</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)] border-l-4 border-tertiary-fixed-dim">
              <p className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-wider mb-2">{t('eac')}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-on-surface-variant">R$</span>
                <span className="text-2xl font-bold text-primary">{(eac / 1000).toFixed(0)}k</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)] border-l-4 border-primary-container">
              <p className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-wider mb-2">{t('vac')}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-on-surface-variant">R$</span>
                <span className={`text-2xl font-bold ${vac < 0 ? 'text-error' : 'text-secondary'}`}>
                  {(vac / 1000).toFixed(0)}k
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 bg-surface-container-lowest p-8 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)]">
              <h3 className="text-primary font-headline font-extrabold text-xl mb-8">{t('earnedValueAnalysis')}</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#4b5563' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#4b5563' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#064e3b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 600, paddingBottom: '20px' }} />
                    <Line type="monotone" dataKey="pv" stroke="#d1d5db" strokeWidth={2} name={t('plannedValue')} dot={false} />
                    <Line type="monotone" dataKey="ev" stroke="#10b981" strokeWidth={3} name={t('earnedValue')} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="ac" stroke="#ef4444" strokeWidth={2} name={t('actualCost')} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="projection" stroke="#ef4444" strokeDasharray="5 5" strokeWidth={2} name="Tendência (EAC)" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-primary text-on-primary p-6 rounded-xl shadow-lg">
                <h3 className="font-bold text-lg mb-4 font-headline">{t('dataEntryTitle')}</h3>
                <p className="text-xs opacity-80 mb-4 leading-relaxed">{t('dataEntryDesc')}</p>
                <ul className="space-y-4">
                  <li className="flex gap-3">
                    <div className="p-2 bg-white/10 rounded-lg h-fit"><Wallet className="w-4 h-4" /></div>
                    <p className="text-[10px] leading-tight">{t('manualEntry')}</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="p-2 bg-white/10 rounded-lg h-fit"><Target className="w-4 h-4" /></div>
                    <p className="text-[10px] leading-tight">{t('excelIntegration')}</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="p-2 bg-white/10 rounded-lg h-fit"><TrendingUp className="w-4 h-4" /></div>
                    <p className="text-[10px] leading-tight">{t('apiIntegration')}</p>
                  </li>
                </ul>
              </div>

              <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10">
                <h3 className="font-bold text-primary mb-4 font-headline">{t('costHealth')}</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-on-surface-variant">{t('cv')}</span>
                    <span className={`text-sm font-bold ${latestData.ev - latestData.ac < 0 ? 'text-error' : 'text-secondary'}`}>
                      R$ {(latestData.ev - latestData.ac).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-on-surface-variant">{t('sv')}</span>
                    <span className={`text-sm font-bold ${latestData.ev - latestData.pv < 0 ? 'text-error' : 'text-secondary'}`}>
                      R$ {(latestData.ev - latestData.pv).toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-outline-variant/10">
                    <p className="text-[10px] text-on-surface-variant italic leading-tight">
                      * {t('pmbokNote')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {userRole === 'admin' && (
        <section className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)] border border-primary/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="space-y-1">
              <h3 className="text-primary font-headline font-extrabold text-2xl tracking-tight">{t('dataEntryTitle')}</h3>
              <p className="text-sm text-on-surface-variant max-w-2xl">{t('dataEntryDesc')}</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-lg border border-primary/10">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Painel de Gestão de Clientes</span>
            </div>
          </div>

          {uploadError && (
            <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-xl text-error flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-xs font-bold">{uploadError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {selectedClientId ? (
              <>
                <div 
                  onClick={() => {
                    if (!activeProjectId) {
                      alert('Selecione ou importe um projeto primeiro.');
                      return;
                    }
                    setShowManualEntry(true);
                  }}
                  className="p-6 rounded-2xl border border-outline-variant/20 bg-surface-container-low hover:border-primary/30 transition-all group cursor-pointer"
                >
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-bold text-primary mb-2">{t('manualEntry').split(':')[0]}</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">{t('manualEntry').split(':')[1]}</p>
            </div>

            <div className="p-6 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all group relative overflow-hidden flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-7 h-7 text-white" />
              </div>
              <h4 className="font-bold text-primary mb-2">Importação de Cronograma</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-4">Selecione o arquivo Excel ou MS Project para atualizar o projeto.</p>
              
              <button 
                onClick={downloadTemplate}
                className="mb-4 flex items-center gap-2 text-[10px] font-bold text-primary hover:underline"
              >
                <Download className="w-3 h-3" />
                Baixar Modelo Excel
              </button>

              <div className="mt-auto space-y-2 w-full">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                />
                <input 
                  type="file" 
                  ref={msProjectInputRef} 
                  onChange={handleMsProjectUpload} 
                  accept=".xml, .mpp" 
                  className="hidden" 
                />
                <button 
                  onClick={() => {
                    if (!selectedClientId) {
                      setUploadError("Por favor, selecione um cliente no topo da tela antes de importar.");
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploading}
                  className={`w-full py-3 rounded-xl border border-primary/20 shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    uploadSuccess ? 'bg-green-500 text-white border-green-500' : 
                    isUploading ? 'bg-primary/10 text-primary' : 'bg-white hover:bg-primary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Processando...</span>
                    </>
                  ) : uploadSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Sucesso!</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Importar Excel</span>
                    </>
                  )}
                </button>
                <button 
                  onClick={() => {
                    if (!selectedClientId) {
                      setUploadError("Por favor, selecione um cliente no topo da tela antes de importar.");
                      return;
                    }
                    msProjectInputRef.current?.click();
                  }}
                  disabled={isUploading}
                  className="w-full py-3 bg-secondary text-on-secondary rounded-xl flex items-center justify-center gap-2 hover:bg-secondary/90 transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Importar MS Project (.XML)</span>
                </button>
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-outline-variant/20 bg-surface-container-low hover:border-primary/30 transition-all group cursor-pointer">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 text-secondary" />
              </div>
              <h4 className="font-bold text-primary mb-2">{t('apiIntegration').split(':')[0]}</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">{t('apiIntegration').split(':')[1]}</p>
            </div>
          </>
        ) : (
          <div className="col-span-3 p-12 rounded-3xl border-2 border-dashed border-outline-variant/20 bg-surface-container-low flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-6">
              <Target className="w-8 h-8 text-primary/40" />
            </div>
            <h4 className="text-xl font-headline font-extrabold text-primary mb-2">Nenhuma Obra Ativa</h4>
            <p className="text-sm text-on-surface-variant max-w-md">
              Selecione uma obra no menu superior ou cadastre uma nova para habilitar as ferramentas de importação e gestão.
            </p>
          </div>
        )}
      </div>

          <div className="mt-8 p-6 bg-white rounded-2xl border border-outline-variant/10 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <h4 className="font-headline font-extrabold text-primary tracking-tight">{t('templateGuide')}</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: t('colTask'), desc: 'Identificação da atividade' },
                { label: t('colPlannedStart'), desc: 'Data base do contrato' },
                { label: t('colPlannedFinish'), desc: 'Data base do contrato' },
                { label: t('colPlannedCost'), desc: 'Orçamento total (BAC)' },
                { label: t('colActualStart'), desc: 'Início real em campo' },
                { label: t('colActualFinish'), desc: 'Término real em campo' },
                { label: t('colPlannedProgress'), desc: 'O que deveria estar pronto' },
                { label: t('colProgress'), desc: 'O que realmente está pronto' },
                { label: t('colActualCost'), desc: 'Custo real incorrido (AC)' },
              ].map((col, i) => (
                <div key={i} className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/5">
                  <p className="text-[10px] font-black text-primary uppercase mb-1">{col.label}</p>
                  <p className="text-[9px] text-on-surface-variant leading-tight">{col.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </motion.div>

      {/* MS Project Preview Modal */}
      {previewData && (
        <ProjectPreviewModal 
          previewData={previewData}
          onClose={() => {
            setPreviewData(null);
            setUploadError(null);
          }}
          onConfirm={confirmMsProjectImport}
          isImporting={isImporting}
          uploadError={uploadError}
        />
      )}

      {/* Import Options Modal */}
      {showImportOptions && pendingImportData && (
        <ImportOptionsModal 
          projectName={pendingImportData.name}
          sourceType={pendingImportData.type}
          onClose={() => setShowImportOptions(false)}
          onConfirm={handleImportConfirm}
        />
      )}

      {/* Success Toast */}
      {uploadSuccess && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-8 right-8 z-[200] bg-green-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-headline font-bold"
        >
          <CheckCircle2 className="w-6 h-6" />
          Importação concluída com sucesso!
        </motion.div>
      )}

      {showManualEntry && activeProjectId && (
        <ManualEntryModal
          projectId={activeProjectId}
          clientId={selectedClientId}
          ownerId={user?.uid || ''}
          onClose={() => setShowManualEntry(false)}
        />
      )}
    </>
  );
};

interface ProjectPreviewModalProps {
  previewData: any;
  onClose: () => void;
  onConfirm: () => void;
  isImporting: boolean;
  uploadError: string | null;
}

const ProjectPreviewModal: React.FC<ProjectPreviewModalProps> = ({ previewData, onClose, onConfirm, isImporting, uploadError }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-container-lowest w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl border border-outline-variant/20 flex flex-col"
      >
        <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-headline font-extrabold text-primary">
              Pré-visualização: {previewData.name}
            </h3>
            <p className="text-sm text-on-surface-variant mt-1">
              {previewData.tasks.length} tarefas encontradas. Verifique os dados antes de confirmar.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
            <AlertCircle className="w-6 h-6 text-on-surface-variant" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant uppercase font-black tracking-tighter">
                <th className="p-2 border border-outline-variant/10">WBS</th>
                <th className="p-2 border border-outline-variant/10">Nome</th>
                <th className="p-2 border border-outline-variant/10">Início</th>
                <th className="p-2 border border-outline-variant/10">Término</th>
                <th className="p-2 border border-outline-variant/10">Progresso</th>
                <th className="p-2 border border-outline-variant/10">Custo</th>
              </tr>
            </thead>
            <tbody>
              {previewData.tasks.slice(0, 100).map((task: any, idx: number) => (
                <tr key={idx} className={`hover:bg-surface-container-low transition-colors ${task.isSummary ? "font-bold bg-primary/5" : ""}`}>
                  <td className="p-2 border border-outline-variant/10">{task.wbs}</td>
                  <td className="p-2 border border-outline-variant/10">
                    <span style={{ marginLeft: `${(task.outlineLevel - 1) * 8}px` }}>
                      {task.name}
                    </span>
                  </td>
                  <td className="p-2 border border-outline-variant/10">{task.start?.split('T')[0]}</td>
                  <td className="p-2 border border-outline-variant/10">{task.finish?.split('T')[0]}</td>
                  <td className="p-2 border border-outline-variant/10">{task.progress}%</td>
                  <td className="p-2 border border-outline-variant/10">R$ {task.cost?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {previewData.tasks.length > 100 && (
            <p className="text-center text-on-surface-variant mt-4 font-bold italic">
              Exibindo as primeiras 100 de {previewData.tasks.length} tarefas...
            </p>
          )}
        </div>

        <div className="p-6 border-t border-outline-variant/10 flex flex-col gap-4">
          {/* Error message inside modal if any */}
          {uploadError && (
            <div className="bg-error/10 text-error p-4 rounded-xl flex items-center gap-3 text-xs font-bold border border-error/20">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {uploadError}
            </div>
          )}
          
          <div className="flex justify-end gap-4">
            <button 
              onClick={onClose}
              disabled={isImporting}
              className="px-6 py-2 text-on-surface-variant font-bold hover:bg-surface-container-high rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              onClick={onConfirm}
              disabled={isImporting}
              className="flex items-center gap-2 px-8 py-2 bg-primary text-on-primary font-headline font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 min-w-[200px] justify-center"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Confirmar Importação</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
