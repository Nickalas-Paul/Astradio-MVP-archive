import type { CanonicalCompositionInput } from '../api/canonical-compose-input';
import type { EphemerisSnapshot } from '../contracts';
import type { ControlSurfacePayload } from '../explainer/contracts';

export function buildHomeCanonicalInput(args: {
  snapshot: EphemerisSnapshot;
  payload: ControlSurfacePayload;
  seed: string;
  enableDailyV1Text: boolean;
}): CanonicalCompositionInput {
  return {
    snapshot: args.snapshot,
    payload: args.payload,
    seed: args.seed,
    enableDailyV1Text: args.enableDailyV1Text,
  };
}

