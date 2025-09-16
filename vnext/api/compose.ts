import type { Request, Response } from "express";
import { encodeFeatures } from "../feature-encode";
import { generatePlanMLOnly } from "../plan-generator";

export async function vnextCompose(req: Request, res: Response) {
  try {
    // Uses chartContext supplied by existing Swiss Ephemeris path (no live calls here)
    const snapshot = req.body?.chartContext;
    if (!snapshot) return res.status(400).json({ ok: false, error: "Missing chartContext" });

    const feat = encodeFeatures(snapshot);
    const { plan, source, diag } = await generatePlanMLOnly(feat);
    res.json({ ok: true, source, plan, quality: (plan as any).__quality, diag });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message || "vNext compose failed" });
  }
}
