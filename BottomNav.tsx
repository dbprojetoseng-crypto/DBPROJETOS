import React from 'react';
import { LayoutDashboard, CalendarDays, Boxes, CircleDollarSign, Trello, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../LanguageContext';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const { t } = useLanguage();
  
  const tabs = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'schedule', label: t('schedule'), icon: CalendarDays },
    { id: 'kanban', label: t('kanban'), icon: Trello },
    { id: 'resources', label: t('resources'), icon: Boxes },
    { id: 'finance', label: t('finance'), icon: CircleDollarSign },
    { id: 'bms', label: 'BMS', icon: FileText },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white shadow-[0_-4px_20px_rgba(6,78,59,0.04)] rounded-t-xl border-t border-outline-variant/10 z-50 md:hidden">
      <div className="flex justify-around items-center h-20 px-4 pb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center px-4 py-1 transition-all active:translate-y-0.5",
                isActive 
                  ? "text-primary bg-primary-container rounded-xl" 
                  : "text-on-surface-variant/60 hover:text-primary"
              )}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="font-headline text-[11px] font-semibold uppercase tracking-wider">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
