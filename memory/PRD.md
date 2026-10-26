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
