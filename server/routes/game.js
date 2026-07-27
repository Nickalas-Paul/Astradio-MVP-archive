/**
 * Phase 5 — Game API routes under /api/game/:campaignId/*
 * Dedicated DTOs; does not alter campaign-daily resolve flow.
 */

const express = require('express');
const pgStore = require('../../lib/pg-store');
const {
  CAMPAIGN_DAILY_ENGINE_VERSION,
  requireCampaignRuntimeModule,
} = require('../lib/campaign-runtime');

function loadGameRuntime() {
  return {
    isGameCombatEnabled: requireCampaignRuntimeModule('game/feature-gate').isGameCombatEnabled,
    buildCharacterDTO: requireCampaignRuntimeModule('game/dto-builders').buildCharacterDTO,
    buildGameStateDTO: requireCampaignRuntimeModule('game/dto-builders').buildGameStateDTO,
    buildInventoryDTO: requireCampaignRuntimeModule('game/dto-builders').buildInventoryDTO,
    buildEncounterDTO: requireCampaignRuntimeModule('game/dto-builders').buildEncounterDTO,
    buildLootTableDTO: requireCampaignRuntimeModule('game/dto-builders').buildLootTableDTO,
    profileFromBundle: requireCampaignRuntimeModule('game/dto-builders').profileFromBundle,
    processConsumableUse: requireCampaignRuntimeModule('game/consumable-use').processConsumableUse,
    ensureCharacterHp: requireCampaignRuntimeModule('game/hp-system').ensureCharacterHp,
    loadInventoryState: requireCampaignRuntimeModule('rpg/inventory-manager').loadInventoryState,
    equipItem: requireCampaignRuntimeModule('rpg/inventory-manager').equipItem,
    unequipSlot: requireCampaignRuntimeModule('rpg/inventory-manager').unequipSlot,
    getBagUtilization: requireCampaignRuntimeModule('rpg/inventory-manager').getBagUtilization,
    createEmptyInventoryState: requireCampaignRuntimeModule('rpg/types').createEmptyInventoryState,
    grantItem: requireCampaignRuntimeModule('rpg/store/inventory-store').grantItem,
    loadCampaignItems: requireCampaignRuntimeModule('rpg/store/inventory-store').loadCampaignItems,
    loadEquipmentState: requireCampaignRuntimeModule('rpg/store/inventory-store').loadEquipmentState,
    saveEquipmentState: requireCampaignRuntimeModule('rpg/store/inventory-store').saveEquipmentState,
    deleteItem: requireCampaignRuntimeModule('rpg/store/inventory-store').deleteItem,
    initializeEquipment: requireCampaignRuntimeModule('rpg/store/inventory-store').initializeEquipment,
    updateItemQuantity: requireCampaignRuntimeModule('rpg/store/inventory-store').updateItemQuantity,
    getBundleByHash: requireCampaignRuntimeModule('rpg/store/rpg-store').getBundleByHash,
    getBundleWithStats: requireCampaignRuntimeModule('rpg/store/rpg-store').getBundleWithStats,
    buildItemDefinitionMap: requireCampaignRuntimeModule('rpg/loot-roller').buildItemDefinitionMap,
    buildLootTableMap: requireCampaignRuntimeModule('rpg/loot-roller').buildLootTableMap,
    loadRpgV1Maps: requireCampaignRuntimeModule('rpg/maps/load-v1').loadRpgV1Maps,
    getChartById: requireCampaignRuntimeModule('compat/chart-store').getChartById,
    fetchChartSnapshot: requireCampaignRuntimeModule('core/architecture-engine').fetchChartSnapshot,
    generateArchitectureFromSnapshot: requireCampaignRuntimeModule('core/architecture-engine')
      .generateArchitectureFromSnapshot,
    buildCanonicalReportForSnapshotSurface: requireCampaignRuntimeModule(
      'canonical/build-from-compose-context'
    ).buildCanonicalReportForSnapshotSurface,
    interpretCanonicalReportObject: requireCampaignRuntimeModule('semantic/semantic-authority')
      .interpretCanonicalReportObject,
    hashSnapshot: requireCampaignRuntimeModule('rpg/hash/snapshot-hash').hashSnapshot,
    buildCharacterProfile: requireCampaignRuntimeModule('rpg/character-builder').buildCharacterProfile,
    buildRpgEffectsBundleFromSnapshot: requireCampaignRuntimeModule('rpg/effects/bundle-from-snapshot')
      .buildRpgEffectsBundleFromSnapshot,
    hashCanonicalJson: requireCampaignRuntimeModule('rpg/hash/json-hash').hashCanonicalJson,
  };
}

