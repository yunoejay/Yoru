import type { Metadata } from 'next';
import LegalShell from '../../components/LegalShell';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The rules for using Yoru.',
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="September 2026">
      <h2>Using Yoru</h2>
      <p>
        Yoru is an independent, non-commercial project. By using the site you agree to use
        it lawfully and not to abuse the reader, its APIs, or the upstream content sources it relies on.
      </p>
      <h2>Accounts</h2>
      <p>
        You are responsible for keeping your password secure and for activity that happens under your
        account. You may delete your account at any time by contacting us.
      </p>
      <h2>No warranty</h2>
      <p>
        The service is provided &ldquo;as is&rdquo; without warranties of any kind. Chapter availability
        depends on third-party sources and can change or disappear without notice.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not resell access, run ads against the service, scrape it at scale, or use it in a way that
        violates the acceptable-use policies of the sources we build on.
      </p>
    </LegalShell>
  );
}
