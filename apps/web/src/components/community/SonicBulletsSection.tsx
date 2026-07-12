import { IdentityMarkdown } from '@/components/shared/IdentityMarkdown';

type SonicBulletsSectionProps = {
  bullets: string[];
};

function SonicBullet({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <div className="text-sm text-text-primary leading-relaxed">
      <IdentityMarkdown content={content} />
    </div>
  );
}

/** Sonic listen cues from compatibilityText.bullets (compose music_translation section). */
export function SonicBulletsSection({ bullets }: SonicBulletsSectionProps) {
  const items = bullets.filter((b) => String(b).trim().length > 0);
  if (items.length === 0) return null;

  return (
    <div className="space-y-4 border-t border-border/60 pt-4">
      <h3 className="text-sm font-medium text-text-primary mb-2">How This Connection Sounds</h3>
      <div className="space-y-4">
        {items.map((bullet, i) => (
          <SonicBullet key={i} content={String(bullet)} />
        ))}
      </div>
    </div>
  );
}
