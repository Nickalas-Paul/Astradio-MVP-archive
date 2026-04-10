import { redirect } from 'next/navigation';

/** Compatibility discovery lives under Community → Discovery only. */
export default function CompatibilityRedirectPage() {
  redirect('/community?tab=discovery');
}
