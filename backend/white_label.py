"""White-label App Studio: theme presets, tenant config.json and App Kit (zip) generation.

Everything a CI/CD pipeline needs to build one jeweller's branded Android/iOS app from the
shared base app lives in the kit produced by `build_app_kit()`.
"""
import io
import json
import re
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT_DIR = Path(__file__).resolve().parent / "fonts"  # GNU FreeSans: has ₹ and → glyphs (Inter does not)

# Five store-safe looks. Each changes colours, card shape and the order of home sections,
# so every jeweller's app looks distinct (helps App Store "4.3 spam" review).
THEME_PRESETS = {
    "royal_gold": {
        "label": "Royal Gold", "primaryColor": "#D4AF37", "secondaryColor": "#8A6E1C", "accentColor": "#111827",
        "backgroundColor": "#FDF8E8", "font": "Inter", "cardRadius": 18,
        "homeLayout": ["prices", "karats", "sip", "banners", "buy", "categories", "trending", "promos"],
    },
    "midnight_luxe": {
        "label": "Midnight Luxe", "primaryColor": "#C9A227", "secondaryColor": "#334155", "accentColor": "#0B1220",
        "backgroundColor": "#F1F3F7", "font": "Inter", "cardRadius": 12,
        "homeLayout": ["prices", "buy", "karats", "banners", "trending", "categories", "sip", "promos"],
    },
    "ivory_classic": {
        "label": "Ivory Classic", "primaryColor": "#A67C2E", "secondaryColor": "#5B4321", "accentColor": "#3A2E1F",
        "backgroundColor": "#FBF7EF", "font": "Inter", "cardRadius": 8,
        "homeLayout": ["banners", "prices", "karats", "buy", "categories", "trending", "sip", "promos"],
    },
    "emerald_heritage": {
        "label": "Emerald Heritage", "primaryColor": "#C8A04A", "secondaryColor": "#0F5132", "accentColor": "#064E3B",
        "backgroundColor": "#F3F8F5", "font": "Inter", "cardRadius": 14,
        "homeLayout": ["prices", "karats", "categories", "buy", "banners", "trending", "sip", "promos"],
    },
    "rose_gold": {
        "label": "Rose Gold", "primaryColor": "#B76E79", "secondaryColor": "#8C4A55", "accentColor": "#3B1F24",
        "backgroundColor": "#FDF4F3", "font": "Inter", "cardRadius": 22,
        "homeLayout": ["prices", "sip", "buy", "karats", "trending", "banners", "categories", "promos"],
    },
}
DEFAULT_PRESET = "royal_gold"

APP_STATUSES = ["details_pending", "theme_selected", "config_ready", "built", "submitted", "live"]
APP_STATUS_LABEL = {"details_pending": "Details pending", "theme_selected": "Theme chosen", "config_ready": "Config ready",
                    "built": "Built", "submitted": "Submitted to store", "live": "Live"}


def preset(key):
    return THEME_PRESETS.get(key or "", THEME_PRESETS[DEFAULT_PRESET])


def slugify(s, sep=""):
    return re.sub(r"[^a-z0-9]+", sep, (s or "").lower()).strip(sep) or "jeweller"


def default_bundle_id(business_name):
    # Reverse-DNS id, letters/digits only per segment, must not start with a digit
    seg = slugify(business_name)[:24]
    if seg[0].isdigit():
        seg = "j" + seg
    return f"in.{seg}.gold"


def valid_bundle_id(b):
    return bool(re.fullmatch(r"[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}", b or ""))


def default_store_text(j):
    name = j.app_name or f"{j.business_name} Gold"
    city = f" in {j.city}" if j.city else ""
    short = f"Buy 24K digital gold & silver from {j.business_name} starting ₹10."[:80]
    long = (
        f"{name} is the official app of {j.business_name}{city}.\n\n"
        "• Buy 24K 99.9% pure digital gold and 999 silver at live market rates\n"
        "• Every gram is backed by physical metal held in insured vaults\n"
        "• Start an Auto SIP from ₹100 and grow your savings in gold\n"
        "• Redeem as coins or jewellery at our store\n"
        "• Live 24K, 22K and 18K rates for jewellery shopping\n"
        "• Secure OTP login, KYC verified and tax invoices for every purchase\n\n"
        f"Visit {j.business_name} or contact us at {j.phone} for any help."
    )
    keywords = "digital gold,gold savings,buy gold,gold SIP,silver,jewellery," + slugify(j.business_name, " ")
    return short, long, keywords[:100]


