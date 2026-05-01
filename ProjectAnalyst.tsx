import React, { useState } from 'react';
import { BrainCircuit, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProjectAnalystProps {
  projectData: {
    projectName: string;
    spi: string;
    cpi: string;
    eac: number;
    vac: number;
    bac: number;
    progress: string;
    totalActualWeight: number;
    totalPlannedWeight: number;
    avgMPStatus: number;
    criticalTasksCount: number;
    criticalTaskNames: string[];
    tasks: Array<{
      name: string;
      month: string;
      progress: number;
      plannedProgress: number;
      situation: string;
      status: string;
      actualWeight: number;
      plannedWeight: number;
    }>;
    months: string[];
    latestMonth: string;
  };
}

export const ProjectAnalyst: React.FC<ProjectAnalystProps> = ({ projectData }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [expanded, setExpanded] = useState(true);

  const generateAnalysis = async () => {
    setLoading(true);
    setError('');
    setAnalysis('');

    const prompt = `Você é um analista sênior de planejamento e controle de obras com 15 anos de experiência em projetos industriais e de montagem metálica. 

Analise os dados abaixo de um projeto de obra e gere um relatório executivo completo em português do Brasil. Seja técnico, direto e objetivo — como um analista real apresentaria para a contratante.

## DADOS DO PROJETO
- Nome: ${projectData.projectName}
- Período analisado: ${projectData.months.join(', ')}
- Mês de referência: ${projectData.latestMonth}

## INDICADORES DE DESEMPENHO (EVM)
- SPI (Índice de Desempenho de Prazo): ${projectData.spi} ${parseFloat(projectData.spi) >= 1 ? '✓ Dentro do prazo' : '⚠ Abaixo do planejado'}
- CPI (Índice de Desempenho de Custo): ${projectData.cpi} ${parseFloat(projectData.cpi) >= 1 ? '✓ Dentro do orçamento' : '⚠ Acima do orçamento'}
- BAC (Orçamento Total): R$ ${(projectData.bac / 1000).toFixed(0)}k
- EAC (Estimativa no Término): R$ ${(projectData.eac / 1000).toFixed(0)}k
- VAC (Variação no Término): R$ ${(projectData.vac / 1000).toFixed(0)}k ${projectData.vac < 0 ? '⚠ ESTOURO' : '✓ Dentro'}
- Avanço Físico Geral: ${projectData.progress}%
- Peso Montado: ${projectData.totalActualWeight.toFixed(1)}t de ${projectData.totalPlannedWeight.toFixed(1)}t planejadas
- Status MP (Matéria-Prima): ${projectData.avgMPStatus.toFixed(1)}%

## ATIVIDADES CRÍTICAS EM ATRASO (${projectData.criticalTasksCount})
${projectData.criticalTaskNames.length > 0 ? projectData.criticalTaskNames.join(', ') : 'Nenhuma atividade crítica identificada'}

## DETALHAMENTO DAS ATIVIDADES
${projectData.tasks.map(t => 
  `- ${t.name} (${t.month}): Real ${t.progress.toFixed(0)}% vs Planejado ${t.plannedProgress.toFixed(0)}% | ${t.situation} | Peso: ${t.actualWeight}t/${t.plannedWeight}t | Status: ${t.status}`
).join('\n')}

---

Gere um relatório executivo com as seguintes seções (use os títulos exatos):

**1. SITUAÇÃO GERAL DO PROJETO**
Resumo executivo de 2-3 parágrafos sobre a saúde do projeto.

**2. ANÁLISE DE PRAZO**
Interpretação do SPI, atividades em atraso, impacto no cronograma mestre e caminho crítico.

**3. ANÁLISE DE CUSTO**
Interpretação do CPI, projeção de estouro ou economia, causas prováveis.

**4. ANÁLISE FÍSICA (PESO MONTADO)**
Status da montagem, ritmo de execução e tendência.

**5. RISCOS IDENTIFICADOS**
Liste de 2 a 4 riscos concretos com base nos dados, do mais crítico ao menos crítico.

**6. RECOMENDAÇÕES**
De 3 a 5 ações concretas e priorizadas que o gestor deve tomar imediatamente.

**7. PROGNÓSTICO**
Perspectiva para o próximo período com base na tendência atual.

Escreva como um profissional — sem exageros, sem frases genéricas como "é importante ressaltar". Vá direto ao ponto.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': 'YOUR_ANTHROPIC_API_KEY', // Placeholder as requested, but realistically this needs a proxy/backend
          'anthropic-version': '2023-06-01',
          'dangerouslyAllowBrowser': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20240620', // Fixing model name to a real one
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const text = data.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');
      
      setAnalysis(text);
      setExpanded(true);
    } catch (err: any) {
      setError('Erro ao gerar análise. Verifique sua conexão e tente novamente. (Nota: requer chave API da Anthropic configurada)');
      console.error('AI Analyst error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Format markdown-like text to JSX
  const formatAnalysis = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && (line.endsWith('**') || line.includes('**'))) {
        return (
          <h4 key={i} className="font-headline font-extrabold text-primary text-sm uppercase tracking-widest mt-5 mb-2 border-l-4 border-primary pl-3">
            {line.replace(/\*\*/g, '')}
          </h4>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <li key={i} className="text-sm text-on-surface leading-relaxed ml-4 mb-1 list-disc">
            {line.slice(2)}
          </li>
        );
      }
      if (line.trim() === '') return <div key={i} className="h-2" />;
      return (
        <p key={i} className="text-sm text-on-surface leading-relaxed mb-1">
          {line}
        </p>
      );
    });
  };

  const spiNum = parseFloat(projectData.spi);
  const cpiNum = parseFloat(projectData.cpi);
  const healthColor = spiNum >= 0.95 && cpiNum >= 0.95 ? 'text-secondary' : spiNum >= 0.85 && cpiNum >= 0.85 ? 'text-amber-500' : 'text-error';
  const healthLabel = spiNum >= 0.95 && cpiNum >= 0.95 ? 'Saudável' : spiNum >= 0.85 && cpiNum >= 0.85 ? 'Atenção' : 'Crítico';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-container-lowest rounded-xl shadow-[0_12px_32px_rgba(6,78,59,0.06)] border border-outline-variant/10 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
        <div className="flex items-center gap-3 text-left">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BrainCircuit className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-primary font-headline font-extrabold text-lg tracking-tight">
              Analista de Planejamento IA
            </h3>
            <p className="text-xs text-on-surface-variant font-medium">
              Análise executiva gerada por inteligência artificial com base nos dados reais da obra
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {analysis && (
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-surface-container-low ${healthColor}`}>
              {healthLabel}
            </span>
          )}
          <button
            onClick={generateAnalysis}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {loading ? 'Analisando...' : analysis ? 'Reanalisar' : 'Gerar Análise'}
          </button>
          {analysis && (
            <button onClick={() => setExpanded(!expanded)} className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-8 flex flex-col items-center justify-center gap-4"
          >
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-primary rounded-full"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
            <p className="text-sm text-on-surface-variant font-medium animate-pulse">
              Analisando indicadores, atividades e tendências da obra...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {error && (
        <div className="p-6 text-sm text-error bg-error/5 border-t border-error/10 font-medium">
          {error}
        </div>
      )}

      {/* Analysis content */}
      <AnimatePresence>
        {analysis && expanded && !loading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-6 overflow-hidden"
          >
            <div className="prose prose-sm max-w-none text-left">
              {formatAnalysis(analysis)}
            </div>
            <div className="mt-6 pt-4 border-t border-outline-variant/10 flex items-center justify-between">
              <p className="text-[10px] text-on-surface-variant/50 font-medium">
                Análise gerada automaticamente com base nos dados importados. Valide com o gestor responsável.
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(analysis);
                }}
                className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest"
              >
                Copiar relatório
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!analysis && !loading && !error && (
        <div className="p-8 text-center">
          <BrainCircuit className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-3" />
          <p className="text-sm text-on-surface-variant font-medium">
            Clique em <strong>"Gerar Análise"</strong> para receber um relatório executivo completo da obra,
            incluindo análise de prazo, custo, riscos e recomendações.
          </p>
        </div>
      )}
    </motion.div>
  );
};
