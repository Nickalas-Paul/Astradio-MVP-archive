'use client';

import Link from 'next/link';
import { AppShell } from '@/components/AppShell';

function PrivacySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-h3 font-serif font-semibold text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

function PrivacySubsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-serif font-semibold text-text-primary">{title}</h3>
      {children}
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <AppShell showPlayer={false}>
      <article className="max-w-4xl mx-auto space-y-10 min-w-0 w-full pb-12">
        <header className="space-y-2 border-b border-border pb-8">
          <h1 className="text-h1 font-serif font-bold text-text-primary">Privacy Policy</h1>
          <p className="text-body-sm text-text-secondary">Last updated: June 25, 2026</p>
        </header>

        <PrivacySection title="Introduction">
          <p className="text-body text-text-secondary leading-relaxed">
            Astradio (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;) operates the website at astradio.io and the
            Astradio mobile application. This policy describes what information we collect, how we use it, and your
            rights regarding that information.
          </p>
        </PrivacySection>

        <PrivacySection title="Information We Collect">
          <PrivacySubsection title="Information you provide">
            <p className="text-body text-text-secondary leading-relaxed">
              When you create an account, we collect your email address, display name, and password. When you create a
              chart, we collect birth date, birth time, and birth location. You may optionally provide a profile bio and
              avatar photo.
            </p>
          </PrivacySubsection>
          <PrivacySubsection title="Information we generate">
            <p className="text-body text-text-secondary leading-relaxed">
              From your birth data, we generate natal chart calculations, identity readings, transit readings,
              compatibility readings, and audio compositions. These are stored on our servers and associated with your
              account.
            </p>
          </PrivacySubsection>
          <PrivacySubsection title="Information collected automatically">
            <p className="text-body text-text-secondary leading-relaxed">
              We collect standard server logs including IP addresses, request timestamps, and user agent strings. We
              use cookies for session management on the web application. The mobile application uses secure token-based
              authentication.
            </p>
          </PrivacySubsection>
          <PrivacySubsection title="Location data">
            <p className="text-body text-text-secondary leading-relaxed">
              If you grant location permission, we use your current location to calculate local transit charts. Location
              data is used for chart calculation only and is not stored persistently or shared with third parties.
            </p>
          </PrivacySubsection>
        </PrivacySection>

        <PrivacySection title="How We Use Your Information">
          <p className="text-body text-text-secondary leading-relaxed">We use your information to:</p>
          <ul className="list-disc pl-6 space-y-2 text-body text-text-secondary leading-relaxed">
            <li>Create and maintain your account</li>
            <li>Generate natal charts, readings, and audio compositions from your birth data</li>
            <li>Connect you with other users you choose to add as connections</li>
            <li>Display compatibility readings and relational content between connected users</li>
            <li>Send transactional emails (account verification, password reset)</li>
          </ul>
          <p className="text-body text-text-secondary leading-relaxed">
            We do not sell your personal information. We do not display advertising. We do not use your data to train
            machine learning models.
          </p>
        </PrivacySection>

        <PrivacySection title="Third-Party Services">
          <p className="text-body text-text-secondary leading-relaxed">
            We use the following services to operate Astradio:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-body text-text-secondary leading-relaxed">
            <li>Vercel (web hosting)</li>
            <li>Render (API server and database hosting)</li>
            <li>Amazon Web Services (media storage via S3, image moderation via Rekognition)</li>
            <li>Google Cloud (audio generation via Vertex AI)</li>
            <li>Resend (transactional email delivery)</li>
          </ul>
          <p className="text-body text-text-secondary leading-relaxed">
            These services process your data only as necessary to provide their functionality. We do not share your
            birth data, readings, or audio compositions with any third party for their own purposes.
          </p>
        </PrivacySection>

        <PrivacySection title="Content Moderation">
          <p className="text-body text-text-secondary leading-relaxed">
            Avatar images are screened using automated image moderation. Community posts and messages are screened for
            prohibited content using text filtering. Content that violates our standards may be removed.
          </p>
        </PrivacySection>

        <PrivacySection title="Data Retention">
          <p className="text-body text-text-secondary leading-relaxed">
            Your account data, charts, readings, and compositions are retained as long as your account is active. Audio
            compositions are stored as content-addressed files and may be shared across users who generate identical
            chart configurations.
          </p>
        </PrivacySection>

        <PrivacySection title="Account Deletion">
          <p className="text-body text-text-secondary leading-relaxed">
            You can delete your account at any time from the Settings page on the web app or the My Sky screen on the
            mobile app. Account deletion permanently removes your profile, charts, readings, saved compositions,
            connections, messages, and community posts. Audio files that are content-addressed and shared with other
            users&apos; compositions are not deleted. Account deletion cannot be undone.
          </p>
        </PrivacySection>

        <PrivacySection title="Data Security">
          <p className="text-body text-text-secondary leading-relaxed">
            Passwords are hashed using Argon2id. All connections use HTTPS/TLS encryption. API authentication uses signed
            tokens. Database access is restricted to our application servers.
          </p>
        </PrivacySection>

        <PrivacySection title="Children's Privacy">
          <p className="text-body text-text-secondary leading-relaxed">
            Astradio is not directed at children under 13. We do not knowingly collect information from children under
            13. If we learn that we have collected information from a child under 13, we will delete that information.
          </p>
        </PrivacySection>

        <PrivacySection title="Changes to This Policy">
          <p className="text-body text-text-secondary leading-relaxed">
            We may update this policy from time to time. We will notify registered users of material changes by email.
            The &quot;Last updated&quot; date at the top reflects the most recent revision.
          </p>
        </PrivacySection>

        <PrivacySection title="Contact">
          <p className="text-body text-text-secondary leading-relaxed">
            For questions about this policy or your data, contact us at{' '}
            <a href="mailto:Support@astradio.io" className="text-accent hover:underline">
              Support@astradio.io
            </a>
            .
          </p>
        </PrivacySection>

        <p className="text-body-sm text-text-muted text-center pt-4 border-t border-border">
          <Link href="/settings" className="text-accent hover:underline">
            Settings
          </Link>
          {' · '}
          <Link href="/today" className="text-accent hover:underline">
            Today
          </Link>
          {' · '}
          <Link href="/privacy" className="text-accent hover:underline">
            Privacy Policy
          </Link>
          {' · '}
          <Link href="/terms" className="text-accent hover:underline">
            Terms of Service
          </Link>
        </p>
      </article>
    </AppShell>
  );
}
