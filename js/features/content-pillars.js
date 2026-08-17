'use strict';

// ── CONTENT PILLARS v2 ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
// STRATEGY SNACK MACHINE × POSTIQ INTEGRATION
// Drop this entire block into app.js, replacing the existing
// ContentPillars IIFE. Then update the cpGateNew handler below.
//
// CHANGES TO EXISTING HTML (app.html):
//   1. Replace cpGateNew card inner HTML (see GATE CARD HTML section)
//   2. Add SSM form HTML (see SSM FORM HTML section)
//   Both are drop-in replacements — no structural changes needed.
// ═══════════════════════════════════════════════════════════════

// ── SSM GATE CARD HTML (replace cpGateNew button contents) ──────
// Paste this as the innerHTML of the existing #cpGateNew button:
/*
<span class="cp-gate-icon">⚡</span>
<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-family:'DM Mono',monospace;font-weight:600;letter-spacing:.06em;text-transform:uppercase;background:var(--brand-dim);border:1px solid var(--brand-glow);color:var(--brand);padding:2px 8px;border-radius:4px;margin-bottom:8px;">Pillar Plan Builder</span>
<span class="cp-gate-title">Generate my content strategy</span>
<span class="cp-gate-desc">Answer 6 quick questions. Get 5 content pillars, 25 post ideas, hooks, CTAs, recurring series ideas, and one post you can publish today.</span>
<span class="cp-gate-cta">Build my plan →</span>
*/

// ── SSM FORM HTML (insert inside #cpStageJourney, replace all inner content) ──
/*
Replace everything inside <div class="cp-stage" id="cpStageJourney"> with:

<div style="max-width:660px;">
  <!-- Loading screen (hidden until generate()) -->
  <div id="ssmLoading" style="display:none;text-align:center;padding:40px 20px;">
    <div style="font-family:'DM Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);margin-bottom:12px;" id="ssmLoadStep">Reading your inputs...</div>
    <div style="border:1px solid var(--border2);height:14px;max-width:280px;margin:0 auto 16px;overflow:hidden;border-radius:2px;"><div style="height:100%;background:var(--brand);width:0%;transition:width .1s linear;" id="ssmLoadBar"></div></div>
    <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:20px;color:var(--ink);letter-spacing:-.02em;">Building your pillar plan<span id="ssmDots">...</span></div>
  </div>

  <!-- Form (shown by default) -->
  <div id="ssmForm">
    <div style="margin-bottom:20px;">
      <div style="font-family:'DM Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--brand);margin-bottom:8px;">Pillar Plan Builder</div>
      <div style="font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:18px;color:var(--ink);margin-bottom:4px;">Answer a few questions. Get a pillar plan.</div>
      <div style="font-size:13px;color:var(--muted);line-height:1.6;">6 quick fields. Deterministic output — built from your inputs.</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="field">
        <label class="label">Brand / Creator Name</label>
        <input type="text" class="input" id="ssm-brand" placeholder="e.g. Maria Chen, TechWave" />
      </div>
      <div class="field">
        <label class="label">Industry Category</label>
        <select class="input" id="ssm-industry">
          <option value="">Select industry...</option>
          <option value="fitness">Fitness & Wellness</option>
          <option value="food">Food & Beverage</option>
          <option value="saas">SaaS / Tech</option>
          <option value="realestate">Real Estate</option>
          <option value="creative">Creative Services</option>
          <option value="ecommerce">E-Commerce / Product Brand</option>
          <option value="coaching">Coaching & Consulting</option>
          <option value="finance">Finance & Money</option>
          <option value="education">Education & Courses</option>
          <option value="nonprofit">Nonprofit / Mission-Driven</option>
          <option value="entertainment">Entertainment / Media</option>
          <option value="localbiz">Local Business</option>
        </select>
      </div>
      <div class="field">
        <label class="label">Target Audience</label>
        <input type="text" class="input" id="ssm-audience" placeholder="e.g. early-stage founders, busy moms" />
      </div>
      <div class="field">
        <label class="label">Product / Service / Offer</label>
        <input type="text" class="input" id="ssm-offer" placeholder="e.g. 1:1 coaching, SaaS tool, meal kits" />
      </div>
      <div class="field">
        <label class="label">Brand Tone</label>
        <select class="input" id="ssm-tone">
          <option value="">Select tone...</option>
          <option value="bold">Bold & Direct</option>
          <option value="playful">Playful & Fun</option>
          <option value="expert">Expert & Authoritative</option>
          <option value="warm">Warm & Relatable</option>
          <option value="edgy">Edgy & Provocative</option>
          <option value="professional">Professional & Polished</option>
        </select>
      </div>
      <div class="field">
        <label class="label">Main Goal</label>
        <select class="input" id="ssm-goal">
          <option value="">Select goal...</option>
          <option value="grow">Grow Audience</option>
          <option value="sales">Drive Sales</option>
          <option value="trust">Build Trust</option>
          <option value="educate">Educate</option>
          <option value="hired">Get Hired</option>
          <option value="launch">Launch Product</option>
          <option value="event">Promote Event</option>
        </select>
      </div>
    </div>

    <div class="field" style="margin-top:4px;grid-column:1/-1;">
      <label class="label">Anything else? (optional)</label>
      <textarea class="input" id="ssm-notes" placeholder="Upcoming launches, topics to avoid, specific angles..." style="min-height:60px;"></textarea>
    </div>

    <div style="display:flex;gap:8px;margin-top:16px;align-items:center;">
      <button class="btn ghost" id="ssmBackBtn" type="button">← Back</button>
      <button class="btn primary" id="ssmGenerateBtn" type="button">⚡ Generate pillar plan →</button>
    </div>
  </div>
</div>
*/

// ═══════════════════════════════════════════════════════════════
// JAVASCRIPT — replaces window.ContentPillars IIFE in app.js
// ═══════════════════════════════════════════════════════════════

