import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';

const AppContent = () => {
  const { collapsed } = useSidebar();
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main
        className="flex-1 transition-all duration-300"
        style={{ marginLeft: collapsed ? '68px' : '260px' }}
      >
        <Outlet />
      </main>
    </div>
  );
};

export const AppLayout = () => (
  <SidebarProvider>
    <AppContent />
  </SidebarProvider>
);
