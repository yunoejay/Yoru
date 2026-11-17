import type { ReactNode } from 'react';

/**
 * Consistent page intro (pill label + heading + supporting copy) shared by the
 * list pages so Home, Library, and Series all open with the same rhythm.
 */
export default function PageHeader({
  pill,
  title,
  description,
  actions,
}: {
  pill?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="page-intro">
        {pill ? <p className="section-pill">{pill}</p> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-subtitle">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
