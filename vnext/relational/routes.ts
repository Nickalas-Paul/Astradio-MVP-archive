/**
 * Phase 5 — Relational groups API routes.
 * Owner auth enforced on every handler. Uses lib/relational-store.
 */

import type { Request, Response } from 'express';

// Path from dist/vnext/vnext/relational/ -> repo root lib
// eslint-disable-next-line @typescript-eslint/no-var-requires
const relationalStore = require('../../../../lib/relational-store');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const communityStore = require('../../../../lib/community-store');
import { resolveGroupChartIds } from './groups/member-resolver';

async function getOwnerId(req: Request): Promise<string | undefined> {
  const q = (req.query.userId as string) || undefined;
  if (q && typeof q === 'string' && q.trim()) return q.trim();
  const b = (req.body as Record<string, unknown>)?.userId as string | undefined;
  if (b && typeof b === 'string' && b.trim()) return b.trim();
  const u = (req as any).user;
  if (u && typeof u.id === 'string') return u.id;
  const ensure = communityStore.ensureDevUser;
  if (ensure) {
    const dev = await ensure();
    return dev?.id;
  }
  return undefined;
}

async function requireOwner(req: Request, res: Response): Promise<string | null> {
  try {
    const ownerId = await getOwnerId(req);
    if (!ownerId) {
      res.status(401).json({ error: 'owner_id required (userId query, body, or session)' });
      return null;
    }
    return ownerId;
  } catch (e) {
    res.status(401).json({ error: 'Could not resolve owner' });
    return null;
  }
}

function createRelationalRouter(): import('express').Router {
  const express = require('express') as typeof import('express');
  const router = express.Router({ mergeParams: true });

  // POST /api/relational/groups — create
  router.post('/relational/groups', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    try {
      const body = req.body || {};
      const { slug, name, description } = body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name required' });
      }
      const group = await relationalStore.createRelationalGroup({
        ownerId,
        slug: (slug && String(slug).trim()) || undefined,
        name: name.trim(),
        description: (description && String(description)) || '',
      });
      return res.status(201).json(group);
    } catch (e: unknown) {
      const err = e as Error;
      const isConflict = err?.message?.includes('unique') || (err as any)?.code === '23505';
      if (isConflict) return res.status(409).json({ error: 'Group slug already exists for owner' });
      console.error('[relational] POST /relational/groups', err);
      return res.status(500).json({ error: err?.message || 'Failed to create group' });
    }
  });

  // GET /api/relational/groups — list by owner
  router.get('/relational/groups', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    try {
      const groups = await relationalStore.listRelationalGroupsByOwner(ownerId);
      return res.status(200).json({ groups });
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] GET /relational/groups', err);
      return res.status(500).json({ error: err?.message || 'Failed to list groups' });
    }
  });

  // GET /api/relational/groups/:id — get one
  router.get('/relational/groups/:id', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const group = await relationalStore.getRelationalGroupById(id);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      if (group.ownerId !== ownerId) return res.status(403).json({ error: 'Not group owner' });
      return res.status(200).json(group);
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] GET /relational/groups/:id', err);
      return res.status(500).json({ error: err?.message || 'Failed to get group' });
    }
  });

  // PATCH /api/relational/groups/:id
  router.patch('/relational/groups/:id', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const body = req.body || {};
      const patch: Record<string, unknown> = {};
      if (body.name != null) patch.name = body.name;
      if (body.description != null) patch.description = body.description;
      if (body.slug != null) patch.slug = body.slug;
      const group = await relationalStore.updateRelationalGroup(id, ownerId, patch);
      if (!group) return res.status(404).json({ error: 'Group not found or not owner' });
      return res.status(200).json(group);
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] PATCH /relational/groups/:id', err);
      return res.status(500).json({ error: err?.message || 'Failed to update group' });
    }
  });

  // DELETE /api/relational/groups/:id
  router.delete('/relational/groups/:id', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const ok = await relationalStore.deleteRelationalGroup(id, ownerId);
      if (!ok) return res.status(404).json({ error: 'Group not found or not owner' });
      return res.status(204).send();
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] DELETE /relational/groups/:id', err);
      return res.status(500).json({ error: err?.message || 'Failed to delete group' });
    }
  });

  // POST /api/relational/groups/:id/members — add member
  router.post('/relational/groups/:id/members', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const groupId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const group = await relationalStore.getRelationalGroupById(groupId);
      if (!group || group.ownerId !== ownerId) return res.status(403).json({ error: 'Not group owner' });
      const body = req.body || {};
      const { memberType, chartId, userId, label } = body;
      if (!chartId || typeof chartId !== 'string' || !chartId.trim()) {
        return res.status(400).json({ error: 'chartId required' });
      }
      const mt = memberType === 'non_platform' ? 'non_platform' : 'platform';
      const member = await relationalStore.addRelationalGroupMember({
        groupId,
        memberType: mt,
        chartId: chartId.trim(),
        userId: mt === 'platform' ? (userId && String(userId).trim()) || undefined : undefined,
        label: (label && String(label)) || undefined,
      });
      return res.status(201).json(member);
    } catch (e: unknown) {
      const err = e as Error;
      const isConflict = err?.message?.includes('unique') || (err as any)?.code === '23505';
      if (isConflict) return res.status(409).json({ error: 'Chart already in group' });
      if (err?.message?.includes('platform member requires')) return res.status(400).json({ error: err.message });
      console.error('[relational] POST /relational/groups/:id/members', err);
      return res.status(500).json({ error: err?.message || 'Failed to add member' });
    }
  });

  // GET /api/relational/groups/:id/members — list members (includes chartIds for resolver)
  router.get('/relational/groups/:id/members', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const groupId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const members = await relationalStore.listRelationalGroupMembers(groupId, ownerId);
      if (!members) return res.status(404).json({ error: 'Group not found or not owner' });
      return res.status(200).json({ members });
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] GET /relational/groups/:id/members', err);
      return res.status(500).json({ error: err?.message || 'Failed to list members' });
    }
  });

  // GET /api/relational/groups/:id/chart-ids — resolve chart IDs (member resolver)
  router.get('/relational/groups/:id/chart-ids', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const groupId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const chartIds = await resolveGroupChartIds(groupId, ownerId);
      return res.status(200).json({ chartIds });
    } catch (e: unknown) {
      const err = e as Error;
      if (err?.message?.includes('not found')) return res.status(404).json({ error: err.message });
      if (err?.message?.includes('Unauthorized')) return res.status(403).json({ error: err.message });
      if (err?.message?.includes('no members')) return res.status(400).json({ error: err.message });
      console.error('[relational] GET /relational/groups/:id/chart-ids', err);
      return res.status(500).json({ error: err?.message || 'Failed to resolve chart IDs' });
    }
  });

  // DELETE /api/relational/groups/:id/members/:memberId
  router.delete('/relational/groups/:id/members/:memberId', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const groupId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const memberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
    try {
      const ok = await relationalStore.removeRelationalGroupMember(groupId, memberId, ownerId);
      if (!ok) return res.status(404).json({ error: 'Member not found or not group owner' });
      return res.status(204).send();
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] DELETE /relational/groups/:id/members/:memberId', err);
      return res.status(500).json({ error: err?.message || 'Failed to remove member' });
    }
  });

  return router;
}

export { createRelationalRouter, resolveGroupChartIds };
