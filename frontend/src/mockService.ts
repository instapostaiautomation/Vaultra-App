// In-browser mock service for demo live deployments (e.g. Render Static Site)
// Guarantees 100% clickable, fully functional app across all tabs, pages & modals!

export interface MockUser {
  id: string;
  phone: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  dob: string;
  gender: string;
  tenant: string;
  kyc_status: "not_submitted" | "pending" | "approved" | "rejected";
  gold_grams: number;
  silver_grams: number;
  invested: number;
  avg_buy_price: number;
  wallet_balance: number;
  created_at: string;
  kyc: any;
  referral_code: string;
  referral_balance: number;
  referred_by?: string | null;
}

const DEFAULT_USER: MockUser = {
  id: "usr_demo_vaultra_01",
  phone: "9876543210",
  name: "Priya Sharma",
  first_name: "Priya",
  last_name: "Sharma",
  email: "priya.sharma@example.com",
  dob: "15/08/1996",
  gender: "Female",
  tenant: "vaultra",
  kyc_status: "approved",
  gold_grams: 8.452,
  silver_grams: 50.0,
  invested: 61570,
  avg_buy_price: 7285.50,
  wallet_balance: 15400,
  created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  kyc: { pan: "ABCDE1234F", aadhar: "•••• •••• 5678", verified: true },
  referral_code: "VAULTRA999",
  referral_balance: 250,
  referred_by: null,
};

const PRODUCTS_DATA = [
  {
    id: "p1",
    name: "Heritage 24K Necklace",
    category: "necklaces",
    grams: 12.5,
    making_charges: 4850,
    image: "heritage-necklace",
    tag: "Trending",
    description: "Exquisite 24 karat pure gold heritage necklace handcrafted with antique royal motifs.",
    features: ["24 Karat / 999 Purity", "BIS Hallmarked", "Zero Deductions Guarantee", "Insured Doorstep Delivery", "Free 1-year polishing"]
  },
  {
    id: "p2",
    name: "Minimalist 24K Gold Bangle",
    category: "bangles",
    grams: 8.2,
    making_charges: 2650,
    image: "minimalist-bangle",
    tag: "Bestseller",
    description: "Sleek and timeless solid 24K gold bangle designed for everyday elegance.",
    features: ["24 Karat / 999 Purity", "BIS Hallmarked", "Anti-Tarnish Coating", "Tamper-Proof Box", "Easy Exchange Guarantee"]
  },
  {
    id: "p3",
    name: "Classic Solitaire Ring",
    category: "rings",
    grams: 3.4,
    making_charges: 1150,
    image: "rings",
    tag: "New",
    description: "Dainty handcrafted 24K pure gold ring with brilliant detailing.",
    features: ["24 Karat / 999 Purity", "BIS Hallmarked", "Comfort Fit", "Certified Authenticity"]
  },
  {
    id: "p4",
    name: "Rope Twist Chain",
    category: "chains",
    grams: 6.8,
    making_charges: 1980,
    image: "chain",
    tag: "Trending",
    description: "High-durability interlocking twist chain in lustrous 24K gold.",
    features: ["24 Karat / 999 Purity", "BIS Hallmarked", "Secure Lobster Clasp", "Smooth Polish"]
  },
  {
    id: "p5",
    name: "Royal Kada",
    category: "kadas",
    grams: 15.0,
    making_charges: 5200,
    image: "kada",
    tag: "Premium",
    description: "Heavily ornamented traditional Indian 24K gold kada with intricate engraving.",
    features: ["24 Karat / 999 Purity", "BIS Hallmarked", "Royal Heirloom Finish", "Lifetime Buyback"]
  },
  {
    id: "p6",
    name: "Lakshmi Pendant Set",
    category: "pendant-sets",
    grams: 9.6,
    making_charges: 3400,
    image: "pendant-set",
    tag: "Festive",
    description: "Auspicious Goddess Lakshmi embossed pendant set crafted with fine filigree.",
    features: ["24 Karat / 999 Purity", "BIS Hallmarked", "Spiritual Significance", "Matching Earrings Available"]
  },
  {
    id: "p7",
    name: "Gold Dial Watch",
    category: "watches",
    grams: 18.0,
    making_charges: 7900,
    image: "watch",
    tag: "Luxury",
    description: "Premium quartz movement timepiece featuring solid 24K gold bezel and dial accents.",
    features: ["24K Gold Bezel", "Sapphire Crystal Glass", "Water Resistant 3ATM", "Swiss Movement"]
  },
  {
    id: "p8",
    name: "Tanmaniya Mangalsutra",
    category: "necklaces",
    grams: 7.1,
    making_charges: 2300,
    image: "tanmaniya",
    tag: "Classic",
    description: "Traditional black bead and 24K pure gold tanmaniya with sacred craftsmanship.",
    features: ["24 Karat / 999 Purity", "BIS Hallmarked", "Reinforced Stringing", "Festive Favorite"]
  }
];

