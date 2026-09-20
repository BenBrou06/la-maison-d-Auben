import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "La Maison d'Auben")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: str = None):
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        return None


def order_confirmation_html(*, product_name: str, amount: float, currency: str, download_url: str, order_id: str) -> str:
    money = f"{amount:.2f} {currency.upper()}".replace(".", ",")
    return (
        '<table role="presentation" width="100%" style="background:#FAF8F5;padding:32px 0;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td align="center">'
        '<table role="presentation" width="560" style="background:#FFFFFF;border:1px solid #E2DDD5;border-radius:16px;overflow:hidden">'
        '<tr><td style="background:#1E3A2B;padding:28px 32px">'
        '<span style="color:#FAF8F5;font-size:22px;font-weight:bold">La Maison d\'Auben</span><br>'
        '<span style="color:#87A987;font-size:13px">L\'aubaine pour mieux s\'organiser.</span>'
        '</td></tr>'
        '<tr><td style="padding:32px">'
        '<h1 style="color:#1E3A2B;font-size:22px;margin:0 0 12px">Merci pour votre achat 🌿</h1>'
        f'<p style="color:#2C332E;font-size:15px;line-height:1.6">Votre commande <strong>{escape(order_id)}</strong> est confirmée. '
        f'Vous pouvez dès maintenant télécharger votre produit.</p>'
        '<table role="presentation" width="100%" style="background:#EAF0EC;border-radius:12px;margin:20px 0">'
        f'<tr><td style="padding:18px 20px;color:#1E3A2B;font-size:15px"><strong>{escape(product_name)}</strong><br>'
        f'<span style="color:#3B6B4C;font-size:14px">Montant payé : {money}</span></td></tr></table>'
        f'<p style="text-align:center;margin:28px 0"><a href="{escape(download_url)}" '
        'style="background:#1E3A2B;color:#FAF8F5;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;font-weight:bold;display:inline-block">'
        'Télécharger mon produit</a></p>'
        '<p style="color:#626D66;font-size:13px;line-height:1.6">Ce lien de téléchargement est personnel et sécurisé. '
        'Conservez cet e-mail : il vous permet de récupérer votre fichier à tout moment.</p>'
        '<p style="font-size:12px;color:#888;margin-top:24px">Envoyé par La Maison d\'Auben. '
        'Nous ne vous demanderons jamais votre mot de passe ou vos informations bancaires par e-mail.</p>'
        '</td></tr></table></td></tr></table>'
    )
