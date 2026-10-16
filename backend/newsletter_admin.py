import asyncio
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from html import escape
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_admin
from database import db
from emailer import send_email, _assert_safe_email

logger = logging.getLogger("newsletter")
router = APIRouter(prefix="/admin/newsletter")

PUBLIC_BASE_URL = os.environ["PUBLIC_BASE_URL"].rstrip("/")
DRY_RUN = os.environ.get("NEWSLETTER_DRY_RUN", "").lower() == "true"
CONFIRM_WORD = "ENVOYER"
IDENTITY = ("La Maison d'Auben — BROU, entrepreneur individuel — 885 Chemin de la Sine, 06140 Vence, France — "
            "SIRET 130 351 562 00017 — lamaisondauben@gmail.com")
_URL = re.compile(r"https://[^\s<>\"']+")
_tasks = set()
_send_lock = asyncio.Lock()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def ineligibility(s: dict):
    if s.get("removed"):
        return "Retiré de la liste"
    if s.get("status") == "unsubscribed":
        return "Désinscrit"
    if s.get("is_test"):
        return "Adresse de test"
    if s.get("consent") is not True or not s.get("consent_at") or not s.get("consent_text_version"):
        return "Consentement non prouvé"
    if not s.get("unsubscribe_token"):
        return "Lien de désinscription manquant"
    return None


def _linkify(text: str) -> str:
    def rep(m):
        url = m.group(0)
        trail = ""
        while url and url[-1] in ".,;:!?)":
            trail, url = url[-1] + trail, url[:-1]
        return f'<a href="{url}" style="color:#3B6B4C">{url}</a>{trail}'
    return _URL.sub(rep, escape(text, quote=False))


def render_body(body: str) -> str:
    out = []
    for block in re.split(r"\n\s*\n", body.strip().replace("\r\n", "\n")):
        lines = [ln.rstrip() for ln in block.split("\n") if ln.strip()]
        groups = []
        for ln in lines:
            is_item = ln.lstrip().startswith("- ")
            if groups and groups[-1][0] == is_item:
                groups[-1][1].append(ln)
            else:
                groups.append((is_item, [ln]))
        for is_item, grp in groups:
            if is_item:
                items = "".join(f'<li style="margin:4px 0">{_linkify(ln.lstrip()[2:])}</li>' for ln in grp)
                out.append(f'<ul style="padding-left:20px;margin:0 0 16px">{items}</ul>')
            else:
                out.append(f'<p style="margin:0 0 16px">{"<br>".join(_linkify(ln) for ln in grp)}</p>')
    return "".join(out)


def newsletter_html(subject: str, body: str, unsubscribe_url: str, consent_date: str = "") -> str:
    since = ""
    if consent_date:
        y, m, d = consent_date[:10].split("-")
        since = f" le {d}/{m}/{y}"
    return (
        '<div style="background:#FAF8F5;padding:32px 16px;font-family:Helvetica,Arial,sans-serif">'
        '<div style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:32px;color:#2C332E;'
        'font-size:15px;line-height:1.65">'
        '<p style="font-family:Georgia,serif;font-size:20px;color:#1E3A2B;margin:0 0 4px">La Maison d\'Auben</p>'
        f'<h1 style="font-family:Georgia,serif;font-size:24px;color:#1E3A2B;margin:16px 0 20px">{escape(subject)}</h1>'
        f'{render_body(body)}'
        '<p style="border-top:1px solid #E2DDD5;margin-top:28px;padding-top:16px;font-size:12px;color:#626D66;line-height:1.6">'
        f'Vous recevez cet e-mail car vous vous êtes inscrit·e à la newsletter de La Maison d\'Auben{since}.<br>'
        f'<a href="{escape(unsubscribe_url)}" style="color:#3B6B4C">Se désinscrire de la newsletter</a><br>'
        f'{escape(IDENTITY)}</p>'
        '</div></div>'
    )


def _unsub_url(token: str) -> str:
    return f"{PUBLIC_BASE_URL}/newsletter/desinscription?token={token}"


class ComposeInput(BaseModel):
    subject: str = Field(min_length=1, max_length=150)
    body: str = Field(min_length=1, max_length=20000)


class SendInput(ComposeInput):
    recipient_ids: List[str] = []
    all_eligible: bool = False
    confirmation: str


class SubscriberPatch(BaseModel):
    is_test: bool


@router.get("")
async def list_subscribers(admin=Depends(get_current_admin)):
    subs = await db.newsletter.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    for s in subs:
        s["status"] = s.get("status", "subscribed")
        s["ineligible_reason"] = ineligibility(s)
        s["eligible"] = s["ineligible_reason"] is None
        if s.get("unsubscribe_token"):
            s["unsubscribe_url"] = _unsub_url(s["unsubscribe_token"])
    return subs


@router.get("/settings")
async def settings(admin=Depends(get_current_admin)):
    return {"dry_run": DRY_RUN, "owner_email_configured": bool(os.environ.get("OWNER_EMAIL")),
            "confirm_word": CONFIRM_WORD}


@router.patch("/{sub_id}")
async def patch_subscriber(sub_id: str, inp: SubscriberPatch, admin=Depends(get_current_admin)):
    res = await db.newsletter.update_one({"id": sub_id}, {"$set": {"is_test": inp.is_test, "updated_at": now_iso()}})
    if not res.matched_count:
        raise HTTPException(404, "Abonné introuvable.")
    return {"ok": True}


