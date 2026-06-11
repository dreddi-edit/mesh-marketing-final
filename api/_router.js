import adminMetrics from './admin/_metrics.js';
import adminUsers from './admin/_users.js';
import adminWaitlist from './admin/_waitlist.js';
import authCliStart from './auth/cli/_start.js';
import authCliPoll from './auth/cli/_poll.js';
import authCliComplete from './auth/cli/_complete.js';
import accountIdeHandoff from './account/_ide-handoff.js';
import accountNewsletter from './account/_newsletter.js';
import contact from './_contact.js';
import subscribe from './_subscribe.js';
import downloadIde from './_download-ide.js';
import ambassadorApply from './_ambassador-apply.js';

/** Vercel Hobby caps serverless functions at 12 — route non-chat APIs here. */
const ROUTES = new Map([
  ['admin/metrics', adminMetrics],
  ['admin/users', adminUsers],
  ['admin/waitlist', adminWaitlist],
  ['auth/cli/start', authCliStart],
  ['auth/cli/poll', authCliPoll],
  ['auth/cli/complete', authCliComplete],
  ['account/ide-handoff', accountIdeHandoff],
  ['account/newsletter', accountNewsletter],
  ['contact', contact],
  ['subscribe', subscribe],
  ['download-ide', downloadIde],
  ['ambassador-apply', ambassadorApply],
]);

function routeKey(slug) {
  if (slug == null || slug === '') return '';
  if (Array.isArray(slug)) return slug.filter(Boolean).join('/');
  return decodeURIComponent(String(slug)).replace(/^\/+|\/+$/g, '');
}

export default async function router(req, res) {
  const key = routeKey(req.query?.slug);
  const handler = ROUTES.get(key);
  if (!handler) {
    return res.status(404).json({ ok: false, error: 'Not found', path: key || '/' });
  }
  return handler(req, res);
}
