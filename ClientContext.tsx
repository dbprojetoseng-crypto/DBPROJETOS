import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'admin' | 'client';

export interface ClientData {
  id: string;
  name: string;
  email: string;
  lastUpdate: string;
  kpis: {
    spi: number;
    cpi: number;
    progress: number;
    budget: number;
  };
}

interface ClientContextType {
  currentUser: { role: UserRole; name: string; clientId?: string } | null;
  clients: ClientData[];
  login: (role: UserRole, name: string, clientId?: string) => void;
  logout: () => void;
  addClient: (client: Omit<ClientData, 'id' | 'lastUpdate' | 'kpis'>) => void;
  updateClientData: (clientId: string, kpis: ClientData['kpis']) => void;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export const ClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<ClientContextType['currentUser']>(null);
  const [clients, setClients] = useState<ClientData[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedClients = localStorage.getItem('app_clients');
    if (savedClients) {
      setClients(JSON.parse(savedClients));
    } else {
      // Initial mock data
      const initialClients: ClientData[] = [
        { 
          id: '1', 
          name: 'Construtora Alpha', 
          email: 'alpha@exemplo.com', 
          lastUpdate: '2024-03-20',
          kpis: { spi: 0.95, cpi: 1.02, progress: 45, budget: 1200000 }
        },
        { 
          id: '2', 
          name: 'Incorporadora Beta', 
          email: 'beta@exemplo.com', 
          lastUpdate: '2024-03-18',
          kpis: { spi: 1.05, cpi: 0.98, progress: 62, budget: 850000 }
        }
      ];
      setClients(initialClients);
      localStorage.setItem('app_clients', JSON.stringify(initialClients));
    }

    const savedUser = localStorage.getItem('app_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const login = (role: UserRole, name: string, clientId?: string) => {
    const user = { role, name, clientId };
    setCurrentUser(user);
    localStorage.setItem('app_user', JSON.stringify(user));
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('app_user');
  };

  const addClient = (client: Omit<ClientData, 'id' | 'lastUpdate' | 'kpis'>) => {
    const newClient: ClientData = {
      ...client,
      id: Math.random().toString(36).substr(2, 9),
      lastUpdate: new Date().toISOString().split('T')[0],
      kpis: { spi: 1, cpi: 1, progress: 0, budget: 0 }
    };
    const updated = [...clients, newClient];
    setClients(updated);
    localStorage.setItem('app_clients', JSON.stringify(updated));
  };

  const updateClientData = (clientId: string, kpis: ClientData['kpis']) => {
    const updated = clients.map(c => 
      c.id === clientId ? { ...c, kpis, lastUpdate: new Date().toISOString().split('T')[0] } : c
    );
    setClients(updated);
    localStorage.setItem('app_clients', JSON.stringify(updated));
  };

  return (
    <ClientContext.Provider value={{ currentUser, clients, login, logout, addClient, updateClientData }}>
      {children}
    </ClientContext.Provider>
  );
};

export const useClients = () => {
  const context = useContext(ClientContext);
  if (!context) throw new Error('useClients must be used within ClientProvider');
  return context;
};
