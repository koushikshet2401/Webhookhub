// frontend/src/pages/ForgotPassword.jsx

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/auth.api';
import AuthLayout from '../components/AuthLayout';
import Input from '../components/Input';
import Button from '../components/Button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // The backend always returns the same response whether or not the
      // account exists, by design - this isn't a UI shortcut, it matches
      // the API's own anti-enumeration behavior.
      await authApi.forgotPassword(email);
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email">
        <p className="text-sm text-text-muted">
          If an account exists for <span className="text-text">{email}</span>, a reset link is on its way. The
          link expires in 1 hour.
        </p>
        <Link to="/login" className="text-sm text-accent hover:text-accent-hover block mt-6">
          Back to log in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a reset link.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" loading={loading} className="w-full mt-1">
          Send reset link
        </Button>
      </form>
      <Link to="/login" className="text-sm text-text-muted hover:text-accent transition-colors block mt-6 text-center">
        Back to log in
      </Link>
    </AuthLayout>
  );
}