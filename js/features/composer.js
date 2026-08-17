'use strict';

// ── COMPOSER ──────────────────────────────────────
function editorToText(html) {
  const root = document.createElement('div'); root.innerHTML = html;
  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    const tag = (node.tagName || '').toLowerCase();
    if (tag === 'br') return '\n';
    if (tag === 'strong' || tag === 'b') return `**${[...node.childNodes].map(walk).join('')}**`;
    if (tag === 'em' || tag === 'i') return `*${[...node.childNodes].map(walk).join('')}*`;
    if (tag === 'li') return [...node.childNodes].map(walk).join('');
    if (tag === 'ul') return [...node.children].map(li => `• ${walk(li)}`).join('\n') + '\n';
    if (tag === 'ol') return [...node.children].map((li, i) => `${i+1}. ${walk(li)}`).join('\n') + '\n';
    const inner = [...node.childNodes].map(walk).join('');
    if (['p','div'].includes(tag)) return inner + '\n';
    return inner;
  };
  return [...root.childNodes].map(walk).join('').replace(/\n{3,}/g, '\n\n').trim();
}

function composerFormat(cmd) {
  const sel = window.getSelection(); if (!sel?.rangeCount) return;
  if (cmd === 'bold' || cmd === 'italic') document.execCommand(cmd, false, null);
  else if (cmd === 'ul') document.execCommand('insertUnorderedList', false, null);
  else if (cmd === 'ol') document.execCommand('insertOrderedList', false, null);
  else if (cmd === 'clear') document.execCommand('removeFormat', false, null);
}
