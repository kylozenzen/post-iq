'use strict';

const { getStore } = require('@netlify/blobs');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function response(statusCode, valid, message) {
  return { statusCode, headers, body: JSON.stringify({ valid, message }) };
}

async function getValidCodes() {
  // Try Blobs config first, fall back to env var
  try {
    const store = getStore('postiq-admin');
    const raw   = await store.get('config', { type: 'text' });
    if (raw) {
      const config = JSON.parse(raw);
      if (Array.isArray(config.inviteCodes) && config.inviteCodes.length > 0) {
        return config.inviteCodes.map(c => c.trim().toLowerCase()).filter(Boolean);
      }
    }
  } catch (_) { /* fall through */ }

  const rawCodes = process.env.AI_ASSIST_INVITE_CODES || '';
  return rawCodes.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return response(405, false, 'Method not allowed.');

  try {
    const { code } = JSON.parse(event.body || '{}');
    if (typeof code !== 'string' || !code.trim()) return response(400, false, 'Enter an invite code.');

    const validCodes = await getValidCodes();
    if (validCodes.length === 0) return response(500, false, 'AI Assist beta access is not configured yet.');

    const valid = validCodes.includes(code.trim().toLowerCase());
    return response(200, valid, valid ? 'AI Assist unlocked.' : 'Invalid invite code.');
  } catch (_) {
    return response(500, false, 'Something went wrong checking your invite code.');
  }
};
