"use client";
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthShell from '../../components/AuthShell';
import PasswordField from '@/components/PasswordField';
import PasswordStrength, {
  ACCOUNT_SETUP_HIDDEN_RULE_IDS,
} from '@/components/PasswordStrength';

// useSearchParams() must sit inside a Suspense boundary for static prerendering.
export default function ResetPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-400">Loading…</div>}>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const res = await fetch('/api/auth/reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, password })
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Reset failed');
      return;
    }

    setMessage('Password reset successful. You can now log in.');
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Paste the token from your reset email and choose a new password."
      footer={
        <p>
          <Link href="/login" className="font-medium text-brand hover:underline dark:text-brand-accent">Back to login</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reset-email" className="field-label">Email</label>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="reset-token" className="field-label">Reset token</label>
          <input
            id="reset-token"
            type="text"
            value={token}
            onChange={e => setToken(e.target.value)}
            required
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="reset-password" className="field-label">New password</label>
          <PasswordField
            id="reset-password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            aria-describedby="reset-password-strength"
          />
          <PasswordStrength
            id="reset-password-strength"
            value={password}
            hideRuleIds={ACCOUNT_SETUP_HIDDEN_RULE_IDS}
            className="mt-2"
          />
        </div>

        {error ? <p className="alert alert-error">{error}</p> : null}
        {message ? <p className="alert alert-success">{message}</p> : null}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </AuthShell>
  );
}

