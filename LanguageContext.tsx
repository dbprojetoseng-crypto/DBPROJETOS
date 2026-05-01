import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'pt' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  pt: {
    // Navigation
    dashboard: 'Painel',
    schedule: 'Cronograma',
    kanban: 'Kanban',
    resources: 'Recursos',
    finance: 'Financeiro',
    
    // Dashboard
    phase: 'VISÃO GERAL',
    overview: 'Visão Geral do Projeto',
    last30: 'Últimos 30 Dias',
    quarterly: 'Trimestral',
    totalProgress: 'Progresso Total',
    thisWeek: 'ESTA SEMANA',
    onTrack: 'Referência:',
    scheduledVsActual: 'Planejado vs. Realizado',
    trackingDesc: 'Acompanhamento da porcentagem cumulativa de conclusão de tarefas ao longo do tempo.',
    scheduled: 'Planejado',
    actual: 'Realizado',
    today: 'Hoje',
    lag: 'Atraso',
    criticalAlerts: 'Alertas de Caminho Crítico',
    highPriority: 'Alta Prioridade',
    advisory: 'Aviso',
    activeWorkPlan: 'Plano de Trabalho Ativo',
    viewGantt: 'Ver Gantt Completo',
    taskDetail: 'Detalhe da Tarefa',
    team: 'Equipe',
    dueDate: 'Data de Entrega',
    status: 'Status',
    logWork: 'Registrar Trabalho Diário',
    
    // Statuses
    inProgress: 'Em Andamento',
    upcoming: 'Próximo',
    blocked: 'Bloqueado',
    completed: 'Concluído',
    pending: 'Pendente',
    
    // Resources
    utilizationMetrics: 'Métricas de Utilização',
    resourceHistogram: 'Histograma de Recursos',
    daily: 'Diário',
    weekly: 'Semanal',
    monthly: 'Mensal',
    exportPdf: 'Exportar PDF',
    totalCapacity: 'Capacidade Total',
    manHours: 'Homem-Hora',
    avgUtilization: 'Utilização Média',
    equipmentLoad: 'Carga de Equipamento',
    unitsActive: 'Unidades Ativas',
    criticalPathGap: 'Lacuna do Caminho Crítico',
    deficit: 'déficit',
    laborDistribution: 'Distribuição de Mão de Obra',
    engineers: 'Engenheiros',
    laborers: 'Trabalhadores',
    operators: 'Operadores',
    optimizationAlert: 'Alerta de Otimização',
    optimizationDesc: 'A semana 37 mostra uma sobrealocação de 12% para Operadores. Considere deslocar as fases de terraplenagem para a Semana 39.',
    runReallocation: 'Executar Realocação',
    resourceHealth: 'Saúde dos Recursos',
    equipmentUptime: 'Tempo de Atividade do Equipamento',
    skillMatchRate: 'Taxa de Correspondência de Habilidades',
    safetyCompliance: 'Conformidade de Segurança',
    equipmentBreakdown: 'Detalhamento de Alocação de Equipamentos',
    inDemand: 'Em Demanda',
    optimal: 'Ideal',
    projectMilestones: 'Marcos do Projeto',
    targetMet: 'Meta Atingida',
    
    // Schedule
    masterSchedule: 'Cronograma Mestre',
    structuralDev: 'Desenvolvimento Estrutural e Acabamento',
    foundation: 'Fundação',
    structure: 'Estrutura',
    finishing: 'Acabamento',
    milestoneReached: 'Marco Alcançado',
    sitePrep: 'Assinatura Final da Preparação do Local',
    week: 'Semana',
    done: 'Concluído',
    lvl1Columns: 'Colunas do Nível 1 Concretadas',
    requiresProcurement: 'Requer Aquisição de Material até 01 de Set',
    potentialDelay: 'Atraso Potencial: Suprimento de Aço',
    logisticsBottleneck: 'Gargalos logísticos podem impactar a data final da Fase: Estrutura em +4 dias.',
    latestReport: 'Último Relatório',
    safetyAudit: 'Auditoria de Segurança Estrutural',
    active: 'Ativos',
    onTrackBudget: 'No Orçamento',
    budget: 'Orçamento',
    
    // Finance
    financeModule: 'Módulo Financeiro',
    comingSoon: 'Em breve na Fase 5',
    
    // Specific Alerts
    steelDelayTitle: 'Atraso no Aço de Reforço',
    steelDelayDesc: 'Remessa #284 retida no porto. Impacto estimado de 3 dias no cronograma de concretagem da laje.',
    hvacShortageTitle: 'Escassez de Subcontratado de HVAC',
    hvacShortageDesc: 'A frequência da equipe caiu 20% esta semana. Monitorando o impacto na instalação de dutos.',
    
    // Tasks
    foundationPileCapping: 'Capeamento de Estacas de Fundação',
    electricMainLinePull: 'Puxamento da Rede Elétrica Principal',
    plumbingPressureTest: 'Teste de Pressão Hidráulica',
    // PMBOK KPIs
    spi: 'IDE (Índice de Desempenho de Prazo)',
    cpi: 'IDC (Índice de Desempenho de Custos)',
    sv: 'VP (Variação de Prazo)',
    cv: 'VC (Variação de Custos)',
    bac: 'ONT (Orçamento no Término)',
    eac: 'EPT (Estimativa no Término)',
    etc: 'ENT (Estimativa para Terminar)',
    vac: 'VNT (Variação no Término)',
    
    // Finance/Cost
    budgetVsActual: 'Orçado vs. Realizado',
    costPerformance: 'Desempenho de Custos',
    plannedValue: 'VP (Valor Planejado)',
    earnedValue: 'VA (Valor Agregado)',
    actualCost: 'CR (Custo Real)',
    
    // Risks
    riskManagement: 'Gestão de Riscos',
    riskLevel: 'Nível de Risco',
    mitigation: 'Mitigação',
    probability: 'Probabilidade',
    impact: 'Impacto',
    high: 'Alto',
    medium: 'Médio',
    low: 'Baixo',
    
    // Data Entry Explanation
    dataEntryTitle: 'Como funciona a entrada de dados?',
    dataEntryDesc: 'Para vender este serviço, você pode oferecer três modalidades de integração:',
    manualEntry: 'Entrada Manual: Interface intuitiva para atualização diária/semanal pelo gestor de campo.',
    excelIntegration: 'Importação Excel/MS Project: Upload de cronogramas e planilhas de custos existentes.',
    apiIntegration: 'Integração ERP/BIM: Conexão direta com sistemas de gestão para dados em tempo real.',
    downloadTemplate: 'Baixar Modelo Excel',
    templateGuide: 'Guia do Modelo Excel',
    colTask: 'Nome da Tarefa',
    colPlannedStart: 'Início Planejado',
    colPlannedFinish: 'Término Planejado',
    colPlannedCost: 'Custo Planejado (BAC)',
    colActualStart: 'Início Real',
    colActualFinish: 'Término Real',
    colPlannedProgress: '% Avanço Planejado',
    colProgress: '% Avanço Real',
    colActualCost: 'Custo Real (AC)',
    mappingNote: 'O sistema mapeia automaticamente colunas padrão. Se o cliente usar um formato próprio, você pode realizar o mapeamento manual na primeira importação.',
    overBudget: 'Acima do Orçamento',
    earnedValueAnalysis: 'Análise de Valor Agregado (EVA)',
    costHealth: 'Saúde de Custos',
    pmbokNote: 'Calculado com base nos padrões de Gestão de Valor Agregado do PMBOK 7ª Edição.',
    milestones: 'Marcos',
  },
  en: {
    // PMBOK KPIs
    spi: 'SPI (Schedule Performance Index)',
    cpi: 'CPI (Cost Performance Index)',
    sv: 'SV (Schedule Variance)',
    cv: 'CV (Cost Variance)',
    bac: 'BAC (Budget at Completion)',
    eac: 'EAC (Estimate at Completion)',
    etc: 'ETC (Estimate to Complete)',
    vac: 'VAC (Variance at Completion)',

    // Finance/Cost
    budgetVsActual: 'Budget vs. Actual',
    costPerformance: 'Cost Performance',
    plannedValue: 'PV (Planned Value)',
    earnedValue: 'EV (Earned Value)',
    actualCost: 'AC (Actual Cost)',

    // Risks
    riskManagement: 'Risk Management',
    riskLevel: 'Risk Level',
    mitigation: 'Mitigation',
    probability: 'Probability',
    impact: 'Impact',
    high: 'High',
    medium: 'Medium',
    low: 'Low',

    // Data Entry Explanation
    dataEntryTitle: 'How does data entry work?',
    dataEntryDesc: 'To sell this service, you can offer three integration modes:',
    manualEntry: 'Manual Entry: Intuitive interface for daily/weekly updates by the field manager.',
    excelIntegration: 'Excel/MS Project Import: Upload existing schedules and cost spreadsheets.',
    apiIntegration: 'ERP/BIM Integration: Direct connection with management systems for real-time data.',
    downloadTemplate: 'Download Excel Template',
    templateGuide: 'Excel Template Guide',
    colTask: 'Task Name',
    colPlannedStart: 'Planned Start',
    colPlannedFinish: 'Planned Finish',
    colPlannedCost: 'Planned Cost (BAC)',
    colActualStart: 'Actual Start',
    colActualFinish: 'Actual Finish',
    colPlannedProgress: '% Planned Progress',
    colProgress: '% Actual Progress',
    colActualCost: 'Actual Cost (AC)',
    mappingNote: 'The system automatically maps standard columns. If the client uses their own format, you can perform manual mapping during the first import.',
    overBudget: 'Over Budget',
    earnedValueAnalysis: 'Earned Value Analysis (EVA)',
    costHealth: 'Cost Health',
    pmbokNote: 'Calculated based on PMBOK 7th Edition Earned Value Management standards.',
    milestones: 'Milestones',

    // Navigation
    dashboard: 'Dashboard',
    schedule: 'Schedule',
    kanban: 'Kanban',
    resources: 'Resources',
    finance: 'Finance',
    
    // Dashboard
    phase: 'OVERVIEW',
    overview: 'Project Overview',
    last30: 'Last 30 Days',
    quarterly: 'Quarterly',
    totalProgress: 'Total Progress',
    thisWeek: 'THIS WEEK',
    onTrack: 'Reference:',
    scheduledVsActual: 'Scheduled vs. Actual',
    trackingDesc: 'Tracking cumulative task completion percentage over time.',
    scheduled: 'Scheduled',
    actual: 'Actual',
    today: 'Today',
    lag: 'Lag',
    criticalAlerts: 'Critical Path Alerts',
    highPriority: 'High Priority',
    advisory: 'Advisory',
    activeWorkPlan: 'Active Work Plan',
    viewGantt: 'View Full Gantt',
    taskDetail: 'Task Detail',
    team: 'Team',
    dueDate: 'Due Date',
    status: 'Status',
    logWork: 'Log Daily Work',
    
    // Statuses
    inProgress: 'In Progress',
    upcoming: 'Upcoming',
    blocked: 'Blocked',
    completed: 'Completed',
    pending: 'Pending',
    
    // Resources
    utilizationMetrics: 'Utilization Metrics',
    resourceHistogram: 'Resource Histogram',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    exportPdf: 'Export PDF',
    totalCapacity: 'Total Capacity',
    manHours: 'Man-Hours',
    avgUtilization: 'Avg Utilization',
    equipmentLoad: 'Equipment Load',
    unitsActive: 'Units Active',
    criticalPathGap: 'Critical Path Gap',
    deficit: 'deficit',
    laborDistribution: 'Labor Distribution',
    engineers: 'Engineers',
    laborers: 'Laborers',
    operators: 'Operators',
    optimizationAlert: 'Optimization Alert',
    optimizationDesc: 'Week 37 shows a 12% over-allocation for Operators. Consider shifting earthwork phases to Week 39.',
    runReallocation: 'Run Re-allocation',
    resourceHealth: 'Resource Health',
    equipmentUptime: 'Equipment Uptime',
    skillMatchRate: 'Skill Match Rate',
    safetyCompliance: 'Safety Compliance',
    equipmentBreakdown: 'Equipment Allocation Breakdown',
    inDemand: 'In Demand',
    optimal: 'Optimal',
    projectMilestones: 'Project Milestones',
    targetMet: 'Target Met',
    
    // Schedule
    masterSchedule: 'Master Schedule',
    structuralDev: 'Q3 Structural Development & Finishing',
    foundation: 'Foundation',
    structure: 'Structure',
    finishing: 'Finishing',
    milestoneReached: 'Milestone Reached',
    sitePrep: 'Site Preparation Final Sign-off',
    week: 'Week',
    done: 'Done',
    lvl1Columns: 'Lvl 1 Columns Poured',
    requiresProcurement: 'Requires Material Procurement by Sept 01',
    potentialDelay: 'Potential Delay: Steel Supply',
    logisticsBottleneck: 'Logistics bottlenecks may impact Phase: Structure end-date by +4 days.',
    latestReport: 'Latest Report',
    safetyAudit: 'Structural Safety Audit',
    active: 'Active',
    onTrackBudget: 'On Track',
    budget: 'Budget',
    
    // Finance
    financeModule: 'Finance Module',
    comingSoon: 'Coming soon in Phase 5',
    
    // Specific Alerts
    steelDelayTitle: 'Reinforcement Steel Delay',
    steelDelayDesc: 'Shipment #284 stuck at port. Estimated 3-day impact on slab casting schedule.',
    hvacShortageTitle: 'HVAC Subcontractor Shortage',
    hvacShortageDesc: 'Crew attendance dropped 20% this week. Monitoring impact on ductwork installation.',
    
    // Tasks
    foundationPileCapping: 'Foundation Pile Capping',
    electricMainLinePull: 'Electric Main Line Pull',
    plumbingPressureTest: 'Plumbing Pressure Test',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('pt');

  const t = (key: string): string => {
    return (translations[language] as any)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
