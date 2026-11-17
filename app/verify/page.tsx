"use client";
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthShell from '../../components/AuthShell';

// useSearchParams() must sit inside a Suspense boundary for static prerendering.
export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-400">Loading…</div>}>
      <VerifyForm />
    </Suspense>
  );
}

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Verification failed');
      return;
    }

    setMessage('Verified! Redirecting to your account…');
    router.push('/account');
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Enter the 6-digit code we emailed you to activate your account."
      footer={
        <p>
          Didn&rsquo;t get a code? <Link href="/register" className="font-medium text-brand hover:underline dark:text-brand-accent">Register again</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="verify-email" className="field-label">Email</label>
          <input
            id="verify-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="verify-code" className="field-label">Verification code</label>
          <input
            id="verify-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={e => setCode(e.target.value)}
            required
            className="field-input tracking-[0.3em]"
          />
        </div>

        {error ? <p className="alert alert-error">{error}</p> : null}
        {message ? <p className="alert alert-success">{message}</p> : null}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </AuthShell>
  );
}

