# Vaultra DigiGold — Product Requirements Document

## Overview
Multi-tenant white-label digital gold platform. Vaultra onboards jewellery shop owners, each gets their own branded digital gold app. Customers buy gold at live rates (fractional grams), accumulate in a digital wallet, and redeem physical gold/jewellery at the shop.

## Tech Stack
- **Frontend:** Expo (React Native) with Expo Router — Customer mobile app
- **Backend:** FastAPI (Python) with PostgreSQL (SQLAlchemy async ORM)
- **Database:** PostgreSQL
- **Admin Panels:** Web HTML served from FastAPI at /api/admin/master and /api/admin/jeweller
- **Payment:** Mock/demo (real Razorpay later)
- **OTP/SMS:** Mock/demo
- **Gold Rate:** Simulated with price ticker
- **KYC:** Demo (Setu KYC keys saved for Phase 2)

## Architecture
- Multi-tenant: jeweller_id isolates all data
- Pool accumulator: all purchases contribute to a shared pool; at 10g threshold, bifurcation invoice is generated
- Wallet ID: unique per customer, used for in-store redemption
- Configurable minimum redemption grams per jeweller

## Implemented Features (Phase 1)

### Backend (FastAPI + PostgreSQL)
- [x] PostgreSQL database with SQLAlchemy async ORM
- [x] Multi-tenant architecture with jeweller_id isolation
- [x] Simulated gold/silver price ticker (updates every 3s)
- [x] Customer auth: phone OTP (mock — any code works, demo OTP returned)
- [x] Customer registration with first/last name, DOB, email, gender, referral code
- [x] Referral program: ₹50 each for referrer and new user
- [x] Gold/Silver buying: quote → order → mock-confirm → wallet credit
- [x] Pool accumulator: tracks total grams across all jewellers, triggers at 10g
- [x] Bifurcation invoice: per-customer, per-jeweller breakdown when pool triggers
- [x] Redemption: customer shows Wallet ID at shop, jeweller approves, grams deducted
- [x] Sell gold (requires KYC)
- [x] SIP: create, pause, resume, cancel, run installment
- [x] Gift gold to any phone number
- [x] Price alerts: alert and book-alert types
- [x] Goals: up to 5 per customer
- [x] Wallet: deposit, withdraw, referral balance
- [x] Notifications system
- [x] KYC submit and review
- [x] Jeweller admin: login, dashboard, customer list, redemption, transactions, pickups, KYC queue, products, settings
- [x] Master admin: login, dashboard, jeweller onboarding, pool tracker, bifurcation invoices, all transactions, toggle jewellers
- [x] Seeded demo data: 2 jewellers, 6 customers, transactions, pool contributions

### Customer Mobile App (Expo)
- [x] Home: jeweller name, live gold/silver prices, wallet ID, buy widget, quick actions, jewellery preview
- [x] Buy gold/silver with any INR amount, metal toggle, quick amounts
- [x] Vault: gold holdings, value, PnL, silver balance, Wallet ID, transaction history
- [x] Jewellery catalog: filter by category, product cards with live pricing
- [x] Product detail: pricing breakdown, features, redeem button
- [x] SIP: create/manage recurring gold purchases
- [x] Wallet: balance, deposit, withdraw, transaction history
- [x] Login: phone → OTP (auto-filled demo) → register (new users)
- [x] Profile: name, phone, KYC status, theme toggle, menu
- [x] Referral: code, copy, share, stats
- [x] Gift gold
- [x] Notifications
- [x] FAQ
- [x] Dark/light theme

### Admin Panels (Web)
- [x] Master Admin (/api/admin/master): dashboard, jeweller management, pool tracker, bifurcation invoices, transactions, onboard new jewellers
- [x] Jeweller Admin (/api/admin/jeweller): dashboard, customers, redemption (Wallet ID lookup), transactions, KYC queue, products, settings (min redemption)

