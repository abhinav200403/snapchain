import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { MailWarning, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

const VerificationBanner = () => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  if (!user || user.emailVerified || dismissed) return null;

  const resend = async () => {
    setSending(true);
    try {
      await api.post('/auth/resend-verification');
      toast.success('Verification email sent — check your inbox.');
    } catch {
      toast.error('Failed to send email. Check your SMTP settings.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-warning/10 border-b border-warning/20 px-4 py-2.5 text-sm">
      <div className="flex items-center gap-2 text-warning">
        <MailWarning className="h-4 w-4 shrink-0" />
        <span className="font-medium">Please verify your email address to access all features.</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={resend}
          disabled={sending}
          className="text-xs font-semibold text-warning underline underline-offset-2 hover:no-underline disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Resend email'}
        </button>
        <button onClick={() => setDismissed(true)} className="text-warning/60 hover:text-warning">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { collapsed } = useSidebar();
  // Establish WebSocket connection for real-time updates
  useSocket();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main
        className="flex-1 transition-all duration-300"
        style={{ marginLeft: collapsed ? '68px' : '260px' }}
      >
        <VerificationBanner />
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
