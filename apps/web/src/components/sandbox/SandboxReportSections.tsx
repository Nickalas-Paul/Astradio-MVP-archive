'use client';

import type { SandboxReport, SandboxSynastryReportV1 } from '../../types/sandbox';
import { Card } from '@/components/shared/Card';
import { ExplainerSections } from '../../../app/sandbox/page-helpers';
import { SandboxSynastryReport } from './SandboxSynastryReport';

export interface SandboxReportSectionsProps {
  displayReport: SandboxReport | null;
}

export function SandboxReportSections({ displayReport }: SandboxReportSectionsProps) {
  if (!displayReport) return null;

  return (
    <div className="mt-6 space-y-4">
      {displayReport.personality && (
        <Card as="section" elevation="raised">
          <h3 className="font-serif text-lg font-semibold text-text-primary mb-3">Personality</h3>
          <div className="text-text-secondary text-sm">
            {displayReport.personality.summary || JSON.stringify(displayReport.personality, null, 2)}
          </div>
        </Card>
      )}
      {displayReport.guidance && (
        <Card as="section" elevation="raised">
          <h3 className="font-serif text-lg font-semibold text-text-primary mb-3">Guidance</h3>
          <div className="text-text-secondary text-sm">
            {displayReport.guidance.advice || JSON.stringify(displayReport.guidance, null, 2)}
          </div>
        </Card>
      )}
      {displayReport.sandboxSynastryReport ? (
        <SandboxSynastryReport report={displayReport.sandboxSynastryReport} />
      ) : null}
      {displayReport.explanation && <ExplainerSections explanation={displayReport.explanation} />}
    </div>
  );
}