function getStored<T>(key: string, fallback: T): T {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const v = window.localStorage.getItem("vaultra_mock_" + key);
      if (v) return JSON.parse(v);
    }
  } catch {}
  return fallback;
}

function setStored<T>(key: string, val: T): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("vaultra_mock_" + key, JSON.stringify(val));
    }
  } catch {}
}

let currentUser: MockUser = getStored("user", DEFAULT_USER);
let transactions: any[] = getStored("txns", [
  { id: "tx_01", type: "buy", metal: "gold", grams: 2.5, amount: 18213.75, status: "completed", created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: "tx_02", type: "buy", metal: "silver", grams: 50.0, amount: 4625.00, status: "completed", created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: "tx_03", type: "sip", metal: "gold", grams: 0.1372, amount: 1000.00, status: "completed", created_at: new Date(Date.now() - 1 * 86400000).toISOString() },
]);
let alertsList: any[] = getStored("alerts", [
  { id: "alt_1", target: 7300, tenant: "vaultra", status: "active", created_at: new Date().toISOString(), triggered_at: null, triggered_price: null }
]);
let notificationsList: any[] = getStored("notifs", [
  { id: "notif_1", title: "Gold Rate Alert 🚀", message: "24K Gold crossed ₹7,285/gm. Great time to invest!", type: "price", read: false, created_at: new Date(Date.now() - 10 * 60000).toISOString() },
  { id: "notif_2", title: "Referral Bonus Credited", message: "₹50 added to your referral balance for inviting Rahul.", type: "referral", read: false, created_at: new Date(Date.now() - 120 * 60000).toISOString() },
  { id: "notif_3", title: "Welcome to Vaultra DigiGold", message: "Your digital gold vault is now active with 100% insured safety.", type: "gift", read: true, created_at: new Date(Date.now() - 86400000).toISOString() }
]);
let sipsList: any[] = getStored("sips", [
  { id: "sip_1", frequency: "daily", amount: 100, active: true, next_run: new Date(Date.now() + 86400000).toISOString() }
]);
let goalsList: any[] = getStored("goals", [
  { id: "goal_1", name: "Diwali Gold Coin", target_grams: 10.0, current_grams: 8.452, created_at: new Date().toISOString() }
]);
let giftsList: any[] = getStored("gifts", [
  { id: "gift_1", recipient_phone: "9811122233", recipient_name: "Rahul", grams: 0.5, amount: 3642.75, message: "Happy Birthday!", status: "delivered", created_at: new Date().toISOString() }
]);

