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
from. Until a domain exists it can be left unset — the deployment's own URL
is used instead, so sharing works before anything has been bought.

### Before you announce it

- [ ] `supabase/seeds/shop-setup.sql` filled in and run
- [ ] The logo uploaded, both grounds (HQ → Logo)
- [ ] The delivery pin dropped (HQ → Delivery) — until it is, delivery is
      offered to nobody, on purpose
- [ ] Opening hours set (HQ → Hours)
- [ ] Payment details set (HQ → Payments) — GCash name and number
- [ ] One test order placed end to end, and moved through every step
- [ ] Product photographs uploaded (HQ → Shop). Prices are already loaded
      from the catalogue seed; the photographs are what sell them

None of these break the site by being missing. Each one is a place where the
site currently says something honest and unhelpful instead of something
useful — which is the trade this system makes everywhere, deliberately, in
preference to guessing.
