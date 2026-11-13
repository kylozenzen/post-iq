# Buffer Commit: LinkedIn drafts

Pairs with `commit-stats-1080x1350.png`. Links go in the post body (no first-comment scheduling on this Buffer plan).

## Subtraction lesson (learning post, Nov 12)

I deleted twice as much code as I wrote.

17 days ago I entered PostIQ into Buffer Commit. It had a lot of features: Pulse, Content Pillars, Approvals, a home dashboard, AI Assist.

Every person I showed it to liked one or two of them. Never the same two.

That was the signal. I didn't have a product. I had a toolbox.

So one of the biggest commits wasn't a feature. It was 20,903 lines of dead code, gone.

Then I picked the one thing creators kept asking for: a calendar that shows what's planned, not just what's scheduled. Everything left had to serve one loop: see how far ahead you are, fill the gap, send to Buffer.

The numbers:
• 28 pull requests merged
• 27.4k lines removed, 13.1k added
• 5 features cut on purpose
• 143 tests passing

The lesson I keep relearning: when people love different parts of your thing, that's not validation. It's a menu. Pick one dish.

Full write-up tomorrow. If you plan around a Buffer queue, PostIQ is free in beta: postiq.netlify.app

## Plumbing lesson (save for the final recap)

The bug that taught me the most this week wasn't a crash.

PostIQ is a planning calendar for Buffer. This week I found out it only re-read Buffer when you pressed Sync. So a post you'd edited or deleted in Buffer would just sit on the calendar. Looking fine. Being wrong.

Nobody would have reported that as a bug. They'd have quietly stopped trusting the calendar.

That's the trap with planning tools. The feature isn't the pretty calendar. It's whether the calendar is telling the truth.

So the last push of Buffer Commit wasn't new features. It was making PostIQ refresh on its own, making reshares land on the actual empty days, and making sure it never offers a text-only post to Instagram.

17 days. 28 pull requests merged. 27.4k lines removed, 13.1k added. 143 tests passing.

Boring plumbing. Biggest trust upgrade.

Full write-up: postiq.netlify.app
