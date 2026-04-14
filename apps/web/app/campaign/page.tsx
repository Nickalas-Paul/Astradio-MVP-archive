import React from 'react';
import { CampaignEntryClient } from './CampaignEntryClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function CampaignEntryPage() {
  return <CampaignEntryClient />;
}
