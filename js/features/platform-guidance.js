'use strict';

// One vocabulary for Content Flow labels, editor tips, and AI remix prompts.
(function initializePlatformGuidance(window) {
  const platforms = {
    linkedin: { label: 'LinkedIn', aliases: ['linkedin'], tip: 'Strong opening · room for context · use whitespace', guidance: ['Lead with a strong point of view or useful observation.', 'Make the opening lines strong and use readable spacing.', 'Allow context and storytelling while keeping the author’s natural voice.', 'Avoid unnecessary hashtags.'] },
    threads: { label: 'Threads', aliases: ['threads', 'thread'], tip: 'Conversational · quick setup · invite discussion', guidance: ['Be conversational and immediate.', 'Get to the idea quickly and sound like a person would naturally post.', 'Encourage conversation without forced engagement bait.', 'Stay shorter and looser than LinkedIn; avoid corporate language.'] },
    bluesky: { label: 'Bluesky', aliases: ['bluesky', 'blue sky'], tip: 'One clear thought · concise · internet-native', guidance: ['Prioritize one clear thought.', 'Use concise, conversational, internet-native language.', 'Do not turn a short thought into a mini LinkedIn essay.', 'Make every word earn its place.'] },
    twitter: { label: 'X / Twitter', aliases: ['twitter', 'x.com', 'x/twitter', 'x'], tip: 'Strong opening · one idea · leave room', guidance: ['Open strongly and focus on one primary idea.', 'Remove unnecessary setup.', 'Be conversational rather than promotional.', 'Preserve room for links or media when applicable.'] },
    instagram: { label: 'Instagram', aliases: ['instagram'], tip: 'Hook quickly · complement the visual · light CTA', guidance: ['Complement the visual rather than describing it unnecessarily.', 'Hook quickly and use readable spacing.', 'Keep a conversational voice and use a CTA only when useful.', 'Avoid hashtag stuffing.'] },
    facebook: { label: 'Facebook', aliases: ['facebook'], tip: 'Accessible · clear context · natural CTA', guidance: ['Be accessible and conversational.', 'Include enough context for a broad audience.', 'Prioritize clarity over clever formatting.', 'Use links or calls to action naturally when useful.'] },
    mastodon: { label: 'Mastodon', aliases: ['mastodon'], tip: 'Community-minded · concise · less promotional', guidance: ['Be concise and conversational.', 'Use less promotional language while preserving useful context.', 'Avoid engagement bait.', 'Write for community conversation.'] }
  };
  const distribution = {
    linkedin: ['This idea can support a professional or personal observation with useful context.', 'Lead with the tension, then support the point with an example.'],
    threads: ['The central opinion can work as a short conversational thought.', 'Get to the opinion quickly and invite a natural response.'],
    bluesky: ['The strongest observation can stand alone even if the full explanation is longer.', 'Distill this to one clear, concise observation.'],
    instagram: ['This may need a visual concept rather than text alone.', 'Use a carousel or talking-head concept and let the caption add context.'],
    facebook: ['The idea can work with accessible context for a broad audience.', 'Explain the context clearly and use a natural call to action only if useful.'],
    twitter: ['A focused version can work when reduced to one strong idea.', 'Remove setup and lead with the sharpest observation.'],
    mastodon: ['The idea may fit a community-minded conversation.', 'Keep it concise, useful, and less promotional.']
  };
  function key(service) {
    const value = String(service || '').trim().toLowerCase();
    return Object.keys(platforms).find(name => platforms[name].aliases.some(alias => value === alias || (alias.length > 1 && value.includes(alias)))) || value.replace(/[^a-z0-9]+/g, '-') || 'platform';
  }
  function get(service) {
    const platformKey = key(service);
    const result = platforms[platformKey] || { label: String(service || 'Platform').replace(/^./, character => character.toUpperCase()), tip: 'Keep it clear · natural · platform-appropriate', guidance: ['Keep the author’s natural voice.', 'Adapt the source for how people use this platform.'] };
    const plan = distribution[platformKey] || ['Possible — review manually.', 'Review the format and audience before creating a draft.'];
    return { ...result, distributionReason: plan[0], distributionApproach: plan[1] };
  }
  window.PlatformGuidance = { platforms, key, get, label: service => get(service).label };
})(window);