export async function handleMockApi(path: string, method: string = "GET", body?: any): Promise<any> {
  // Realistic tiny network response time (40ms)
  await new Promise((r) => setTimeout(r, 40));

  // --- Price ---
  if (path === "/price" || path.startsWith("/price?") || path === "/price/live") {
    return {
      buy: 7285.50,
      sell: 7066.94,
      change: 42.10,
      change_pct: 0.58,
      direction: "up",
      updated_at: new Date().toISOString(),
      silver: {
        buy: 92.50,
        sell: 89.72,
        change: 0.85,
        change_pct: 0.92,
        direction: "up"
      }
    };
  }

  // --- Products ---
  if (path === "/products") {
    return PRODUCTS_DATA;
  }

  if (path.startsWith("/products/")) {
    const pid = path.replace("/products/", "").split("?")[0];
    const found = PRODUCTS_DATA.find((p) => p.id === pid) || PRODUCTS_DATA[0];
    const liveRate = 7285.50;
    const goldValue = Math.round(found.grams * liveRate * 100) / 100;
    const totalPrice = Math.round(goldValue + found.making_charges);
    return {
      ...found,
      live_rate: liveRate,
      gold_value: goldValue,
      total_price: totalPrice,
    };
  }

  // --- Quotes ---
  if (path === "/quote") {
    const rate = 7285.50;
    const grossRate = Math.round(rate * 1.03 * 100) / 100;
    let rupees = body?.rupees;
    let grams = body?.grams;
    if (rupees) {
      const net = rupees / 1.03;
      grams = Math.round((net / rate) * 10000) / 10000;
    } else if (grams) {
      const net = grams * rate;
      rupees = Math.round(net * 1.03);
    } else {
      rupees = 1000;
      grams = 0.1332;
    }
    const gst = Math.round((rupees - rupees / 1.03) * 100) / 100;
    return {
      id: "quote_" + Math.random().toString(36).substring(7),
      rate,
      buy: rate,
      sell: 7066.94,
      gross_rate: grossRate,
      rupees,
      grams,
      gst,
      base_amount: Math.round((rupees - gst) * 100) / 100,
      lock_seconds: 300,
      expires_at: new Date(Date.now() + 300000).toISOString()
    };
  }

  if (path === "/quote/silver") {
    const rate = 92.50;
    let rupees = body?.rupees || 500;
    let grams = body?.grams || Math.round((rupees / 1.03 / rate) * 10000) / 10000;
    return {
      id: "quote_s_" + Math.random().toString(36).substring(7),
      rate,
      buy: rate,
      sell: 89.72,
      gross_rate: 95.28,
      rupees,
      grams,
      gst: Math.round(rupees * 0.03),
      lock_seconds: 300,
      expires_at: new Date(Date.now() + 300000).toISOString()
    };
  }

  // --- Auth & User ---
  if (path === "/auth/otp/request") {
    const cid = "chal_" + Date.now();
    return {
      challenge_id: cid,
      demo_otp: "123456",
      expires_in: 300,
      is_new_user: false,
      success: true,
      message: "Demo OTP is 123456"
    };
  }

  if (path === "/auth/otp/verify") {
    const phone = body?.phone || currentUser.phone || "9876543210";
    const fname = (body?.first_name || currentUser.first_name || "Priya").trim();
    const lname = (body?.last_name || currentUser.last_name || "Sharma").trim();
    const full = `${fname} ${lname}`.trim();
    currentUser = {
      ...currentUser,
      phone,
      first_name: fname,
      last_name: lname,
      name: full,
      email: body?.email || currentUser.email,
      dob: body?.dob || currentUser.dob,
      gender: body?.gender || currentUser.gender,
      referral_code: currentUser.referral_code || "VAULTRA999",
    };
    setStored("user", currentUser);
    return {
      access_token: "demo_jwt_token_vaultra_live",
      token: "demo_jwt_token_vaultra_live",
      user: currentUser,
    };
  }

  if (path === "/me") {
    if (method === "PATCH") {
      currentUser = { ...currentUser, ...body };
      setStored("user", currentUser);
      return currentUser;
    }
    return currentUser;
  }

  // --- Vault ---
  if (path.startsWith("/vault")) {
    const buyRate = 7285.50;
    const sellRate = 7066.94;
    const goldVal = currentUser.gold_grams * buyRate;
    const silverVal = (currentUser.silver_grams || 0) * 92.50;
    const totalVal = goldVal + silverVal;
    return {
      user: currentUser,
      buy_rate: buyRate,
      sell_rate: sellRate,
      current_value: Math.round(totalVal),
      unrealized_pnl: 2850.50,
      unrealized_pct: 4.25,
      pending_pickups: []
    };
  }

  // --- Orders ---
  if (path === "/orders/buy") {
    const grams = body?.grams || 0.1332;
    const rupees = body?.rupees || 1000;
    currentUser.gold_grams = Math.round((currentUser.gold_grams + grams) * 10000) / 10000;
    currentUser.invested = Math.round(currentUser.invested + rupees);
    setStored("user", currentUser);
    const newTx = {
      id: "ord_" + Date.now(),
      type: "buy",
      metal: "gold",
      grams,
      amount: rupees,
      status: "completed",
      created_at: new Date().toISOString()
    };
    transactions = [newTx, ...transactions];
    setStored("txns", transactions);
    return { order_id: newTx.id, status: "paid", grams, amount: rupees };
  }

  if (path === "/orders/buy-silver") {
    const grams = body?.grams || 5.0;
    const rupees = body?.rupees || 500;
    currentUser.silver_grams = Math.round((currentUser.silver_grams + grams) * 10000) / 10000;
    currentUser.invested = Math.round(currentUser.invested + rupees);
    setStored("user", currentUser);
    const newTx = {
      id: "ord_s_" + Date.now(),
      type: "buy",
      metal: "silver",
      grams,
      amount: rupees,
      status: "completed",
      created_at: new Date().toISOString()
    };
    transactions = [newTx, ...transactions];
    setStored("txns", transactions);
    return { order_id: newTx.id, status: "paid", grams, amount: rupees };
  }

  if (path.startsWith("/orders/") && path.endsWith("/mock-confirm")) {
    const oid = path.split("/")[2];
    const newTx = {
      id: "tx_" + Date.now(),
      type: "buy",
      metal: "gold",
      grams: 0.2745,
      amount: 2000,
      status: "completed",
      created_at: new Date().toISOString()
    };
    currentUser.gold_grams = Math.round((currentUser.gold_grams + 0.2745) * 10000) / 10000;
    currentUser.invested = Math.round(currentUser.invested + 2000);
    setStored("user", currentUser);
    transactions = [newTx, ...transactions];
    setStored("txns", transactions);
    return { order_id: oid, status: "paid", transaction: newTx };
  }

  if (path.startsWith("/orders/")) {
    const oid = path.replace("/orders/", "");
    return {
      order: { id: oid, status: "paid", grams: 1.0, amount: 7500 },
      order_id: oid,
      status: "paid",
      created_at: new Date().toISOString()
    };
  }

  if (path === "/sell") {
    const grams = body?.grams || 1.0;
    const amt = Math.round(grams * 7066.94);
    currentUser.gold_grams = Math.max(0, Math.round((currentUser.gold_grams - grams) * 10000) / 10000);
    currentUser.wallet_balance = (currentUser.wallet_balance || 0) + amt;
    setStored("user", currentUser);
    const newTx = {
      id: "tx_sell_" + Date.now(),
      type: "sell",
      metal: "gold",
      grams,
      amount: amt,
      status: "completed",
      created_at: new Date().toISOString()
    };
    transactions = [newTx, ...transactions];
    setStored("txns", transactions);
    return { success: true, credited_amount: amt, remaining_grams: currentUser.gold_grams };
  }

  if (path === "/redeem") {
    const grams = body?.grams || 1.0;
    currentUser.gold_grams = Math.max(0, Math.round((currentUser.gold_grams - grams) * 10000) / 10000);
    setStored("user", currentUser);
    const newTx = {
      id: "tx_rdm_" + Date.now(),
      type: "redemption",
      metal: "gold",
      grams,
      amount: 0,
      status: "processing",
      created_at: new Date().toISOString()
    };
    transactions = [newTx, ...transactions];
    setStored("txns", transactions);
    return { success: true, order_id: newTx.id, status: "processing", message: "Redemption order placed successfully!" };
  }

  if (path.startsWith("/transactions")) {
    return transactions;
  }

  // --- Referral ---
  if (path === "/referral") {
    return {
      referral_code: currentUser.referral_code || "VAULTRA999",
      referral_balance: currentUser.referral_balance || 250,
      referral_count: 5,
      referrals: [
        { name: "Rahul Verma", reward: 50, date: "Yesterday", joined: new Date(Date.now() - 86400000).toISOString() },
        { name: "Pooja Patel", reward: 50, date: "3 days ago", joined: new Date(Date.now() - 3 * 86400000).toISOString() },
        { name: "Amit Kumar", reward: 50, date: "Last week", joined: new Date(Date.now() - 7 * 86400000).toISOString() },
        { name: "Sneha Nair", reward: 50, date: "2 weeks ago", joined: new Date(Date.now() - 14 * 86400000).toISOString() },
        { name: "Vikas Joshi", reward: 50, date: "3 weeks ago", joined: new Date(Date.now() - 21 * 86400000).toISOString() }
      ]
    };
  }

  // --- Notifications ---
  if (path === "/notifications") {
    const unread = notificationsList.filter((n) => !n.read).length;
    return { notifications: notificationsList, unread_count: unread };
  }

  if (path === "/notifications/mark-read") {
    notificationsList = notificationsList.map((n) => ({ ...n, read: true }));
    setStored("notifs", notificationsList);
    return { success: true, unread_count: 0 };
  }

  // --- Alerts ---
  if (path === "/alerts") {
    if (method === "POST") {
      const newAlert = {
        id: "alt_" + Date.now(),
        target: body?.target || 7400,
        tenant: "vaultra",
        status: "active",
        created_at: new Date().toISOString(),
        triggered_at: null,
        triggered_price: null
      };
      alertsList = [newAlert, ...alertsList];
      setStored("alerts", alertsList);
      return newAlert;
    }
    return alertsList;
  }

  if (path.startsWith("/alerts/") && method === "DELETE") {
    const aid = path.replace("/alerts/", "");
    alertsList = alertsList.filter((a) => a.id !== aid);
    setStored("alerts", alertsList);
    return { success: true };
  }

  if (path.startsWith("/alerts/") && path.endsWith("/trigger")) {
    return { success: true };
  }

  if (path === "/alerts/book") {
    return { success: true, booked: true };
  }

  // --- SIPs ---
  if (path === "/sips") {
    if (method === "POST") {
      const newSip = {
        id: "sip_" + Date.now(),
        frequency: body?.frequency || "daily",
        amount: body?.amount || 100,
        active: true,
        next_run: new Date(Date.now() + 86400000).toISOString()
      };
      sipsList = [newSip, ...sipsList];
      setStored("sips", sipsList);
      return newSip;
    }
    return sipsList;
  }

  if (path.startsWith("/sips/") && path.endsWith("/toggle")) {
    const sid = path.split("/")[2];
    sipsList = sipsList.map((s) => (s.id === sid ? { ...s, active: !s.active } : s));
    setStored("sips", sipsList);
    return { success: true };
  }

  if (path.startsWith("/sips/") && method === "DELETE") {
    const sid = path.replace("/sips/", "");
    sipsList = sipsList.filter((s) => s.id !== sid);
    setStored("sips", sipsList);
    return { success: true };
  }

  // --- Goals ---
  if (path === "/goals") {
    if (method === "POST") {
      const newGoal = {
        id: "goal_" + Date.now(),
        name: body?.name || "Gold Savings",
        target_grams: body?.target_grams || 5.0,
        current_grams: currentUser.gold_grams,
        created_at: new Date().toISOString()
      };
      goalsList = [newGoal, ...goalsList];
      setStored("goals", goalsList);
      return newGoal;
    }
    return goalsList;
  }

  if (path.startsWith("/goals/") && method === "DELETE") {
    const gid = path.replace("/goals/", "");
    goalsList = goalsList.filter((g) => g.id !== gid);
    setStored("goals", goalsList);
    return { success: true };
  }

  // --- Gifts ---
  if (path === "/gifts") {
    if (method === "POST") {
      const newGift = {
        id: "gift_" + Date.now(),
        recipient_phone: body?.recipient_phone || "9876543210",
        recipient_name: body?.recipient_name || "Friend",
        grams: body?.grams || 0.5,
        amount: body?.amount || 3642.75,
        message: body?.message || "Warm Wishes!",
        status: "delivered",
        created_at: new Date().toISOString()
      };
      giftsList = [newGift, ...giftsList];
      setStored("gifts", giftsList);
      return newGift;
    }
    return giftsList;
  }

  if (path === "/gifts/mark-seen") {
    return { success: true };
  }

  // --- Wallet ---
  if (path === "/wallet") {
    return {
      balance: currentUser.wallet_balance || 15400,
      referral_balance: currentUser.referral_balance || 250,
      transactions: transactions
    };
  }

  if (path === "/wallet/deposit") {
    currentUser.wallet_balance = (currentUser.wallet_balance || 0) + (body?.amount || 1000);
    setStored("user", currentUser);
    return { balance: currentUser.wallet_balance };
  }

  if (path === "/wallet/withdraw") {
    currentUser.wallet_balance = Math.max(0, (currentUser.wallet_balance || 0) - (body?.amount || 1000));
    setStored("user", currentUser);
    return { balance: currentUser.wallet_balance };
  }

  // --- KYC ---
  if (path === "/kyc/submit") {
    currentUser.kyc_status = "approved";
    currentUser.kyc = { ...body, verified: true };
    setStored("user", currentUser);
    return { status: "approved", message: "KYC verified successfully" };
  }

  // --- Tenants ---
  if (path === "/tenants") {
    return [
      { id: "vaultra", name: "Vaultra Gold Bullion", markup: 0.0 },
      { id: "tanishq", name: "Tanishq Partner", markup: 12.40 },
      { id: "malabar", name: "Malabar Partner", markup: 8.75 }
    ];
  }

  // --- Admin Endpoints ---
  if (path.startsWith("/admin/")) {
    if (path === "/admin/login") {
      return { token: "demo_admin_token", staff: { id: "admin_1", name: "Vaultra Admin", role: "manager" } };
    }
    if (path === "/admin/stats") {
      return { total_users: 1248, total_gold_grams: 4850.2, total_revenue: 35400000 };
    }
    if (path === "/admin/customers" || path.startsWith("/admin/customers")) {
      return [
        { id: "c1", name: "Priya Sharma", phone: "9876543210", gold_grams: 8.452, kyc_status: "approved" },
        { id: "c2", name: "Rahul Verma", phone: "9811122334", gold_grams: 3.12, kyc_status: "approved" },
        { id: "c3", name: "Sunil Mehta", phone: "9922233445", gold_grams: 14.8, kyc_status: "pending" }
      ];
    }
    if (path === "/admin/kyc-queue") {
      return [
        { id: "k1", user_id: "c3", name: "Sunil Mehta", phone: "9922233445", pan: "FGHIJ5678K", submitted_at: new Date().toISOString() }
      ];
    }
    if (path === "/admin/kyc-reviewed") {
      return [];
    }
    if (path === "/admin/pickups") {
      return [
        { id: "pk_1", user_name: "Priya Sharma", items: "24K Gold Coin (5g)", scheduled_date: "Tomorrow, 2:00 PM", status: "confirmed" }
      ];
    }
    if (path === "/admin/ledger") {
      return transactions;
    }
    return { ok: true };
  }

  // Fallback generic response
  return { ok: true, message: "Success" };
}