def tenant_config(j, api_base):
    p = preset(j.theme_preset)
    short, long, kw = default_store_text(j)
    bundle = j.bundle_id or default_bundle_id(j.business_name)
    name = j.app_name or f"{j.business_name} Gold"
    return {
        "tenantId": j.id,
        "appName": name,
        "slug": slugify(name, "-"),
        "bundleId": bundle,
        "packageName": bundle,
        "version": j.app_version or "1.0.0",
        "apiBaseUrl": api_base,
        "theme": {"preset": j.theme_preset or DEFAULT_PRESET, "primaryColor": p["primaryColor"],
                  "secondaryColor": p["secondaryColor"], "accentColor": p["accentColor"],
                  "backgroundColor": p["backgroundColor"], "font": p["font"], "cardRadius": p["cardRadius"]},
        "homeLayout": p["homeLayout"],
        "assets": {"logoUrl": abs_url(j.logo_url, api_base), "splashUrl": abs_url(j.splash_url, api_base),
                   "icon": "assets/icon.png", "adaptiveIcon": "assets/adaptive-icon.png", "splash": "assets/splash.png"},
        "support": {"phone": j.phone, "email": j.support_email or j.email},
        "store": {"shortDescription": j.store_short or short, "longDescription": j.store_long or long,
                  "keywords": j.store_keywords or kw,
                  "privacyPolicyUrl": f"{api_base}/api/tenant/{j.id}/privacy",
                  "termsUrl": f"{api_base}/api/tenant/{j.id}/terms"},
    }


def abs_url(u, base):
    if not u:
        return ""
    return base + u if u.startswith("/") else u


# ── image generation ─────────────────────────────────────────────────────────
def _font(size, weight=700):
    try:
        return ImageFont.truetype(str(FONT_DIR / ("FreeSansBold.ttf" if weight >= 600 else "FreeSans.ttf")), size)
    except OSError:
        return ImageFont.load_default()


def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _gradient(w, h, c1, c2):
    a, b = _rgb(c1), _rgb(c2)
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        d.line([(0, y), (w, y)], fill=tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)))
    return img


def _initials(name):
    words = [w for w in re.split(r"\s+", name or "") if w and w[0].isalnum()]
    return "".join(w[0] for w in words[:2]).upper() or "G"


def _center_text(d, box_w, y, text, font, fill):
    w = d.textlength(text, font=font)
    d.text(((box_w - w) / 2, y), text, font=font, fill=fill)


def _paste_logo(canvas, logo, size, center):
    lg = logo.convert("RGBA")
    lg.thumbnail((size, size))
    canvas.paste(lg, (int(center[0] - lg.width / 2), int(center[1] - lg.height / 2)), lg)


def make_icon(name, p, logo=None, transparent=False):
    s = 1024
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0)) if transparent else _gradient(s, s, p["primaryColor"], p["secondaryColor"]).convert("RGBA")
    if logo:
        _paste_logo(img, logo, 560 if not transparent else 480, (s / 2, s / 2))
    else:
        d = ImageDraw.Draw(img)
        f = _font(420 if not transparent else 340)
        txt = _initials(name)
        w = d.textlength(txt, font=f)
        d.text(((s - w) / 2, s / 2 - 260 if not transparent else s / 2 - 210), txt, font=f,
               fill=(255, 255, 255) if not transparent else _rgb(p["secondaryColor"]))
    out = io.BytesIO()
    (img if transparent else img.convert("RGB")).save(out, "PNG")
    return out.getvalue()


def make_splash(name, p, logo=None):
    w, h = 1284, 2778
    img = Image.new("RGB", (w, h), _rgb(p["accentColor"]))
    d = ImageDraw.Draw(img)
    if logo:
        rgba = img.convert("RGBA")
        _paste_logo(rgba, logo, 520, (w / 2, h / 2 - 120))
        img = rgba.convert("RGB")
        d = ImageDraw.Draw(img)
    else:
        f = _font(300)
        _center_text(d, w, h / 2 - 380, _initials(name), f, _rgb(p["primaryColor"]))
    _center_text(d, w, h / 2 + 220, name, _font(84), (255, 255, 255))
    _center_text(d, w, h / 2 + 330, "24K Digital Gold", _font(48, 500), _rgb(p["primaryColor"]))
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


def _inr(n):
    s = f"{n:,.2f}"
    whole, dec = s.split(".")
    digits = whole.replace(",", "")
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        head = ",".join([head[max(i - 2, 0):i] for i in range(len(head), 0, -2)][::-1])
        whole = head + "," + tail
    return f"₹{whole}.{dec}"