@router.delete("/{sub_id}")
async def remove_subscriber(sub_id: str, admin=Depends(get_current_admin)):
    sub = await db.newsletter.find_one({"id": sub_id})
    if not sub:
        raise HTTPException(404, "Abonné introuvable.")
    if not sub.get("removed"):
        await db.newsletter.update_one({"id": sub_id}, {"$set": {"removed": True, "removed_at": now_iso()}})
    return {"ok": True}


@router.post("/preview")
async def preview(inp: ComposeInput, admin=Depends(get_current_admin)):
    html = newsletter_html(inp.subject, inp.body, _unsub_url("apercu"), now_iso())
    try:
        _assert_safe_email(inp.subject, html)
    except ValueError as e:
        raise HTTPException(400, f"Contenu refusé par le contrôle de sécurité des e-mails : {e}")
    return {"html": html}


async def _deliver(to: str, subject: str, html: str):
    _assert_safe_email(subject, html)
    if DRY_RUN:
        return "simulated", None
    msg_id = await send_email(to=to, subject=subject, html=html)
    return ("sent", msg_id) if msg_id else ("failed", None)


@router.post("/test")
async def send_test(inp: ComposeInput, admin=Depends(get_current_admin)):
    owner = os.environ.get("OWNER_EMAIL")
    if not owner:
        raise HTTPException(400, "Adresse vendeur (OWNER_EMAIL) non configurée.")
    html = newsletter_html(inp.subject, inp.body, _unsub_url("exemple-test"), now_iso())
    try:
        status, _ = await _deliver(owner, f"[TEST] {inp.subject}", html)
    except ValueError as e:
        raise HTTPException(400, f"Contenu refusé par le contrôle de sécurité des e-mails : {e}")
    await db.newsletter_campaigns.insert_one({
        "id": str(uuid.uuid4()), "kind": "test", "subject": inp.subject, "body": inp.body,
        "mode": "dry_run" if DRY_RUN else "live", "status": "done", "created_at": now_iso(),
        "finished_at": now_iso(), "created_by": admin["email"],
        "results": [{"email": owner, "status": status, "at": now_iso()}],
        "counts": {status: 1},
    })
    if status == "failed":
        raise HTTPException(502, "L'envoi du test a échoué.")
    return {"status": status}


async def _run_campaign(cid: str, sub_ids: List[str], subject: str, body: str):
    counts = {"sent": 0, "simulated": 0, "failed": 0, "skipped": 0}
    try:
        for sid in sub_ids:
            sub = await db.newsletter.find_one({"id": sid})
            reason = ineligibility(sub) if sub else "Abonné introuvable"
            result = {"subscriber_id": sid, "email": (sub or {}).get("email", ""), "at": now_iso()}
            if reason:
                result.update(status="skipped", reason=reason)
            else:
                html = newsletter_html(subject, body, _unsub_url(sub["unsubscribe_token"]), sub.get("consent_at", ""))
                try:
                    status, msg_id = await _deliver(sub["email"], subject, html)
                except ValueError as e:
                    status, msg_id = "failed", None
                    result["reason"] = str(e)[:200]
                result.update(status=status, message_id=msg_id)
            counts[result["status"]] += 1
            await db.newsletter_campaigns.update_one({"id": cid}, {"$push": {"results": result}, "$set": {"counts": counts}})
        final = "done"
    except Exception as e:
        logger.error(f"Campaign {cid} error: {e}")
        final = "error"
    await db.newsletter_campaigns.update_one({"id": cid}, {"$set": {"status": final, "finished_at": now_iso(), "counts": counts}})


@router.post("/send")
async def send_campaign(inp: SendInput, admin=Depends(get_current_admin)):
    if inp.confirmation != CONFIRM_WORD:
        raise HTTPException(400, f"Confirmation invalide : tapez {CONFIRM_WORD}.")
    async with _send_lock:
        return await _start_campaign(inp, admin)


async def _start_campaign(inp: SendInput, admin: dict):
    if await db.newsletter_campaigns.find_one({"status": "sending"}):
        raise HTTPException(409, "Un envoi est déjà en cours.")
    subs = await db.newsletter.find({}, {"_id": 0}).to_list(5000)
    eligible = [s for s in subs if ineligibility(s) is None]
    if inp.all_eligible:
        targets = [s["id"] for s in eligible]
    else:
        wanted = set(inp.recipient_ids)
        targets = [s["id"] for s in eligible if s["id"] in wanted]
    excluded = len(set(inp.recipient_ids) - set(targets)) if not inp.all_eligible else 0
    if not targets:
        raise HTTPException(400, "Aucun destinataire éligible sélectionné.")
    cid = str(uuid.uuid4())
    await db.newsletter_campaigns.insert_one({
        "id": cid, "kind": "campaign", "subject": inp.subject, "body": inp.body,
        "mode": "dry_run" if DRY_RUN else "live", "status": "sending", "created_at": now_iso(),
        "created_by": admin["email"], "requested": len(targets), "excluded_at_send": excluded,
        "results": [], "counts": {},
    })
    task = asyncio.create_task(_run_campaign(cid, targets, inp.subject, inp.body))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"campaign_id": cid, "recipients": len(targets), "excluded": excluded, "mode": "dry_run" if DRY_RUN else "live"}


@router.get("/campaigns")
async def list_campaigns(admin=Depends(get_current_admin)):
    return await db.newsletter_campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


async def mark_interrupted_campaigns():
    await db.newsletter_campaigns.update_many(
        {"status": "sending"}, {"$set": {"status": "interrupted", "finished_at": now_iso()}})
