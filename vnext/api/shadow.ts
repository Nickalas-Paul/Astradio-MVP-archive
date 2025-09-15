import type { Request, Response, NextFunction } from "express";
import { encodeFeatures } from "../feature-encode";
import { generatePlanMLOnly } from "../plan-generator";

export async function shadowMiddleware(req: Request, res: Response, next: NextFunction) {
  // Do not change the live response. Run ML vNext in the background for telemetry.
  res.on("finish", async () => {
    try {
      if (process.env.FF_VNEXT_SHADOW !== "true") return;
      const snapshot = (req as any)?.body?.chartContext;
      if (!snapshot) return;
      const feat = encodeFeatures(snapshot);
      await generatePlanMLOnly(feat); // intentionally ignore result here
    } catch {
      // swallow errors; shadow must never impact live response
    }
  });
  next();
}
