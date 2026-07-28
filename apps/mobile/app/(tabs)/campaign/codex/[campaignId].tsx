import { useLocalSearchParams } from 'expo-router';
import { DungeonCodexScreen } from '../../../../src/components/campaign/DungeonCodexScreen';

export default function DungeonCodexRoute() {
  const params = useLocalSearchParams<{ campaignId: string; house?: string }>();
  const campaignId = Array.isArray(params.campaignId) ? params.campaignId[0] : params.campaignId;
  const houseRaw = Array.isArray(params.house) ? params.house[0] : params.house;
  const scrollHouse = houseRaw ? Number(houseRaw) : undefined;

  if (!campaignId) return null;

  return (
    <DungeonCodexScreen
      campaignId={campaignId}
      scrollHouse={Number.isFinite(scrollHouse) ? scrollHouse : undefined}
    />
  );
}
