'use strict';

// Local, API-independent relationships for one creative source and its executions.
(function initializeContentModel(window) {
  const postId = variant => String(variant?.buffer?.postId || variant?.postId || '');
  const variants = content => Array.isArray(content?.variants) ? content.variants : [];
  const status = variant => String(variant?.buffer?.status || variant?.publishingState || variant?.status || '').toLowerCase();
  const published = value => ['published', 'sent', 'complete', 'completed'].includes(value);
  const scheduled = value => ['scheduled', 'pending', 'queue', 'queued'].includes(value);

  function lifecycle(content = {}) {
    const executions = variants(content).filter(variant => postId(variant));
    const states = executions.map(status).filter(Boolean);
    if (executions.length && states.length === executions.length && states.every(published)) return 'published';
    if (states.some(scheduled) || executions.some(variant => variant.dueAt && !published(status(variant)))) return 'scheduled';
    const source = String(content.sourceText ?? content.body ?? '').trim();
    if (source && variants(content).length) return 'ready';
    if (source.length >= 20 || String(content.status || '').toLowerCase() === 'developing') return 'developing';
    return 'idea';
  }

  function buildIndex(contents = []) {
    const byContentId = new Map(); const byContentItemId = new Map(); const byPostId = new Map();
    contents.forEach(content => {
      byContentId.set(String(content.id), content);
      const itemId = String(content?.buffer?.contentItemId || '');
      if (itemId) byContentItemId.set(itemId, content);
      variants(content).forEach(variant => { const id = postId(variant); if (id) byPostId.set(id, { content, variant }); });
    });
    return { byContentId, byContentItemId, byPostId };
  }

  function scheduledDates(content) {
    return [...new Set(variants(content).map(variant => variant.dueAt).filter(Boolean).map(value => String(value).slice(0, 10)))].sort();
  }
  function calendarEntry(content) {
    const dates = scheduledDates(content);
    const date = dates[0] || String(content.targetDate || '').slice(0, 10);
    return { content, date, dates, dateEnd: dates.at(-1) || date, lifecycle: lifecycle(content), variants: variants(content) };
  }

  window.ContentModel = { lifecycle, variants, postId, buildIndex, scheduledDates, calendarEntry };
})(window);
