import type { EphemerisSnapshot } from '../contracts';
import type { ControlSurfacePayload } from '../explainer/contracts';

export interface CanonicalCompositionInput {
  snapshot: EphemerisSnapshot;
  payload: ControlSurfacePayload;
  seed: string;
  overlayNatalSnapshot?: EphemerisSnapshot;
  enableDailyV1Text?: boolean;
}