## Access URLs
- Customer App: http://localhost:3000
- Master Admin: http://localhost:8001/api/admin/master (or /api/admin/master on preview URL)
- Jeweller Admin: http://localhost:8001/api/admin/jeweller (or /api/admin/jeweller on preview URL)

## Phase 2 (Future)
- Real payment gateway (Razorpay/Cashfree per jeweller)
- Real gold supplier API
- Real SMS/OTP per jeweller
- Setu KYC integration (keys already saved)
- Custom domains per jeweller
- App Store / Play Store publishing

## Update — Oct 2026
- Expo SDK upgraded 57 → 58 (RN 0.88, React 19.3); expo-doctor 20/20; strict-TS fixes in theme.ts, tabs layout, BannerCarousel.
- MT5 live rate feed (MT5_RATES_URL, MT5_API_KEY optional, symbols GOLDDEC/SILVERDEC, units 10g / 1kg) with simulated fallback; `source`/`live` in /api/price.
- Per-jeweller margins (buy markup %, sell-back discount % for gold & silver) — jeweller admin Settings.
- Custom domains per jeweller (app + admin domain), master admin Domains modal with DNS check; /api/tenant/resolve.
- Pending (iteration_4): home screen lacks "Indicative/Live" label, change arrow/sign mismatch, margin error alert shows [object Object], onboarding domain uniqueness, quote-tenant check, suspended-domain fallback.
- Paused: Claude AI integration request.

## Update — Old UI restored (Oct 2026)
- Customer Expo screens restored from the pre-v2 UI (commit 369ac86) and wired to the PostgreSQL multi-tenant backend via compat endpoints (tenant alias, /quote/silver, /orders/buy-silver, GET /orders/{id}, /gifts/mark-seen, /alerts/book, /alerts/{id}/trigger, vault.pending_pickups).
- Inter fonts restored; header shows jeweller name; demo/AI-looking text and emojis removed; admin login forms no longer prefilled.
- Silver balance + silver passbook/invoice labels; products scoped to the jeweller; product images by category.
- Backlog: book alerts auto-buy, MT5 URL connection, legacy test suites cleanup.

