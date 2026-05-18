'use strict';

function readBooleanEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

const DEFAULT_POSTIQ_CONFIG = {
  betaMessage: process.env.POSTIQ_BETA_MESSAGE || 'PostIQ is in public beta. Some tools may change as Buffer’s API evolves.',
  features: {
    calendar: true,
    composer: true,
    ideas: true,
    contentPillars: true,
    trending: readBooleanEnv('POSTIQ_FEATURE_TRENDING', true),
    approvals: readBooleanEnv('POSTIQ_FEATURE_APPROVALS', true),
    snapshots: readBooleanEnv('POSTIQ_FEATURE_SNAPSHOTS', true),
    uploads: readBooleanEnv('POSTIQ_FEATURE_UPLOADS', false),
    unsplash: readBooleanEnv('POSTIQ_FEATURE_UNSPLASH', true),
  },
  notices: {
    approvals: '',
    trending: '',
    uploads: '',
    snapshots: '',
  },
};

exports.handler = async function handler() {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(DEFAULT_POSTIQ_CONFIG),
  };
};
