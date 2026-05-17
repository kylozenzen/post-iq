'use strict';

const DEFAULT_POSTIQ_CONFIG = {
  betaMessage: 'PostIQ is in public beta. Some tools may change as Buffer’s API evolves.',
  features: {
    calendar: true,
    composer: true,
    ideas: true,
    contentPillars: true,
    trending: true,
    approvals: true,
    snapshots: true,
    uploads: true,
    unsplash: true,
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
