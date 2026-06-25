import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AUTH_HORIZONTAL_PADDING } from '../src/constants/auth-styles';
import { colors } from '../src/constants/colors';
import { layout } from '../src/constants/layout';
import { typography } from '../src/constants/typography';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Body({ children }: { children: string }) {
  return <Text style={styles.body}>{children}</Text>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item} style={styles.listItem}>
          <Text style={styles.bullet}>{'\u2022'}</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.pageTitle}>Privacy Policy</Text>
        <Text style={styles.updated}>Last updated: June 25, 2026</Text>

        <Section title="Introduction">
          <Body>
            Astradio (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;) operates the website at astradio.io and the
            Astradio mobile application. This policy describes what information we collect, how we use it, and your
            rights regarding that information.
          </Body>
        </Section>

        <Section title="Information We Collect">
          <Subsection title="Information you provide">
            <Body>
              When you create an account, we collect your email address, display name, and password. When you create a
              chart, we collect birth date, birth time, and birth location. You may optionally provide a profile bio
              and avatar photo.
            </Body>
          </Subsection>
          <Subsection title="Information we generate">
            <Body>
              From your birth data, we generate natal chart calculations, identity readings, transit readings,
              compatibility readings, and audio compositions. These are stored on our servers and associated with your
              account.
            </Body>
          </Subsection>
          <Subsection title="Information collected automatically">
            <Body>
              We collect standard server logs including IP addresses, request timestamps, and user agent strings. We
              use cookies for session management on the web application. The mobile application uses secure
              token-based authentication.
            </Body>
          </Subsection>
          <Subsection title="Location data">
            <Body>
              If you grant location permission, we use your current location to calculate local transit charts.
              Location data is used for chart calculation only and is not stored persistently or shared with third
              parties.
            </Body>
          </Subsection>
        </Section>

        <Section title="How We Use Your Information">
          <Body>We use your information to:</Body>
          <BulletList
            items={[
              'Create and maintain your account',
              'Generate natal charts, readings, and audio compositions from your birth data',
              'Connect you with other users you choose to add as connections',
              'Display compatibility readings and relational content between connected users',
              'Send transactional emails (account verification, password reset)',
            ]}
          />
          <Body>
            We do not sell your personal information. We do not display advertising. We do not use your data to train
            machine learning models.
          </Body>
        </Section>

        <Section title="Third-Party Services">
          <Body>We use the following services to operate Astradio:</Body>
          <BulletList
            items={[
              'Vercel (web hosting)',
              'Render (API server and database hosting)',
              'Amazon Web Services (media storage via S3, image moderation via Rekognition)',
              'Google Cloud (audio generation via Vertex AI)',
              'Resend (transactional email delivery)',
            ]}
          />
          <Body>
            These services process your data only as necessary to provide their functionality. We do not share your
            birth data, readings, or audio compositions with any third party for their own purposes.
          </Body>
        </Section>

        <Section title="Content Moderation">
          <Body>
            Avatar images are screened using automated image moderation. Community posts and messages are screened for
            prohibited content using text filtering. Content that violates our standards may be removed.
          </Body>
        </Section>

        <Section title="Data Retention">
          <Body>
            Your account data, charts, readings, and compositions are retained as long as your account is active. Audio
            compositions are stored as content-addressed files and may be shared across users who generate identical
            chart configurations.
          </Body>
        </Section>

        <Section title="Account Deletion">
          <Body>
            You can delete your account at any time from the Settings page on the web app or the My Sky screen on the
            mobile app. Account deletion permanently removes your profile, charts, readings, saved compositions,
            connections, messages, and community posts. Audio files that are content-addressed and shared with other
            users&apos; compositions are not deleted. Account deletion cannot be undone.
          </Body>
        </Section>

        <Section title="Data Security">
          <Body>
            Passwords are hashed using Argon2id. All connections use HTTPS/TLS encryption. API authentication uses
            signed tokens. Database access is restricted to our application servers.
          </Body>
        </Section>

        <Section title="Children's Privacy">
          <Body>
            Astradio is not directed at children under 13. We do not knowingly collect information from children under
            13. If we learn that we have collected information from a child under 13, we will delete that information.
          </Body>
        </Section>

        <Section title="Changes to This Policy">
          <Body>
            We may update this policy from time to time. We will notify registered users of material changes by email.
            The &quot;Last updated&quot; date at the top reflects the most recent revision.
          </Body>
        </Section>

        <Section title="Contact">
          <Text style={styles.body}>
            For questions about this policy or your data, contact us at{' '}
            <Text style={styles.link} onPress={() => void Linking.openURL('mailto:Support@astradio.io')}>
              Support@astradio.io
            </Text>
            .
          </Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: AUTH_HORIZONTAL_PADDING,
    paddingBottom: layout.screenBottomPadding,
  },
  backButton: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  backText: {
    ...typography.bodySecondary,
    color: colors.accent.DEFAULT,
  },
  pageTitle: {
    ...typography.screenTitle,
    color: colors.text.primary,
    marginBottom: 8,
  },
  updated: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  section: {
    marginBottom: 28,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'Cormorant-SemiBold',
    fontSize: 22,
    color: colors.text.primary,
  },
  subsection: {
    gap: 8,
  },
  subsectionTitle: {
    fontFamily: 'Cormorant-SemiBold',
    fontSize: 18,
    color: colors.text.primary,
  },
  body: {
    ...typography.bodyPrimary,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  list: {
    gap: 8,
    paddingLeft: 4,
  },
  listItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  bullet: {
    ...typography.bodyPrimary,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  listText: {
    ...typography.bodyPrimary,
    color: colors.text.secondary,
    lineHeight: 22,
    flex: 1,
  },
  link: {
    color: colors.accent.DEFAULT,
  },
});
