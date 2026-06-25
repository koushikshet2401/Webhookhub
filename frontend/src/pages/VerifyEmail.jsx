// frontend/src/pages/VerifyEmail.jsx

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/auth.api';
import AuthLayout from '../components/AuthLayout';
import Spinner from '../components/Spinner';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying'); // verifying | success | error

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    authApi
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <AuthLayout title="Email verification">
      {status === 'verifying' && (
        <div className="flex items-center gap-3 text-text-muted">
          <Spinner className="h-5 w-5" />
          <span>Verifying your email...</span>
        </div>
      )}
      {status === 'success' && (
        <div>
          <p className="text-sm text-success mb-4">Your email is verified.</p>
          <Link to="/projects" className="text-sm text-accent hover:text-accent-hover">
            Continue to your dashboard
          </Link>
        </div>
      )}
      {status === 'error' && (
        <div>
          <p className="text-sm text-danger mb-4">This verification link is invalid or has expired.</p>
          <Link to="/projects" className="text-sm text-accent hover:text-accent-hover">
            Go to dashboard and request a new link
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}