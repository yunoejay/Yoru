"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthShell from '../../components/AuthShell';
import PasswordField from '@/components/PasswordField';
import { notifyAuthChanged } from '@/components/useSessionUser';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error || 'Login failed');
      return;
    }

    // The Navbar is mounted in the root layout, so it has to be told the
    // session changed; otherwise it keeps showing the Login link until reload.
    notifyAuthChanged();
    router.push('/account');
    router.refresh();
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in with your username or email to sync your profile and pick up where you left off."
      footer={
        <>
          <p>
            Need an account? <Link href="/register" className="font-medium text-brand hover:underline dark:text-brand-accent">Register</Link>
          </p>
          <p>
            Forgot your password? <Link href="/forgot" className="font-medium text-brand hover:underline dark:text-brand-accent">Reset it</Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-username" className="field-label">Username or email</label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            placeholder="your_handle or you@example.com"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="field-label">Password</label>
          <PasswordField
            id="login-password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>

        {message ? <p className="alert alert-error">{message}</p> : null}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </AuthShell>
  );
}

