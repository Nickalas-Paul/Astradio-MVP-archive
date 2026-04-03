import { AppShell } from '@/components/AppShell';
import { ProfilePanel } from '@/components/community/ProfilePanel';
import { TestSessionResumeBlock } from '@/components/session/TestSessionResumeBlock';

export default function ProfilePage() {
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <section className="space-y-2">
          <h1 className="text-3xl font-bold text-text">Profile</h1>
          <p className="text-sm text-subtext max-w-2xl">
            Create or update your Astradio profile so your charts and soundtrack can persist across sessions.
          </p>
        </section>

        <TestSessionResumeBlock />
        <ProfilePanel />
      </div>
    </AppShell>
  );
}

