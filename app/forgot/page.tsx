"use client";
import { useState } from 'react';
import Link from 'next/link';
import AuthShell from '../../components/AuthShell';

/** Reset helpers only surface outside production. */
const isProduction = process.env.NODE_ENV === 'production';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setDevResetUrl(null);

    const res = await fetch('/api/auth/reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error || 'Request failed');
      return;
    }

    if (data.devResetUrl) {
      setDevResetUrl(data.devResetUrl);
    }

    setMessage('If the email exists, a reset link was sent.');
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to choose a new password."
      footer={
        <p>
          Remembered it? <Link href="/login" className="font-medium text-brand hover:underline dark:text-brand-accent">Back to login</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="forgot-email" className="field-label">Email</label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="field-input"
          />
        </div>

        {message ? <p className="alert alert-success">{message}</p> : null}
        {!isProduction && devResetUrl ? (
          <p className="alert alert-info break-all">
            DEV reset link: <a href={devResetUrl} className="font-medium underline">{devResetUrl}</a>
          </p>
        ) : null}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  );
}

