/*
 HOW TO MANAGE HELP GUIDES

 To add a new guide:
 1. Copy an existing article object.
 2. Give it a unique slug, like "compose-posts".
 3. Choose one category from HELP_CATEGORIES.
 4. Write a short summary for the card.
 5. Add searchable tags.
 6. Add the full guide content inside the body field.

 To update a guide:
 - Edit the title, summary, tags, or body.
 - Do not change the slug unless you are okay with old links breaking.

 To remove a guide:
 - Delete the article object.
 - Also remove its slug from relatedArticles in any other guide.

 The slug controls the guide URL:
 /help/?article=your-slug-here
*/

const HELP_CATEGORIES = [
  "Getting Started",
  "Buffer Connection",
  "Plan / Calendar",
  "Compose",
  "Thread Splitter",
  "Ideas Library",
  "Content Pillars",
  "Templates",
  "Notebook",
  "Trending",
  "Snapshots",
  "Approvals",
  "Troubleshooting",
  "Privacy & Data"
];

window.HELP_CATEGORIES = HELP_CATEGORIES;

window.POSTIQ_HELP_ARTICLES = [
  {
    slug: 'getting-started',
    title: 'Getting Started with PostIQ',
    category: 'Getting Started',
    summary: 'Connect Buffer, sync your queue, and learn the core workflow in a few minutes.',
    tags: ['onboarding', 'basics', 'setup'],
    relatedArticles: ['connect-buffer', 'plan-view', 'compose-posts'],
    body: `<p>Welcome to PostIQ. Start by signing in with Buffer, then load your channels to unlock planning, composing, and approvals.</p><ol><li>Open <strong>Connection settings</strong> and sign in.</li><li>Click <strong>Load from Buffer</strong> to sync posts.</li><li>Use Plan to review your schedule and Compose to draft.</li></ol><p>Tip: Use Ideas Library for reusable templates and notebook references before writing.</p>`
  },
  { slug:'connect-buffer', title:'Connect and Reconnect Buffer', category:'Buffer Connection', summary:'How to connect Buffer securely and recover from a disconnected state.', tags:['buffer','oauth','token'], relatedArticles:['getting-started','troubleshoot-connection'], body:`<p>Use the sidebar connection card to sign in with Buffer. If your connection expires, open Connection settings and reconnect.</p><p>After connecting, run <strong>Load from Buffer</strong> to refresh channels and queued posts.</p>` },
  { slug:'plan-view', title:'Use the Plan Calendar View', category:'Plan / Calendar', summary:'Review your monthly queue, detect content gaps, and share snapshots.', tags:['calendar','planning','queue'], relatedArticles:['compose-posts','snapshot-sharing'], body:`<p>Plan gives you a monthly view of scheduled posts and planning notes. Use filters to focus on specific channels and click days to review details.</p><p>When you need stakeholder visibility, create a snapshot from the Share button.</p>` },
  { slug:'compose-posts', title:'Compose Posts and Send to Buffer', category:'Compose', summary:'Draft posts, attach media, and choose save/schedule actions.', tags:['compose','drafts','publishing'], relatedArticles:['thread-splitter','templates-library','approvals'], body:`<p>Compose is where you write and format content before sending it to Buffer.</p><ul><li>Write your post and optionally attach media.</li><li>Pick a profile and scheduling option.</li><li>Save as draft, queue, or schedule depending on your workflow.</li></ul>` },
  { slug:'thread-splitter', title:'Split Long Copy into a Thread', category:'Thread Splitter', summary:'Turn one long draft into clean multi-part thread posts.', tags:['thread','x','repurposing'], relatedArticles:['compose-posts'], body:`<p>Use Split into thread when your draft is too long for a single post. PostIQ breaks content into smaller chunks you can edit before sending to Buffer.</p>` },
  { slug:'ideas-library', title:'Work from the Ideas Library', category:'Ideas Library', summary:'Capture inspiration and move ideas into Compose quickly.', tags:['ideas','inspiration','workflow'], relatedArticles:['notebook','templates-library','content-pillars'], body:`<p>The Ideas Library centralizes your Notebook, Content Pillars, Templates, and Trending feeds. Use it to go from rough idea to ready-to-edit draft faster.</p>` },
  { slug:'content-pillars', title:'Build Content Pillars', category:'Content Pillars', summary:'Create reusable themes and seed ideas that support your goals.', tags:['strategy','pillars','planning'], relatedArticles:['ideas-library','templates-library'], body:`<p>Content Pillars help you stay consistent. Define 3–5 repeatable themes, then add seed ideas under each one. Generate starters and send them to Compose.</p>` },
  { slug:'templates-library', title:'Create and Reuse Templates', category:'Templates', summary:'Save repeatable post structures for hooks, launches, and CTAs.', tags:['templates','reuse','copy'], relatedArticles:['compose-posts','ideas-library'], body:`<p>Templates are reusable writing blocks. Save high-performing structures and insert them in one click while composing.</p>` },
  { slug:'notebook', title:'Capture Notes in Notebook', category:'Notebook', summary:'Store references, links, and thought starters for future posts.', tags:['notes','research','references'], relatedArticles:['ideas-library','compose-posts'], body:`<p>Notebook is your lightweight idea vault. Save links, thoughts, and snippets, then pin them in Compose when you are ready to write.</p>` },
  { slug:'trending', title:'Find Fresh Angles with Trending', category:'Trending', summary:'Browse external trend sources and turn them into original takes.', tags:['trends','reddit','newsjacking'], relatedArticles:['notebook','compose-posts'], body:`<p>Trending pulls idea signals from supported sources. Use them as prompts, not copy-paste content. Save relevant items to Notebook and write your own perspective.</p>` },
  { slug:'snapshot-sharing', title:'Share Planning Snapshots', category:'Snapshots', summary:'Generate a read-only snapshot link to share your plan.', tags:['share','snapshot','stakeholders'], relatedArticles:['plan-view'], body:`<p>Snapshots create a static view of your content plan for teammates or clients. Share the link, then regenerate if your plan changes significantly.</p>` },
  { slug:'approvals', title:'Route Posts Through Approvals', category:'Approvals', summary:'Collect feedback before publishing and keep review status organized.', tags:['review','approval','team'], relatedArticles:['compose-posts'], body:`<p>Mark drafts that need review, then use Approvals to generate a reviewer link and track status. Publish only when feedback is complete.</p>` },
  { slug:'troubleshoot-connection', title:'Troubleshoot Connection and Sync Issues', category:'Troubleshooting', summary:'Quick checks when channels or posts are not loading.', tags:['troubleshooting','sync','errors'], relatedArticles:['connect-buffer'], body:`<p>If data is missing: verify Buffer connection, reconnect if needed, then run Load from Buffer again. Check profile filters and retry after a short wait.</p>` },
  { slug:'privacy-data', title:'Privacy and Data Handling', category:'Privacy & Data', summary:'How PostIQ handles auth and content data during normal use.', tags:['privacy','security','data'], relatedArticles:['connect-buffer'], body:`<p>PostIQ is designed as a companion workspace for Buffer workflows. Review the Privacy page for current data handling details and update notices.</p><p><a href="/privacy.html">Read the Privacy page</a>.</p>` }
];
