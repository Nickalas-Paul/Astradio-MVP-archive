/**
 * Phase 5 — Relational groups persistence.
 * Delegates to lib/pg-store. Requires POSTGRES_URL and migrations 004/005.
 */

let pgStore = null;
try {
  if (process.env.POSTGRES_URL) {
    pgStore = require('./pg-store');
  }
} catch (e) {
  // pg-store not available
}

async function createRelationalGroup(input) {
  if (!pgStore) throw new Error('Relational store requires POSTGRES_URL');
  return pgStore.createRelationalGroup(input);
}

async function listRelationalGroupsByOwner(ownerId) {
  if (!pgStore) throw new Error('Relational store requires POSTGRES_URL');
  return pgStore.listRelationalGroupsByOwner(ownerId);
}

async function getRelationalGroupById(groupId) {
  if (!pgStore) throw new Error('Relational store requires POSTGRES_URL');
  return pgStore.getRelationalGroupById(groupId);
}

async function updateRelationalGroup(groupId, ownerId, patch) {
  if (!pgStore) throw new Error('Relational store requires POSTGRES_URL');
  return pgStore.updateRelationalGroup(groupId, ownerId, patch);
}

async function deleteRelationalGroup(groupId, ownerId) {
  if (!pgStore) throw new Error('Relational store requires POSTGRES_URL');
  return pgStore.deleteRelationalGroup(groupId, ownerId);
}

async function addRelationalGroupMember(input) {
  if (!pgStore) throw new Error('Relational store requires POSTGRES_URL');
  return pgStore.addRelationalGroupMember(input);
}

async function removeRelationalGroupMember(groupId, memberId, ownerId) {
  if (!pgStore) throw new Error('Relational store requires POSTGRES_URL');
  return pgStore.removeRelationalGroupMember(groupId, memberId, ownerId);
}

async function listRelationalGroupMembers(groupId, ownerId) {
  if (!pgStore) throw new Error('Relational store requires POSTGRES_URL');
  return pgStore.listRelationalGroupMembers(groupId, ownerId);
}

async function createNonPlatformChart(input) {
  if (!pgStore) throw new Error('Relational store requires POSTGRES_URL');
  return pgStore.createNonPlatformChart(input);
}

async function deleteChart(chartId) {
  if (!pgStore) throw new Error('Relational store requires POSTGRES_URL');
  return pgStore.deleteChart(chartId);
}

module.exports = {
  createRelationalGroup,
  listRelationalGroupsByOwner,
  getRelationalGroupById,
  updateRelationalGroup,
  deleteRelationalGroup,
  addRelationalGroupMember,
  removeRelationalGroupMember,
  listRelationalGroupMembers,
  createNonPlatformChart,
  deleteChart,
};
