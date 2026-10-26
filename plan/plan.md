# Vaultra DigiGold — White-Label Digital Gold Platform

A SaaS platform where Vaultra onboards jewellery shop owners, each gets their own branded digital gold app. Customers buy gold at live rates (fractional grams), accumulate in a digital wallet, and redeem physical gold/jewellery at the shop. Orders are pooled across all jewellers, and bulk procurement happens when the pool reaches 10 grams.

**Who it's for:** Vaultra (platform owner) providing white-label digital gold technology to jewellery businesses across India.

---

## Tech Stack

- **Frontend:** Expo (React Native) with Expo Router
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL (with SQLAlchemy ORM)
- **KYC:** Setu KYC API (real integration, keys saved)
- **Payment:** Mock/demo for now (real Razorpay/Cashfree later)
- **OTP/SMS:** Mock/demo for now
- **Gold Rate:** Simulated (real bullion API later)
- **Admin Panels:** Web pages served from FastAPI backend

---

## Core Business Logic

### How Gold Buying Works
Customer pays any INR amount at the current displayed rate. They receive fractional grams in their digital wallet. The rate at which they booked, the grams received, and the transaction are visible to the customer, the jeweller, and the master admin — all in real time.

Example: Customer pays ₹2,000 at rate ₹7,500/gm → receives 0.2667 grams in wallet.

### How Pooling Works
All customer purchases across all jewellers are pooled into a single accumulator. When the pool reaches 10 grams total, the system triggers a bulk procurement order (mock for now, real supplier API later). A bifurcation invoice is generated showing which customers contributed how many grams and which jeweller each belongs to.

### How Redemption Works
When a customer accumulates the minimum required grams (default 1 gram, configurable by each shopkeeper), they visit the physical shop, show their Wallet ID to the shopkeeper, and the shopkeeper gives them physical gold or equivalent jewellery. The redeemed grams are deducted from the customer's digital wallet. Each shopkeeper can set their own minimum gram threshold for redemption.

---

## Core Features

### End-User Mobile App (white-labeled per jeweller)
- Buy gold/silver at live displayed rate with any INR amount
- Digital wallet showing accumulated fractional grams and Wallet ID
- Transaction history: rate at booking, grams received, date, amount paid
- Redemption at physical shop using Wallet ID
- Jewellery catalog: browse items available for redemption
- SIP (recurring gold purchase plan)
- Gift gold to other users
- Price alerts
- KYC via Setu API (real verification)
- Referral program
- Notifications
- Profile with jeweller's branding (logo, colors, name)

### Jeweller Admin Panel (Web)
- Dashboard: total customers, total grams sold, revenue, active wallets
- Customer list with wallet balances
- Transaction log for their customers
- Redemption management: verify Wallet ID, approve redemption, deduct grams
- Set minimum gram threshold for redemption (default 1gm, changeable)
- Product catalog management (jewellery items, gram equivalents)
- KYC review for their customers
- Store settings

### Master Admin Panel (Web)
- Dashboard: all jewellers, all customers, total grams, pool status
- Jeweller onboarding form (business name, logo, colors, address, PAN, Aadhaar, phone, email, password, domain)
- Pool tracker: current accumulated grams, progress toward 10gm
- Bulk order trigger when pool hits 10gm
- Bifurcation invoice: breakdown by customer and jeweller
- View all transactions, redemptions, wallet balances
- Gold/silver rate management
- Suspend/activate jewellers

---

## User Flows

### Customer buys gold
1. Opens app → sees current gold rate
2. Enters amount (₹2,000) → app shows grams (0.2667 gm at ₹7,500/gm)
3. Confirms purchase (mock payment)
4. Wallet updated with fractional grams at booked rate
5. Transaction visible in customer app, jeweller panel, master panel
6. Pool accumulator increases

### Customer redeems at shop
1. Customer wallet reaches minimum grams (set by shopkeeper, default 1gm)
2. Visits physical shop, shows Wallet ID
3. Shopkeeper enters Wallet ID in admin panel, sees balance
4. Customer picks gold/jewellery, shopkeeper approves redemption
5. Grams deducted from wallet, redemption logged everywhere

### Pool reaches 10 grams
1. Master admin sees pool reach 10gm threshold
2. Bulk procurement triggered (mock)
3. Bifurcation invoice generated: per-customer, per-jeweller breakdown

---

## Implementation Phases

### Phase 1 — MVP (built now on Emergent)

**PostgreSQL Setup:**
- Install PostgreSQL in environment
- SQLAlchemy ORM models for all entities
- Alembic for database migrations

**Backend (FastAPI + PostgreSQL):**
- Multi-tenant architecture with tenant_id isolation
- Gold rate API (simulated)
- Customer wallet: buy (INR → fractional grams), balance, transactions
- Pool accumulator: track total, trigger at 10gm, bifurcation invoice
- Redemption: verify Wallet ID, deduct grams
- Jeweller onboarding with all details
- Configurable minimum redemption grams per jeweller
- Setu KYC integration (real)
- Admin APIs for jeweller and master panels

**Customer Mobile App (Expo):**
- White-label ready: tenant config from backend
- Gold/silver rate display and buying
- Digital wallet with Wallet ID
- Transaction history
- Redemption flow
- Jewellery catalog
- SIP, gift, alerts, referral, notifications, KYC (Setu), profile

**Master Admin Panel (Web):**
- Jeweller onboarding
- Dashboard with pool tracker
- Bifurcation invoice
- All transactions view

**Jeweller Admin Panel (Web):**
- Customer dashboard
- Redemption management
- Minimum grams configuration
- Product catalog

### Phase 2 — Production (AWS)
- AWS deployment
- Real payment gateway (Razorpay/Cashfree per jeweller)
- Real gold supplier API
- Real SMS/OTP per jeweller
- Automated white-label app build pipeline
- Custom domains per jeweller
- App Store / Play Store publishing

### Phase 3 — Scale (1000+ jewellers)
- Auto-scaling infrastructure
- Self-service jeweller onboarding
- Advanced analytics
- Push notifications per jeweller

---

## Assumptions

- PostgreSQL will be installed and used from the start (replacing MongoDB).
- Setu KYC is real integration (keys saved). All other services (payment, OTP, gold rate) are mock/demo in Phase 1.
- Payment mock: any amount entered is accepted without real charge.
- Gold rate is simulated. Real bullion API in Phase 2.
- OTP is demo: any code works. Real SMS per jeweller in Phase 2.
- Pool threshold is 10 grams (configurable by master admin).
- Default minimum redemption is 1 gram (configurable per jeweller).
- Admin panels are web pages served from the FastAPI backend.
- Existing Vaultra DigiGold mobile app is the master template for white-labeling.
