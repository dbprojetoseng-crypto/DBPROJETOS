import React from 'react';
import { HardHat, Bell, Languages, LogOut, LayoutDashboard, CalendarDays, Boxes, CircleDollarSign, Trello, Users, UserPlus, ChevronDown, PlusCircle, Settings, Trash2, AlertTriangle, FileText, Shield } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useAuth } from './AuthWrapper';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { useProject } from '../ProjectContext';
import { useWorkspace } from '../WorkspaceContext';
import { NewClientModal } from './NewClientModal';
import { motion, AnimatePresence } from 'motion/react';

interface TopBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeTab, setActiveTab }) => {
  const { language, setLanguage, t } = useLanguage();
  const { user } = useAuth();
  const { myRole } = useWorkspace();
  const { activeProjectId, setActiveProjectId, projects, clients, selectedClientId, setSelectedClientId, addClient } = useProject();
  const [showNewClientModal, setShowNewClientModal] = React.useState(false);
  const [showProjectMenu, setShowProjectMenu] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null); // clientId a deletar

  const selectedClient = clients.find(c => c.uid === selectedClientId);
  const activeProject = projects.find(p => p.id === activeProjectId);

  const handleSignOut = () => {
    signOut(auth);
  };

  const tabs = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'schedule', label: t('schedule'), icon: CalendarDays },
    { id: 'kanban', label: t('kanban'), icon: Trello },
    { id: 'resources', label: t('resources'), icon: Boxes },
    { id: 'finance', label: t('finance'), icon: CircleDollarSign },
    { id: 'bms', label: 'BMS', icon: FileText },
  ];

  if (myRole === 'admin') {
    tabs.push({ id: 'admin', label: 'Admin', icon: Shield });
  }

  return (
    <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm border-b border-outline-variant/10">
      <div className="flex justify-between items-center px-6 h-16 w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <HardHat className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-extrabold text-primary tracking-tighter font-headline hidden lg:block">
              DB PROJETOS E ENGENHARIA
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-headline text-xs font-bold uppercase tracking-wider",
                    isActive 
                      ? "text-primary bg-primary/10" 
                      : "text-on-surface-variant/60 hover:text-primary hover:bg-surface-container-low"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Client & Project Switcher */}
          <div className="relative">
            <button 
              onClick={() => setShowProjectMenu(!showProjectMenu)}
              className="flex items-center gap-3 px-4 py-2 bg-surface-container-low hover:bg-surface-container-high rounded-2xl border border-outline-variant/10 transition-all group"
            >
              <div className="flex flex-col items-start text-left">
                <span className="text-[9px] font-black text-primary uppercase tracking-widest opacity-60 leading-none mb-1">
                  {selectedClient?.clientName || 'Selecionar Cliente'}
                </span>
                <span className="text-xs font-bold text-on-surface leading-none flex items-center gap-1">
                  {selectedClient?.obraName || 'Sem Obra Ativa'}
                  <ChevronDown className={cn("w-3 h-3 transition-transform", showProjectMenu && "rotate-180")} />
                </span>
              </div>
            </button>

            <AnimatePresence>
              {showProjectMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-72 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden z-[60]"
                >
                  <div className="p-4 border-b border-outline-variant/10 bg-surface-container-low/50">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">Minhas Obras</h4>
                    <div className="space-y-1 max-h-60 overflow-y-auto no-scrollbar">
                      {clients.map(client => (
                        <div key={client.uid} className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedClientId(client.uid);
                              setShowProjectMenu(false);
                            }}
                            className={cn(
                              "flex-1 flex flex-col items-start p-3 rounded-xl transition-all text-left",
                              selectedClientId === client.uid ? "bg-primary text-white" : "hover:bg-surface-container-high text-on-surface"
                            )}
                          >
                            <span className={cn("text-[9px] font-bold uppercase tracking-wider mb-0.5", selectedClientId === client.uid ? "text-white/70" : "text-primary")}>
                              {client.clientName}
                            </span>
                            <span className="text-xs font-black">{client.obraName}</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(client.uid); }}
                            className="p-2 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                            title="Excluir obra"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-2 bg-surface-container-lowest">
                    <button 
                      onClick={() => {
                        setShowNewClientModal(true);
                        setShowProjectMenu(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/5 text-primary transition-all group"
                    >
                      <PlusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-black uppercase tracking-wider">Nova Obra</span>
                    </button>
                  </div>
                  {/* Delete confirmation modal */}
                  {confirmDelete && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-surface-container-lowest rounded-3xl shadow-2xl border border-outline-variant/20 p-8 max-w-sm w-full"
                      >
                        <div className="w-12 h-12 bg-error/10 rounded-2xl flex items-center justify-center mb-4">
                          <AlertTriangle className="w-6 h-6 text-error" />
                        </div>
                        <h3 className="text-lg font-black text-primary font-headline mb-2">Excluir Obra?</h3>
                        <p className="text-sm text-on-surface-variant mb-6">
                          Esta ação é <strong>irreversível</strong>. Todos os dados do projeto, cronograma e recursos serão perdidos permanentemente.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="flex-1 py-3 border border-outline-variant/20 rounded-xl font-bold text-sm hover:bg-surface-container-low transition-all"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirmDelete) return;
                              try {
                                const { deleteDoc, doc, getDocs, collection, query, where } = await import('firebase/firestore');
                                const { db } = await import('../firebase');
                                // Delete all projects of this client
                                const projQ = query(collection(db, 'projects'), where('clientId', '==', confirmDelete));
                                const projSnap = await getDocs(projQ);
                                for (const p of projSnap.docs) {
                                  // Delete subcollections
                                  for (const sub of ['tasks', 'financials', 'resources']) {
                                    const subSnap = await getDocs(collection(db, 'projects', p.id, sub));
                                    for (const s of subSnap.docs) await deleteDoc(s.ref);
                                  }
                                  await deleteDoc(p.ref);
                                }
                                await deleteDoc(doc(db, 'clients', confirmDelete));
                                setConfirmDelete(null);
                                setShowProjectMenu(false);
                              } catch (err) {
                                console.error('Error deleting client:', err);
                              }
                            }}
                            className="flex-1 py-3 bg-error text-white rounded-xl font-bold text-sm hover:bg-error/90 transition-all"
                          >
                            Sim, Excluir
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Project Tabs (Horizontal Scroll) */}
          {projects.length > 0 && (
            <div className="hidden xl:flex items-center gap-1 bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10 ml-2">
              {projects.map(project => (
                <button 
                  key={project.id}
                  onClick={() => setActiveProjectId(project.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                    activeProjectId === project.id ? "bg-primary text-white shadow-md" : "text-on-surface-variant hover:bg-surface-container-high"
                  )}
                >
                  {project.name}
                </button>
              ))}
            </div>
          )}

          <div className="w-px h-8 bg-outline-variant/10 mx-2 hidden sm:block" />

          <button 
            onClick={() => setLanguage(language === 'pt' ? 'en' : 'pt')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container-low rounded-lg transition-colors border border-outline-variant/20"
          >
            <Languages className="w-4 h-4" />
            {language === 'pt' ? 'EN' : 'PT'}
          </button>
          
          <button className="p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors duration-200 rounded-full active:scale-95">
            <Bell className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3 pl-3 border-l border-outline-variant/10">
            <div className="flex flex-col items-end hidden lg:flex">
              <span className="text-[10px] font-black text-primary uppercase leading-none mb-1">{user?.displayName || 'Usuário'}</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                <span className="text-[9px] text-on-surface-variant font-bold uppercase opacity-60 leading-none">Online</span>
              </div>
            </div>
            <button 
              onClick={handleSignOut}
              className="h-10 w-10 rounded-2xl bg-primary-container overflow-hidden border border-outline-variant/20 group relative shadow-sm hover:shadow-md transition-all"
            >
              <img 
                alt="User Profile" 
                className="w-full h-full object-cover group-hover:opacity-20 transition-opacity"
                referrerPolicy="no-referrer"
                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || 'U'}&background=064e3b&color=fff`} 
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <LogOut className="w-5 h-5 text-primary" />
              </div>
            </button>
          </div>
        </div>
      </div>
      {showNewClientModal && (
        <NewClientModal 
          onClose={() => setShowNewClientModal(false)}
          onConfirm={addClient}
        />
      )}
    </header>
  );
};
