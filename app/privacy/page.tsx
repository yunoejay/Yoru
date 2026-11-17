import type { Metadata } from 'next';
import LegalShell from '../../components/LegalShell';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What Yoru stores and why.',
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="September 2026">
      <h2>What we collect</h2>
      <p>
        If you create an account, we store your email address, an optional display name, a hashed
        password, and an email-verification status. We do not sell your data or use it for advertising.
      </p>
      <h2>Cookies</h2>
      <p>
        We use a single session cookie to keep you signed in. Your theme choice (light or dark) is
        saved in your browser&rsquo;s local storage.
      </p>
      <h2>Content and page views</h2>
      <p>
        Chapter images are fetched from third-party sources at read time through a same-origin proxy.
        We do not store page image URLs long-term because they expire quickly upstream.
      </p>
      <h2>Your rights</h2>
      <p>
        You can request a copy or deletion of your account data at any time by contacting us. Deleting
        your account removes your profile and credentials.
      </p>
    </LegalShell>
  );
}
