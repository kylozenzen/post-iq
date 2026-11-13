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
    summary: 'Turn Pace on or off, pick a theme, understand what saves automatically, and manage your Buffer connection.',
    tags: ['settings', 'customize', 'theme', 'sidebar', 'sign out', 'logout', 'stay signed in', 'API key'],
    relatedArticles: ['connect-buffer', 'privacy-storage-beta-limits'],
    body: `<p>Open Settings from the sidebar or the mobile More menu. Section tabs stay available while you scroll.</p>
    <h2>Connection</h2><p>Check your Buffer connection, choose Sync now, or Sign out. You stay signed in on this browser until you sign out, clear site data, or Buffer requires authorization again. Advanced API key setup is optional: Session keeps a manual key for this tab, while Save locally keeps it between visits. Sign out removes both kinds of Buffer access.</p>
    <h2>Customize</h2><p>The Pace switch, theme, planning options (queue gaps, week numbers in week view, posting days), and note types save automatically in this browser. Calendar, Compose and Shelf are always on. Turning Pace off hides it from the sidebar and calendar header and keeps your posting schedules for when you turn it back on.</p>
    <h2>Posting rhythm</h2><p>Choose default posting days or override them for each synced channel. The posting schedule guides open-slot suggestions. Changing it never changes your Buffer queue or scheduled posts.</p>
    <h2>Features and Discord</h2><p>The Features tab shows which beta tools are available right now. If a tool is paused, PostIQ shows a notice instead of breaking your workflow. Discord has its own configuration and save controls. Never include keys or webhook URLs in screenshots or support messages.</p>
    <h2>Using a shared device</h2><p>Sign out clears Buffer access and cached Buffer data but keeps local work and other integration settings. Private browser windows can discard saved work when closed. Export or copy important work before clearing site data.</p>`
  },
  {
    slug: 'getting-started',
    title: 'Getting Started with PostIQ',
    category: 'Getting Started',
    summary: 'Learn what PostIQ is, how it works with Buffer, and the calendar-first workflow: connect, check coverage, plan a gap, send.',
    tags: ['onboarding', 'workflow', 'buffer', 'queue', 'publish'],
    featured: true,
    relatedArticles: ['connect-buffer', 'plan-content-calendar', 'keyboard-shortcuts-command-menu'],
    body: `<p>PostIQ is an independent calendar companion for Buffer users. Buffer is still your publishing home. PostIQ shows your scheduled Buffer posts beside planning notes and actions, flags gaps against the posting rhythm you choose, and helps you turn saved content into a dated plan. It is not made by or affiliated with Buffer.</p>
    <h2>How PostIQ fits into your process</h2>
    <ol>
      <li><strong>Connect Buffer</strong> so PostIQ can load your channels and scheduled queue.</li>
      <li><strong>Set your posting schedule</strong> in <strong>Pace</strong> (sidebar) to show open slots that fit your rhythm.</li>
      <li><strong>Plan a gap</strong> from the calendar: add a note or action, date a Shelf idea, or start a draft for that day.</li>
      <li><strong>Send to Buffer</strong> from Compose only when you pick Draft, Queue, or Schedule.</li>
    </ol>
    <h2>Preview without signing in</h2>
    <p>You can open the calendar without a Buffer account. Notes, actions, Shelf ideas, and Compose drafts are saved in your browser. Scheduled posts and sending to Buffer need Buffer sign-in.</p>
    <h2>Take the tour</h2>
    <p>A four-step tour opens the first time you visit. To see it again, choose <strong>Take a tour</strong> in the sidebar, the calendar’s ⋯ menu, or the mobile More menu. It walks through the calendar, planning a day, Compose, and what Shelf is for. The first time you open Shelf, a short run-through offers a stop for each of its tabs. It only points at controls and never sends anything to Buffer. Skip or close it at any time and restart it from the same buttons.</p>
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
    relatedArticles: ['settings-and-sign-out', 'troubleshooting', 'plan-content-calendar'],
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
      <li>Choose <strong>Sync now</strong> to pull current queue data.</li>
      <li>Verify the right profile filter is selected.</li>
    </ol>
    <h2>Staying signed in</h2>
    <p>Buffer sign-in is saved on this browser across reloads and new tabs. PostIQ refreshes access automatically when Buffer provides a refresh token. Clearing site data, private browsing, or revoked authorization can require another sign-in. A network outage or rate limit does not clear your saved connection; retry Sync now when service returns.</p>
    <h2>Sign out</h2>
    <p>Choose <strong>Sign out</strong> in the sidebar, mobile More menu, or Settings → Connection. This removes Buffer tokens, any manual API key, and cached Buffer posts from this browser. It keeps local notes, Shelf ideas, drafts, and preferences. It does not sign you out of buffer.com or cancel anything already queued there. To revoke PostIQ’s authorization entirely, use Buffer’s connected-app controls.</p>
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
    relatedArticles: ['getting-started', 'keyboard-shortcuts-command-menu', 'share-content-for-review'],
    body: `<p>The Calendar shows two layers. <strong>Posts</strong> from Buffer are solid cards with platform icons. <strong>Plans</strong> you make — notes, to-dos and dated Shelf ideas — are outlined. Switch between Month and Week at the top, or choose List view from the ⋯ menu.</p>
    <h2>How to use the calendar</h2>
    <ol>
      <li>Sign in with Buffer and sync.</li>
      <li>Look for dashed <strong>open slots</strong>: a day where your posting schedule expects a post and none is in Buffer yet. Open the day to fill it.</li>
      <li>Newsletters and campaigns show as a band across their days: solid on the first and last day, a light tint between. Open any day in the range to see where it stands, like <em>Day 3 of 5 · next: Final</em>.</li>
      <li>Use <strong>+ Add</strong>, or the + that appears on a day, to add a note, a to-do, or a draft.</li>
      <li>Open the <strong>⋯ menu</strong> to filter by channel or item, set your posting schedule, switch to List view, or share a read-only snapshot. When a filter is on, a dot appears on ⋯ and a “Filtered · Clear” chip shows beside it.</li>
    </ol>
    <h2>Fast ways to plan</h2>
    <ul>
      <li><strong>Quick add.</strong> Press <strong>⌘K / Ctrl K</strong>, choose Quick add, or press <kbd>N</kbd> and type a plan with its day: “Fri: reshare the press release”, “todo tomorrow: film B-roll”, “Nov 12: webinar promo”, or a holiday name like “Thanksgiving: thank-you post”. A preview shows the day before you press Enter.</li>
      <li><strong>Today.</strong> When you’re looking at the current month or week, the Today card shows what’s going out, today’s to-dos, and your next open slot.</li>
      <li><strong>Fill an open slot.</strong> Click a dashed open slot (or use the Today card). If you’ve starred evergreen posts on your Shelf, PostIQ suggests one and shows the exact day and time before you queue it in Buffer. Choose <strong>Another</strong> for a different post, or <strong>Write new</strong>.</li>
      <li><strong>Drag to reschedule.</strong> Drag a scheduled post or a plan to another day. Posts keep their time of day and move in Buffer; plans move in PostIQ. Every move has an <strong>Undo</strong>. Published posts and past days don’t move.</li>
      <li><strong>Edit a scheduled post.</strong> Open the day or post, then choose <strong>Edit / reschedule</strong>. Change the text or publish date and choose <strong>Save changes</strong>, <strong>Move to drafts</strong>, or <strong>Publish now</strong>. Publishing now asks you to confirm. These actions update the existing Buffer post and keep its media and channel settings. Thread text is edited in Buffer; you can still change the thread’s schedule, move it to drafts, or publish it here. Shared snapshots stay read-only.</li>
      <li><strong>Holidays.</strong> Public holidays show under the date. Pick your country, or turn them off, in the ⋯ menu.</li>
    </ul>
    <h2>Keep a copy of your plans</h2>
    <p>Plans are saved in this browser. From the ⋯ menu you can <strong>Download a backup</strong> (and later <strong>Restore</strong> it on any browser), or <strong>Export to calendar app</strong> to add your plans to Google, Apple or Outlook calendar. Backups never include your Buffer sign-in.</p>
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
      <li>Start from a blank draft, a template, a Shelf idea, or a calendar day.</li>
      <li>Add copy and media.</li>
      <li>If you started from a calendar day, the schedule picker is already set to that day at the channel’s usual time. Nothing is sent until you press Schedule, and “Not for this day” clears it.</li>
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
    slug: 'queue-health-your-pace', // Retained so older help links continue to resolve.
    title: 'Pace: Posting Schedules and Time Away',
    category: 'Plan / Calendar',
    summary: 'Set which days each channel posts, see how far ahead you are, and plan a break so nothing goes quiet.',
    tags: ['pace', 'calendar', 'gaps', 'posting schedule', 'rhythm', 'days off', 'time off', 'vacation', 'break', 'runway'],
    featured: true,
    relatedArticles: ['plan-content-calendar', 'connect-buffer', 'getting-started'],
    body: `<p><strong>Pace</strong> is where your posting rhythm lives. Open it from the sidebar, the gauge icon on the calendar, or <strong>Posting schedule</strong> in the calendar’s ⋯ menu. Nothing here changes your Buffer queue unless you press a Queue button.</p>
    <h2>Posting schedule</h2>
    <ol>
      <li>Each channel has a row. Tap the day letters it posts on and set <strong>posts per day</strong> (0–10). Changes save as you go.</li>
      <li>The right side says how far ahead that channel is, like <em>Covered for 4 days · Next open day Tue</em>, or <em>Today is open</em>.</li>
      <li>The line at the top sums it up: who needs something soon, and whether the rest are fine.</li>
      <li>Turn on <strong>Fill gaps from Shelf</strong> for channels where resharing a kept post is okay. Instagram, TikTok, YouTube and Pinterest need a photo or video, so they’re never filled with text.</li>
    </ol>
    <p>On the calendar, dashed <strong>open slots</strong> are days your schedule expects a post and Buffer has none yet. Tap one to reshare from Shelf or write something new.</p>
    <h2>Time away</h2>
    <ol>
      <li>Pick the dates you’ll be away. The table shows, week by week, posts queued against posts your schedule expects.</li>
      <li><strong>Keep posting:</strong> queue reshares from your Shelf on the empty days, at each channel’s usual time. Each kept post goes out at most once per channel, and nothing doubles up with what’s already in Buffer.</li>
      <li><strong>Go quiet on purpose:</strong> choose <strong>Mark these days off</strong>. Those days stop counting as gaps on the calendar. Remove time off from the list anytime.</li>
    </ol>
    <h2>Turning Pace off</h2>
    <p>Don’t need it? Go to <strong>Settings → Customize</strong> and switch <strong>Pace</strong> off. It leaves the sidebar and calendar header, and your schedules are kept. Open slots on the calendar follow the separate <strong>Show queue gaps</strong> setting.</p>
    <h3>Good to know</h3>
    <ul>
      <li>PostIQ re-reads Buffer on its own when its copy is more than a few minutes old, and shortly after it queues anything, so Pace and the calendar stay current.</li>
      <li>Public holidays are in the calendar’s ⋯ menu under Holidays.</li>
      <li>Your schedule and time off are local planning preferences. They never move, cancel, or delete Buffer posts.</li>
    </ul>`
  },
  {
    slug: 'keyboard-shortcuts-command-menu',
    title: 'Keyboard shortcuts & command menu',
    category: 'Plan / Calendar',
    summary: 'Find actions with the command menu, add a plan in plain English, and move around the calendar from your keyboard.',
    tags: ['keyboard', 'shortcuts', 'command menu', 'quick add', 'accessibility'],
    relatedArticles: ['plan-content-calendar', 'getting-started'],
    body: `<p>Press <kbd>⌘K</kbd> on a Mac or <kbd>Ctrl K</kbd> on Windows to open the command menu. Search for an action, use the arrow keys to choose it, press Enter to run it, or press Escape to close the menu.</p>
    <h2>Quick add from the menu</h2><p>Type a plan such as “Fri: film B-roll” or “todo tomorrow: review captions” and press Enter. PostIQ reads the date, shows a preview, and saves it to the calendar. Press <kbd>N</kbd> or choose <strong>+ Add</strong> for the quick-add field.</p>
    <h2>Calendar shortcuts</h2><ul><li><kbd>T</kbd>: go to today</li><li><kbd>←</kbd> / <kbd>→</kbd>: previous or next period</li><li><kbd>M</kbd> / <kbd>W</kbd> / <kbd>L</kbd>: Month, Week, or List view</li><li><kbd>Arrow keys</kbd>: move focus between days; press Enter to open a day</li><li><kbd>?</kbd>: show the shortcut sheet</li></ul>
    <p>Shortcuts pause while you type in a field or when a dialog is open. The command menu can still be opened with its shortcut while you are in a field.</p>`
  },
  {
    slug: 'build-your-idea-system',
    title: 'Build Your Idea System',
    category: 'Shelf',
    summary: 'Use the Shelf’s Notebook, Snippets, Past posts, and Trending tabs to collect ideas and turn them into content for your calendar.',
    tags: ['shelf', 'notebook', 'snippets', 'past posts', 'trending', 'ideas', 'starters'],
    featured: false,
    relatedArticles: ['plan-content-calendar', 'write-split-send-posts', 'getting-started'],
    body: `<p>The Shelf is on by default and is your go-to place for content: ideas, snippets, past posts, and trending topics. Add a Shelf item to your calendar when you need it. Local target dates are planning reminders, not confirmed Buffer scheduling. Instead of starting from zero each time, you save signals and turn them into drafts.</p>
    <h2>Use each tool for a specific job</h2>
    <ul>
      <li><strong>Notebook</strong>: capture ideas and notes, and give an idea a target date to plan it on the calendar.</li>
      <li><strong>Snippets</strong>: save proven hooks, openings, calls to action, and hashtag sets. Compose pulls them in as you write.</li>
      <li><strong>Past posts</strong>: star posts that worked. Starred posts can fill open calendar slots, or be reshared to keep your streak going.</li>
      <li><strong>Trending</strong>: see what is trending on Reddit, Hacker News and Product Hunt, to react faster.</li>
    </ul>
    <h2>Simple weekly routine</h2>
    <ol>
      <li>Save 5–10 new ideas to your Notebook or from Trending.</li>
      <li>Turn the strongest ideas into snippets.</li>
      <li>Put the ones you are ready to post on your calendar.</li>
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
