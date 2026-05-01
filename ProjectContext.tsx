import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './components/AuthWrapper';
import { useWorkspace } from './WorkspaceContext';

export type SourceType = 'excel' | 'msproject';

export interface Project {
  id: string;
  name: string;
  sourceType: SourceType;
  clientId: string;
  segment?: string;
  importedAt: any;
}

interface ProjectContextType {
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  projects: Project[];
  clients: any[];
  loadingClients: boolean;
  selectedClientId: string;
  setSelectedClientId: (id: string) => void;
  addClient: (clientData: { name: string; obra: string; segment?: string; city?: string }) => Promise<string>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userRole } = useAuth();
  const { workspaceId } = useWorkspace();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    return localStorage.getItem('selectedClientId') || '';
  });

  useEffect(() => {
    if (selectedClientId) {
      localStorage.setItem('selectedClientId', selectedClientId);
    }
  }, [selectedClientId]);

  const addClient = async (clientData: { name: string; obra: string; segment?: string; city?: string }) => {
    const { addDoc, collection, updateDoc, doc } = await import('firebase/firestore');
    const docRef = await addDoc(collection(db, 'clients'), {
      clientName: clientData.name,
      obraName: clientData.obra,
      projectName: clientData.obra,
      segment: clientData.segment || '',
      city: clientData.city || '',
      ownerId: user?.uid,
      userId: user?.uid,
      workspaceId: workspaceId,
      createdAt: new Date().toISOString()
    });
    
    await updateDoc(doc(db, 'clients', docRef.id), {
      clientId: docRef.id
    });

    setSelectedClientId(docRef.id);
    return docRef.id;
  };

  useEffect(() => {
    if (!user) {
      setClients([]);
      setLoadingClients(false);
      return;
    }

    console.log("Subscribing to clients for workspace:", workspaceId);
    if (!workspaceId) {
      setClients([]);
      setLoadingClients(false);
      return;
    }

    const q = query(collection(db, 'clients'), where('workspaceId', '==', workspaceId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      console.log("Fetched clients:", clientList.length);
      setClients(clientList);
      setLoadingClients(false);
      
      // Auto-select first client if none is selected or if selected client is not in the list
      setSelectedClientId(prev => {
        if (clientList.length > 0) {
          const exists = clientList.some(c => c.uid === prev);
          if (!prev || !exists) {
            return clientList[0].uid;
          }
        }
        return prev;
      });
    }, (error) => {
      console.error("Error fetching clients:", error);
      setLoadingClients(false);
    });

    return () => unsubscribe();
  }, [user, workspaceId]); // Added workspaceId to dependencies

  useEffect(() => {
    if (!selectedClientId || !user || !workspaceId) {
      setProjects([]);
      setActiveProjectId(null);
      return;
    }

    console.log("[ProjectContext] Subscribing to projects for client:", selectedClientId, "workspace:", workspaceId);
    const q = query(
      collection(db, 'projects'),
      where('clientId', '==', selectedClientId),
      where('workspaceId', '==', workspaceId),
      orderBy('importedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      console.log("[ProjectContext] Fetched projects:", projectList.length);
      setProjects(projectList);
      
      // Auto-select first project if none selected or current active project is gone
      if (projectList.length > 0) {
        if (!activeProjectId || !projectList.find(p => p.id === activeProjectId)) {
          setActiveProjectId(projectList[0].id);
        }
      } else {
        setActiveProjectId(null);
      }
    }, (error) => {
      console.error("[ProjectContext] Error fetching projects:", error);
    });

    return () => unsubscribe();
  }, [selectedClientId, user, workspaceId]);

  return (
    <ProjectContext.Provider value={{ 
      activeProjectId, 
      setActiveProjectId, 
      projects,
      clients,
      loadingClients,
      selectedClientId, 
      setSelectedClientId,
      addClient
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