def make_screenshot(kind, name, p, rates, logo=None):
    """Store-size (1290x2796, iPhone 6.7") screenshot drawn in the chosen theme."""
    W, H = 1290, 2796
    img = Image.new("RGB", (W, H), _rgb(p["backgroundColor"]))
    d = ImageDraw.Draw(img)
    pri, sec, acc = _rgb(p["primaryColor"]), _rgb(p["secondaryColor"]), _rgb(p["accentColor"])
    r = p["cardRadius"] * 3
    # marketing headline band
    head = {"home": ("Live gold rates", "Buy 24K gold from ₹10"), "rates": ("24K · 22K · 18K", "Today's rates, every second"),
            "vault": ("Your gold vault", "Insured, 99.9% pure, always yours")}[kind]
    band = _gradient(W, 620, p["accentColor"], p["secondaryColor"])
    img.paste(band, (0, 0))
    _center_text(d, W, 200, head[0], _font(96), (255, 255, 255))
    _center_text(d, W, 330, head[1], _font(54, 500), pri)
    # app header
    y = 700
    d.rounded_rectangle([60, y, 180, y + 120], 30, fill=pri)
    d.text((86, y + 22), _initials(name)[:2], font=_font(64), fill=(255, 255, 255))
    d.text((210, y + 30), name[:22], font=_font(64), fill=acc)
    y += 200
    if kind in ("home", "rates"):
        g24 = rates.get("24K", 0)
        if kind == "home":
            cards = [("Gold 24K", g24), ("Silver 999", rates.get("silver", 0))]
            cw = (W - 180) // 2
            for i, (lbl, val) in enumerate(cards):
                x = 60 + i * (cw + 60)
                d.rounded_rectangle([x, y, x + cw, y + 380], r, fill=acc)
                d.text((x + 40, y + 50), "LIVE RATE", font=_font(34, 600), fill=pri)
                d.text((x + 40, y + 120), lbl, font=_font(56), fill=pri if i == 0 else (229, 231, 235))
                d.text((x + 40, y + 220), (_inr(val) if val else "—") + "/g", font=_font(58), fill=(255, 255, 255))
            y += 460
            rows = [("24K · 99.9%", rates.get("24K", 0)), ("22K · 91.6%", rates.get("22K", 0)), ("18K · 75.0%", rates.get("18K", 0))]
        else:
            rows = [("Gold 24K · 99.9%", rates.get("24K", 0)), ("Gold 22K · 91.6%", rates.get("22K", 0)),
                    ("Gold 18K · 75.0%", rates.get("18K", 0)), ("Silver 999", rates.get("silver", 0))]
        d.rounded_rectangle([60, y, W - 60, y + 120 + 150 * len(rows)], r, fill=(255, 255, 255), outline=pri, width=3)
        d.text((110, y + 40), "Today's gold rates", font=_font(52), fill=acc)
        for i, (lbl, val) in enumerate(rows):
            yy = y + 150 + i * 150
            d.text((110, yy), lbl, font=_font(50, 500), fill=sec)
            v = (_inr(val) if val else "—") + "/g"
            d.text((W - 110 - d.textlength(v, font=_font(54)), yy), v, font=_font(54), fill=acc)
        y += 180 + 150 * len(rows)
        d.rounded_rectangle([60, y, W - 60, y + 170], r, fill=pri)
        _center_text(d, W, y + 50, "Buy Gold  →", _font(66), (255, 255, 255))
    else:
        d.rounded_rectangle([60, y, W - 60, y + 560], r, fill=acc)
        d.text((120, y + 70), "Gold balance", font=_font(48, 500), fill=pri)
        d.text((120, y + 160), "12.5000 g", font=_font(120), fill=(255, 255, 255))
        d.text((120, y + 340), "≈ " + (_inr(12.5 * rates.get("24K", 0)) if rates.get("24K") else "—"), font=_font(60, 600), fill=(229, 231, 235))
        y += 640
        for i, (t, s) in enumerate([("Auto SIP", "₹500 every month"), ("Redeem", "Coins & jewellery at store"), ("Live rates", "24K · 22K · 18K every second")]):
            d.rounded_rectangle([60, y, W - 60, y + 220], r, fill=(255, 255, 255), outline=pri, width=3)
            d.ellipse([110, y + 50, 230, y + 170], fill=pri)
            d.text((280, y + 50), t, font=_font(58), fill=acc)
            d.text((280, y + 125), s, font=_font(44, 500), fill=sec)
            y += 260
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


