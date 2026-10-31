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
  "Queue Health",
  "Compose",
  "Content Bank",
  "Content Pillars",
  "Templates",
  "Notebook",
  "Trending",
  "Snapshots",
  "Troubleshooting",
  "Privacy & Data"
];

window.HELP_CATEGORIES = HELP_CATEGORIES;

window.POSTIQ_HELP_ARTICLES = [
  {
    slug: 'getting-started',
    title: 'Getting Started with PostIQ',
    category: 'Getting Started',
    summary: 'Learn what PostIQ is, how it works with Buffer, and the calendar-first workflow: connect, check coverage, plan a gap, send.',
    tags: ['onboarding', 'workflow', 'buffer', 'queue', 'publish'],
    featured: true,
    relatedArticles: ['connect-buffer', 'plan-content-calendar', 'queue-health-your-pace'],
    body: `<p>PostIQ is an independent calendar companion for Buffer users. Buffer is still your publishing home. PostIQ shows your scheduled Buffer posts beside planning notes and actions, flags gaps against the posting rhythm you choose, and helps you turn saved content into a dated plan. It is not made by or affiliated with Buffer.</p>
    <h2>How PostIQ fits into your process</h2>
    <ol>
      <li><strong>Connect Buffer</strong> so PostIQ can load your channels and scheduled queue.</li>
      <li><strong>Inspect coverage</strong> in Queue Health. Set your rhythm in Your Pace, then check a period.</li>
      <li><strong>Plan a gap</strong> from the calendar: add a note or action, date a Content Bank item, or start a draft for that day.</li>
      <li><strong>Send to Buffer</strong> from Compose only when you pick Draft, Queue, or Schedule.</li>
    </ol>
    <h2>Preview without signing in</h2>
    <p>You can open the calendar without a Buffer account. Notes, actions, Content Bank items, and Compose drafts are saved in your browser. Scheduled posts, Queue Health coverage, and sending to Buffer need Buffer sign-in.</p>
    <h2>Take the tour</h2>
    <p>A five-step tour opens the first time you visit. To see it again, choose <strong>Take a tour</strong> in the sidebar, the Calendar header, or the mobile More menu. It walks through the calendar, planning context, Queue Health, Your Pace, and Content Bank. It only points at controls and never sends anything to Buffer. Skip or close it at any time and restart it from the same buttons; steps for workspaces you have turned off are skipped.</p>
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
    summary: 'Learn how to review your Buffer queue on the calendar, read gap labels, add planning notes and actions, and share snapshots.',
    tags: ['calendar', 'queue', 'gaps', 'notes', 'actions', 'snapshot', 'planning'],
    featured: false,
    relatedArticles: ['getting-started', 'queue-health-your-pace', 'share-content-for-review'],
    body: `<p>The Calendar shows confirmed Buffer posts, date-only notes, to-do actions, and Content Bank target dates in month, week, or agenda view. Each has its own marker, and target dates are labelled “not scheduled”.</p>
    <h2>How to use the calendar</h2>
    <ol>
      <li>Sign in with Buffer and sync.</li>
      <li>Read the day labels: a <strong>gap</strong> means your rhythm expects a post and no confirmed post is loaded; a <strong>non-posting day</strong> is outside your rhythm.</li>
      <li>Use <strong>+ Add</strong> or the + on a day to add a note, an action, or a draft.</li>
      <li>Use Filters to narrow channels or item types, and Share for a read-only snapshot.</li>
    </ol>
    <p>Gap labels need a connected, recently synced queue. If data is partial or stale, the calendar says so instead of showing full coverage.</p>
    <h2>When to use Snapshot sharing</h2>
    <p>Use snapshots when you need to share a read-only plan quickly. Snapshot links are ideal for alignment, not for collecting line-by-line feedback.</p>
    <h3>Good to know</h3>
    <ul>
      <li>Snapshots are static views, so re-share after major updates.</li>
      <li>Plan helps you prepare; publishing still happens through Buffer actions.</li>
    </ul>`
  },
  {
    // Slug kept from the retired thread-splitter guide so existing links still work.
    slug: 'write-split-send-posts',
    title: 'Write and Send Posts to Buffer',
    category: 'Compose',
    summary: 'Learn how to draft posts, add media, start from a calendar day, and choose the right Buffer action.',
    tags: ['compose', 'media', 'draft', 'queue', 'schedule'],
    featured: false,
    relatedArticles: ['getting-started', 'build-your-idea-system', 'share-content-for-review'],
    body: `<p>Compose is where ideas become publish-ready posts. Draft the message, shape formatting, attach media, and decide the final Buffer action.</p>
    <h2>Drafting workflow</h2>
    <ol>
      <li>Start from a blank draft, a template, a Content Bank item, or a calendar day.</li>
      <li>Add copy and media.</li>
      <li>If you started from the calendar, use the planning date in the schedule picker only if you want it.</li>
      <li>Choose the Draft, Queue, or Schedule action for Buffer.</li>
    </ol>
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
    slug: 'queue-health-your-pace',
    title: 'Check Coverage with Queue Health and Your Pace',
    category: 'Queue Health',
    summary: 'Set a posting rhythm per channel, check a period for uncovered slots, and plan days off or a lighter stretch.',
    tags: ['queue health', 'your pace', 'gaps', 'coverage', 'rhythm', 'days off', 'runway'],
    featured: true,
    relatedArticles: ['plan-content-calendar', 'connect-buffer', 'getting-started'],
    body: `<p>Queue Health shows each channel’s confirmed runway. Your Pace, on the same page, compares confirmed scheduled Buffer posts with the rhythm you choose.</p>
    <h2>Set a rhythm</h2>
    <ol>
      <li>Open <strong>Queue Health</strong> from the sidebar, the Calendar header, or the mobile More menu.</li>
      <li>Under <strong>Channel rhythm</strong>, pick a channel, its posting days, and posts per selected day (0–10).</li>
      <li>Choose a period of up to 92 days and select <strong>Check this period</strong>.</li>
      <li>Use <strong>Plan this slot</strong> to open that date on the calendar with the channel selected.</li>
    </ol>
    <h2>Before time away</h2>
    <p>Use <strong>Intentional days off</strong> for one channel or all channels, or <strong>A lighter period</strong> to lower a target for selected dates. Days off are excluded from gaps.</p>
    <h3>Good to know</h3>
    <ul>
      <li>Only confirmed scheduled posts count. Notes, drafts, and target dates do not.</li>
      <li>Coverage needs Buffer sign-in and a recent sync; partial or stale data is labelled.</li>
      <li>These are local planning settings. They never move, cancel, or delete Buffer posts.</li>
    </ul>`
  },
  {
    slug: 'build-your-idea-system',
    title: 'Build Your Idea System',
    category: 'Content Bank',
    summary: 'Learn how to use saved content, Content Pillars, Templates, and Trending to turn raw ideas into reusable content starters.',
    tags: ['notebook', 'content pillars', 'templates', 'trending', 'ideas', 'starters'],
    featured: false,
    relatedArticles: ['plan-content-calendar', 'write-split-send-posts', 'getting-started'],
    body: `<p>Content Bank holds your saved material. Local target dates are planning reminders, not confirmed Buffer scheduling. Use the date controls to plan, and Develop to continue the existing workflow. Templates, Content Pillars and Trending are available under Resources. Instead of starting from zero each time, you store signals and transform them into usable drafts.</p>
    <h2>Use each tool for a specific job</h2>
    <ul>
      <li><strong>Saved content</strong>: search existing material, identify items without a target, and plan a local date. Your original source and channel versions stay intact.</li>
      <li><strong>Content Pillars</strong>: define recurring themes.</li>
      <li><strong>Templates</strong>: save proven structures and CTAs.</li>
      <li><strong>Trending</strong>: monitor timely topics to react faster.</li>
    </ul>
    <h2>Simple weekly routine</h2>
    <ol>
      <li>Save 5–10 new idea inputs in Content Bank or Trending.</li>
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
    category: 'Snapshots',
    summary: 'Learn when to use Snapshots for plan visibility and what reviewers can see.',
    tags: ['review', 'snapshot', 'stakeholders', 'feedback'],
    featured: false,
    relatedArticles: ['plan-content-calendar', 'write-split-send-posts', 'troubleshooting'],
    body: `<p>Snapshots share a read-only view of your plan, so a client or teammate can see what is coming without access to your workspace.</p>
    <h2>When to use a snapshot</h2>
    <ul>
      <li>Aligning on calendar direction before you write.</li>
      <li>Giving stakeholders visibility into a week or month of planned content.</li>
    </ul>
    <h2>Recommended review flow</h2>
    <ol>
      <li>Share a snapshot to align on calendar direction.</li>
      <li>Draft in Compose once the direction is agreed.</li>
      <li>Send to Buffer when you are ready to publish.</li>
    </ol>
    <h3>Good to know</h3>
    <ul>
      <li>Reviewers see what you shared at that stage, not your entire workspace.</li>
      <li>Snapshots are static, so re-share after major updates.</li>
      <li>In beta, minor visual differences can occur between draft and published formatting.</li>
    </ul>`
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting PostIQ',
    category: 'Troubleshooting',
    summary: 'Fix common connection, sync, media, Snapshot, and beta feature issues.',
    tags: ['troubleshooting', 'oauth', 'sync', 'media', 'snapshot', 'beta'],
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
