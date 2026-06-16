'use strict';

const { getStore } = require('@netlify/blobs');

function readBooleanEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function envDefaults() {
  return {
    betaMessage: process.env.POSTIQ_BETA_MESSAGE || "PostIQ is in public beta. Some tools may change as Buffer's API evolves.",
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
  };
}

exports.handler = async function handler() {
  const defaults = envDefaults();

  try {
    const store = getStore('postiq-admin');
    const raw   = await store.get('config', { type: 'text' });
    if (raw) {
      const blob = JSON.parse(raw);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        body: JSON.stringify({
          betaMessage: blob.betaMessage ?? defaults.betaMessage,
          features:    { ...defaults.features, ...blob.features },
          notices:     { ...defaults.notices,  ...blob.notices  },
        }),
      };
    }
  } catch (_) {
    // Blobs unavailable — fall through to env defaults
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(defaults),
  };
};
