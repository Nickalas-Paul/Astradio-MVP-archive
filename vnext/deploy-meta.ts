/**
 * Deployment metadata for version endpoints and API _meta fields.
 * Same commit should appear on Vercel UI routes and engine when unified.
 */

export type DeployMeta = {
  commit: string;
  branch: string;
  deployTarget: string;
  bulletSystem: 'library-feed';
  timestamp: string;
};

export function getDeployMeta(): DeployMeta {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    process.env.GIT_COMMIT ||
    'unknown';

  const branch =
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.RENDER_GIT_BRANCH ||
    process.env.GIT_BRANCH ||
    'unknown';

  const deployTarget = process.env.VERCEL
    ? 'vercel'
    : process.env.RENDER
      ? 'render'
      : process.env.RAILWAY_ENVIRONMENT
        ? 'railway'
        : 'local';

  return {
    commit,
    branch,
    deployTarget,
    bulletSystem: 'library-feed',
    timestamp: new Date().toISOString(),
  };
}
