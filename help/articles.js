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
  "Shelf",
  "Content Pillars",
  "Templates",
  "Notebook",
  "Trending",
  "Snapshots",
  "Troubleshooting",
  "Privacy & Data",
  "Settings"
];

window.HELP_CATEGORIES = HELP_CATEGORIES;

window.POSTIQ_HELP_ARTICLES = [
  {
    slug: 'settings-and-sign-out',
    title: 'Settings, Saved Preferences, and Sign Out',
    category: 'Settings',
    summary: 'Customize PostIQ, enable Shelf ideas, and find advanced connection settings.',
    tags: ['settings', 'customize', 'theme', 'sidebar', 'sign out', 'logout', 'stay signed in', 'API key'],
    relatedArticles: ['connect-buffer', 'privacy-storage-beta-limits'],
    body: `<p>Open <strong>Settings</strong> from the desktop sidebar or mobile More menu. Settings is for preferences and advanced configuration; most everyday Buffer actions can now be done directly in the sidebar.</p>
<h2>Buffer connection without opening Settings</h2>
<p>Click the compact Buffer status row near the top of the sidebar to expand <strong>Connect/Reconnect Buffer</strong>, <strong>Sync now</strong>, or <strong>Sign out</strong>, as applicable. Click it again to collapse. Green indicates a connected account; amber indicates a reconnect or detected sync issue.</p>
<p>Use <strong>Settings → Connection</strong> or <strong>Advanced connection settings</strong> for less common setup, including the optional manual API key. Your browser keeps Buffer sign-in until you sign out, clear site data, or need reauthorization.</p>
<h2>Customize</h2>
<p>Under <strong>Settings → Customize</strong>, choose your workspace visibility, theme, posting defaults, queue-gap visibility, and note types. <strong>Ideas on the Shelf</strong> adds an Ideas tab to Shelf; turning it off hides that tab rather than deleting your ideas. At least one workspace must remain enabled. Preferences save in this browser.</p>
<h2>Posting rhythm</h2>
<p>Use <strong>Posting schedule</strong> from the calendar's <strong>⋯</strong> menu to choose days and channel cadence. This guides open slots and coverage without moving or modifying scheduled Buffer posts.</p>
<h2>Help and onboarding</h2>
<p>Open <strong>Help</strong> in the sidebar to choose <strong>Getting started</strong>, <strong>Replay product tour</strong>, or <strong>Help Center</strong>. Getting started opens a separate optional checklist, not a permanent calendar banner.</p>
<h2>AI, Discord, and shared devices</h2>
<p>Optional integrations have their own configuration. Never include private keys or webhook URLs in screenshots. Signing out of Buffer keeps local plans and other integration settings; clearing browser data may remove those. Use the calendar backup feature before clearing your browser or moving devices.</p>`
  },
  {
    slug: 'getting-started',
    title: 'Getting Started with PostIQ',
    category: 'Getting Started',
    summary: 'Start with Welcome, take the four-part tour, and find optional setup in Help.',
    tags: ['onboarding', 'workflow', 'buffer', 'queue', 'publish'],
    featured: true,
    relatedArticles: ['connect-buffer', 'plan-content-calendar', 'keyboard-shortcuts-command-menu'],
    body: `<p>PostIQ is an independent planning companion for Buffer. Buffer handles publishing; PostIQ helps you see scheduled posts alongside notes, to-dos, and dated ideas, spot gaps in your posting rhythm, and prepare what comes next. PostIQ is not made by or affiliated with Buffer.</p>
<h2>Your first visit: choose your pace</h2>
<p>The first time you open the app, a welcome screen offers <strong>Take the tour</strong> or <strong>Look around</strong>. Neither choice requires connecting Buffer. If you are already connected, PostIQ keeps your existing session; it does not make you sign in again to take the tour.</p>
<h2>The four-part tour</h2>
<ol>
<li><strong>Calendar:</strong> solid cards are scheduled Buffer posts; outlined items are plans that are not scheduled.</li>
<li><strong>Planning:</strong> use <strong>+ Add</strong> or open a calendar day to add a note, reminder, or idea. In an open day drawer, choose <strong>Add planning note</strong>.</li>
<li><strong>Compose:</strong> write and prepare a post. Sending it to Buffer requires a deliberate Draft, Queue, or Schedule action and a connected Buffer account.</li>
<li><strong>Shelf:</strong> keep past posts handy and optionally enable <strong>Ideas on the Shelf</strong> under <strong>Settings → Customize</strong>. The tour includes a <strong>Show me that setting</strong> shortcut.</li>
</ol>
<p>The tour is skippable. Reopen it through <strong>Help → Replay product tour</strong>, the calendar's <strong>⋯</strong> menu, or the mobile More menu. It guides you around the interface; it does not publish or send posts.</p>
<h2>Getting Started is optional</h2>
<p>Need help with setup after the tour? Open <strong>Help → Getting started</strong> in the sidebar. This opens a separate checklist window with optional tasks: connect Buffer, set a posting rhythm, enable Shelf ideas, create a Buffer draft, and star a past post for reuse. The checklist is not something you must finish to use PostIQ.</p>
<h2>Explore without a Buffer account</h2>
<p>Choose <strong>Look around</strong> to explore the existing calendar and planning tools. Local planning work stays in this browser. This is not a preloaded sample Buffer queue: actual scheduled posts, channels, and sending actions require a Buffer connection.</p>
<h2>Start a simple workflow</h2>
<ol><li>Connect Buffer from the expandable status at the top of the sidebar if you want to see your real posts.</li><li>Check the calendar and set your posting rhythm in its <strong>⋯</strong> menu.</li><li>Open a blank day, add a plan, or move an idea onto a date.</li><li>Open Compose and send to Buffer only when ready.</li></ol>
<p><strong>Nothing publishes automatically.</strong> A note, draft, or target date is not a scheduled Buffer post.</p>`
  },
  {
    slug: 'connect-buffer',
    title: 'Connect Buffer and Manage Syncing',
    category: 'Buffer Connection',
    summary: 'Expand the sidebar status to connect, sync, reconnect, and sign out of Buffer.',
    tags: ['buffer', 'oauth', 'sync', 'token', 'disconnected'],
    featured: true,
    relatedArticles: ['settings-and-sign-out', 'troubleshooting', 'plan-content-calendar'],
    body: `<p>PostIQ uses your Buffer connection to load channels and scheduled posts. <strong>Connected</strong> means authorized; <strong>synced</strong> means the app has refreshed data. The two are different.</p>
<h2>Connect from the sidebar</h2>
<ol><li>Find the Buffer status row near the top of the desktop sidebar. It says <strong>Connect Buffer</strong>, <strong>Buffer connected</strong>, <strong>Reconnect Buffer</strong>, or <strong>Sync issue</strong>, depending on the state.</li><li>Click the status row to <strong>expand</strong> its actions without leaving the calendar.</li><li>Choose <strong>Connect Buffer</strong> (or <strong>Reconnect Buffer</strong>) and finish Buffer's authorization flow.</li><li>When connected, expand the row again and use <strong>Sync now</strong> to refresh your queue and channels.</li><li>Click the status row again to collapse the controls.</li></ol>
<h2>What the status light means</h2>
<ul><li><strong>Green:</strong> Buffer is connected. Data may still need syncing.</li><li><strong>Amber:</strong> the session needs reconnection or the most recent sync reports an issue.</li><li><strong>Neutral:</strong> Buffer is not connected yet.</li></ul>
<p>When a sync issue occurs, open the status row, try <strong>Sync now</strong>, and review your channel filters. A connection being active does not guarantee your calendar data is current.</p>
<h2>Sign out and advanced settings</h2>
<p>Expand the sidebar status row and choose <strong>Sign out</strong> to disconnect from Buffer. More advanced setup, including the optional manual API key fallback, remains under <strong>Advanced connection settings</strong> or <strong>Settings → Connection</strong>. On mobile, connection actions remain available from the More menu.</p>
<p>Signing out clears Buffer tokens, manual Buffer keys, and cached Buffer data from this browser; it does not remove your locally saved notes, ideas, drafts, or preferences. It does not cancel scheduled Buffer posts or sign you out of buffer.com.</p>
<h2>Why might I need to reconnect?</h2>
<p>PostIQ keeps your Buffer sign-in on this browser and refreshes authorization when possible. Clearing site data, using a private session, revoking the app, or an expired authorization may require sign-in again. A temporary network or API problem may instead require only another sync.</p>`
  },
  {
    slug: 'plan-content-calendar',
    title: 'Plan Your Content Calendar',
    category: 'Plan / Calendar',
    summary: 'Learn how to review your Buffer queue on the calendar, read gap labels, add planning notes and actions, and share snapshots.',
    tags: ['calendar', 'queue', 'gaps', 'notes', 'actions', 'snapshot', 'planning'],
    featured: false,
    relatedArticles: ['getting-started', 'keyboard-shortcuts-command-menu', 'share-content-for-review'],
    body: `<p>The Calendar is PostIQ's home. <strong>Solid cards</strong> represent posts loaded from Buffer; <strong>outlined cards</strong> represent local notes, to-dos, and dated ideas that have not been scheduled. Choose Month or Week from the calendar controls, or List from the <strong>⋯</strong> menu.</p>
<h2>Start on a blank day</h2><ol><li>Click a calendar date or dashed <strong>Open slot</strong>.</li><li>The day drawer opens with <strong>Add planning note</strong>, <strong>Start draft</strong>, and <strong>Plan a campaign / newsletter</strong> actions.</li><li>Choose the action that matches your next step; a note stays a plan, while a draft takes you to Compose.</li><li>Nothing goes into Buffer until you deliberately choose a send or schedule action.</li></ol>
<h2>Plan faster</h2><ul><li><strong>+ Add:</strong> open the calendar's add-plan entry point. Press <kbd>N</kbd> when keyboard shortcuts are available.</li><li><strong>Today card:</strong> see today's posts and tasks and find an upcoming gap.</li><li><strong>Open slots:</strong> reflect your chosen posting rhythm, not a requirement to publish every day.</li><li><strong>Drag:</strong> move an eligible post or plan to another day and use Undo when offered. Moving a Buffer post may update the connected queue; local plans remain local.</li><li><strong>Holidays:</strong> choose visible public holidays from the calendar menu.</li></ul>
<h2>Filters and posting rhythm</h2><p>Use the calendar <strong>⋯</strong> menu to filter by channel or content, configure your posting schedule, and access additional views and share tools. Coverage information depends on the channels and scheduled posts most recently synced from Buffer.</p>
<h2>Backup and sharing</h2><p>The menu includes options for backing up and restoring local plans, exporting calendar data, and sharing read-only snapshots when enabled. Backups do not contain your Buffer authorization. Snapshot links show a static view; share a new one after substantial changes.</p>
<p>Remember: a planning date is not a scheduled Buffer post, and a stale sync may make calendar coverage incomplete.</p>`
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
    body: `<p><strong>Compose</strong> is where you turn a plan into something ready for Buffer. You can explore the editor without connecting; actual Buffer sending requires a connected account.</p>
<h2>Start writing</h2><ol><li>Open <strong>Compose</strong> from the sidebar, or open a calendar day and choose <strong>Start draft</strong>.</li><li>Write your message, choose channels when available, and attach media or use writing resources as needed.</li><li>Review the copy, media, channels, and timing.</li><li>Only when ready, choose the appropriate Buffer action.</li></ol>
<h2>Draft, Queue, or Schedule?</h2><ul><li><strong>Draft:</strong> send an unfinished post into Buffer drafts for later work.</li><li><strong>Queue:</strong> send it to Buffer's posting queue.</li><li><strong>Schedule:</strong> choose a specific posting date and time.</li></ul>
<p>Creating a local planning note or opening Compose does not schedule a Buffer post. A target date in PostIQ is only a plan until you explicitly send to Buffer.</p>
<h2>Need a starting point?</h2><p>Use <strong>Shelf</strong> for past posts, or enable <strong>Ideas on the Shelf</strong> under <strong>Settings → Customize</strong> for an ideas tab you can develop over time. The four-part onboarding tour includes Compose and Shelf.</p>`
  },
  {
    slug: 'queue-health-your-pace', // Retained so older help links continue to resolve.
    title: 'Choose a Posting Schedule',
    category: 'Plan / Calendar',
    summary: 'Choose posting days for each channel and understand how open slots appear on the calendar.',
    tags: ['calendar', 'gaps', 'posting schedule', 'rhythm', 'days off'],
    featured: true,
    relatedArticles: ['plan-content-calendar', 'connect-buffer', 'getting-started'],
    body: `<p>Your posting schedule tells PostIQ which days are useful opportunities to plan. It is a local planning preference and does not change what is scheduled in Buffer.</p>
    <h2>Set a rhythm</h2>
    <ol>
      <li>On the calendar, open the <strong>⋯ menu</strong> and choose <strong>Posting schedule</strong>.</li>
      <li>Under <strong>Channel rhythm</strong>, pick a channel, its posting days, and posts per selected day (0–10).</li>
      <li>Look for dashed <strong>Open slot</strong> buttons on days when the schedule expects a post and no confirmed post is loaded.</li>
      <li>Choose an open slot to see one-tap fill suggestions or start a new plan for that date.</li>
    </ol>
    <h2>Before time away</h2>
    <p>Use the Holidays picker in the ⋯ menu to show public holidays for a country or turn them off. You can still add a note or to-do on any date.</p>
    <h3>Good to know</h3>
    <ul>
      <li>Only confirmed Buffer posts appear as scheduled. Notes, drafts, and target dates stay in the outlined planning layer.</li>
      <li>A recent Buffer sync is needed to show scheduled posts; partial or stale data is labelled.</li>
      <li>The schedule is a local planning preference. It never moves, cancels, or deletes Buffer posts.</li>
    </ul>`
  },
  {
    slug: 'keyboard-shortcuts-command-menu',
    title: 'Keyboard shortcuts & command menu',
    category: 'Plan / Calendar',
    summary: 'Find actions with the command menu, add a plan in plain English, and move around the calendar from your keyboard.',
    tags: ['keyboard', 'shortcuts', 'command menu', 'quick add', 'accessibility'],
    relatedArticles: ['plan-content-calendar', 'getting-started'],
    body: `<p>PostIQ has a keyboard power layer for common navigation and planning tasks. Press <kbd>⌘K</kbd> on Mac or <kbd>Ctrl+K</kbd> on Windows to open the command menu. Use the arrow keys and Enter to choose actions, or Escape to close it.</p>
<h2>Add a plan by typing a date</h2><p>Choose <strong>+ Add</strong> or press <kbd>N</kbd> outside text fields to open the add-plan flow. Enter a date and an idea, such as “Fri: film B-roll,” “tomorrow: review captions,” or “Nov 12: webinar promo.” Check the proposed date before saving. These entries are local plans, not Buffer posts.</p>
<h2>Calendar navigation</h2><p>Shortcuts include <kbd>T</kbd> for Today, <kbd>M</kbd> and <kbd>W</kbd> for Month and Week, and calendar navigation keys. Use <kbd>?</kbd> to show the shortcut reference where available.</p>
<p>Typing shortcuts pause when you are editing a field or using most dialogs, so they do not interfere with writing. The product tour is available through <strong>Help → Replay product tour</strong>.</p>`
  },
  {
    slug: 'build-your-idea-system',
    title: 'Build Your Idea System',
    category: 'Shelf',
    summary: 'Enable Ideas on the Shelf, reuse past posts, and develop ideas into plans.',
    tags: ['notebook', 'content pillars', 'templates', 'trending', 'ideas', 'starters'],
    featured: false,
    relatedArticles: ['plan-content-calendar', 'write-split-send-posts', 'getting-started'],
    body: `<p><strong>Shelf</strong> brings together past Buffer posts and, when enabled, a separate Ideas workspace. Think of past posts as material you can reuse; ideas are things you have not finished yet. A target date is a planning reminder, not a Buffer schedule.</p>
<h2>Turn on Ideas on the Shelf</h2>
<ol><li>Open <strong>Settings → Customize</strong>.</li><li>Find <strong>Ideas on the Shelf</strong> under workspace visibility.</li><li>Enable it to add an Ideas tab to Shelf.</li><li>Return to <strong>Shelf</strong> in the sidebar and switch between <strong>Past posts</strong> and <strong>Ideas</strong>.</li></ol>
<p>You can also reach this setting from the final step of the product tour or the optional <strong>Help → Getting started</strong> checklist. Disabling Ideas on the Shelf hides its navigation but does not erase locally saved ideas.</p>
<h2>Make use of past posts</h2>
<p>When connected and synced, the Past posts tab shows content returned from Buffer. Star useful posts as evergreen for later reuse or start a new take in Compose. Buffer remains responsible for publishing.</p>
<h2>Develop and date ideas</h2>
<p>Use the Ideas tab to keep a thought, develop it, and give it a target date that appears on the calendar's planning layer. Your original material remains separate from scheduled Buffer posts until you explicitly send a post to Buffer.</p>
<h2>Writing resources</h2>
<p>Templates, content pillars, and optional Trending tools can help you develop material. Availability may vary with feature settings and beta access. Use <strong>Compose</strong> when you are ready to turn a plan into a Buffer draft, queued post, or scheduled post.</p>`
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
    body: `<p>If PostIQ looks wrong, first distinguish account connection, sync status, browser-stored plans, and calendar filters.</p>
<h2>Buffer connected but posts are missing</h2>
<ol><li>Expand the Buffer status row in the sidebar.</li><li>Choose <strong>Sync now</strong> and check for a sync error.</li><li>Clear calendar filters or choose the correct channel.</li><li>If the status says <strong>Reconnect Buffer</strong>, complete sign-in again.</li></ol>
<h2>What do the connection colors mean?</h2>
<p>Green indicates an active Buffer connection, not necessarily a fresh sync. Amber means a reconnect or detected sync problem. Click the status row to expand troubleshooting actions. Advanced connection options are still available in Settings.</p>
<h2>I cannot find Getting Started</h2>
<p>Open the desktop sidebar's <strong>Help</strong> section, then choose <strong>Getting started</strong>. It opens a separate checklist window. <strong>Replay product tour</strong> is a different action: it highlights the main app screens. On mobile, use the More menu for the tour and help options.</p>
<h2>I cannot see Ideas on Shelf</h2>
<p>Go to <strong>Settings → Customize → Ideas on the Shelf</strong> and enable that workspace. The Past posts tab and Ideas tab are related but distinct parts of Shelf.</p>
<h2>How do I replay the welcome screen?</h2>
<p>Open <code>/app.html?welcome=1</code> on your PostIQ site to revisit the welcome choice without clearing your Buffer session. For just the guided steps, use <strong>Help → Replay product tour</strong> or the calendar's tour menu item.</p>
<h2>Media, snapshots, and beta issues</h2>
<p>If an upload or post action fails, check the file and retry; an API or network issue can be temporary. Snapshot links are read-only views and may need to be shared again after changes. When reporting a bug, include what you clicked, what you expected, what happened, and whether Buffer was connected—never include access tokens or private keys.</p>`
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
    <h2>Browser storage and signing out</h2>
    <p>Buffer sign-in tokens persist on this browser so you do not have to reconnect each visit. Sign out removes those tokens, any manual Buffer API key, and cached Buffer queue data. Your notes, Shelf items, drafts, preferences, and optional Gemini key remain on this device. Sign out is not an erase-all-data action. Export important local work before clearing browser site data; local work does not automatically follow you to another browser.</p>
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
