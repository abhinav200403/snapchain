import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '@/lib/api';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const VerifyEmailPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }
    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setStatus('success'))
      .catch(err => {
        setStatus('error');
        setMessage(err?.response?.data?.error ?? 'This link is invalid or has expired.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-10 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          {status === 'loading' && <Loader2 className="h-12 w-12 text-primary animate-spin" />}
          {status === 'success' && <CheckCircle2 className="h-12 w-12 text-success" />}
          {status === 'error' && <XCircle className="h-12 w-12 text-destructive" />}
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">
          {status === 'loading' && 'Verifying your email…'}
          {status === 'success' && 'Email verified!'}
          {status === 'error' && 'Verification failed'}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {status === 'loading' && 'Please wait a moment.'}
          {status === 'success' && 'Your email has been verified. You can now use all features of SynapChain AI.'}
          {status === 'error' && message}
        </p>
        {status !== 'loading' && (
          <Button asChild className="w-full">
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
