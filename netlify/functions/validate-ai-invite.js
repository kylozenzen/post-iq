'use strict';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function response(statusCode, valid, message) {
  return { statusCode, headers, body: JSON.stringify({ valid, message }) };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return response(405, false, 'Method not allowed.');

  try {
    const { code } = JSON.parse(event.body || '{}');
    if (typeof code !== 'string' || !code.trim()) return response(400, false, 'Enter an invite code.');

    const rawCodes = process.env.AI_ASSIST_INVITE_CODES || '';
    if (!rawCodes.trim()) return response(500, false, 'AI Assist beta access is not configured yet.');

    const submittedCode = code.trim().toLowerCase();
    const validCodes = rawCodes.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
    const valid = validCodes.includes(submittedCode);
    return response(200, valid, valid ? 'AI Assist unlocked.' : 'Invalid invite code.');
  } catch (_) {
    return response(500, false, 'Something went wrong checking your invite code.');
  }
};
