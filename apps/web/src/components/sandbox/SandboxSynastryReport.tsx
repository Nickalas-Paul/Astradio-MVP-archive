'use client';

import { IdentityMarkdown } from '@/components/shared/IdentityMarkdown';
import type { SandboxSynastryReportV1 } from '../../types/sandbox';

export interface SandboxSynastryReportProps {
  report: SandboxSynastryReportV1;
}

export function SandboxSynastryReport({ report }: SandboxSynastryReportProps) {
  if (!report.pairSections.length) return null;

  return (
    <div className="space-y-6">
      {report.pairSections.map((pairSection) => (
        <section
          key={`${pairSection.sourceSlotIndex}-${pairSection.targetSlotIndex}`}
          className="rounded-lg border border-border bg-bgElev p-4"
        >
          {report.mode === 'group' && pairSection.pairHeader ? (
            <h2 className="reading-section-header mb-4 first:mt-0">{pairSection.pairHeader}</h2>
          ) : null}

          <div className="space-y-6">
            {pairSection.tierBlocks.map((tierBlock) => (
              <div key={tierBlock.tierId} className="space-y-4">
                <h3 className="reading-section-header mb-2 first:mt-0">{tierBlock.title}</h3>
                {tierBlock.activations.map((activation) => (
                  <div
                    key={activation.aspectKey}
                    className="space-y-3 border-t border-border/60 pt-4 first:border-t-0 first:pt-0"
                  >
                    <h4 className="text-base font-semibold text-text-primary">{activation.directionalHeader}</h4>
                    <IdentityMarkdown content={activation.synastryProse} />
                    {activation.sonicInterplay ? (
                      <IdentityMarkdown
                        content={`**Sonic Interplay**\n\n${activation.sonicInterplay}`}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
