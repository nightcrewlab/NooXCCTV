// api/resolve.js — Vercel Serverless Function
import { resolveWebcamUrl } from '../lib/resolveStream.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url param' });

  try {
    const result = await resolveWebcamUrl(url);

    if (result.reason === 'domain_not_allowed') {
      return res.status(403).json({ error: 'Domain not allowed' });
    }
    if (result.reason === 'missing_url') {
      return res.status(400).json({ error: 'Missing url param' });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[resolve] error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
