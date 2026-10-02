# Seeing it, and putting it live

Two different things, and the first one does not need the second.

---

## The short version

| What you want | What you need |
|---|---|
| Set the logo, the map pin, the hours | **Nothing.** Supabase SQL editor — see below |
| Look at the site, click around, place a test order | The site running on your own machine — ~5 minutes |
| A link you can send to a customer | A deploy |

---

## 1. Settings, with no site at all

Everything a shop has to set before opening can be set from the Supabase
dashboard → **SQL Editor**, the same place the migrations were run.

Open `supabase/seeds/shop-setup.sql`, fill in the marked values, paste, Run.
It covers the logo, where delivery is measured from, and the opening hours,
and it ends by telling you what is still missing.

Every block is safe on its own and safe to run twice. Fill in what you have
and come back for the rest.

There are two more seed files in the same folder, run the same way:

| File | What it loads |
|---|---|
| `everribbon-catalogue.sql` | the categories, the 34 products and the price ladders |
| `everribbon-questions.sql` | a starting set of questions for the quote desk |

The questions are a starting point, not an answer — reword, delete and add
them on **HQ → What to ask**. Rewording is safe at any time: every answer
already given carries the wording it was given under, so an order taken today
still reads correctly after the question changes next month.

Once the site is running these are all on screens instead — HQ → Logo,
HQ → Delivery, HQ → Hours — and the screens are easier. This file exists
because the settings are needed *before* there is a screen to use.

---

## 2. Running it on your own machine

```bash
git clone https://github.com/heyrolddev/everribbon
cd everribbon
npm install
cp .env.example .env.local     # fill in the three Supabase keys
npm run dev                    # http://localhost:3000
```

The keys are in the Supabase dashboard under **Settings → API**:

| In `.env.local` | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key |

> **The service role key bypasses row-level security completely** — every row
> of every table, for anybody holding it. It belongs in `.env.local` and in
> your host's environment settings, and nowhere else. Not in a chat, not in a
> screenshot, not committed. `.env.local` is already in `.gitignore`; keep it
> that way.

`SUPABASE_SERVICE_ROLE_KEY` is not optional any more, on the site as well as
locally: a customer's GCash screenshot goes into a private bucket, and a
private bucket cannot be written or read by the customer's own session. With
the key missing, the site says so and asks them for their reference number
instead — which works, but is a worse thing to ask of somebody who has
already taken the screenshot.

Then sign up on the running site, and promote yourself to owner once — in the
SQL editor:

```sql
UPDATE public.profiles SET role = 'owner'
WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
```

HQ is at `/admin`.

---

## 3. Putting it live

Vercel, connected to this repository. The three keys above go in **Project
Settings → Environment Variables**, plus:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_BRAND` | `everribbon` |
| `NEXT_PUBLIC_SITE_URL` | the real address, once there is a domain |

`NEXT_PUBLIC_SITE_URL` is what share cards and canonical links are built
from. Until a domain exists **leave it out entirely** rather than setting it
empty — `siteUrl()` falls back to Vercel's own production URL, so sharing
works before anything has been bought.

**Creating the project does not deploy it.** The import screen makes the
project and connects the repository, and then the Overview says "No
Production Deployment — your Production Domain is not serving traffic",
which reads like a failure and is not one. There is simply nothing to serve
yet. Vercel builds on a push, so the first deployment is the first commit
that lands on `main` after the project exists:

```bash
git commit --allow-empty -m "Trigger the first deployment"
git push origin main
```

Any real commit does it too. After that every push to `main` deploys by
itself, which is the whole arrangement.

### The receipts already in the public bucket

Migration 0021 moved payment screenshots into a second, private bucket —
`everribbon-private`, made automatically the first time one is uploaded. From
now on nothing serves a receipt without a signed link that lasts ten minutes.
The reference photos customers attach to an enquiry (0022) live there too,
for the same reason: one is usually a photograph of a person at a graduation.

**The ones already uploaded are still in the public bucket**, under
`everribbon/receipts/`, and still readable by anyone with the address. The
migration deliberately leaves them alone: they are the evidence behind
payments already confirmed, and a half-finished move would have lost some of
them. Moving them is a job for a person with the dashboard open.

When you are ready — Storage → `everribbon` → `receipts`:

1. Check the orders they belong to are settled (HQ → Costs & cash shows you).
2. Download the folder if you want to keep the evidence off-site.
3. Delete the folder.

Old orders then show no screenshot, which is honest — the reference number and
the confirmation are still on the order. Do not move the files into the
private bucket by hand: the rows point at the public URL, so the link would
break rather than start working.

### Deploying and announcing are not the same day

Deploy as soon as it builds. The address is unguessable until you give it to
somebody, and it is the only way to test the one thing no amount of checking
here can: this site against **your** database, with your products, your
questions and your storage bucket. Nothing below has to be true to deploy.

Announcing is the other day. These are what make the site useful rather than
honest-but-empty:

- [ ] `supabase/seeds/shop-setup.sql` filled in and run
- [ ] The logo uploaded, both grounds (HQ → Logo)
- [ ] The delivery pin dropped (HQ → Delivery) — until it is, delivery is
      offered to nobody, on purpose
- [ ] Opening hours set (HQ → Hours)
- [ ] The questions checked (HQ → What to ask) — these are what a customer is
      asked on the order form, and the answers travel with the order onto the
      board, the proof photo and the customer's own page
- [ ] Payment details set (HQ → Payments) — GCash name and number
- [ ] Material costs and assembly minutes entered (HQ → Inventory) — without
      them the quote desk reads every job as near-pure margin and says so
- [ ] Product photographs uploaded (HQ → Shop). Prices are already loaded
      from the catalogue seed; the photographs are what sell them

### The one test that matters

A made-to-order shop has one path, and this walks all of it. Ten minutes, on
a phone, on the deployed site — not on a laptop, because a phone is where
every real one of these happens.

1. **Ask.** Open `/enquire`, fill it in, attach a photo, send. You should get
   a ticket number and a link. The private storage bucket is created by this
   first upload, so this is also the step that proves storage works.
2. **Check the link.** Open it. It should show what you asked for and say
   there is no price yet.
3. **Find it.** HQ → Orders. The answers and the photo should be on the card,
   with **Put a price on this**.
4. **Price it.** The desk opens with everything they told you already in it.
   Save.
5. **Check the link again.** The price should be there, with what stands
   until when.
6. **Send a proof** from the order card, then move the order through every
   remaining step to Delivered.

If any step does something other than that, the exact message is worth more
than a description of it.

None of these break the site by being missing. Each one is a place where the
site currently says something honest and unhelpful instead of something
useful — which is the trade this system makes everywhere, deliberately, in
preference to guessing.
