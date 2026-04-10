import { redirect } from 'next/navigation';

export default function CompatibilityIntentRedirectPage() {
  redirect('/community?tab=discovery');
}
