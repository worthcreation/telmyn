// Deployment settings. API_BASE is the Cloudflare Worker address.
export const API_BASE = 'https://telmyn-api.worthcreation.workers.dev';

// Blocks that show a daily follow-along video instead of the verse study video. Value = /daily source.
export const DAILY_VIDEO = { gates: 'gator' };

// Voice stop is shelved (Ross, 2026-10-30): no mic button, no Voice stop screen, and nothing listens, whatever was
// set before. The code, the model and any recordings stay; set this to true to bring it back.
export const VOICE_STOP = false;
