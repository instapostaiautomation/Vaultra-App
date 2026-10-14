# Vaultra DigiGold — PRD

## Original Problem Statement
Production-grade multi-tenant Digital Gold Platform (inspired by DigiGold), built as an Expo mobile app. Customer portal (header with tenant switch, live 24K ticker, vault pill, promo carousel, Instant Buy widget with 5-min price lock, rupees/grams toggle, quick chips, 3% GST, Razorpay/UPI payment, categories, trending jewellery, Vault & Ledger with portfolio, quick actions, passbook filters, Auto SIP, FAQ). Dark staff admin portal: Overview + live event stream, Customers directory by tenant, KYC review (Aadhaar/PAN, approve/reject with staff ID), In-store pickups with 6-digit OTP (locks after 5 tries), Counter POS sale, Ledger & reversals. Gold #D4AF37, Inter font, Lucide icons, toasts.

## User Choices
- Staff access: separate Staff ID + PIN login
- Backend: FastAPI + MongoDB with seeded demo data
- Payments: real Razorpay requested but keys skipped, so a mock payment sheet is used for now (switches to Razorpay automatically when keys are set)
- Gold price: simulated live ticker that moves every 3s
- Customer sign-in: mock phone OTP, with the demo OTP shown in the app

## Architecture
- Backend: /app/backend/server.py (JWT auth, bcrypt staff PINs, quotes, orders, transactions with embedded double-entry entries, pickups, SIPs, events = simulated pub/sub, price loop)
- Frontend: expo-router. (tabs): Home, Vault, Jewellery, SIP. Other routes: /login, /profile, /faq, /checkout (Razorpay WebView). Admin: /admin/login, /admin/(tabs) dashboard, kyc-review, pickups, counter-sale; /admin/customers, /admin/ledger
- State: AppContext (customer session, tenant, price polling, vault), StaffContext (staff session, tenant filter)

## Implemented (2026-06)
- All customer and admin features above, tested end to end (25/25 backend tests passed, frontend flows passed)

## Iteration 2 (2026-06)
- Gift Gold: /gift screen. Send grams or rupees from your vault to any phone, with 5 greeting card themes (Diwali, Birthday, Wedding, Thank You, Congrats) and a personal message. New recipients get an account automatically. Shows sent and received history, and gifts appear in the passbook under the Gifts filter. APIs: /api/gifts (POST/GET), /api/gifts/mark-seen
- Price Alerts: Home card opens a sheet to set a target price (max 5 active). A green banner appears on Home when the live 24K price drops below a target; the server checks the price before marking it hit. APIs: /api/alerts CRUD + /trigger
- Sheets now scroll to the focused input when the keyboard opens

## Backlog
- P0: Add Razorpay test keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in backend/.env) to turn on the real gateway
- P1: Doorstep BRINK'S delivery booking, PDF invoices, Razorpay webhooks
- P2: Real SMS OTP, real gold price feed, scheduled SIP runner
