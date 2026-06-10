'use client';

import { IdentityMarkdown } from '@/components/shared/IdentityMarkdown';
import { Card } from '@/components/shared/Card';
import { usePlacementHighlight } from '@/core/PlacementHighlightContext';
import { useScrollToHighlightedSection } from '@/core/useScrollToHighlightedSection';
import { parsePlanetNamesFromAspectKey } from '@/core/planet-identity';
import type { SandboxSynastryReportV1 } from '../../types/sandbox';

export interface SandboxSynastryReportProps {
  report: SandboxSynastryReportV1;
}

export function SandboxSynastryReport({ report }: SandboxSynastryReportProps) {
  const { highlightedPlanets, setHighlight, clearHighlight } = usePlacementHighlight();
  useScrollToHighlightedSection(highlightedPlanets);

  if (!report.pairSections.length) return null;

  return (
    <div className="space-y-6">
      {report.pairSections.map((pairSection) => (
        <Card
          key={`${pairSection.sourceSlotIndex}-${pairSection.targetSlotIndex}`}
          as="section"
          elevation="raised"
        >
          {report.mode === 'group' && pairSection.pairHeader ? (
            <h2 className="reading-section-header mb-4 first:mt-0">{pairSection.pairHeader}</h2>
          ) : null}

          <div className="space-y-6">
            {pairSection.tierBlocks.map((tierBlock) => (
              <div key={tierBlock.tierId} className="space-y-4">
                <h3 className="reading-section-header mb-2 first:mt-0">{tierBlock.title}</h3>
                {tierBlock.activations.map((activation) => {
                  const planets = parsePlanetNamesFromAspectKey(activation.aspectKey);
                  const isHighlightedFromWheel = planets.some((p) => highlightedPlanets.has(p));
                  return (
                    <div
                      key={activation.aspectKey}
                      id={`section-${activation.aspectKey}`}
                      data-section-planets={planets.join(',')}
                      className={`space-y-3 border-t pt-4 first:border-t-0 first:pt-0 transition-all duration-200 ${
                        isHighlightedFromWheel
                          ? 'border-accent/50 bg-accent/5 -mx-2 px-2 rounded-lg'
                          : 'border-border/60'
                      }`}
                      onMouseEnter={() => {
                        if (planets.length) setHighlight(planets);
                      }}
                      onMouseLeave={() => clearHighlight()}
                      onTouchStart={() => {
                        if (planets.length) setHighlight(planets);
                      }}
                      onTouchEnd={() => clearHighlight()}
                    >
                      <h4 className="text-base font-semibold text-text-primary">
                        {activation.directionalHeader}
                      </h4>
                      <IdentityMarkdown content={activation.synastryProse} />
                      {activation.sonicInterplay ? (
                        <IdentityMarkdown
                          content={`**Sonic Interplay**\n\n${activation.sonicInterplay}`}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
