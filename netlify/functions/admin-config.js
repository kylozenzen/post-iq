'use strict';

const { connectLambda, getStore } = require('@netlify/blobs');

const STORE = 'postiq-admin';
const KEY   = 'config';

function authError() {
  return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
}

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

function readBooleanEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

function envDefaults() {
  return {
    betaMessage: process.env.POSTIQ_BETA_MESSAGE || "PostIQ is in public beta. Some tools may change as Buffer’s API evolves.",
    features: {
      calendar:      true,
      composer:      true,
      ideas:         true,
      contentPillars:true,
      trending:      readBooleanEnv('POSTIQ_FEATURE_TRENDING', true),
      approvals:     readBooleanEnv('POSTIQ_FEATURE_APPROVALS', true),
      snapshots:     readBooleanEnv('POSTIQ_FEATURE_SNAPSHOTS', true),
      library:       readBooleanEnv('POSTIQ_FEATURE_LIBRARY', true),
      pulse:         readBooleanEnv('POSTIQ_FEATURE_PULSE', true),
      uploads:       readBooleanEnv('POSTIQ_FEATURE_UPLOADS', false),
      unsplash:      readBooleanEnv('POSTIQ_FEATURE_UNSPLASH', true),
    },
    notices: {
      calendar: '', composer: '', ideas: '', contentPillars: '',
      trending: '', approvals: '', snapshots: '', library: '',
      pulse: '', uploads: '', unsplash: '',
    },
    inviteCodes: (process.env.AI_ASSIST_INVITE_CODES || '').split(',').map(s => s.trim()).filter(Boolean),
  };
}

exports.handler = async function handler(event) {
  connectLambda(event);

  const token = process.env.POSTIQ_ADMIN_TOKEN;
  if (!token || event.headers['x-admin-token'] !== token) return authError();

  if (event.httpMethod === 'GET') {
    try {
      const store = getStore(STORE);
      const raw   = await store.get(KEY, { type: 'text' });
      if (raw) {
        const blobConfig = JSON.parse(raw);
        const defaults   = envDefaults();
        // Merge: blobs wins, fill any missing keys from env defaults
        return json(200, {
          betaMessage:  blobConfig.betaMessage  ?? defaults.betaMessage,
          features:     { ...defaults.features,  ...blobConfig.features  },
          notices:      { ...defaults.notices,   ...blobConfig.notices   },
          inviteCodes:  blobConfig.inviteCodes  ?? defaults.inviteCodes,
        });
      }
    } catch (_) {
      // Blobs not available or empty — fall through to env defaults
    }
    return json(200, envDefaults());
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

    const { betaMessage, features, notices, inviteCodes } = body;
    const config = { betaMessage, features, notices, inviteCodes };

    try {
      const store = getStore(STORE);
      await store.set(KEY, JSON.stringify(config));
      return json(200, { ok: true });
    } catch (err) {
      return json(500, { error: 'Failed to save config', detail: err.message });
    }
  }

  return json(405, { error: 'Method not allowed' });
};