window.ContentPillars = (() => {
  const CP_KEY    = 'postiq_pillars_v3';
  const USAGE_KEY = 'postiq_pillars_usage_v1';
  const CP_TEMPLATE_TAG = 'postiq-content-pillars';
  const TONES     = ['Practical', 'Story', 'Contrarian', 'Question'];
  const COLORS    = ['#3a3fff','#0fa672','#f59e0b','#ff4f6a','#7c3aed','#9298b0'];

  const cpState = {
    identity: '',
    pillars: [],
    _ssmInputs: null,
  };

  const cpQs    = id => document.getElementById(id);
  const cpUid   = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const cpEsc   = s  => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pillarColor = i => COLORS[i % COLORS.length];

  function cpGetUsage() { try { return JSON.parse(localStorage.getItem(USAGE_KEY) || '{}'); } catch { return {}; } }
  function cpBumpUsage(pid) { const u = cpGetUsage(); u[pid] = (u[pid] || 0) + 1; try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch {} }
  function cpTotalUsage() { return Object.values(cpGetUsage()).reduce((a, b) => a + Number(b || 0), 0); }
  function cpUsageFor(pid) { return cpGetUsage()[pid] || 0; }

  function cpGeneratedSeriesNames() {
    try { return new Set(Object.values(SERIES || {}).flat().map(s => String(s?.name || '').trim()).filter(Boolean)); }
    catch { return new Set(); }
  }

  function cpIsGeneratedTemplate(tpl) {
    const tags = Array.isArray(tpl?.tags) ? tpl.tags.map(x => String(x || '').trim().toLowerCase()) : [];
    if (tags.includes(CP_TEMPLATE_TAG) || tags.includes('pillar-plan')) return true;
    const title = String(tpl?.title || '').trim();
    return tags.includes('series') && cpGeneratedSeriesNames().has(title);
  }

  function cpClearGeneratedTemplates() {
    if (typeof state === 'undefined' || !Array.isArray(state.templates)) return 0;
    const before = state.templates.length;
    state.templates = state.templates.filter(t => !cpIsGeneratedTemplate(t));
    const removed = before - state.templates.length;
    if (removed > 0) {
      if (typeof persistTemplates === 'function') persistTemplates();
      if (typeof renderTemplates === 'function') renderTemplates();
    }
    return removed;
  }

  function cpNormalizePillar(p, i = 0) {
    return {
      id:      String(p?.id      || cpUid()),
      name:    String(p?.name    || `Pillar ${i + 1}`),
      promise: String(p?.promise || p?.desc || ''),
      layer:   ['awareness','credibility','action'].includes(p?.layer) ? p.layer : '',
      seeds:   Array.isArray(p?.seeds) && p.seeds.length ? p.seeds.map(s => String(s || '')) : (Array.isArray(p?.ideas) ? p.ideas.map(s => String(s || '')) : ['']),
      tones:   p?.tones && typeof p.tones === 'object' ? p.tones : {},
      hook:    String(p?.hook || ''),
      cta:     String(p?.cta  || ''),
    };
  }

  function cpPersist() {
    try { localStorage.setItem(CP_KEY, JSON.stringify({ identity: cpState.identity, pillars: cpState.pillars })); } catch {}
    cpRenderCompact();
  }

  function cpLoad() {
    try {
      const d = JSON.parse(localStorage.getItem(CP_KEY) || 'null');
      if (d?.pillars?.length) {
        cpState.identity = d.identity || '';
        cpState.pillars  = d.pillars.map(cpNormalizePillar);
        return true;
      }
    } catch {}
    return false;
  }

  function cpShowStage(id) {
    document.querySelectorAll('.cp-stage').forEach(el => el.classList.remove('active'));
    const el = cpQs(id);
    if (el) el.classList.add('active');
  }

  // ── SSM ENGINE ─────────────────────────────────────────────────

  // Pillar library (subset — grow/sales for most verticals)
  // Full library inlined from SSM index.html
  const LIBRARY = {
    fitness_grow: [
      { name:'Real Progress, No Filter', desc:'Show the actual journey — sweat, setbacks, and small wins.', ideas:['Week 3 and I almost quit — here\'s what kept me going','My workout looked nothing like the plan today. Here\'s why that\'s fine','The fitness advice that actually worked for me (vs what I tried first)','What nobody shows you about getting in shape after 30','Progress pic I almost didn\'t post — but here we are'], hook:'The fitness account you actually need isn\'t showing you the full picture.', cta:'Follow if you\'re tired of the highlight reel. Real progress lives here.' },
      { name:'Workout How-Tos', desc:'Teach your audience a specific exercise, modification, or technique.', ideas:['How to do a proper Romanian deadlift if you\'ve never tried one','3 beginner-friendly swaps for exercises that hurt your knees','The form mistake everyone makes on bench press (and how to fix it)','5-minute morning mobility routine you can do in bed','How to build a full-body workout with just a resistance band'], hook:'You\'re working out consistently and still not seeing results. Here\'s why.', cta:'Save this one. Come back to it when you need a form check.' },
      { name:'Myth Busting', desc:'Fitness is full of bad advice that won\'t die. Be the person who calls it out.', ideas:['No, you don\'t need to do cardio every day to lose fat','The \'no pain no gain\' mindset is actually keeping you injured','Spot reduction isn\'t real — here\'s what actually works','You don\'t need a gym membership to get strong','Why eating less is sometimes making your weight loss harder'], hook:'I\'ve been in fitness for years and the amount of bad advice out there is actually alarming.', cta:'Drop your biggest fitness myth in the comments. Let\'s debunk it.' },
      { name:'Community & Motivation', desc:'Build belonging. People stay loyal to communities, not just content creators.', ideas:['If you worked out at all this week, this post is for you','Who else started their fitness journey after a doctor\'s visit?','The type of gym-goer I love to see (and it\'s not who you think)','Tag someone who needs to hear this today','What getting fit actually gave me that had nothing to do with my body'], hook:'Fitness changed my life. But not the way I expected.', cta:'Tell me where you\'re at in your journey. No judgment here.' },
      { name:'Lifestyle & Nutrition', desc:'Show that fitness is a full-system game — sleep, food, stress, recovery all matter.', ideas:['What I eat in a day as someone who actually lifts','The sleep habit that improved my training more than any supplement','3 high-protein meals I make when I have no time','Why I stopped counting calories and what I do instead','Recovery isn\'t lazy. Here\'s how I structure my rest days'], hook:'Your workouts aren\'t the problem. Your recovery is.', cta:'Save this. Your future self will thank you.' },
    ],
    fitness_sales: [
      { name:'Client Transformations', desc:'Document real outcomes from real clients — not just bodies, but confidence and consistency.', ideas:['Client went from skipping workouts to showing up 5x/week — here\'s what changed','Before & after: 90 days with a plan that actually fit her schedule','He told me he\'d "tried everything." 8 weeks later, this happened.','What my client learned in month one that she wishes she knew sooner','Real talk from a client: what coaching actually feels like from the inside'], hook:'I don\'t sell shortcuts. I sell systems that stick — and here\'s proof.', cta:'DM me READY to see if my coaching is the right fit for you.' },
      { name:'What You Get', desc:'Break down your offer in concrete, specific terms.', ideas:['Here\'s exactly what happens in week 1 of working with me','What\'s included in my program (and why I built it that way)','The difference between my coaching and a generic app','How I build your program around your actual schedule, not an ideal one','FAQ: Is your program right for me? Honest answer.'], hook:'Most fitness programs fail because they weren\'t built for your life. Mine is.', cta:'See the full breakdown at the link in bio. Spots are limited.' },
      { name:'Common Objections Answered', desc:'Meet your audience where their doubts live.', ideas:['"I don\'t have time to work out." Let me reframe that.','"I\'ve tried programs before and quit." Here\'s why this is different.','"I can just use YouTube." You can. Here\'s what you\'ll miss.','"I can\'t afford a coach right now." Let\'s talk about what\'s actually expensive.','"I\'m not in good enough shape to start." That\'s exactly why you should.'], hook:'You\'ve been telling yourself the same story for months. Let\'s challenge it.', cta:'Your questions are valid. Let\'s talk. DM me anytime.' },
      { name:'Social Proof', desc:'Let your clients do the selling.', ideas:['What she told me at the end of our 12 weeks together','Client DM that made my morning — sharing with permission','From "I hate working out" to 4x a week. Her words, not mine.','Results that surprised even me (and I\'ve been coaching for years)','The review that reminded me why I do this'], hook:'I could tell you my program works. Or I could let my clients.', cta:'Ready to write your own story? DM me to get started.' },
      { name:'Your Story & Method', desc:'Share why you do this and how your method is different.', ideas:['Why I became a fitness coach (it wasn\'t for the obvious reason)','The method I use that most trainers skip entirely','What I got wrong about fitness before I figured this out','My philosophy: I don\'t chase aesthetics, I chase ability','The moment I knew I had to start coaching other people'], hook:'There are thousands of fitness coaches. Here\'s why my clients choose me.', cta:'Follow for a different kind of fitness perspective. No fluff.' },
    ],
    saas_grow: [
      { name:'Build In Public', desc:'Document what you\'re building, deciding, and learning.', ideas:['We shipped a feature we almost cut. Here\'s what convinced us.','The metric we watch instead of MRR (and why)','3 things our users told us that changed our roadmap','Why we chose to build in [tech stack] and what we\'d do differently','What our churn data taught us that our NPS score never could'], hook:'Most SaaS companies share the wins. We\'re going to share everything.', cta:'Follow if you want to see what building a software company actually looks like.' },
      { name:'Hot Takes & Industry POV', desc:'Have real opinions about the tools, trends, and practices in your space.', ideas:['Unpopular opinion: your tech stack matters less than your distribution strategy','The SaaS metric everyone obsesses over that actually means nothing','Why most B2B software has a UX problem and nobody\'s talking about it','The "growth hack" that\'s actually just good product thinking','AI isn\'t replacing SaaS — but it\'s changing what SaaS has to be'], hook:'The SaaS advice that keeps getting recycled is keeping founders stuck.', cta:'Follow for takes on software, growth, and building products that last.' },
      { name:'Founder & Team Stories', desc:'Put humans behind the logo.', ideas:['Why we turned down a partnership that looked perfect on paper','The hire that changed everything about how we build','A decision I made in year one that still haunts me (and what I fixed)','Our remote team has never met in person. Here\'s how we make it work.','The week we thought about shutting down — and what we learned'], hook:'Behind every SaaS is a team making hard calls with incomplete information.', cta:'Follow along as we build this thing in public — wins, mistakes, and all.' },
      { name:'Use Case Education', desc:'Show your product solving real problems in specific industries.', ideas:['How a solo founder uses [product] to replace 3 different tools','[Industry] team saved 6 hours/week with this workflow in [product]','The exact setup a [role] uses in [product] to manage their pipeline','3 ways [product] handles [problem] that [competitor] can\'t','A day in the life of a power user — every tool, every trigger'], hook:'You\'ve heard about [product]. Here\'s what it actually looks like in the wild.', cta:'Try it free. Link in bio. No credit card required.' },
      { name:'Market Commentary', desc:'React to industry news with genuine analysis.', ideas:['What [major company] shutting down [feature] means for everyone in [space]','This funding round tells us a lot about where the market is going','The trend I\'m watching in [category] that nobody\'s written about yet','Why the consolidation happening in [space] is actually good for smaller players','My take on the "AI-first" narrative and what it gets wrong'], hook:'The [industry] news cycle moves fast. Here\'s the take you actually need.', cta:'Follow for weekly signal vs noise analysis on [space].' },
    ],
    saas_sales: [
      { name:'Problem-First Content', desc:'Name the exact friction your product removes.', ideas:['If your team is still doing [task] manually, here\'s what that\'s costing you','The reason [workflow] breaks down at scale (and what companies do about it)','Signs your current [tool category] is holding your team back','How much time does [problem] actually cost per week? (We did the math)','What happens when [process] doesn\'t have a system behind it'], hook:'The [problem] you\'ve been working around has a fix. You\'re just not using it.', cta:'See how [offer] handles this in 2 minutes — demo link in bio.' },
      { name:'Feature Storytelling', desc:'Tell the story of the problem features solve.', ideas:['We built [feature] because a customer showed us something that broke our heart','How [feature] works and why we built it this way (not the obvious way)','The edge case that led to [feature] — and why it matters for your team','[Feature] in 60 seconds: here\'s what changes for your workflow','Before [feature] vs after [feature] — a real user workflow comparison'], hook:'Software features don\'t matter. The problems they solve do. Here\'s ours.', cta:'Activate [feature] in your account today.' },
      { name:'ROI & Business Case', desc:'Help your buyers justify the purchase internally.', ideas:['How to calculate what [problem] is actually costing your company','The ROI calculation our customers use to justify [product] internally','What "saving time" actually means when 4 people use [product] every day','Our customers report [outcome] in the first 30 days — here\'s how','The business case for [product]: a template you can steal'], hook:'Your boss needs a number, not a feature list. Here\'s the number.', cta:'Need a custom ROI analysis? DM us your team size.' },
      { name:'Customer Stories', desc:'Your customers are your best salespeople.', ideas:['[Customer type] reduced [metric] by [X]% using this workflow in [product]','From spreadsheet chaos to [outcome]: a [company type] story','How a [team size] team uses [product] to do what used to take twice as many people','The customer who said they\'d "never switch tools again" — and what changed their mind','Interview: how [customer type] went from [before] to [after] in 60 days'], hook:'Don\'t take our word for it. Here\'s what [industry] teams say after 90 days.', cta:'Book a 15-min call. We\'ll show you how this works for your team.' },
      { name:'Comparison & Positioning', desc:'Help buyers understand why you\'re the right choice.', ideas:['[Product] vs [competitor]: what\'s actually different (honest breakdown)','Why [product] isn\'t for everyone — and who it\'s built for','The workflow [competitor] can\'t do that [product] was designed for','What to look for when evaluating [tool category] (regardless of who you choose)','The questions to ask any [tool category] vendor before you sign'], hook:'Every [tool category] looks the same on a comparison page. Here\'s what to actually look for.', cta:'See a side-by-side comparison. Link in bio.' },
    ],
    coaching_grow: [
      { name:'Thought Leadership', desc:'Share your genuine perspective on the problems your clients face.', ideas:['The advice every [client type] keeps getting that\'s actually holding them back','What [goal] actually requires — and why nobody wants to hear it','The coaching industry problem I\'m not willing to ignore anymore','Why [popular approach] works for some people and fails for most','My most controversial belief about [your niche] — and why I stand by it'], hook:'Most coaches in [space] are teaching the same thing. Here\'s what they\'re missing.', cta:'Follow if you\'re tired of advice that sounds good but doesn\'t land.' },
      { name:'Client Story Spotlights', desc:'Tell transformation stories with context, emotion, and specifics.', ideas:['She came to me believing [limiting belief]. Here\'s what shifted.','The client who had tried everything before working with me — and what finally worked','What 6 months of coaching looks like from the inside','A client win that had nothing to do with [obvious metric]','The moment a client said something that completely changed how I coach'], hook:'Transformation doesn\'t look the way you think it does. Let me show you.', cta:'Follow for real stories about what growth actually looks like.' },
      { name:'Your Framework & Method', desc:'Give your audience a taste of how you think and how you work.', ideas:['The 3-part framework I use with every new client','How I diagnose what\'s really blocking [audience type] in the first session','The question I ask that unlocks everything else','My signature process, explained — step by step','Why most [audience type] are solving the wrong problem'], hook:'Most people in [niche] focus on the symptom. I work on the root.', cta:'Follow to learn the framework behind real results.' },
      { name:'Behind The Coaching Business', desc:'Show what it\'s like to run a coaching practice.', ideas:['What a full coaching week actually looks like for me','How I structure my offers (and why I changed them twice)','The boundary I set that changed my business','What I charge and why (transparency post)','The tools I use to run my entire coaching practice'], hook:'Running a coaching business is nothing like what the gurus show you.', cta:'Follow for an honest look at what building a coaching practice actually takes.' },
      { name:'Mindset & Growth Content', desc:'Speak to the internal game — beliefs, fears, and patterns.', ideas:['The belief that\'s costing [audience type] the most right now','Why [audience] keep starting over (and how to stop)','The fear I see in almost every new client — and how we move through it','What "not ready" really means (and what to do about it)','The mindset shift that changes everything for [audience type]'], hook:'Your [goal] isn\'t a strategy problem. It\'s a belief problem.', cta:'Follow if you\'re ready to work on the thing that\'s actually in the way.' },
    ],
    creative_grow: [
      { name:'Process & Craft', desc:'Show your work in progress — not just the polished final product.', ideas:['Before and after: how this project evolved from brief to final delivery','The sketch that became the brand identity for [client type]','How I approach color when I have complete creative freedom','Why this logo went through 6 rounds — and what each version taught me','The creative decision I almost didn\'t make (and why I\'m glad I did)'], hook:'The final version never looks like the first one. Here\'s the full story.', cta:'Follow for a behind-the-scenes look at how creative work actually gets made.' },
      { name:'Portfolio Storytelling', desc:'Tell the story behind the work — the brief, the challenge, the decision-making.', ideas:['The brief: [client] needed [goal]. Here\'s what we built and why.','This project had one constraint that made it better','The client who trusted us completely — and what that unlocked','A project I\'m proud of that almost nobody saw','What I would do differently on this project if I had another shot'], hook:'Great creative work doesn\'t happen in a vacuum. Here\'s the context behind this one.', cta:'See the full project breakdown at [link]. Follow for more.' },
      { name:'Industry Takes', desc:'Have opinions about design, photography, video, or your craft.', ideas:['The design trend I\'m already tired of seeing everywhere','What makes [craft] actually hard — not just technically, but creatively','The client feedback that secretly made the project better','Why [popular style] is overused and what I\'d recommend instead','What AI is doing to [creative field] — my honest take'], hook:'Most designers/photographers/editors won\'t say this publicly. I will.', cta:'Follow for takes on [craft] that go beyond tutorials and aesthetics.' },
      { name:'Creative Tips & Education', desc:'Teach your audience something real about your craft.', ideas:['The typography rule I apply to every project without fail','3 things I check before I call a design/photo/video done','How I approach creative briefs when clients don\'t know what they want','The free tool that changed how I present work to clients','What I wish I knew in year one of being a [role]'], hook:'I\'ve been doing [craft] for [X] years. Here\'s the shortcut I wish I had.', cta:'Save this. The tutorial version is coming next week.' },
      { name:'Client Collaboration', desc:'Show what it\'s like to work with you.', ideas:['What my client onboarding actually looks like — step by step','The questions I ask before I touch any creative work','How I handle client feedback that misses the mark — honestly','What "unlimited revisions" really means and why I don\'t offer it','Why I show 1-2 concepts instead of 5 — and how clients feel about it afterwards'], hook:'Working with a creative shouldn\'t feel like a mystery. Here\'s how I make it easy.', cta:'Curious about working together? DM me. Let\'s see if it\'s a fit.' },
    ],
    ecommerce_grow: [
      { name:'Product in the Wild', desc:'Show your product living in the world — styled, used, loved.', ideas:['How our customers are styling [product] this season','UGC of the week: [product] in a home we never expected','The way [product] actually gets used vs how we originally imagined','Our team\'s favorite way to use [product] (3 very different answers)','[Product] in a day: morning, afternoon, and night'], hook:'The best thing about [product] is how many different ways people use it.', cta:'Tag us in your [product] photos. We share every one.' },
      { name:'Behind The Brand', desc:'Show your sourcing, your values, your process.', ideas:['Where [product] is made — and why we chose that factory/supplier/maker','The material we spent 6 months finding before we felt good about launching','Meet the person who [role] at [brand]','Why we made [brand decision] that other brands don\'t','The product we almost launched — and why we pulled it'], hook:'You can buy [product category] anywhere. Here\'s why people buy ours.', cta:'Follow [brand] to go behind the curtain on what we build and why.' },
      { name:'Education & Use Cases', desc:'Teach your audience how to get more value out of what you sell.', ideas:['The [product] mistake most people make in the first week','How to get the most out of [product] — tips from our most loyal customers','[Product] 101: everything to know before your first order','The use case for [product] you probably haven\'t tried yet','How to pair [product] with [complementary thing] for [better outcome]'], hook:'Most people only use [product] one way. Here are four more.', cta:'Save this for when your order arrives.' },
      { name:'Trend & Culture', desc:'Connect your product to what\'s culturally relevant right now.', ideas:['[Product] and the [trend] moment: why this is the year to care about [value]','How [cultural shift] is changing how people think about [product category]','The aesthetic moment [product] was made for — and why it\'s having a moment','What [pop culture thing] gets right about [product category]','Why [season/moment/year] is the perfect time for [product]'], hook:'[Product category] is having a moment. Here\'s where [brand] fits in.', cta:'Follow [brand] — we stay ahead of what\'s coming next.' },
      { name:'Community & UGC', desc:'Turn your customers into content.', ideas:['Customer photo of the month — congrats to [handle]','The review that stopped us in our tracks — sharing it here','How our community is using [product] in ways we didn\'t expect','The [product] photo that outperformed every piece of branded content we\'ve made','Real customers, real homes, real [product]: this week\'s roundup'], hook:'Our best marketing doesn\'t come from us. It comes from people like you.', cta:'Order [product], take a photo, tag us. We\'ll feature you here.' },
    ],
    finance_grow: [
      { name:'Personal Finance Education', desc:'Break down money concepts that feel intimidating into content that actually helps.', ideas:['What a Roth IRA actually is — explained like you\'re 25 and finally ready to care','The difference between good debt and bad debt (with real examples)','Why your budget keeps failing — and the simpler version that works','What [financial concept] means and why it matters for [audience]','The money move I wish I\'d made in my 20s (not clickbait)'], hook:'The financial system wasn\'t built to be understood. Let me fix that.', cta:'Follow for money content that makes you feel smarter, not worse.' },
      { name:'Market & News Commentary', desc:'React to economic news and market events with genuine analysis.', ideas:['What today\'s [economic news] actually means for your accounts/savings/portfolio','The Fed rate decision explained in 3 sentences that actually make sense','Why I\'m not panicking about [market event] — here\'s how I\'m thinking about it','The economic news nobody\'s talking about — and why it matters','What this recession signal does and doesn\'t mean for your money'], hook:'Financial news is designed to be alarming. Let\'s look at it clearly instead.', cta:'Follow for weekly market context — no fear, no hype.' },
      { name:'Budgeting & Spending Systems', desc:'Give your audience practical tools for managing money day-to-day.', ideas:['The budgeting method I\'ve seen work for people who hate budgets','How I allocate my income — the percentages and why','The subscription audit that saves people $100+ a month (do this today)','Why I stopped using a spending category called "miscellaneous"','How to pay yourself first when money is already tight'], hook:'Budgeting advice is everywhere. Here\'s what actually works in the real world.', cta:'Save this and actually do it this weekend. Your future self will be glad.' },
      { name:'Building Wealth Basics', desc:'Demystify investing, saving, and building long-term wealth.', ideas:['What to do with $1,000 if you have no idea where to start','Index funds explained without the jargon — why I recommend them first','The wealth gap between people who invest and people who don\'t (the math is wild)','How compound interest works — visualized simply','3 investing mistakes I see over and over with first-timers'], hook:'Wealth building isn\'t complicated. It\'s just not taught anywhere.', cta:'Follow for the financial education system that failed you.' },
      { name:'Financial Mindset', desc:'Address the emotional and psychological side of money.', ideas:['The money story from childhood that\'s affecting your finances right now','Why high earners still feel broke — the spending psychology behind it','The guilt I see around money that\'s keeping people from building wealth','What "good with money" actually means — it\'s not what you think','Financial anxiety is real. Here\'s how I talk to clients about it.'], hook:'Most money problems aren\'t math problems. They\'re psychology problems.', cta:'Follow if you want to fix your relationship with money — not just your budget.' },
    ],
    localbiz_grow: [
      { name:'Local Expertise & Context', desc:'Be the most useful local expert in your space.', ideas:['The [neighborhood] spots we recommend to our own customers','What [local event/season] means for [your business category]','Why [city] customers are different from national trends — and what we do about it','The [local thing] that inspired something we do at [business]','Our take on what\'s happening in [local area] right now'], hook:'Nobody knows [city] like we do. Here\'s what we\'re seeing.', cta:'Follow [business] — we\'re as local as it gets.' },
      { name:'Behind The Business', desc:'Show your team, your space, your process.', ideas:['Meet [team member] — what they do here and why they love it','A day in [business] before we open the doors','How we prep for [busy season] — the real version','What it actually took to open [business] in [city]','The decision we made about [business practice] that surprised people'], hook:'You\'ve probably walked past [business]. Here\'s who we actually are.', cta:'Come visit us at [address]. We\'re here [hours].' },
      { name:'Customer Love', desc:'Celebrate your regulars, your reviews, and the community.', ideas:['Customer of the month: [name] has been coming since [year]','The review that made our whole team stop what they were doing','A thank-you post to our neighborhood for [milestone]','What a local regular means to a small business — honestly','The community event we hosted and what it meant to us'], hook:'Small businesses run on regulars. Here\'s a thank-you to ours.', cta:'Leave us a review if we\'ve earned it. It matters more than you know.' },
      { name:'Educational & Service Content', desc:'Teach your audience something relevant to your category.', ideas:['What to look for when choosing a [business category] in [city]','The question you should always ask before hiring a [service type]','How to tell quality [product/service] from the generic version','Why [common misconception about your category] isn\'t quite right','What we\'ve learned after [X] years serving [city]'], hook:'We\'ve been in [business category] long enough to know what actually matters.', cta:'Questions about [service/product]? DM us or stop in anytime.' },
      { name:'Events & Promotions', desc:'Drive foot traffic and community engagement.', ideas:['[Event] at [business] on [date] — here\'s what to expect','We\'re doing [special offer] this week only — here\'s the deal','Celebrating [local event] with [something special] at [business]','Why we [host/participate in] [local thing] every year','[Limited time thing] is back — and it won\'t last long'], hook:'Something\'s happening at [business] and you don\'t want to miss it.', cta:'See you at [location] on [date]. Bring a friend.' },
    ],
  };

  // Inline the full fallback + series + hooks from SSM
  const SERIES = {
    grow:  [ { name:'Weekly Insight Drop', desc:'Every week, one specific insight from your world. Keep it concrete, keep it useful.' }, { name:'Myth vs. Reality', desc:'Monthly myth-busting post targeted at your audience\'s most common misconceptions.' }, { name:'Community Spotlight', desc:'Regular feature on a real person from your community — customer, follower, or collaborator.' } ],
    sales: [ { name:'Client Story of the Month', desc:'Feature one real client outcome every month. The before, the work, the result.' }, { name:'Objection of the Week', desc:'Pick one real objection you hear and address it with care and specificity.' }, { name:'Value Stack Breakdown', desc:'Monthly breakdown of everything inside your offer. Reinforce perceived value without discounting.' } ],
    trust: [ { name:'Learning in Public', desc:'Weekly update on something you\'re actively figuring out. Show the messy middle.' }, { name:'Process Deep Dive', desc:'Every two weeks, document the exact process behind something you do.' }, { name:'Transparency Report', desc:'Monthly real numbers post — what happened, what worked, what didn\'t.' } ],
    educate: [ { name:'101 → 301 Series', desc:'Build a curriculum from beginner to advanced on your core topic.' }, { name:'Myth of the Month', desc:'Monthly explainer that kills one widely-held misconception in your space.' }, { name:'Tool Teardown', desc:'Biweekly breakdown of a relevant tool — what it does, who it\'s for, honest verdict.' } ],
    hired: [ { name:'Work in Progress', desc:'Document a real project across multiple posts. Show your thinking, not just the output.' }, { name:'Skills Unlocked', desc:'Weekly post on one specific skill — what it is, how you apply it, proof it works.' }, { name:'Industry Read of the Week', desc:'Share and react to one article or trend each week.' } ],
    launch: [ { name:'Build Log', desc:'Weekly documentation of building your product.' }, { name:'Founding Story Arc', desc:'Multi-part narrative from idea to launch.' }, { name:'Beta Diaries', desc:'Share early user stories as they come in.' } ],
    event: [ { name:'Road to the Event', desc:'A short countdown series that reveals why the event matters.' }, { name:'Speaker / Feature Spotlight', desc:'Highlight one person, product, or reason to attend at a time.' }, { name:'Last Call Logistics', desc:'A practical series answering time, place, cost, schedule, and what-to-bring questions.' } ],
  };

  const HOOKS = {
    bold: ['Stop doing this in {industry}. It\'s costing you.','The {industry} advice everyone repeats that is actually wrong.','Nobody in {industry} wants to say this out loud.','Here is the take that will get me unfollowed:','If you are doing {offer}, you need to hear this first.'],
    playful: ['Okay but why does nobody talk about this in {industry}??','This is unhinged but hear me out...','POV: you finally figured out {industry}','Friendly reminder that this exists and it is completely free.','Hot take incoming and I am not sorry at all.'],
    expert: ['After years working in {industry}, here is what I know with confidence:','The research on this is clearer than most people realize.','A framework I have used across many {audience}: it works.','Here is what actually happens in {industry} — not what the courses say.','If you only take one thing from this:'],
    warm: ['I have been wanting to share this for a while now.','Can we be honest for a second about {industry}?','Something I wish someone had told me earlier:','This community keeps teaching me things. Here is what I mean.','You are not behind. You are just human. Let me explain.'],
    edgy: ['Everyone is wrong about this in {industry}. Here is proof.','I am about to upset some people and that is fine.','This is what {industry} does not want {audience} to know.','Hard truth: the popular {industry} advice is keeping {audience} stuck.','Controversial? Maybe. But someone had to say it.'],
    professional: ['Sharing a framework that consistently drives results for {audience}:','Based on our experience across {industry}, here is what we have found:','A strategic insight for {audience} worth bookmarking:','The data does not lie: here is what matters in {industry}.','For {audience} making decisions in {industry}: this is worth your time.'],
  };

  const QUICK_WINS = {
    fitness_grow:'Post a real photo from your last workout — no filter, no setup. Caption it with one honest sentence about where you\'re at in your fitness journey. Authenticity outperforms aesthetic every time.',
    fitness_sales:'Share a 3-sentence client story: the problem they came to you with, what changed, and what they said to you after. End with "DM me READY if this sounds familiar."',
    saas_grow:'Share one thing you learned from your last user interview or support ticket that changed how you think about your product. Be specific. Founders and operators love content that shows real product thinking.',
    saas_sales:'Write a 3-line business case for your product: the problem, what it costs companies to ignore it, and what your product does about it. No features — just outcome language.',
    coaching_grow:'Give away one piece of genuinely useful content from inside your coaching — a framework, a question you ask clients, a mindset shift. If it\'s useful enough to put in a program, it\'s useful enough to post.',
    coaching_sales:'Describe your ideal client in 4 sentences: where they are, what they\'ve already tried, what\'s actually blocking them, and where they want to be. The right person will read it and DM you.',
    creative_grow:'Show a before/after of a project you finished recently — the rough first version and the final delivery. Add 2 sentences about the key creative decision that changed everything.',
    creative_sales:'Post a project spotlight: the brief you received, the challenge you faced, and the outcome you delivered. Use the client\'s industry so the right buyer sees themselves in the story.',
    ecommerce_grow:'Post a real UGC photo from a customer — with permission — and in the caption, share what they said about the product. No polish. Real people, real products, real words.',
    finance_grow:'Break down one financial concept that most of your audience is confused about — in plain language, no jargon. The simpler and more useful, the better the save rate.',
    localbiz_grow:'Post a "day before we open" photo or video — your team getting ready, the space being prepped. Add one sentence about what you love about your neighborhood. Local and human always wins.',
  };

  // Trust layer mapping — maps SSM pillar order to PostIQ trust layers
  const LAYER_MAP = ['awareness', 'credibility', 'awareness', 'action', 'credibility'];

  function getFallback(industry, goal, inp) {
    const byGoal = {
      grow: [
        { name:'Behind The Scenes', desc:`Pull the curtain back on how ${inp.brand} works.`, ideas:[`A day running ${inp.brand}`,`The decision behind ${inp.offer} that surprised us`,`What ${inp.brand} looks like before it's polished`,`The team/person behind ${inp.brand}`,`Why we do things differently in ${inp.industry}`], hook:`Most ${inp.industry} brands only show you the highlight reel.`, cta:`Follow ${inp.brand} for the real version.` },
        { name:'Education & Value', desc:`Teach ${inp.audience} something genuinely useful every week.`, ideas:[`The ${inp.industry} mistake ${inp.audience} keep making`,`How to get more out of ${inp.offer}`,`What most people misunderstand about ${inp.industry}`,`3 things ${inp.audience} should know before ${inp.offer}`,`The question I get asked most — answered properly`], hook:`${inp.audience} deserve better information about ${inp.industry}.`, cta:`Follow for real, useful content — no fluff.` },
        { name:'Hot Takes & POV', desc:`Say something real. Generic accounts are invisible.`, ideas:[`The ${inp.industry} advice I'm tired of seeing`,`Unpopular opinion about ${inp.offer}`,`What everyone gets wrong about ${inp.industry}`,`The trend in ${inp.industry} I think is overhyped`,`My honest take on where ${inp.industry} is headed`], hook:`Most ${inp.industry} content sounds the same. Here's a different take.`, cta:`Follow if you want ${inp.industry} content with an actual perspective.` },
        { name:'Community & Stories', desc:`Build belonging. Feature your audience, celebrate wins.`, ideas:[`A win from someone in our community worth celebrating`,`The DM that made our week`,`Who our ${inp.audience} actually are — real stories`,`What ${inp.audience} have in common (it's not what you think)`,`Shoutout to every ${inp.audience} doing the work right now`], hook:`${inp.brand} isn't just content. It's a community.`, cta:`Tell us your story in the comments. We want to hear it.` },
        { name:'Progress & Milestones', desc:`Document your journey — the wins, the setbacks, the lessons.`, ideas:[`What ${inp.brand} looked like 1 year ago vs today`,`A mistake we made and what it taught us`,`The milestone we just hit — and what it took`,`What we're working on right now (and why it's hard)`,`The decision that changed everything for ${inp.brand}`], hook:`The best brands show you where they started and how far they've come.`, cta:`Follow ${inp.brand} to see where we go next.` },
      ],
      sales: [
        { name:'Problem Clarity', desc:`Name the exact pain ${inp.offer} solves.`, ideas:[`The real reason ${inp.audience} struggle with ${inp.industry}`,`What happens when ${inp.audience} keep doing ${inp.industry} without a system`,`Signs ${inp.audience} are ready for ${inp.offer}`,`The cost of not solving this problem`,`What ${inp.audience} tell us they tried before ${inp.offer}`], hook:`If you're ${inp.audience} dealing with [problem], this is for you.`, cta:`DM us or visit the link in bio to learn more.` },
        { name:'Offer Breakdown', desc:`Explain ${inp.offer} with specificity.`, ideas:[`What's inside ${inp.offer} — the full breakdown`,`Who ${inp.offer} is built for (and who it's not)`,`How ${inp.offer} works from start to finish`,`The difference between ${inp.offer} and everything else in ${inp.industry}`,`FAQ about ${inp.offer} — the real questions answered`], hook:`Here's exactly what you get with ${inp.offer} — no surprises.`, cta:`Full details at the link in bio. Questions? DM us.` },
        { name:'Social Proof', desc:`Let results, reviews, and real customers do the selling.`, ideas:[`A customer result we're proud of — with the full story`,`What ${inp.audience} say after 30 days with ${inp.offer}`,`The review that surprised even us`,`Before & after: how ${inp.offer} changed things for a real customer`,`X customers in — here's what we're hearing`], hook:`Don't take our word for it. Here's what ${inp.audience} say.`, cta:`Ready to add your name to this list? Link in bio.` },
        { name:'Objection Handling', desc:`Meet your audience where their doubts live.`, ideas:[`"Is ${inp.offer} right for me?" — honest answer`,`The hesitation we hear most often (and why it makes sense)`,`What makes ${inp.offer} worth it, even if you've tried other things`,`For ${inp.audience} who aren't sure they're ready`,`Why now is actually a better time than waiting`], hook:`The reason you haven't bought yet is probably one of these things.`, cta:`Still have questions? DM us. We'll be straight with you.` },
        { name:'Your Story & Credibility', desc:`Show who's behind ${inp.brand} and why they're qualified.`, ideas:[`Why we built ${inp.offer}`,`What qualifies us to help ${inp.audience} with ${inp.industry}`,`The mistake that led to building ${inp.brand}`,`What we've learned after serving ${inp.audience}`,`Our values — and how they show up in ${inp.offer}`], hook:`There are options in ${inp.industry}. Here's why ${inp.audience} choose us.`, cta:`Follow ${inp.brand} — and reach out when you're ready.` },
      ],
    };
    return byGoal[goal] || byGoal.grow;
  }

  function fillHook(hook, inp) {
    return hook.replace(/{industry}/g, inp.industry).replace(/{audience}/g, inp.audience).replace(/{offer}/g, inp.offer).replace(/{brand}/g, inp.brand);
  }

  function getQuickWin(industry, goal, inp) {
    const key = `${industry}_${goal}`;
    if (QUICK_WINS[key]) return QUICK_WINS[key];
    const fallbacks = {
      grow: `Post one honest, specific insight from your work in ${inp.industry} this week. Not a tip — a real observation. Something ${inp.audience} rarely hear from anyone in your space.`,
      sales: `Write three sentences about ${inp.offer}: the problem it solves, who it's for, and one specific outcome a real customer got. Then add your contact or link.`,
      trust: `Share something you got wrong recently in ${inp.industry} and specifically what you changed because of it. Honest, specific, and humble content is the fastest trust-builder there is.`,
      educate: `Teach one small, specific, genuinely useful thing to ${inp.audience} about ${inp.industry}. Make it complete — not a teaser.`,
      hired: `Post a breakdown of a recent project: the brief, your process, and the outcome. Show your actual thinking, not just the final product.`,
      launch: `Share the "why" behind ${inp.offer} in 3-5 sentences. No features, no specs. Just the problem it solves, who it's for, and why you cared enough to build it.`,
      event: `Post the clearest possible invite for ${inp.offer}: who should come, what they will get, when it happens, and why it is worth showing up.`,
    };
    return fallbacks[goal] || fallbacks.grow;
  }

  function ssmGetPillars(industry, goal) {
    return LIBRARY[`${industry}_${goal}`] || null;
  }

  function ssmBuildStrategy(inp) {
    let rawPillars = ssmGetPillars(inp.industry, inp.goal);
    if (!rawPillars) rawPillars = getFallback(inp.industry, inp.goal, inp);

    const tonePool = HOOKS[inp.tone] || HOOKS.bold;
    const series   = SERIES[inp.goal] || SERIES.grow;
    const quickWin = getQuickWin(inp.industry, inp.goal, inp);

    // Convert SSM pillars → PostIQ pillar format with trust layer tags
    const pillars = rawPillars.map((p, i) => ({
      id:      cpUid(),
      name:    p.name,
      promise: p.desc,
      layer:   LAYER_MAP[i] || 'awareness',
      seeds:   (p.ideas || []).slice(0, 5).map(s => String(s || '')),
      tones:   {},
      hook:    fillHook(tonePool[i] || tonePool[0], inp),
      cta:     p.cta || '',
    }));

    if (inp.notes && pillars.length) {
      pillars[0].seeds = [
        `Context to work in: ${inp.notes}`,
        ...pillars[0].seeds
      ].slice(0, 6);
    }

    return { pillars, series, quickWin, inp };
  }

  // ── SSM FORM LOGIC ─────────────────────────────────────────────

  function ssmInit() {
    const backBtn     = cpQs('ssmBackBtn');
    const generateBtn = cpQs('ssmGenerateBtn');
    if (!backBtn || !generateBtn) return;

    backBtn.onclick     = () => cpShowStage('cpStageGate');
    generateBtn.onclick = ssmRunGenerate;
  }

  function ssmRunGenerate() {
    const generationStartTime = Date.now();
    window.__postiqSsmGenerationStart = generationStartTime;
    const brand    = (cpQs('ssm-brand')?.value    || '').trim() || 'Your Brand';
    const industry = cpQs('ssm-industry')?.value  || '';
    const audience = (cpQs('ssm-audience')?.value || '').trim() || 'your audience';
    const offer    = (cpQs('ssm-offer')?.value    || '').trim() || 'your offer';
    const tone     = cpQs('ssm-tone')?.value      || 'bold';
    const goal     = cpQs('ssm-goal')?.value      || 'grow';
    const notes    = (cpQs('ssm-notes')?.value    || '').trim();

    if (!industry) { if (typeof showToast === 'function') showToast('Select an industry first', 'error'); return; }
    if (!goal)     { if (typeof showToast === 'function') showToast('Select a goal first', 'error'); return; }

    const inp = { brand, industry, audience, offer, tone, goal, notes }
    cpState._ssmInputs = inp;
    safeTrack(() => GA4_Pillars.ssmQuestionnaireComplete({ industry, tone, goal }));
    safeTrack(() => GA4_Pillars.ssmGenerationStarted());

    // Show loading screen
    const form    = cpQs('ssmForm');
    const loading = cpQs('ssmLoading');
    if (form)    form.style.display    = 'none';
    if (loading) loading.style.display = 'block';

    const steps  = ['Detecting your industry...','Matching goal + industry combo...','Pulling pillar templates...','Generating hooks for your tone...','Finalizing your pillar plan...'];
    const bar    = cpQs('ssmLoadBar');
    const label  = cpQs('ssmLoadStep');
    let i = 0;
    const iv = setInterval(() => {
      if (bar)   bar.style.width    = ((i + 1) * 20) + '%';
      if (label) label.textContent  = steps[i] || 'Almost ready...';
      i++;
      if (i >= 5) {
        clearInterval(iv);
        setTimeout(() => ssmFinish(inp), 200);
      }
    }, 320);
  }

  function ssmFinish(inp) {
    const result = ssmBuildStrategy(inp);

    // Set identity from inputs
    cpState.identity = `${inp.brand} — ${inp.audience} — ${inp.offer}${inp.notes ? ` — Context: ${inp.notes}` : ''}`;
    cpState.pillars  = result.pillars.map(cpNormalizePillar);
    safeTrack(() => GA4_Pillars.ssmGenerationComplete(cpState.pillars.length));
    safeTrack(() => GA4_System.performanceMetric('ssm_generation', Date.now() - (window.__postiqSsmGenerationStart || Date.now())));
    cpState._ssmInputs = inp;

    cpPersist();

    // Move to builder
    cpShowStage('cpStageBuilder');

    // Populate identity field
    const bi = cpQs('cpBuilderIdentity');
    if (bi) bi.value = cpState.identity;

    // Render pillars in builder
    cpRenderPillars();

    // Keep the quick-win starter inside the pillar plan. Do not auto-insert into Compose.
    cpState._latestGeneratedStarter = result.quickWin || '';

    // Replace any old pillar-generated series templates so reset/new generation stays clean.
    cpClearGeneratedTemplates();

    // Save recurring series as PostIQ templates
    ssmSaveSeriesAsTemplates(result.series, inp);

    if (typeof showToast === 'function') {
      showToast('Pillar plan generated — review your starters below', 'success');
    }

    // Restore form for next time
    const form    = cpQs('ssmForm');
    const loading = cpQs('ssmLoading');
    const bar     = cpQs('ssmLoadBar');
    if (form)    form.style.display    = 'block';
    if (loading) loading.style.display = 'none';
    if (bar)     bar.style.width       = '0%';
  }

  function ssmSendQuickWin(text) {
    const editor = document.getElementById('composerEditor');
    if (!editor) return;
    const existing = editor.innerText.trim();
    editor.innerText = existing ? `${existing}\n\n${text}` : text;
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
  }

  function ssmSaveSeriesAsTemplates(series, inp) {
    if (!Array.isArray(series) || !series.length) return;
    const now = new Date().toISOString();
    const newTpls = series.map(s => ({
      id:        cpUid(),
      title:     s.name,
      type:      'Hooks',
      platform:  'Universal',
      tags:      [CP_TEMPLATE_TAG, 'pillar-plan', 'series', inp.industry, inp.goal, inp.notes ? 'custom-context' : ''].filter(Boolean),
      body:      inp.notes ? `${s.desc}\n\nContext to consider: ${inp.notes}` : s.desc,
      createdAt: now,
      updatedAt: now,
    }));
    if (typeof state !== 'undefined' && Array.isArray(state.templates)) {
      state.templates = [...newTpls, ...state.templates];
      if (typeof persistTemplates === 'function') persistTemplates();
      if (typeof renderTemplates   === 'function') renderTemplates();
    }
  }

  // ── BUILDER RENDER ─────────────────────────────────────────────

  function cpRenderPillars() {
    const list = cpQs('cpPillarsList');
    if (!list) return;
    cpState.pillars = cpState.pillars.map(cpNormalizePillar);
    list.innerHTML = '';
    cpState.pillars.forEach((pillar, pi) => {
      const card  = document.createElement('div');
      card.className  = 'cp-pillar-card';
      card.dataset.pid = pillar.id;
      const usage = cpUsageFor(pillar.id);
      card.innerHTML = `<div class="cp-pillar-head"><div class="cp-pillar-tab" style="background:${pillarColor(pi)};"></div><div class="cp-pillar-head-inner"><div class="cp-pillar-inputs"><input class="cp-pillar-name" data-field="name" value="${cpEsc(pillar.name)}" placeholder="Pillar name" /><input class="cp-pillar-promise" data-field="promise" value="${cpEsc(pillar.promise)}" placeholder="The recurring promise this pillar makes…" /></div></div><div class="cp-pillar-head-right"><select class="cp-layer-select" data-field="layer"><option value="" ${pillar.layer ? '' : 'selected'}>Tag layer…</option><option value="awareness" ${pillar.layer==='awareness'?'selected':''}>👁 Awareness</option><option value="credibility" ${pillar.layer==='credibility'?'selected':''}>🎓 Credibility</option><option value="action" ${pillar.layer==='action'?'selected':''}>🛒 Action</option></select><span class="cp-usage-badge ${usage > 0 ? 'used' : ''}">${usage > 0 ? `${usage} starter${usage > 1 ? 's' : ''}` : 'unused'}</span></div></div>` +
        (pillar.hook ? `<div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--brand);background:var(--brand-dim);border-top:1px solid var(--brand-glow);padding:8px 13px;line-height:1.45;">Hook: "${cpEsc(pillar.hook)}"</div>` : '') +
        `<div class="cp-seeds" data-seeds-for="${pillar.id}">${pillar.seeds.map((seed, si) => cpSeedRowHtml(pillar, si, seed)).join('')}</div><div class="cp-pillar-footer"><button class="btn sm ghost" data-action="add-seed" type="button" style="font-size:11px;height:26px;padding:0 10px;">+ Add seed idea</button><button class="btn sm ghost" data-action="remove-pillar" type="button" style="font-size:11px;height:26px;padding:0 8px;color:var(--subtle);">Remove pillar</button></div>`;

      card.querySelectorAll('[data-field="name"],[data-field="promise"]').forEach(inp => {
        inp.addEventListener('input', () => { pillar[inp.dataset.field] = inp.value; cpPersist(); cpUpdateHealth(); });
      });
      card.querySelector('[data-field="layer"]').addEventListener('change', e => { pillar.layer = e.target.value; cpPersist(); cpUpdateLayerCheck(); });
      card.querySelector('[data-action="add-seed"]').addEventListener('click', () => { pillar.seeds.push(''); cpRenderPillars(); cpPersist(); });
      card.querySelector('[data-action="remove-pillar"]').addEventListener('click', () => {
        if (!confirm('Remove this pillar?')) return;
        cpState.pillars = cpState.pillars.filter(p => p.id !== pillar.id);
        cpRenderPillars(); cpPersist(); cpUpdateHealth();
        if (typeof showToast === 'function') showToast('Pillar removed');
      });
      cpBindSeeds(card, pillar);
      list.appendChild(card);
    });
    cpUpdateHealth();
    cpUpdateLayerCheck();
  }

  function cpSeedRowHtml(pillar, si, seed) {
    const tone = (pillar.tones && pillar.tones[si]) || 'Practical';
    return `<div class="cp-seed-row" data-si="${si}"><div class="cp-seed-idx">${si + 1}</div><div class="cp-seed-body"><input class="cp-seed-input" value="${cpEsc(seed)}" placeholder="A specific, real idea you could write about…" /><select class="cp-tone-select" data-tone="${si}">${TONES.map(t => `<option value="${t}" ${t === tone ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="cp-seed-actions"><button class="cp-seed-btn go" data-action="start" type="button">Start</button><button class="cp-seed-btn del" data-action="del" type="button" title="Remove">×</button></div></div>`;
  }

  function cpBindSeeds(card, pillar) {
    const wrap = card.querySelector('[data-seeds-for]');
    wrap.querySelectorAll('.cp-seed-input').forEach((inp, si) => {
      inp.addEventListener('input', () => { pillar.seeds[si] = inp.value; cpPersist(); cpUpdateHealth(); });
    });
    wrap.querySelectorAll('[data-tone]').forEach(sel => {
      sel.addEventListener('change', e => { if (!pillar.tones) pillar.tones = {}; pillar.tones[+e.target.dataset.tone] = e.target.value; cpPersist(); });
    });
    wrap.querySelectorAll('[data-action="start"]').forEach((btn, si) => {
      btn.addEventListener('click', () => {
        const seed = (pillar.seeds[si] || '').trim();
        if (!seed) { if (typeof showToast === 'function') showToast('Add a seed idea first', 'error'); return; }
        const tone = (pillar.tones && pillar.tones[si]) || 'Practical';
        safeTrack(() => GA4_Pillars.seedIdeaStarted());
        safeTrack(() => GA4_Composer.composerOpened('pillar_seed'));
        cpSendToComposer(cpBuildStarter(pillar, seed, tone));
        cpBumpUsage(pillar.id);
        cpRenderPillars();
        if (typeof showToast === 'function') showToast('Starter added to Compose', 'success');
      });
    });
    wrap.querySelectorAll('[data-action="del"]').forEach((btn, si) => {
      btn.addEventListener('click', () => {
        if (pillar.seeds.length <= 1) pillar.seeds = [''];
        else pillar.seeds.splice(si, 1);
        cpRenderPillars(); cpPersist();
      });
    });
  }

  function cpBuildStarter(pillar, seed, tone) {
    const identity  = (cpState.identity || '').trim();
    const voiceLine = identity ? `Voice: ${identity}\n\n` : '';
    const openers   = { Practical:'Here\'s the clearest way I can explain this:', Story:'Here\'s a moment that changed how I think about this:', Contrarian:'Unpopular take:', Question:'Quick question for you:' };
    const hookLine  = pillar.hook ? `\nHook: "${pillar.hook}"\n` : '';
    const ctaLine   = pillar.cta  ? `\nCTA: ${pillar.cta}\n`    : '';
    return `${voiceLine}Pillar: ${pillar.name} — ${pillar.promise}\nTopic: ${seed}${hookLine}${ctaLine}\nPost starter: ${openers[tone] || openers.Practical}`;
  }

  function cpSendToComposer(text) {
    const editor = document.getElementById('composerEditor');
    if (editor) {
      const existing = editor.innerText.trim();
      editor.innerText = existing ? `${existing}\n\n${text}` : text;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
      updateComposerClearButtonVisibility();
      if (typeof window.activateView === 'function') window.activateView('composerView');
      editor.focus();
      return true;
    }
    return false;
  }

  function cpUpdateHealth() {
    const total = cpState.pillars.length;
    const seeds = cpState.pillars.reduce((a, p) => a + p.seeds.filter(s => String(s || '').trim()).length, 0);
    const used  = cpTotalUsage();
    const hP = cpQs('cpHealthPillars'), hS = cpQs('cpHealthSeeds'), hU = cpQs('cpHealthUsage');
    if (hP) hP.textContent = total;
    if (hS) hS.textContent = seeds;
    if (hU) hU.textContent = used;
    const score = Math.min(100, (Math.min(total, 5) / 5) * 40 + (Math.min(seeds, 15) / 15) * 40 + (Math.min(used, 5) / 5) * 20);
    const bar = cpQs('cpHealthBar');
    if (bar) { bar.style.width = `${score}%`; bar.className = `cp-health-fill${score >= 70 ? ' good' : score >= 40 ? ' warn' : ''}`; }
    const msgs = [[90,'Pillar system firing on all cylinders.'],[70,'Strong foundation. Keep creating starters.'],[50,'Looking solid. Start from a few seeds.'],[20,'Good start — add more seed ideas.'],[0,'Add your pillars to start.']];
    const msg = msgs.find(m => score >= m[0]);
    const el = cpQs('cpHealthMsg'); if (el) el.textContent = (msg || msgs[msgs.length - 1])[1];
  }

  function cpUpdateLayerCheck() {
    const has = l => cpState.pillars.some(p => p.layer === l);
    const fmt = l => has(l) ? '<span style="color:var(--green);font-weight:700;">✓</span>' : '<span style="color:var(--border2);">—</span>';
    const a = cpQs('cpLayerA'), c = cpQs('cpLayerC'), x = cpQs('cpLayerX');
    if (a) a.innerHTML = fmt('awareness');
    if (c) c.innerHTML = fmt('credibility');
    if (x) x.innerHTML = fmt('action');
  }

  function cpRenderCompact() {
    const wrap = document.getElementById('composerPillarsCompact');
    if (!wrap) return;
    const pillars = cpState.pillars.slice(0, 4);
    if (!pillars.length) {
      wrap.innerHTML = "<div style=\"font-size:12px;color:var(--subtle);padding:8px 0;font-family:'DM Mono',monospace;\">Build your pillars in the Ideas tab to see quick starters here.</div>";
      return;
    }
    wrap.innerHTML = '';
    const usage = cpGetUsage();
    pillars.forEach(pillar => {
      const card  = document.createElement('div');
      card.className = 'cp-compact-card';
      const seed  = pillar.seeds.find(s => String(s || '').trim()) || '';
      const count = usage[pillar.id] || 0;
      const unusedBadge  = count === 0 ? `<span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);border:1px solid var(--border);padding:1px 6px;border-radius:999px;margin-left:6px;">unused</span>` : '';
      const draftedLabel = count > 0 ? `${count} starter${count > 1 ? 's' : ''} created` : 'Not used yet';
      const seedHtml = seed ? `<div class="cp-compact-seed">${cpEsc(seed)}</div><div class="cp-compact-row"><span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--subtle);">${draftedLabel}</span><button class="btn sm primary" type="button" style="height:24px;font-size:11px;padding:0 8px;" data-start="${cpEsc(pillar.id)}">Start</button></div>` : '';
      card.innerHTML = `<div class="cp-compact-name">${cpEsc(pillar.name)}${unusedBadge}</div>${seedHtml}`;
      const btn = card.querySelector('[data-start]');
      if (btn) btn.addEventListener('click', e => {
        e.stopPropagation();
        const p = cpState.pillars.find(item => item.id === pillar.id);
        if (p) { cpSendToComposer(cpBuildStarter(p, seed, 'Practical')); cpBumpUsage(p.id); cpRenderCompact(); if (typeof showToast === 'function') showToast('Starter added to Compose', 'success'); }
      });
      wrap.appendChild(card);
    });
  }

  function init() {
    const hasData = cpLoad();

    // Gate: SSM path
    const gN = cpQs('cpGateNew');
    if (gN) gN.addEventListener('click', () => { safeTrack(() => GA4_Pillars.ssmQuestionnaireStarted()); cpShowStage('cpStageJourney'); ssmInit(); });

    // Gate: manual path
    const gE = cpQs('cpGateExperienced');
    if (gE) gE.addEventListener('click', () => {
      if (!cpState.pillars.length) {
        // Seed default pillars
        cpState.pillars = ['Behind The Scenes','Education & Value','Hot Takes & POV','Community & Stories','Your Offer & Story'].map((name, i) => ({
          id: cpUid(), name, promise: 'Define the recurring promise this pillar makes to your audience.', layer: LAYER_MAP[i] || 'awareness', seeds: [''], tones: {}, hook: '', cta: '',
        }));
      }
      cpShowStage('cpStageBuilder');
      const bi = cpQs('cpBuilderIdentity'); if (bi) bi.value = cpState.identity || '';
      cpRenderPillars(); cpPersist();
    });

    // Builder UI
    const bi = cpQs('cpBuilderIdentity');
    if (bi) bi.addEventListener('input', e => { cpState.identity = e.target.value; cpPersist(); });

    const ap = cpQs('cpAddPillarBtn');
    if (ap) ap.addEventListener('click', () => {
      const newPillar = { id: cpUid(), name: 'New Pillar', promise: 'The recurring promise this pillar makes…', layer: '', seeds: [''], tones: {}, hook: '', cta: '' };
      cpState.pillars.push(newPillar);
      safeTrack(() => GA4_Pillars.pillarCreated({ icon: 'none', seeds: newPillar.seeds.length, trustLayer: false }));
      cpRenderPillars(); cpPersist(); if (typeof showToast === 'function') showToast('Pillar added');
    });

    const rb = cpQs('cpRestartBtn');
    if (rb) rb.addEventListener('click', () => {
      if (!confirm('Start over? This clears your pillars, starter counts, and pillar-generated series templates.')) return;
      const removedTemplates = cpClearGeneratedTemplates();
      cpState.pillars = [];
      cpState.identity = '';
      cpState._ssmInputs = null;
      cpState._latestGeneratedStarter = '';
      try { localStorage.removeItem(CP_KEY); localStorage.removeItem(USAGE_KEY); } catch {}
      const bi = cpQs('cpBuilderIdentity'); if (bi) bi.value = '';
      ['ssm-brand','ssm-industry','ssm-audience','ssm-offer','ssm-tone','ssm-goal','ssm-notes'].forEach(id => { const el = cpQs(id); if (el) el.value = ''; });
      cpRenderPillars();
      cpShowStage('cpStageGate');
      cpRenderCompact();
      if (typeof showToast === 'function') showToast(`Content pillars reset${removedTemplates ? ` — removed ${removedTemplates} generated template${removedTemplates > 1 ? 's' : ''}` : ''}.`, 'success');
    });

    const eb = cpQs('cpExportBtn');
    if (eb) eb.addEventListener('click', () => {
      const lines = ['# My Content Pillars\n', `Voice: ${cpState.identity || '(not set)'}\n`];
      cpState.pillars.forEach(p => {
        lines.push(`\n## ${p.name}`, `Promise: ${p.promise}`, `Layer: ${p.layer || 'untagged'}`, p.hook ? `Hook: "${p.hook}"` : '', p.cta ? `CTA: ${p.cta}` : '');
        p.seeds.filter(s => String(s || '').trim()).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      });
      const a = document.createElement('a');
      a.href     = URL.createObjectURL(new Blob([lines.filter(Boolean).join('\n')], { type: 'text/plain' }));
      a.download = 'content-pillars.txt';
      a.click();
      URL.revokeObjectURL(a.href);
      if (typeof showToast === 'function') showToast('Exported', 'success');
    });

    if (hasData) {
      cpShowStage('cpStageBuilder');
      const bi2 = cpQs('cpBuilderIdentity'); if (bi2) bi2.value = cpState.identity || '';
      cpRenderPillars();
    }
    cpRenderCompact();
  }

  return {
    init,
    renderCompact: cpRenderCompact,
    renderDraftCompact: cpRenderCompact,
    getData: () => ({ identity: cpState.identity, pillars: cpState.pillars }),
    insertStarter: (pillar, seed, dateLabel) => {
      const normalized = cpNormalizePillar(pillar || { name: 'Pillar', promise: 'Post starter' });
      const topic      = String(seed || '').trim();
      if (!topic) return false;
      const starter = `${dateLabel ? `Date: ${dateLabel}\n` : ''}${cpBuildStarter(normalized, topic, 'Practical')}`;
      const wrote = cpSendToComposer(starter);
      if (wrote && normalized.id) cpBumpUsage(normalized.id);
      cpRenderCompact();
      return wrote;
    },
  };
})();
