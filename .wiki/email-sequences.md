# Email Sequences — The Playbook

*Cold outbound, nurture flows, subject lines, deliverability, and design. What works in 2025–2026, and what quietly kills your reply rate.*

---

## The One Rule

Cold email lives or dies on one axis: **does this read like it was written for one person, or for a list?**

Specific, short, human → opens and replies.
Generic, long, templated → the trash folder, then the spam filter, then a dead domain.

**The 4-part formula:**
1. **Personalized first line** — something real and specific about *them*
2. **Relevance bridge** — why that detail made you write
3. **Value or curiosity** — give something, or open a gap they want closed
4. **One soft CTA** — a single, low-friction ask

**Length:** Under 120 words. Past that, you're hiding an unclear offer behind volume.

---

## Subject Lines That Earn the Open

| Formula | Example | Best for |
|---|---|---|
| `Quick question` | "Quick question" | Cold — implies you need *them* specifically |
| `[First name],` | "Sarah," | Feels cut off; forces curiosity |
| `Re: [topic]` | "Re: your Q4 strategy" | Implied continuity — use sparingly, it's risky |
| `[Specific outcome]` | "3 clients in 30 days" | Warm audiences, results-led |
| `[Mutual connection] suggested` | "Alex Kim suggested I reach out" | Social proof — only if true |
| Blunt question | "Are you the right person?" | Disarms skepticism |
| Pattern interrupt | "This email might not be for you" | Reverse psychology, skeptical lists |

**Non-negotiables:**
- Under 50 characters (mobile truncates hard)
- No ALL CAPS, no emojis in cold email
- Never write "following up" — it announces you've already been ignored
- Send test versions to yourself across Gmail/Outlook/Apple Mail before a campaign

---

## The First Line Is the Whole Pitch

If line one doesn't feel personal, line two never gets read.

**Tier 1 — best:** something they made or said
> "Your post on [topic] last week changed how I think about [thing]."

**Tier 2:** a company-specific event
> "Saw [company] just shipped [product] — congrats."

**Tier 3:** their role or problem
> "Most [job title] I talk to are fighting [specific pain] right now."

**Never:**
- "I came across your profile on LinkedIn"
- "I hope this email finds you well"
- Anything that could be pasted into 100 other emails unchanged

---

## The 5-Touch Cold Sequence

| Day | Email | Goal |
|---|---|---|
| 0 | Personalized first touch | Open → reply or click |
| 3 | Follow-up #1, new angle | Re-engage non-openers |
| 7 | Follow-up #2, add value | Give before you ask again |
| 14 | Follow-up #3, shift the pain point or add proof | Final real attempt |
| 21 | Break-up email | Close the loop or reopen it |

**Break-up formula — often the best-performing email in the sequence, because it removes all pressure:**
> "I've reached out a few times and haven't heard back — I'll assume the timing isn't right. If you ever want to [outcome], I'm here. No hard feelings either way."

---

## The 7-Day Welcome Sequence (Post-Signup)

| Day | Purpose | Content |
|---|---|---|
| 0 | Deliver the promise | Pure value, zero selling |
| 1 | Quick win | One thing they can do right now |
| 3 | Story | Origin story or customer story — builds trust |
| 5 | Proof | Case study, specific numbers |
| 7 | Offer | First soft product mention |

**Ongoing newsletter cadence:**
- Once a week — often enough to stay top of mind, rare enough to stay an event
- Same day, same time — trains the open
- Subject line should feel worth opening, never an obligation

---

## Deliverability: Don't Skip This

**Technical setup (non-negotiable):**
- SPF: `v=spf1 include:[your ESP] ~all`
- DKIM enabled in your ESP, DNS record published
- DMARC: `v=DMARC1; p=none; rua=mailto:postmaster@yourdomain` (monitor before enforcing)
- Custom tracking subdomain (`mail.yourdomain.com`) — never a shared ESP domain
- Warm new domains slowly: 10/day, doubling every 3 days over 4 weeks

**Sending behavior:**
- Never buy a list
- Send from a human name (`sarah@company.com`, not `info@`)
- Plain text or minimal HTML — heavy HTML trips spam filters
- One link max in cold email; unsubscribe link required in commercial email
- Hard bounce rate under 2%; clean the list monthly
- Spam complaint rate under 0.1%

**Before any campaign:** seed-test inbox placement across Gmail, Outlook, Yahoo using GlockApps, Mail-Tester, or MXToolbox.

---

## CTAs

**Work:**
- "Would this be useful to you?"
- "Open to a 15-minute call this week?"
- "Reply 'yes' and I'll send [resource]"
- "Click here to [specific outcome]" — warm audiences only

**Don't work:**
- "Let me know your thoughts"
- "Feel free to reach out"
- "I'd love to connect sometime"

**The P.S. line** is the most-read line after the subject. Use it for the real CTA, a proof point, or urgency you didn't want to lead with.

---

## Benchmarks

| Metric | Cold Email | Nurture | Newsletter |
|---|---|---|---|
| Open rate | 30–50% | 40–60% | 25–35% |
| Reply rate | 3–8% | — | — |
| Click rate | — | 2–5% | 1–3% |
| Unsubscribe | <0.5% | <0.3% | <0.2% |

**Diagnosis shortcut:**
- Opens below benchmark → deliverability or subject line
- Opens fine, replies/clicks low → body copy or CTA

---

## Visual Design Standard for All Email Templates

Every template — cold, nurture, or newsletter — follows one of two palettes. Don't mix them within a single sequence.

| Palette | Background | Accent / text |
|---|---|---|
| A | Beige | Midnight green |
| B | Peach | Faint grey |

**Build rules:**
- **Tables:** real `<table>` markup with borders and padding, not screenshots or spaced-out plain text — every table must render cleanly if images are blocked
- **Buttons:** small, tight padding, one per email, rounded corners — never a full-width banner button
- **Charts/graphs:** minimal gridlines, one accent color from the active palette, no legends unless more than two series
- **Scrollbars** (in any embedded interactive or web version): thin, low-contrast, matching the palette — never the default browser scrollbar
- **Mobile responsiveness:** single-column layout, font size 14px minimum, buttons full-tappable-width on mobile only, test render at 375px width before sending

---

*Last updated by Etles: 2026-04-21*