## Update — Panels v3 (Oct 2026)
- Jeweller Shop Panel & Master Console rebuilt: shared design (templates/panel.css, panel.js served at /api/admin/assets/*), left sidebar nav.
- Shop panel: Dashboard (range 1d/3d/7d/30d/custom, active/inactive customers, gold/silver booked, chart), Commission (flat ₹/g, live rate + calc), Orders (buy/redeem only + View bill), Wallet & Holdings (drawer detail), Customers, KYC, Redemptions, Catalogue, Gifts, Referral, Settings (shop details, app key, links).
- New APIs: /api/jeweller/v3/* and /api/master/v3/overview. Selling disabled (/api/sell → 403); customer app Wallet tab + Sell removed.
- MetaApi live feed code (METAAPI_TOKEN, METAAPI_ACCOUNT_ID, METAAPI_REGION) — keys pending from user.
- PostgreSQL runs via supervisor (/etc/supervisor/conf.d/postgresql.conf). NOTE: Emergent deployment provides MongoDB only — production needs an external PostgreSQL (e.g. AWS RDS) via DATABASE_URL.

## Update — Panels v4
- Shop: Catalogue table (images, live rate + commission + making % 9/12/14/18/22/24), App Content (banners with image upload via Emergent Object Storage + live phone preview, FAQ), SIP tab, Gold Goals tab.
- Master (dark luxury sidebar): Overview hero, Shops, Pricing, Market & Feed, Catalogue, App Content, Orders (+bill), Customers, KYC, Transactions, Settlement, SIP, Referrals, Gifts, Redemptions, Gold Goals, Gold Pool, Invoices, Audit Log.
- New tables: banners, faqs, uploads, audit_logs; products.making_pct. Customer app banners + FAQ load from /api/content.
- PostgreSQL self-heals via /app/scripts/ensure_postgres.sh (supervisor program "postgresql").

## Database safety (Jun 2026)
- Alembic configured: /app/backend/alembic.ini, /app/backend/migrations (baseline 00e340a04c4e stamped; app_settings excluded from autogenerate).
- Future schema change: edit models -> `cd /app/backend && alembic revision --autogenerate -m "msg"` -> review -> `alembic upgrade head`. Never drop_all.
- Seed is idempotent (skips if master admin exists). init_db only creates/adds, never deletes.
- Backup: /app/scripts/backup_db.sh -> /app/backups (keeps last 14). Run before every migration.
- LIVE RATES: hosted MT5 JSON feed via MT5_RATES_URL + MT5_API_KEY (takes priority over MetaApi). Verified live: GOLDDEC per 10g, SILVERDEC per kg -> per gram. httpx logs silenced (key in URL). Order booking API (/order, /positions, /close_order) available on same host, not yet integrated.

## Customer app luxe redesign (Jun 2026, iteration 12)
- Left-top side drawer (src/components/SideMenu.tsx): profile block, Vault & Redeem, Catalogue, SIP, Gift, Refer, Notifications*, KYC*, FAQ, Logout*; footer jeweller support_phone (from /jewellers/list = jeweller.phone) + Powered by.
- Wallet pill only when signed in. Category tiles = lucide icons. Product/detail images contentFit contain on cream. Banners: blurred backdrop + contain; uploaded banners show no text overlay.
- Dark luxe price cards; price alert banner only for user's triggered alerts; price direction vs open; jeweller product total uses making %.

## Rates offline handling (iteration 13-14)
- If MT5 feed configured but down > 60s: source="offline", last real price frozen (persisted in app_settings.last_live_rates), /quote, /sips/{id}/run, /gifts return 503. App shows PAUSED + disabled buy. Auto-resumes when feed returns.
- Backend startup retries DB 30x2s. MT5 key redacted in logs.
- App does NOT place MT5 trade orders (rates only).

## Feed-down alert + persistence (iteration 15-16)
- Master Admin red banner #feed-down-alert (polls /api/master/rate every 5s, shows friendly reason). Feed marked down after 15s without data. Startup = offline until feed answers when feed configured.
- has_live=false -> all panels/app show "—" instead of demo prices.
- PostgreSQL data moved to /app/pgdata (persistent). Previously /var/lib was wiped on pod restart -> DB reseeded (data loss on 29 Oct). Backups in /app/backups.
- MT5_RATES_URL currently points to a dead trycloudflare host; user must provide new link via secrets.
- 31 Oct: MT5_RATES_URL switched to permanent direct server (http, port 8000). Live verified: source=mt5, quotes OK.

## White-label SaaS structure (iteration 18)
- frontend/tenant.config.json (empty tenantId = base app with jeweller picker) + src/tenantConfig.ts + app.config.js (applies name, bundleId, package, icon, splash from tenant-assets/). theme.ts overrides brand colours from tenantConfig.theme; home section order from tenantConfig.homeLayout.
- api.ts sends X-Tenant-ID; backend get_current_customer rejects token/tenant mismatch (403); /price & /products fall back to header.
- Karat rates: 22K = 24K x 22/24 + gold22_commission_per_g; 18K = x 18/24 + gold18_commission_per_g; margins may be negative. Editable in Master Pricing + Shop Admin Commission. KaratRates card on home.
- Master "App Studio" tab (templates/app_studio.js): 5 presets (backend/white_label.py), live phone preview, App ID auto, logo/splash upload, auto store listing, privacy/terms at /api/tenant/{id}/privacy|terms, status Details pending→Theme chosen→Config ready→Built→Submitted→Live, Export App Kit zip (/api/master/app-studio/{id}/kit): config.json, icon, adaptive icon, splash, 3 screenshots 1290x2796, feature graphic, listing.md, README.
- Alembic revision 7a1c2e9b4d10.
- Iter 18 fixes: store picker in side menu (base mode), FreeSans fonts in backend/fonts for ₹ in kit images, locked tenant header from first request, per-tenant URL scheme, export saves draft first, status steps back if logo removed.
- OTP request honours X-Tenant-ID (picked store); panel inr shows 2 decimals.

## Phase 1 of big change list (iteration 21-22) — DONE
- Gift removed everywhere (app route deleted, panels nav, POST /api/gifts → 410).
- QUOTE_SECONDS=120; fresh quote locked on Proceed. GST-inclusive: grams = (paid − 3%)/rate for buy & SIP.
- CONTROLS (app_settings.platform_controls): global+per-shop rates/booking switches, min_investment (500). Master tab "Security & Controls" (app_studio.js vSecurity). Rates hidden → price/products zeroed.
- Redeem grams requests: POST /api/redeem-requests (≥ max(1g, shop min), KYC approved); Shop pop-up Accept/Decline (/jeweller/v3/redeem-requests).
- Referral reward per shop: app_settings referral_reward:{jid}; Shop Referral tab; app reads /api/referral-reward.
## Phase 2 (iteration 23-24) — DONE
- Shop: KPI info pop-ups (dashInfo); holdings gold/silver value + avg gold/silver buy (GST-incl); shared customerDrawer + kycDetails (panel_ext.js); KYC photo (POST /api/kyc/photo, Upload.owner=kyc:<cid>, served only via /jeweller|master/v3/kyc/{cid}/photo; /api/files refuses kyc uploads).
- Silver SIP (Sip.metal) and silver goals (Goal.metal) in app + panels. Redeem grams form coin|bar.
- Product.purity 24K/22K/18K (PURITY_PCT = 22/24, 18/24). Price = grams × karat rate × (1+making%). Product redemption deducts fine 24K grams (fine_grams). Making % free 0-40.
- Master: shop name → catalogue drawer; Customers → full detail (/master/v3/customers/{cid}); MT5 Bookings tab.
- MT5 cover: purchases accumulate in app_settings mt5_pending; BUY POST {base}/order {symbol,type,volume} when ≥ min lot. Config mt5_booking_cfg (gold_lot_g 10, silver_lot_g 1000, min 1, step 1, max 10). Failed auto attempt → 5 min cooldown; manual retry. Table mt5_bookings. Migration b3d9e1f0a2c4.
- Security audit: per-object tenant scoping PASS. Referral lookup scoped to store. Known demo risks: OTP echoed, seeded demo passwords (must change before launch).
## Security (Nov 2026)
- Panel logins: in-memory brute-force limiter (5 fails/account, 20/IP per 15 min → 429), right-most X-Forwarded-For, expired keys pruned. Single-process only.
- Master KYC button no longer embeds JSON in onclick (S.mcust).
- Open demo items before launch: OTP echoed in API, seeded demo passwords, CORS "*", mocked payments/AutoPay.

## Iteration 25 (Nov 2026) — DONE
- MT5: gold & silver 1 lot = 100g, books 0.1 lot per 10g in pool (min 0.1, step 0.1, max 10). BUY only.
- Rates: backend reads MT5 back-to-back (~0.4-0.5s per read over tunnel); app polls /price every 1s, panels 1.5s.
- Customer buy: UI shows live rate, no timer/"deducted" line; 120s quote lock is backend-only at Proceed.
- Dues: ShopPayment table; payable = collected − shop commission (metal + GST). /master/v3/dues*, /jeweller/v3/dues. Master "Shop Dues" tab + Overview banner; Shop "Payments to Master" tab + dashboard banner.
- SIP AutoPay (demo mandate UPIMD…): first instalment debited on create, sip_scheduler every 60s auto-debits due SIPs (row lock, per-SIP commit), notification, MT5 cover. "Pay extra now" doesn't move next date.
- Customer app liquid glass: Glass.tsx (expo-blur; Android fallback fill), floating glass tab bar, glass menu/back buttons, glass side menu. Theme keys glassFill/glassBorder/glassHighlight/glassFallback/glassTint. (orders refused "AutoTrading disabled"); confirm real lot sizes.
- Real SMS OTP + payments before launch; replace seeded passwords.
