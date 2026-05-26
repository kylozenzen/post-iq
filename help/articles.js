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
    summary: 'Learn what PostIQ is, how it works with Buffer, and the core workflow from planning to publishing.',
    tags: ['onboarding', 'workflow', 'buffer', 'queue', 'publish'],
    featured: true,
    relatedArticles: ['connect-buffer', 'plan-content-calendar', 'write-split-send-posts'],
    body: `<p>PostIQ is the planning and preparation layer around Buffer. Buffer is still your publishing home. PostIQ helps you decide <em>what</em> to post, shape it, review it, and send it to Buffer when you are ready.</p>
    <h2>How PostIQ fits into your process</h2>
    <ol>
      <li><strong>Connect Buffer</strong> so PostIQ can load your channels and queue context.</li>
      <li><strong>Plan</strong> in calendar view to spot gaps and capture notes.</li>
      <li><strong>Compose</strong> drafts, media, or threads in PostIQ.</li>
      <li><strong>Review</strong> with Snapshots and Approvals where needed.</li>
      <li><strong>Send to Buffer</strong> only when you pick a Buffer action.</li>
    </ol>
    <h2>What does not happen automatically</h2>
    <p>Nothing is published just because you typed it in PostIQ. Content only moves into Buffer when you choose a Buffer action (for example draft, queue, or scheduled send).</p>
    <h3>Good to know</h3>
    <ul>
      <li>PostIQ is in public beta, so flows can evolve.</li>
      <li>You may see lightweight rough edges while features stabilize.</li>
      <li>Use Help links inside each view for context-specific guidance.</li>
    </ul>`
  },
  {
    slug: 'connect-buffer',
    title: 'Connect Buffer and Manage Syncing',
    category: 'Buffer Connection',
    summary: 'Learn how Buffer connection works, what syncing does, and how to recover from a disconnected state.',
    tags: ['buffer', 'oauth', 'sync', 'token', 'disconnected'],
    featured: true,
    relatedArticles: ['getting-started', 'troubleshooting', 'plan-content-calendar'],
    body: `<p>Buffer connection gives PostIQ access to the profiles and queue data you need for planning and prep. Connection and syncing are related, but not the same.</p>
    <h2>Connection vs sync</h2>
    <ul>
      <li><strong>Connection</strong> = authorization to access your Buffer workspace.</li>
      <li><strong>Sync</strong> = loading fresh channel and queue data into PostIQ.</li>
    </ul>
    <h2>Standard setup steps</h2>
    <ol>
      <li>Open <strong>Connection settings</strong>.</li>
      <li>Complete Buffer sign-in/OAuth.</li>
      <li>Use <strong>Load from Buffer</strong> to pull current queue data.</li>
      <li>Verify the right profile filter is selected.</li>
    </ol>
    <h2>If you get disconnected</h2>
    <ol>
      <li>Reconnect from Connection settings.</li>
      <li>Run sync again.</li>
      <li>Refresh filters if posts appear missing.</li>
    </ol>
    <h3>Common confusion</h3>
    <p>“Connected” does not always mean “fresh.” If your calendar looks stale, sync again.</p>
    <h3>Good to know</h3>
    <ul>
      <li>OAuth state is handled by Buffer auth flow; PostIQ does not replace it.</li>
      <li>Temporary API/network issues can delay sync updates in beta.</li>
    </ul>`
  },
  {
    slug: 'plan-content-calendar',
    title: 'Plan Your Content Calendar',
    category: 'Plan / Calendar',
    summary: 'Learn how to review your Buffer queue, spot content gaps, add planning notes, and share content snapshots.',
    tags: ['calendar', 'queue', 'gaps', 'notes', 'snapshot', 'planning'],
    featured: false,
    relatedArticles: ['getting-started', 'share-content-for-review', 'write-split-send-posts'],
    body: `<p>The Plan view helps you understand posting cadence before you draft more content. Use it to find weak spots and plan what to create next.</p>
    <h2>How to use Plan effectively</h2>
    <ol>
      <li>Sync Buffer data.</li>
      <li>Review month view for empty days or uneven posting.</li>
      <li>Add planning notes on key days.</li>
      <li>Use snapshot sharing for stakeholder visibility.</li>
    </ol>
    <h2>When to use Snapshot sharing</h2>
    <p>Use snapshots when you need to share a read-only plan quickly. Snapshot links are ideal for alignment, not for collecting line-by-line approval comments.</p>
    <h3>Good to know</h3>
    <ul>
      <li>Snapshots are static views, so re-share after major updates.</li>
      <li>Plan helps you prepare; publishing still happens through Buffer actions.</li>
    </ul>`
  },
  {
    slug: 'write-split-send-posts',
    title: 'Write, Split, and Send Posts to Buffer',
    category: 'Compose',
    summary: 'Learn how to draft posts, add media, split long copy into threads, and choose the right Buffer action.',
    tags: ['compose', 'thread', 'split', 'media', 'draft', 'queue', 'schedule'],
    featured: true,
    relatedArticles: ['getting-started', 'build-your-idea-system', 'share-content-for-review'],
    body: `<p>Compose is where ideas become publish-ready posts. Draft the message, shape formatting, attach media, and decide the final Buffer action.</p>
    <h2>Drafting workflow</h2>
    <ol>
      <li>Start from a blank draft, template, or idea card.</li>
      <li>Add copy and media.</li>
      <li>Use split mode if the post is too long for one update.</li>
      <li>Choose draft/queue/schedule action for Buffer.</li>
    </ol>
    <h2>Thread splitting basics</h2>
    <p>Split mode helps convert long-form thoughts into cleaner multi-part posts. Always review each part before sending.</p>
    <h2>Choosing the right Buffer action</h2>
    <ul>
      <li><strong>Draft</strong>: still in review.</li>
      <li><strong>Queue</strong>: ready for your normal posting cadence.</li>
      <li><strong>Schedule</strong>: needs a specific time.</li>
    </ul>
    <h3>Good to know</h3>
    <p>Nothing is sent until you explicitly choose one of those Buffer actions.</p>`
  },
  {
    slug: 'build-your-idea-system',
    title: 'Build Your Idea System',
    category: 'Ideas Library',
    summary: 'Learn how to use Notebook, Content Pillars, Templates, and Trending to turn raw ideas into reusable content starters.',
    tags: ['notebook', 'content pillars', 'templates', 'trending', 'ideas', 'starters'],
    featured: false,
    relatedArticles: ['write-split-send-posts', 'plan-content-calendar', 'getting-started'],
    body: `<p>Ideas Library is your repeatable idea engine. Instead of starting from zero each time, you store signals and transform them into usable drafts.</p>
    <h2>Use each tool for a specific job</h2>
    <ul>
      <li><strong>Notebook</strong>: capture raw references and angles.</li>
      <li><strong>Content Pillars</strong>: define recurring themes.</li>
      <li><strong>Templates</strong>: save proven structures and CTAs.</li>
      <li><strong>Trending</strong>: monitor timely topics to react faster.</li>
    </ul>
    <h2>Simple weekly routine</h2>
    <ol>
      <li>Save 5–10 new idea inputs in Notebook/Trending.</li>
      <li>Map them to pillars.</li>
      <li>Turn the strongest ideas into templates or starters.</li>
      <li>Open Compose and finalize for Buffer.</li>
    </ol>
    <h3>Common confusion</h3>
    <p>Trending is for prompts and context, not copy-and-paste posting. Keep your own voice and point of view.</p>`
  },
  {
    slug: 'share-content-for-review',
    title: 'Share Content for Review',
    category: 'Approvals',
    summary: 'Learn when to use Snapshots, when to use Approvals, and what reviewers can see.',
    tags: ['approvals', 'review', 'snapshot', 'stakeholders', 'feedback'],
    featured: false,
    relatedArticles: ['plan-content-calendar', 'write-split-send-posts', 'troubleshooting'],
    body: `<p>PostIQ supports two review paths: Snapshots for plan visibility and Approvals for draft-level sign-off.</p>
    <h2>Snapshot vs Approvals</h2>
    <ul>
      <li><strong>Snapshots</strong>: read-only plan sharing (calendar-level context).</li>
      <li><strong>Approvals</strong>: explicit reviewer workflow for draft decisions.</li>
    </ul>
    <h2>Recommended review flow</h2>
    <ol>
      <li>Share a snapshot to align on calendar direction.</li>
      <li>Draft in Compose and mark items requiring sign-off.</li>
      <li>Send reviewer link from Approvals.</li>
      <li>Finalize and send to Buffer after approval.</li>
    </ol>
    <h3>Good to know</h3>
    <ul>
      <li>Reviewers see what you shared at that stage, not your entire workspace.</li>
      <li>In beta, minor visual differences can occur between draft and published formatting.</li>
    </ul>`
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting PostIQ',
    category: 'Troubleshooting',
    summary: 'Fix common connection, sync, media, Snapshot, Approval, and beta feature issues.',
    tags: ['troubleshooting', 'oauth', 'sync', 'media', 'snapshot', 'approvals', 'beta'],
    featured: false,
    relatedArticles: ['connect-buffer', 'share-content-for-review', 'privacy-storage-beta-limits'],
    body: `<p>If something feels off, most issues fall into connection state, stale sync, or view/filter mismatch.</p>
    <h2>Quick triage checklist</h2>
    <ol>
      <li>Confirm Buffer connection status.</li>
      <li>Run sync again.</li>
      <li>Check current profile/channel filters.</li>
      <li>Retry the action after a short wait.</li>
    </ol>
    <h2>Common issues</h2>
    <h3>Posts missing in calendar</h3>
    <p>Usually filter mismatch or stale sync. Re-sync and reset filters.</p>
    <h3>Media not behaving as expected</h3>
    <p>Validate source file and retry send action; in beta, certain edge media cases may need a second attempt.</p>
    <h3>Approval/Snapshot confusion</h3>
    <p>Use snapshot for visibility and approvals for sign-off; they solve different review jobs.</p>
    <h3>Good to know</h3>
    <p>Public beta means occasional regressions can appear. If behavior persists, capture steps and share feedback with the team.</p>`
  },
  {
    slug: 'privacy-storage-beta-limits',
    title: 'Privacy, Storage, and Beta Limits',
    category: 'Privacy & Data',
    summary: 'Understand what PostIQ stores, what Buffer handles, what Snapshot links expose, and what public beta means.',
    tags: ['privacy', 'data', 'browser storage', 'snapshot links', 'beta limits', 'security'],
    featured: false,
    relatedArticles: ['connect-buffer', 'share-content-for-review', 'troubleshooting'],
    body: `<p>PostIQ is built to support your Buffer workflow, not replace Buffer’s publishing and account systems.</p>
    <h2>What Buffer handles</h2>
    <ul>
      <li>Primary account auth and OAuth session.</li>
      <li>Final publishing actions and destination posting behavior.</li>
    </ul>
    <h2>What PostIQ handles</h2>
    <ul>
      <li>Planning, draft prep, organization, and review utilities.</li>
      <li>Local workspace state and beta workflow features.</li>
    </ul>
    <h2>Snapshot link visibility</h2>
    <p>Anyone with a snapshot link can view that shared snapshot. Treat links as shareable planning artifacts.</p>
    <h2>Public beta expectations</h2>
    <ul>
      <li>Features can change quickly.</li>
      <li>Storage/limits may evolve as reliability improves.</li>
      <li>Always keep final publishing checks in Buffer.</li>
    </ul>
    <p>For policy-level updates, review the <a href="/privacy.html">Privacy page</a>.</p>`
  }
];
