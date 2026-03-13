/**
 * Phase 8 debug bootstrap response contract.
 * Single source of truth for create-test-user and create-iso-user API responses.
 */

export interface Phase8BootstrapResponse {
  userId: string;
  campaignId: string;
  chartId: string;
}
