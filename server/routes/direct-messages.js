/**
 * Direct messaging API: conversations and messages between users.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { proxySecretGate } = require('../../lib/proxy-secret-gate');
const { moderateCommunityText } = require('../../lib/community-content-moderation');
const { assertDirectMessagesEnabled } = require('../../lib/direct-messages-enabled');

const MESSAGE_BODY_MAX = 1000;
const PREVIEW_MAX = 100;
const EXPORT_ID_RE = /^[a-f0-9]{64}$/;

let pgStore = null;
try {
  if (process.env.POSTGRES_URL) {
    pgStore = require('../../lib/pg-store');
  }
} catch (_) {
  pgStore = null;
}

const dmMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many messages; try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const dmConversationCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many new conversations; try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

async function getDevUserId() {
  if (!pgStore) throw new Error('postgres_unavailable');
  const u = await pgStore.ensureDevUser();
  return u.id;
}

function queryUserId(req) {
  const q = req.query?.userId != null ? String(req.query.userId).trim() : '';
  return q || null;
}

function bodyUserId(body) {
  const b = body?.userId != null ? String(body.userId).trim() : '';
  return b || null;
}

async function resolveUserId(req, body) {
  return queryUserId(req) || bodyUserId(body || {}) || (await getDevUserId());
}

function messagePreview(body, audioLabel) {
  const text = String(body || '').trim();
  if (text) return text.slice(0, PREVIEW_MAX);
  const label = String(audioLabel || '').trim();
  if (label) return label.slice(0, PREVIEW_MAX);
  return '';
}

function validateExportId(id) {
  const s = id != null ? String(id).trim() : '';
  if (!s) return null;
  if (!EXPORT_ID_RE.test(s)) return { error: 'invalid_audio_export_id' };
  return s;
}

function validateMessageBody(body) {
  const s = body != null ? String(body) : '';
  if (s.length > MESSAGE_BODY_MAX) return { error: 'body_too_long', max: MESSAGE_BODY_MAX };
  return s;
}

async function peerIdentity(peerUserId) {
  if (!peerUserId || !pgStore) return null;
  const u = await pgStore.getUser(peerUserId);
  if (!u) {
    return {
      userId: peerUserId,
      displayName: null,
      handle: null,
      avatarUrl: null,
    };
  }
  return {
    userId: peerUserId,
    displayName: u.displayName || null,
    handle: u.handle || null,
    avatarUrl: `/api/profile/avatar/${encodeURIComponent(peerUserId)}`,
  };
}

async function enrichConversationRow(conversation, viewerUserId) {
  const peerId = pgStore.dmPeerUserId(conversation, viewerUserId);
  const [peer, unreadCount] = await Promise.all([
    peerIdentity(peerId),
    pgStore.countDmUnreadMessages(conversation.id, viewerUserId),
  ]);
  return {
    id: conversation.id,
    peer,
    status: conversation.status,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    unreadCount,
    initiatedBy: conversation.initiatedBy,
    createdAt: conversation.createdAt,
  };
}

async function loadNotificationService() {
  try {
    return require('../../lib/community-notification-service');
  } catch (_) {
    return null;
  }
}

async function loadPubsub() {
  try {
    return require('../../lib/redis-pubsub');
  } catch (_) {
    return null;
  }
}

async function notifyMessageRecipient({ recipientUserId, actorUserId, conversationId, messageId, preview, type }) {
  const notificationService = await loadNotificationService();
  if (!notificationService?.enqueueNotification) return;
  await notificationService.enqueueNotification({
    recipientUserId,
    type: type || 'message',
    conversationId,
    messageId,
    actorUserId,
    preview: preview ? String(preview).slice(0, 120) : undefined,
  });
}

async function publishMessageEvent({ recipientUserId, conversationId, messageId }) {
  const pubsub = await loadPubsub();
  if (!pubsub?.publishEvent || !pubsub.CHANNELS?.MESSAGES) return;
  await pubsub.publishEvent(pubsub.CHANNELS.MESSAGES, {
    type: 'message',
    recipientUserId,
    conversationId,
    messageId,
  });
}

async function insertMessageAndUpdateConversation({
  conversationId,
  senderId,
  recipientId,
  body,
  audioExportId,
  audioLabel,
  conversationStatus,
}) {
  const insertResult = await pgStore.insertDmMessage({
    conversationId,
    senderId,
    body,
    audioExportId,
    audioLabel,
  });
  if (!insertResult.ok) return insertResult;

  const preview = messagePreview(body, audioLabel);
  const t = insertResult.message.createdAt;
  await pgStore.updateDmConversation(conversationId, {
    lastMessageAt: t,
    lastMessagePreview: preview,
  });

  if (conversationStatus === 'active' && recipientId) {
    await notifyMessageRecipient({
      recipientUserId: recipientId,
      actorUserId: senderId,
      conversationId,
      messageId: insertResult.message.id,
      preview,
      type: 'message',
    });
    await publishMessageEvent({
      recipientUserId: recipientId,
      conversationId,
      messageId: insertResult.message.id,
    });
  } else if (conversationStatus === 'requested' && recipientId) {
    await notifyMessageRecipient({
      recipientUserId: recipientId,
      actorUserId: senderId,
      conversationId,
      messageId: insertResult.message.id,
      preview,
      type: 'message_request',
    });
    await publishMessageEvent({
      recipientUserId: recipientId,
      conversationId,
      messageId: insertResult.message.id,
    });
  }

  return insertResult;
}

function createDirectMessagesRouter() {
  const router = express.Router({ mergeParams: true });
  router.use(proxySecretGate);
  router.use(assertDirectMessagesEnabled);

  router.get('/dm/conversations', async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const userId = await resolveUserId(req);
      if (!userId) return res.status(401).json({ error: 'unauthorized' });

      const rows = await pgStore.listDmConversationsForUser(userId);
      const conversations = [];
      const requests = [];
      for (const row of rows) {
        const enriched = await enrichConversationRow(row, userId);
        if (row.status === 'requested') {
          requests.push({
            id: enriched.id,
            peer: enriched.peer,
            status: enriched.status,
            lastMessagePreview: enriched.lastMessagePreview,
            createdAt: enriched.createdAt,
            initiatedBy: enriched.initiatedBy,
          });
        } else {
          conversations.push(enriched);
        }
      }
      return res.status(200).json({ conversations, requests });
    } catch (e) {
      console.error('[dm] GET /dm/conversations', e);
      return res.status(500).json({ error: e?.message || 'list_conversations_failed' });
    }
  });

  router.post('/dm/conversations', dmConversationCreateLimiter, async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const body = req.body || {};
      const senderId = await resolveUserId(req, body);
      const recipientId = String(body.recipientUserId || '').trim();
      if (!senderId) return res.status(401).json({ error: 'unauthorized' });
      if (!recipientId) return res.status(400).json({ error: 'recipientUserId_required' });
      if (senderId === recipientId) return res.status(400).json({ error: 'cannot_message_self' });
      if (await pgStore.isUserBlocked(senderId, recipientId)) {
        return res.status(403).json({ error: 'blocked' });
      }

      const bodyText = validateMessageBody(body.body);
      if (bodyText && typeof bodyText === 'object' && bodyText.error) {
        return res.status(400).json(bodyText);
      }
      const text = String(bodyText || '');
      const audioExportId = body.audioExportId != null ? validateExportId(body.audioExportId) : null;
      if (audioExportId && typeof audioExportId === 'object' && audioExportId.error) {
        return res.status(400).json(audioExportId);
      }
      const audioLabel = body.audioLabel != null ? String(body.audioLabel).trim() : null;

      if (text.trim()) {
        const moderation = moderateCommunityText(text);
        if (!moderation.ok) {
          return res.status(400).json({
            error: 'content_moderation_failed',
            message: moderation.message,
          });
        }
      }

      let conversation = await pgStore.getDmConversationByParticipants(senderId, recipientId);

      if (conversation) {
        if (conversation.status === 'declined') {
          return res.status(403).json({ error: 'conversation_declined' });
        }
        if (conversation.status === 'active') {
          const hasContent = Boolean(text.trim() || audioExportId);
          if (hasContent) {
            const insertResult = await insertMessageAndUpdateConversation({
              conversationId: conversation.id,
              senderId,
              recipientId,
              body: text,
              audioExportId,
              audioLabel,
              conversationStatus: 'active',
            });
            if (!insertResult.ok) {
              return res.status(400).json({ error: insertResult.error || 'send_failed' });
            }
            return res.status(200).json({
              conversationId: conversation.id,
              existing: true,
              message: insertResult.message,
            });
          }
          return res.status(200).json({ conversationId: conversation.id, existing: true });
        }
        if (conversation.status === 'inactive') {
          const upd = await pgStore.updateDmConversation(conversation.id, { status: 'active' });
          if (!upd.ok) return res.status(400).json({ error: upd.error || 'reactivate_failed' });
          conversation = upd.conversation;
        }
        if (conversation.status === 'requested') {
          return res.status(200).json({ conversationId: conversation.id, existing: true, status: 'requested' });
        }
      }

      if (!conversation) {
        const connected = await pgStore.areUsersConnected(senderId, recipientId);
        const status = connected ? 'active' : 'requested';
        const created = await pgStore.createDmConversation({
          senderId,
          recipientId,
          status,
        });
        if (!created.ok) {
          if (created.error === 'dm_tables_missing') return res.status(501).json({ error: 'dm_unavailable' });
          return res.status(400).json({ error: created.error || 'create_failed' });
        }
        conversation = created.conversation;
      }

      const insertResult = await insertMessageAndUpdateConversation({
        conversationId: conversation.id,
        senderId,
        recipientId,
        body: text,
        audioExportId,
        audioLabel,
        conversationStatus: conversation.status,
      });
      if (!insertResult.ok) {
        if (insertResult.error === 'dm_tables_missing') return res.status(501).json({ error: 'dm_unavailable' });
        return res.status(400).json({ error: insertResult.error || 'send_failed' });
      }

      return res.status(201).json({
        conversationId: conversation.id,
        conversation,
        message: insertResult.message,
      });
    } catch (e) {
      console.error('[dm] POST /dm/conversations', e);
      return res.status(500).json({ error: e?.message || 'create_conversation_failed' });
    }
  });

  router.get('/dm/conversations/:id', async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const userId = await resolveUserId(req);
      const conversationId = String(req.params.id || '').trim();
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      if (!conversationId) return res.status(400).json({ error: 'invalid_id' });

      const conversation = await pgStore.getDmConversationById(conversationId);
      if (!conversation) return res.status(404).json({ error: 'not_found' });
      if (!pgStore.userParticipatesInDmConversation(conversation, userId)) {
        return res.status(403).json({ error: 'forbidden' });
      }

      const before = req.query.before != null ? String(req.query.before).trim() : null;
      const limitRaw = parseInt(String(req.query.limit || '50'), 10);
      const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
      const { messages, hasMore } = await pgStore.listDmMessagesForConversation(conversationId, {
        before: before || undefined,
        limit,
      });
      const peerId = pgStore.dmPeerUserId(conversation, userId);
      const peer = await peerIdentity(peerId);

      return res.status(200).json({
        conversation: {
          id: conversation.id,
          status: conversation.status,
          initiatedBy: conversation.initiatedBy,
          peer,
        },
        messages,
        hasMore,
      });
    } catch (e) {
      console.error('[dm] GET /dm/conversations/:id', e);
      return res.status(500).json({ error: e?.message || 'get_conversation_failed' });
    }
  });

  router.post('/dm/conversations/:id/messages', dmMessageLimiter, async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const body = req.body || {};
      const senderId = await resolveUserId(req, body);
      const conversationId = String(req.params.id || '').trim();
      if (!senderId) return res.status(401).json({ error: 'unauthorized' });
      if (!conversationId) return res.status(400).json({ error: 'invalid_id' });

      const conversation = await pgStore.getDmConversationById(conversationId);
      if (!conversation) return res.status(404).json({ error: 'not_found' });
      if (!pgStore.userParticipatesInDmConversation(conversation, senderId)) {
        return res.status(403).json({ error: 'forbidden' });
      }
      if (conversation.status !== 'active') {
        return res.status(403).json({ error: 'conversation_not_active' });
      }

      const bodyText = validateMessageBody(body.body);
      if (bodyText && typeof bodyText === 'object' && bodyText.error) {
        return res.status(400).json(bodyText);
      }
      const text = String(bodyText || '');
      const audioExportId = body.audioExportId != null ? validateExportId(body.audioExportId) : null;
      if (audioExportId && typeof audioExportId === 'object' && audioExportId.error) {
        return res.status(400).json(audioExportId);
      }
      const audioLabel = body.audioLabel != null ? String(body.audioLabel).trim() : null;

      if (!text.trim() && !audioExportId) {
        return res.status(400).json({ error: 'content_required' });
      }

      const moderation = moderateCommunityText(text);
      if (!moderation.ok) {
        return res.status(400).json({
          error: 'content_moderation_failed',
          message: moderation.message,
        });
      }

      const recipientId = pgStore.dmPeerUserId(conversation, senderId);
      const insertResult = await insertMessageAndUpdateConversation({
        conversationId,
        senderId,
        recipientId,
        body: text,
        audioExportId,
        audioLabel,
        conversationStatus: 'active',
      });
      if (!insertResult.ok) {
        if (insertResult.error === 'dm_tables_missing') return res.status(501).json({ error: 'dm_unavailable' });
        return res.status(400).json({ error: insertResult.error || 'send_failed' });
      }

      return res.status(201).json({ message: insertResult.message });
    } catch (e) {
      console.error('[dm] POST /dm/conversations/:id/messages', e);
      return res.status(500).json({ error: e?.message || 'send_message_failed' });
    }
  });

  router.post('/dm/conversations/:id/accept', async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const body = req.body || {};
      const userId = await resolveUserId(req, body);
      const conversationId = String(req.params.id || '').trim();
      if (!userId) return res.status(401).json({ error: 'unauthorized' });

      const conversation = await pgStore.getDmConversationById(conversationId);
      if (!conversation) return res.status(404).json({ error: 'not_found' });
      if (!pgStore.userParticipatesInDmConversation(conversation, userId)) {
        return res.status(403).json({ error: 'forbidden' });
      }
      if (conversation.status !== 'requested') {
        return res.status(400).json({ error: 'not_a_request' });
      }
      if (conversation.initiatedBy === userId) {
        return res.status(403).json({ error: 'initiator_cannot_accept' });
      }

      const upd = await pgStore.updateDmConversation(conversationId, { status: 'active' });
      if (!upd.ok) return res.status(400).json({ error: upd.error || 'accept_failed' });

      const notificationService = await loadNotificationService();
      if (notificationService?.enqueueNotification) {
        await notificationService.enqueueNotification({
          recipientUserId: conversation.initiatedBy,
          type: 'message_request_accepted',
          conversationId,
          actorUserId: userId,
        });
      }

      return res.status(200).json({ ok: true, conversation: upd.conversation });
    } catch (e) {
      console.error('[dm] POST /dm/conversations/:id/accept', e);
      return res.status(500).json({ error: e?.message || 'accept_failed' });
    }
  });

  router.post('/dm/conversations/:id/decline', async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const body = req.body || {};
      const userId = await resolveUserId(req, body);
      const conversationId = String(req.params.id || '').trim();
      if (!userId) return res.status(401).json({ error: 'unauthorized' });

      const conversation = await pgStore.getDmConversationById(conversationId);
      if (!conversation) return res.status(404).json({ error: 'not_found' });
      if (!pgStore.userParticipatesInDmConversation(conversation, userId)) {
        return res.status(403).json({ error: 'forbidden' });
      }
      if (conversation.status !== 'requested') {
        return res.status(400).json({ error: 'not_a_request' });
      }
      if (conversation.initiatedBy === userId) {
        return res.status(403).json({ error: 'initiator_cannot_decline' });
      }

      const upd = await pgStore.updateDmConversation(conversationId, { status: 'declined' });
      if (!upd.ok) return res.status(400).json({ error: upd.error || 'decline_failed' });

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[dm] POST /dm/conversations/:id/decline', e);
      return res.status(500).json({ error: e?.message || 'decline_failed' });
    }
  });

  router.post('/dm/conversations/:id/read', async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const body = req.body || {};
      const userId = await resolveUserId(req, body);
      const conversationId = String(req.params.id || '').trim();
      if (!userId) return res.status(401).json({ error: 'unauthorized' });

      const conversation = await pgStore.getDmConversationById(conversationId);
      if (!conversation) return res.status(404).json({ error: 'not_found' });
      if (!pgStore.userParticipatesInDmConversation(conversation, userId)) {
        return res.status(403).json({ error: 'forbidden' });
      }

      const result = await pgStore.markDmMessagesRead(conversationId, userId);
      if (!result.ok) return res.status(400).json({ error: result.error || 'read_failed' });

      return res.status(200).json({ ok: true, updated: result.updated });
    } catch (e) {
      console.error('[dm] POST /dm/conversations/:id/read', e);
      return res.status(500).json({ error: e?.message || 'read_failed' });
    }
  });

  return router;
}

module.exports = {
  createDirectMessagesRouter,
  MESSAGE_BODY_MAX,
};