function requireCaller(req, res) {
  const u = req.user;
  if (u && typeof u.id === 'string' && u.id.trim()) return u.id.trim();
  const userId = (req.headers['x-caller-user-id'] || req.query.userId || '').toString().trim();
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return userId;
}

function chartRowToNatalInput(chart) {
  if (!chart || !chart.timezone || !String(chart.timezone).trim()) {
    const err = new Error('NATAL_TIMEZONE_REQUIRED');
    err.code = 'NATAL_TIMEZONE_REQUIRED';
    throw err;
  }
  const t = chart.time;
  const timeNorm = typeof t === 'string' && t.length >= 5 ? t.slice(0, 5) : String(t || '12:00').slice(0, 5);
  return {
    date: chart.date,
    time: timeNorm,
    lat: chart.lat,
    lon: chart.lon,
    timezone: chart.timezone,
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function createGameRouter() {
  const router = express.Router({ mergeParams: true });

  if (!process.env.POSTGRES_URL) {
    router.use((_req, res) => res.status(501).json({ error: 'game_requires_postgres' }));
    return router;
  }

  let vn;
  try {
    vn = loadGameRuntime();
  } catch (e) {
    console.error('[game] runtime unavailable; run npm run vnext:build', e);
    router.use((_req, res) =>
      res.status(503).json({ error: 'game_engine_unavailable', message: 'Run vnext:build' })
    );
    return router;
  }

  async function requireGameCaller(req, res) {
    const userId = requireCaller(req, res);
    if (!userId) return null;

    if (!vn.isGameCombatEnabled()) {
      res.status(503).json({ error: 'Game mode not enabled' });
      return null;
    }

    const campaignId = (req.params.campaignId || '').toString().trim();
    if (!campaignId) {
      res.status(400).json({ error: 'invalid_request', message: 'campaignId required' });
      return null;
    }

    const campaign = await pgStore.getStage5CampaignById(campaignId);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return null;
    }
    if (
      campaign.ownerUserId !== userId &&
      !(Array.isArray(campaign.participantUserIds) && campaign.participantUserIds.includes(userId))
    ) {
      res.status(404).json({ error: 'Campaign not found' });
      return null;
    }

    return { userId, campaign, campaignId };
  }

  async function loadInventory(campaignId, client) {
    await vn.initializeEquipment(campaignId, client);
    const items = await vn.loadCampaignItems(campaignId, client);
    const equipment = await vn.loadEquipmentState(campaignId, client);
    return vn.loadInventoryState(items, equipment);
  }

  function definitionsMap() {
    const maps = vn.loadRpgV1Maps();
    return vn.buildItemDefinitionMap(maps.itemDefinitions);
  }

  async function resolveProfile(campaign) {
    const charts = Array.isArray(campaign.participantChartIds) ? campaign.participantChartIds : [];
    const chartId = charts[0];
    let natalSnap = null;
    if (chartId) {
      try {
        const chart = await vn.getChartById(chartId);
        if (chart) {
          natalSnap = await vn.fetchChartSnapshot(chartRowToNatalInput(chart));
        }
      } catch (e) {
        console.warn('[game] natal load failed:', e?.message);
      }
    }

    if (natalSnap) {
      try {
        const arch = await vn.generateArchitectureFromSnapshot(natalSnap, vn.hashSnapshot(natalSnap));
        const seed = vn.hashSnapshot(natalSnap);
        const canonicalReport = vn.buildCanonicalReportForSnapshotSurface({
          surface_kind: 'profile_natal',
          subject_ids: [seed],
          snapshot: arch.snapshot,
          featureVec: arch.features,
          control_surface_hash: seed,
          compose_seed: seed,
          guidance: arch.guidance,
        });
        const semanticCore = vn.interpretCanonicalReportObject(canonicalReport);
        const bundle = vn.buildRpgEffectsBundleFromSnapshot(arch.snapshot);
        return vn.buildCharacterProfile({
          natalSnapshot: arch.snapshot,
          featureVec: arch.features,
          semanticCore,
          dominantPlanetNames: canonicalReport.participants[0]?.dominant_planet_names ?? [],
          effectsBundle: bundle,
        });
      } catch (e) {
        console.warn('[game] profile build failed:', e?.message);
      }
    }

    if (campaign.bundleHash && natalSnap) {
      const enriched = await vn.getBundleWithStats(campaign.bundleHash, natalSnap);
      if (enriched) {
        return vn.profileFromBundle(enriched.bundle, enriched.statBlock, enriched.statTrace);
      }
    }

    if (campaign.bundleHash) {
      const row = await vn.getBundleByHash(campaign.bundleHash);
      const bundle = row?.bundle_json;
      if (bundle?.statBlock && bundle?.statTrace) {
        return vn.profileFromBundle(bundle, bundle.statBlock, bundle.statTrace);
      }
      if (bundle) {
        const fallbackStats = {
          vitality: 10,
          resilience: 10,
          cunning: 10,
          charm: 10,
          intuition: 10,
          willpower: 10,
        };
        const emptyTrace = {
          raw: fallbackStats,
          final: fallbackStats,
          perPlanet: {},
          aspectBonuses: [],
        };
        return vn.profileFromBundle(
          bundle,
          bundle.statBlock || fallbackStats,
          bundle.statTrace || emptyTrace
        );
      }
    }

    return null;
  }

  // ---------- GET /game/:campaignId/character ----------
  async function handleGetCharacter(req, res) {
    const ctx = await requireGameCaller(req, res);
    if (!ctx) return;
    try {
      const profile = await resolveProfile(ctx.campaign);
      if (!profile) {
        return res.status(503).json({ error: 'bundle not found' });
      }
      const inventoryState = await loadInventory(ctx.campaignId);
      const dto = vn.buildCharacterDTO({
        profile,
        inventoryState,
        definitions: definitionsMap(),
        campaignState: ctx.campaign.stateJson || {},
        calendarDate: todayIso(),
      });
      return res.status(200).json(dto);
    } catch (e) {
      console.error('[game/character]', e);
      return res.status(500).json({ error: e?.message || 'character_failed' });
    }
  }

  // ---------- GET /game/:campaignId/state ----------
  async function handleGetState(req, res) {
    const ctx = await requireGameCaller(req, res);
    if (!ctx) return;
    try {
      const inventoryState = await loadInventory(ctx.campaignId);
      let fallbackStats = { vitality: 10, resilience: 10 };
      try {
        const profile = await resolveProfile(ctx.campaign);
        if (profile?.statBlock) {
          fallbackStats = {
            vitality: profile.statBlock.vitality,
            resilience: profile.statBlock.resilience,
          };
        }
      } catch (_) {
        /* defaults */
      }
      const dto = vn.buildGameStateDTO({
        campaignId: ctx.campaignId,
        state: ctx.campaign.stateJson || {},
        inventoryState,
        fallbackStats,
      });
      return res.status(200).json(dto);
    } catch (e) {
      console.error('[game/state]', e);
      return res.status(500).json({ error: e?.message || 'state_failed' });
    }
  }

  // ---------- GET /game/:campaignId/inventory ----------
  async function handleGetInventory(req, res) {
    const ctx = await requireGameCaller(req, res);
    if (!ctx) return;
    try {
      const inventoryState = await loadInventory(ctx.campaignId);
      const profile = await resolveProfile(ctx.campaign);
      const dto = vn.buildInventoryDTO(
        ctx.campaignId,
        inventoryState,
        definitionsMap(),
        profile?.classSlug
      );
      return res.status(200).json(dto);
    } catch (e) {
      console.error('[game/inventory]', e);
      return res.status(500).json({ error: e?.message || 'inventory_failed' });
    }
  }

  // ---------- POST /game/:campaignId/inventory/equip ----------
  async function handleEquip(req, res) {
    const ctx = await requireGameCaller(req, res);
    if (!ctx) return;
    const instanceId = (req.body?.instanceId || '').toString().trim();
    if (!instanceId) {
      return res.status(400).json({ error: 'invalid_request', message: 'instanceId required' });
    }
    try {
      const definitions = definitionsMap();
      let inventoryState = await loadInventory(ctx.campaignId);
      const item = inventoryState.items.find((i) => i.instanceId === instanceId);
      if (!item) {
        return res.status(400).json({ error: 'invalid_request', message: 'item not found in bag' });
      }
      const already = Object.values(inventoryState.equipped).includes(instanceId);
      if (already) {
        return res.status(409).json({ error: 'conflict', message: 'item already equipped' });
      }
      try {
        inventoryState = vn.equipItem(inventoryState, instanceId, definitions);
      } catch (err) {
        return res.status(400).json({ error: 'invalid_request', message: err?.message || 'equip failed' });
      }
      await vn.saveEquipmentState(
        ctx.campaignId,
        inventoryState.equipped,
        inventoryState.slotsUnlocked,
        inventoryState.maxBagSize
      );
      const profile = await resolveProfile(ctx.campaign);
      return res.status(200).json(
        vn.buildInventoryDTO(ctx.campaignId, inventoryState, definitions, profile?.classSlug)
      );
    } catch (e) {
      console.error('[game/equip]', e);
      return res.status(500).json({ error: e?.message || 'equip_failed' });
    }
  }

  // ---------- POST /game/:campaignId/inventory/unequip ----------
  async function handleUnequip(req, res) {
    const ctx = await requireGameCaller(req, res);
    if (!ctx) return;
    const slot = (req.body?.slot || '').toString().trim();
    const validSlots = ['weapon', 'armor', 'accessory', 'consumable_1', 'consumable_2', 'relic'];
    if (!validSlots.includes(slot)) {
      return res.status(400).json({ error: 'invalid_request', message: 'invalid slot name' });
    }
    try {
      const definitions = definitionsMap();
      let inventoryState = await loadInventory(ctx.campaignId);
      if (!inventoryState.equipped[slot]) {
        return res.status(400).json({ error: 'invalid_request', message: 'slot is already empty' });
      }
      inventoryState = vn.unequipSlot(inventoryState, slot);
      await vn.saveEquipmentState(
        ctx.campaignId,
        inventoryState.equipped,
        inventoryState.slotsUnlocked,
        inventoryState.maxBagSize
      );
      const profile = await resolveProfile(ctx.campaign);
      return res.status(200).json(
        vn.buildInventoryDTO(ctx.campaignId, inventoryState, definitions, profile?.classSlug)
      );
    } catch (e) {
      console.error('[game/unequip]', e);
      return res.status(500).json({ error: e?.message || 'unequip_failed' });
    }
  }

  // ---------- POST /game/:campaignId/inventory/use ----------
  async function handleUseConsumable(req, res) {
    const ctx = await requireGameCaller(req, res);
    if (!ctx) return;
    const instanceId = (req.body?.instanceId || '').toString().trim();
    if (!instanceId) {
      return res.status(400).json({ error: 'invalid_request', message: 'instanceId required' });
    }
    try {
      const definitions = definitionsMap();
      const calendarDate = todayIso();

      const result = await pgStore.withTransaction(async (client) => {
        const campaignRes = await client.query(
          `SELECT campaign_id, state_json, state_hash, state_version
           FROM stage5_campaigns WHERE campaign_id = $1 FOR UPDATE`,
          [ctx.campaignId]
        );
        const row = campaignRes.rows[0];
        if (!row) {
          return { status: 404, body: { error: 'Campaign not found' } };
        }

        let inventoryState = await loadInventory(ctx.campaignId, client);
        const stateJson = row.state_json && typeof row.state_json === 'object' ? { ...row.state_json } : {};
        const profile = await resolveProfile(ctx.campaign);
        const stats = profile?.statBlock || {
          vitality: 10,
          resilience: 10,
          cunning: 10,
          charm: 10,
          intuition: 10,
          willpower: 10,
        };

        let used;
        try {
          const hp = vn.ensureCharacterHp(stateJson.hp, stats);
          used = vn.processConsumableUse({
            inventoryState,
            instanceId,
            definitions,
            hp,
            calendarDate,
            activeBuffs: Array.isArray(stateJson.activeBuffs) ? stateJson.activeBuffs : [],
            damageShield: stateJson.damageShield || null,
          });
        } catch (err) {
          return {
            status: 400,
            body: { error: 'invalid_request', message: err?.message || 'use failed' },
          };
        }

        if (
          used.effect?.type === 'heal' &&
          used.hpBefore >= (used.hp?.max ?? Infinity) &&
          used.hpAfter === used.hpBefore &&
          !used.woundedCleared
        ) {
          return {
            status: 422,
            body: { error: 'unprocessable', message: 'already at full HP' },
          };
        }

        inventoryState = used.inventoryState;
        stateJson.hp = used.hp;
        stateJson.activeBuffs = used.activeBuffs;
        stateJson.damageShield = used.damageShield;
        if (used.revealActive) stateJson.revealActive = true;

        if (used.itemConsumed) {
          await vn.deleteItem(instanceId, client);
        } else {
          const rem = inventoryState.items.find((i) => i.instanceId === instanceId);
          if (rem) {
            await vn.updateItemQuantity(rem.instanceId, rem.quantity, client);
          }
        }
        await vn.saveEquipmentState(
          ctx.campaignId,
          inventoryState.equipped,
          inventoryState.slotsUnlocked,
          inventoryState.maxBagSize,
          client
        );

        const newHash = vn.hashCanonicalJson(stateJson);
        await client.query(
          `UPDATE stage5_campaigns
           SET state_json = $1::jsonb, state_hash = $2, state_version = state_version + 1, updated_at = NOW()
           WHERE campaign_id = $3`,
          [JSON.stringify(stateJson), newHash, ctx.campaignId]
        );

        return {
          status: 200,
          body: {
            used: true,
            effect: {
              type: used.effect.type,
              stat: used.effect.stat ?? null,
              magnitude: used.effect.magnitude,
              duration: used.effect.duration ?? null,
            },
            hpBefore: used.hpBefore,
            hpAfter: used.hpAfter,
            woundedCleared: used.woundedCleared,
            itemConsumed: used.itemConsumed,
            updatedState: {
              hp: used.hp,
              activeBuffs: used.activeBuffs,
              damageShield: used.damageShield,
              revealActive: !!stateJson.revealActive,
            },
          },
        };
      });

      return res.status(result.status).json(result.body);
    } catch (e) {
      console.error('[game/use]', e);
      return res.status(500).json({ error: e?.message || 'use_failed' });
    }
  }

  // ---------- POST /game/:campaignId/inventory/discard ----------
  async function handleDiscard(req, res) {
    const ctx = await requireGameCaller(req, res);
    if (!ctx) return;
    const instanceId = (req.body?.instanceId || '').toString().trim();
    if (!instanceId) {
      return res.status(400).json({ error: 'invalid_request', message: 'instanceId required' });
    }
    try {
      const definitions = definitionsMap();
      const inventoryState = await loadInventory(ctx.campaignId);
      const item = inventoryState.items.find((i) => i.instanceId === instanceId);
      if (!item) {
        return res.status(404).json({ error: 'item not found' });
      }
      if (Object.values(inventoryState.equipped).includes(instanceId)) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'item is currently equipped (must unequip first)',
        });
      }
      const def = definitions.get(item.slug);
      await vn.deleteItem(instanceId);
      const nextItems = inventoryState.items.filter((i) => i.instanceId !== instanceId);
      const bagUsed = nextItems.length;
      return res.status(200).json({
        discarded: true,
        slug: item.slug,
        name: def?.name || item.slug,
        bagUsed,
        maxBagSize: inventoryState.maxBagSize,
      });
    } catch (e) {
      console.error('[game/discard]', e);
      return res.status(500).json({ error: e?.message || 'discard_failed' });
    }
  }

  // ---------- GET /game/:campaignId/encounter ----------
  async function handleGetEncounter(req, res) {
    const ctx = await requireGameCaller(req, res);
    if (!ctx) return;
    try {
      const date = (req.query.date || todayIso()).toString().trim();
      const engineVersion = (req.query.engineVersion || CAMPAIGN_DAILY_ENGINE_VERSION).toString().trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'invalid_request', message: 'date YYYY-MM-DD required' });
      }

      const existing = await pgStore.getCampaignDailyState(ctx.campaignId, date, engineVersion);
      if (!existing || !existing.dailyStateJson) {
        return res.status(404).json({
          error: 'daily_not_found',
          code: 'DAILY_REQUIRED',
          message: 'Compose daily first via GET/POST /api/campaigns/:id/daily',
        });
      }

      const dailyStateJson = existing.dailyStateJson;
      const dailyInner =
        dailyStateJson.daily && typeof dailyStateJson.daily === 'object'
          ? dailyStateJson.daily
          : dailyStateJson;
      if (!dailyInner.challenge) {
        return res.status(404).json({
          error: 'daily_not_found',
          code: 'DAILY_INCOMPLETE',
          message: 'Daily challenge not available',
        });
      }

      const profile = await resolveProfile(ctx.campaign);
      if (!profile) {
        return res.status(503).json({ error: 'bundle not found' });
      }
      const inventoryState = await loadInventory(ctx.campaignId);
      const dto = vn.buildEncounterDTO({
        campaignId: ctx.campaignId,
        calendarDate: date,
        dailyInner,
        resolution: dailyStateJson.resolution || null,
        profile,
        inventoryState,
        definitions: definitionsMap(),
        campaignState: ctx.campaign.stateJson || {},
      });
      return res.status(200).json(dto);
    } catch (e) {
      console.error('[game/encounter]', e);
      return res.status(500).json({ error: e?.message || 'encounter_failed' });
    }
  }

  // ---------- GET /game/:campaignId/loot-table ----------
  async function handleGetLootTable(req, res) {
    const ctx = await requireGameCaller(req, res);
    if (!ctx) return;
    try {
      const state = ctx.campaign.stateJson || {};
      const chapterHouse =
        (state.activeChapter && Number.isFinite(state.activeChapter.currentHouse)
          ? Number(state.activeChapter.currentHouse)
          : null) ??
        (state.saturnChapter && Number.isFinite(state.saturnChapter.currentHouse)
          ? Number(state.saturnChapter.currentHouse)
          : null) ??
        1;
      const maps = vn.loadRpgV1Maps();
      const tables = vn.buildLootTableMap(maps.lootTables);
      const definitions = vn.buildItemDefinitionMap(maps.itemDefinitions);
      const profile = await resolveProfile(ctx.campaign);
      const chapter = Number.isFinite(state.chapter) ? Number(state.chapter) : 1;
      const dto = vn.buildLootTableDTO({
        campaignId: ctx.campaignId,
        saturnHouse: chapterHouse,
        table: tables.get(chapterHouse) || null,
        definitions,
        classSlug: profile?.classSlug || '',
        campaignChapter: chapter,
      });
      return res.status(200).json(dto);
    } catch (e) {
      console.error('[game/loot-table]', e);
      return res.status(500).json({ error: e?.message || 'loot_table_failed' });
    }
  }

  const json = express.json({ limit: '64kb' });

  router.get('/game/:campaignId/character', handleGetCharacter);
  router.get('/game/:campaignId/state', handleGetState);
  router.get('/game/:campaignId/inventory', handleGetInventory);
  router.post('/game/:campaignId/inventory/equip', json, handleEquip);
  router.post('/game/:campaignId/inventory/unequip', json, handleUnequip);
  router.post('/game/:campaignId/inventory/use', json, handleUseConsumable);
  router.post('/game/:campaignId/inventory/discard', json, handleDiscard);
  router.get('/game/:campaignId/encounter', handleGetEncounter);
  router.get('/game/:campaignId/loot-table', handleGetLootTable);

  return router;
}

module.exports = { createGameRouter };
