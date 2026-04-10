import { redirect } from 'next/navigation';

export default function CompatibilityResultsRedirectPage() {
  redirect('/community?tab=discovery&view=clusters');
}