def make_feature_graphic(name, p, logo=None):
    img = _gradient(1024, 500, p["accentColor"], p["secondaryColor"])
    d = ImageDraw.Draw(img)
    d.text((70, 150), name[:26], font=_font(72), fill=(255, 255, 255))
    d.text((70, 260), "24K Digital Gold · Live rates · SIP", font=_font(36, 500), fill=_rgb(p["primaryColor"]))
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


def privacy_html(j, terms=False):
    name = j.app_name or f"{j.business_name} Gold"
    if terms:
        body = (f"<h1>Terms of Use — {name}</h1><p>{name} is operated by {j.business_name}. Digital gold and silver purchases are made at the live "
                "rate shown at the time of purchase, including applicable GST. Purchased metal is held on your behalf and can be redeemed "
                "as coins or jewellery as per the store's redemption policy. Prices change with the market; past rates do not guarantee future rates.</p>"
                f"<p>Contact: {j.phone} · {j.support_email or j.email}</p>")
    else:
        body = (f"<h1>Privacy Policy — {name}</h1><p>{j.business_name} (\"we\") operates the {name} app. We collect your phone number for login, "
                "your name, PAN and address for KYC as required by law, and your transaction history to show your vault and invoices.</p>"
                "<p>We do not sell your data. Data is shared only with payment and KYC partners needed to complete your request, and with "
                "authorities when legally required. Data is encrypted in transit. You may request deletion of your account by contacting us.</p>"
                f"<p>Contact: {j.phone} · {j.support_email or j.email}<br>{j.address or ''} {j.city or ''} {j.pincode or ''}</p>")
    return f"<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>{name}</title><style>body{{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#222}}</style></head><body>{body}</body></html>"


def build_app_kit(j, api_base, rates, logo_bytes=None, splash_bytes=None):
    cfg = tenant_config(j, api_base)
    p = preset(j.theme_preset)
    name = cfg["appName"]
    logo = Image.open(io.BytesIO(logo_bytes)) if logo_bytes else None
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("config.json", json.dumps(cfg, indent=2, ensure_ascii=False))
        z.writestr("assets/icon.png", make_icon(name, p, logo))
        z.writestr("assets/adaptive-icon.png", make_icon(name, p, logo, transparent=True))
        z.writestr("assets/splash.png", splash_bytes or make_splash(name, p, logo))
        if logo_bytes:
            z.writestr("assets/logo-original.png", logo_bytes)
        for i, kind in enumerate(("home", "rates", "vault"), 1):
            z.writestr(f"store/screenshots/{i}-{kind}.png", make_screenshot(kind, name, p, rates, logo))
        z.writestr("store/feature-graphic.png", make_feature_graphic(name, p, logo))
        s = cfg["store"]
        z.writestr("store/listing.md", f"# {name}\n\n**Short description:** {s['shortDescription']}\n\n**Keywords:** {s['keywords']}\n\n"
                   f"**Privacy policy:** {s['privacyPolicyUrl']}\n**Terms:** {s['termsUrl']}\n\n## Full description\n\n{s['longDescription']}\n")
        z.writestr("store/privacy-policy.html", privacy_html(j))
        z.writestr("store/terms.html", privacy_html(j, terms=True))
        z.writestr("README.md", KIT_README.format(name=name, bundle=cfg["bundleId"], tenant=j.id))
    return buf.getvalue(), cfg


KIT_README = """# App Kit — {name}

Tenant ID: `{tenant}` · Bundle / package ID: `{bundle}`

## Inject into the base app (CI/CD)
1. Copy `config.json` to `frontend/tenant.config.json` (replaces the empty base file).
2. Copy `assets/*` to `frontend/tenant-assets/`.
3. Set `EXPO_PUBLIC_BACKEND_URL` to the `apiBaseUrl` in config.json.
4. Run your pipeline's Android (AAB) and iOS (IPA) build. `app.config.js` reads
   tenant.config.json and sets the app name, bundle ID, package, icon and splash automatically.

The app then opens directly into this jeweller's store, sends `X-Tenant-ID: {tenant}` on every
API request, and uses this jeweller's theme, logo and home layout.

## Store submission
- `store/listing.md` — name, short/long description, keywords
- `store/screenshots/` — 1290×2796 (iPhone 6.7") images, also accepted by Google Play
- `store/feature-graphic.png` — Google Play 1024×500
- Privacy policy and terms URLs are hosted by the platform (see listing.md)
"""
