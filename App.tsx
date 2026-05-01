import { useState } from 'react';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './DashboardView';
import { ScheduleView } from './ScheduleView';
import { ResourcesView } from './ResourcesView';
import { FinanceView } from './FinanceView';
import { BMSView } from './BMSView';
import { KanbanView } from './KanbanView';
import { AnimatePresence } from 'motion/react';
import { useLanguage } from './LanguageContext';
import { AuthWrapper } from './components/AuthWrapper';

import { ProjectProvider, useProject } from './ProjectContext';
import { OnboardingView } from './OnboardingView';
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext';
import { WorkspaceSetup } from './WorkspaceSetup';
import { AdminPanel } from './AdminPanel';
import { ContratadaView } from './ContratadaView';

const AppContent = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { clients, loadingClients } = useProject();
  const { workspace, myRole, loading: wsLoading } = useWorkspace();

  console.log("[AppContent] Rendering, loadingClients:", loadingClients, "clientsCount:", clients.length);

  if (wsLoading || loadingClients) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Se não tem workspace, mostrar setup
  if (!workspace) {
    return <WorkspaceSetup />;
  }

  // Se for contratada, mostrar layout simplificado
  if (myRole === 'contratada') {
    return (
      <div className="min-h-screen bg-surface">
        <TopBar activeTab="bms" setActiveTab={() => {}} />
        <main className="pt-24 pb-10 px-4 md:px-8 max-w-4xl mx-auto">
          <ContratadaView />
        </main>
      </div>
    );
  }

  if (clients.length === 0) {
    return <OnboardingView />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'schedule':
        return <ScheduleView />;
      case 'kanban':
        return <KanbanView />;
      case 'resources':
        return <ResourcesView />;
      case 'finance':
        return <FinanceView />;
      case 'bms':
        return <BMSView />;
      case 'admin':
        return <AdminPanel />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <TopBar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="pt-24 pb-28 px-4 md:px-8 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <div key={activeTab}>
            {renderContent()}
          </div>
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default function App() {
  return (
    <AuthWrapper>
      <WorkspaceProvider>
        <ProjectProvider>
          <AppContent />
        </ProjectProvider>
      </WorkspaceProvider>
    </AuthWrapper>
  );
}
