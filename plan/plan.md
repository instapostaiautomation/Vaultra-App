# MT5 Auto-Hedge for Customer Gold & Silver Purchases

When customer purchases in the app add up to one MT5 lot, the app places a matching BUY order on the MT5 account through the user's hosted MT5 order API.
Right now app purchases do not reach MT5. The app only reads live rates from it.

## Who it's for
- **Master Admin (platform owner):** covers the metal customers buy, without placing trades by hand.
- **Jewellers and customers:** they see no difference. Buying works exactly as it does today.

## Core features and experience
- **Pooling to a lot:** every paid customer purchase is added to a running "unhedged" total, kept separately for gold and silver and combined across all jewellers.
- **Automatic BUY:** when the gold total reaches one lot (100 g), one BUY order for 1.0 lot of GOLDDEC goes to MT5, and 100 g is taken off the total. Silver works the same way with SILVERDEC. Anything left over keeps building towards the next lot.
- **No action on redemption or sell:** redeeming doesn't touch MT5, and the app never places SELL or close orders.
- **Hedge log:** every order is recorded with time, metal, lots, grams covered, the MT5 ticket number, the fill price, and success or failure.
- **Retry on failure:** if MT5 rejects an order or can't be reached, the grams stay in the pending total. The next attempt happens automatically, and Master Admin can also press "Retry now".
- **Master Admin "MT5 Hedge" tab:**
  - Pending grams so far for gold and silver, each with a progress bar towards the next lot.
  - The hedge log, with a status badge on each entry.
  - Open MT5 positions with live profit/loss, read from the MT5 positions API.
  - An on/off switch for auto-hedging.
  - Editable lot sizes: grams per 1.0 lot for gold and for silver.

## User flow
1. A customer buys 3 g of gold and the payment is confirmed.
2. Pending gold goes from 97 g to 100 g.
3. The app places "BUY GOLDDEC 1.0" on MT5. The ticket comes back and is saved in the hedge log, and pending gold goes back to 0 g.
4. Master Admin opens the MT5 Hedge tab and sees the order and its live P&L.

## UI/UX feel
- The MT5 Hedge tab matches the existing Master Admin luxury sidebar style.
- Each metal has a gold or silver progress bar, and the logs have clear success and failure badges.
- Nothing changes in the customer app.

## Implementation phases
- **Phase 1 (MVP, built now):**
  - Pending totals and the automatic BUY at one lot for gold and silver.
  - The hedge log and automatic retry.
  - The Master Admin MT5 Hedge tab: pending progress, log, open positions, auto on/off and lot sizes.
- **Phase 2:**
  - Alerts to Master Admin when an order fails or when the MT5 feed or orders stop working.
  - A daily check that compares MT5 positions with customer holdings.
- **Phase 3:**
  - Separate hedging for each jeweller, with its own MT5 account and margin rules.
  - Optional SELL or close orders when customers redeem, if the policy changes later.

## Assumptions
- **Lot sizes:** 1.0 lot of GOLDDEC = 100 g, as stated. The answer only gave one size, so 1.0 lot of SILVERDEC is also set to 100 g at the start. Both can be changed in Master Admin.
- **What counts:** only payment-confirmed purchases. Pending or failed payments don't count, and SIP instalments and gift purchases count once they're paid.
- **Pooling:** totals are shared across all jewellers, and one MT5 account covers the whole platform.
- **Order size:** exactly 1.0 lot is placed each time. If one purchase pushes the total over several lots at once, several 1.0-lot orders go through in a row.
- **No stop loss or take profit:** stop loss and take profit are set to 0 on every order.
- **Starts from zero:** purchases made before this feature switches on are not hedged backwards. Pending totals start at zero, and Master Admin can add an opening amount by hand if wanted.
- **Same API and key as the rates:** orders use the MT5 order API at the same base address and key that the live rates already use. If that tunnel address changes, both rates and orders stop until the new address is saved.
- **Demo account first:** MT5 orders are placed on the demo account described in the API. Customer payments are still mock, so test purchases will create real demo-account trades.
