"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthShell from '../../components/AuthShell';
import PasswordField from '@/components/PasswordField';
import PasswordStrength, {
  ACCOUNT_SETUP_HIDDEN_RULE_IDS,
} from '@/components/PasswordStrength';

/** Verification/reset helpers only surface outside production. */
const isProduction = process.env.NODE_ENV === 'production';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setDevCode(null);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error || 'Registration failed');
      return;
    }

    // With SMTP unconfigured the API hands the code straight back (and prints it
    // to the dev server console). Stay on this page when it does: navigating
    // away immediately used to hide the only copy of the code the reader could
    // type in, leaving the new, unverified account unable to log in.
    if (data.devCode) {
      setDevCode(data.devCode);
      return;
    }

    router.push(`/verify?email=${encodeURIComponent(email)}`);
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Register to save your profile and keep your place across chapters."
      footer={
        <p>
          Already have an account? <Link href="/login" className="font-medium text-brand hover:underline dark:text-brand-accent">Log in</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reg-username" className="field-label">Username</label>
          <input
            id="reg-username"
            type="text"
            autoComplete="username"
            placeholder="your_handle"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9_]{3,30}"
            title="3–30 characters: letters, numbers, and underscores only"
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="reg-email" className="field-label">Email</label>
          <input
            id="reg-email"
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
          <label htmlFor="reg-password" className="field-label">Password</label>
          <PasswordField
            id="reg-password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            aria-describedby="reg-password-strength"
          />
          <PasswordStrength
            id="reg-password-strength"
            value={password}
            hideRuleIds={ACCOUNT_SETUP_HIDDEN_RULE_IDS}
            className="mt-2"
          />
        </div>

        {message ? <p className="alert alert-error">{message}</p> : null}
        {!isProduction && devCode ? (
          <div className="alert alert-info space-y-1">
            <p>
              DEV verification code: <span className="font-mono font-semibold">{devCode}</span>
            </p>
            <Link
              href={`/verify?email=${encodeURIComponent(email)}`}
              className="font-medium text-brand underline dark:text-brand-accent"
            >
              Continue to verification
            </Link>
          </div>
        ) : null}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating account…' : 'Register'}
        </button>
      </form>
    </AuthShell>
  );
}

