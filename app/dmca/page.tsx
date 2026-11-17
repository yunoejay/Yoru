import type { Metadata } from 'next';
import Link from 'next/link';
import LegalShell from '../../components/LegalShell';

export const metadata: Metadata = {
  title: 'Takedown Requests',
  description: 'How scanlation groups and rights holders can request content removal.',
};

export default function DmcaPage() {
  return (
    <LegalShell title="Takedown & Removal Requests" updated="September 2026">
      <h2>For scanlation groups and rights holders</h2>
      <p>
        Yoru credits MangaDex and the scanlation group behind every chapter directly in the
        reader. If you are a rights holder or a scanlation group and would like a title or chapter
        removed, we honour removal requests promptly and in good faith.
      </p>
      <h2>How to submit a request</h2>
      <p>
        Email <a href="mailto:abuse@example.com">abuse@example.com</a> with the title, the specific
        chapter or series URL, and a statement that you are the rights holder or an authorized agent.
        Where content is served through an upstream aggregator such as MangaDex, we may ask you to
        file with them as well and will remove your content from our listings once confirmed.
      </p>
      <h2>No ads, no paywall</h2>
      <p>
        This project runs no advertising and charges no access fee, in line with the acceptable-use
        rules of the sources it builds on. Scraped sources remain disabled unless explicitly enabled
        by an operator who has permission from the group.
      </p>
      <p>
        Prefer the reader? Return to the <Link href="/library" className="font-medium text-brand hover:underline dark:text-brand-accent">library</Link>.
      </p>
    </LegalShell>
  );
}
