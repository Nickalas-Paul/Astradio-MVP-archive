import type { CanonicalCompositionInput } from '../api/canonical-compose-input';
import type { EphemerisSnapshot } from '../contracts';
import type { ControlSurfacePayload } from '../explainer/contracts';

export function buildSandboxCanonicalInput(args: {
  snapshot: EphemerisSnapshot;
  payload: ControlSurfacePayload;
  seed: string;
}): CanonicalCompositionInput {
  return {
    snapshot: args.snapshot,
    payload: args.payload,
    seed: args.seed,
  };
}

