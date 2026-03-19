import type { CanonicalCompositionInput } from '../api/canonical-compose-input';
import type { EphemerisSnapshot } from '../contracts';
import type { ControlSurfacePayload } from '../explainer/contracts';

export function buildOverlayCanonicalInput(args: {
  snapshot: EphemerisSnapshot;
  natalSnapshot: EphemerisSnapshot;
  payload: ControlSurfacePayload;
  seed: string;
}): CanonicalCompositionInput {
  return {
    snapshot: args.snapshot,
    overlayNatalSnapshot: args.natalSnapshot,
    payload: args.payload,
    seed: args.seed,
  };
}

