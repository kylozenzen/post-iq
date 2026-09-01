'use strict';

// Local, API-independent relationships for one creative source and its executions.
(function initializeContentModel(window) {
  const postId = variant => String(variant?.buffer?.postId || variant?.postId || '');
  const variants = content => Array.isArray(content?.variants) ? content.variants : [];
  const status = variant => String(variant?.buffer?.status || variant?.publishingState || variant?.status || '').toLowerCase();
  const published = value => ['published', 'sent', 'complete', 'completed'].includes(value);
  const scheduled = value => ['scheduled', 'pending', 'queue', 'queued', 'publishing'].includes(value);
  const WORKFLOW_STEPS = [
    { id: 'idea', label: 'Idea' }, { id: 'develop', label: 'Develop' },
    { id: 'angle', label: 'Angle' }, { id: 'distribution', label: 'Distribution' },
    { id: 'drafts', label: 'Drafts' }, { id: 'buffer', label: 'Buffer' },
    { id: 'scheduled', label: 'Scheduled' }
  ];

  function workflow(content = {}) {
    const development = content.development && typeof content.development === 'object' ? content.development : {};
    const usefulProof = Array.isArray(development.proof) && development.proof.some(item => String(item?.text || item?.url || '').trim());
    const supporting = [development.tension, development.whyItMatters, development.audience, development.notes].some(value => String(value || '').trim()) || usefulProof;
    const selectedAngle = Array.isArray(development.angles) && development.angles.some(angle => angle?.selected && String(angle.title || angle.description || angle.type || '').trim());
    const selectedPlans = (Array.isArray(content.distributionPlan) ? content.distributionPlan : []).filter(plan => plan?.selected && Array.isArray(plan.accountIds) && plan.accountIds.length);
    const selectedAccounts = new Set(selectedPlans.flatMap(plan => plan.accountIds.map(String)));
    const localDrafts = variants(content).filter(variant => String(variant?.text || '').trim());
    const expectedDrafts = selectedAccounts.size ? localDrafts.filter(variant => selectedAccounts.has(String(variant.channelId))) : localDrafts;
    const allDraftsExist = selectedAccounts.size > 0 && selectedAccounts.size === new Set(expectedDrafts.map(variant => String(variant.channelId))).size;
    const bufferDrafts = expectedDrafts.filter(variant => postId(variant) && status(variant) === 'draft');
    const scheduledPosts = expectedDrafts.filter(variant => postId(variant) && scheduled(status(variant)));
    const checks = {
      idea: !!String(content.title || content.sourceText || content.body || '').trim(),
      develop: !!String(development.coreThought || '').trim() && supporting,
      angle: selectedAngle,
      distribution: selectedAccounts.size > 0,
      drafts: allDraftsExist || (!selectedAccounts.size && localDrafts.length > 0),
      buffer: expectedDrafts.length > 0 && bufferDrafts.length === expectedDrafts.length,
      scheduled: expectedDrafts.length > 0 && scheduledPosts.length === expectedDrafts.length
    };
    const firstIncomplete = WORKFLOW_STEPS.findIndex(step => !checks[step.id]);
    const currentIndex = firstIncomplete < 0 ? WORKFLOW_STEPS.length - 1 : firstIncomplete;
    const steps = WORKFLOW_STEPS.map((step, index) => ({ ...step, complete: checks[step.id], status: index === currentIndex ? 'current' : checks[step.id] ? 'complete' : 'future' }));
    return { steps, current: steps[currentIndex].id, currentIndex, completedCount: steps.filter(step => step.complete).length, bufferDraftCount: bufferDrafts.length, scheduledCount: scheduledPosts.length };
  }

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

  window.ContentModel = { lifecycle, workflow, workflowSteps: WORKFLOW_STEPS, variants, postId, buildIndex, scheduledDates, calendarEntry };
})(window);
