# Demandes de contact : file d'envoi persistante (notifications), réponses admin, détection des envois bloqués.
import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from html import escape
from typing import Literal
from zoneinfo import ZoneInfo

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from auth import get_current_admin
from database import db
from emailer import _assert_safe_email, send_email_result

logger = logging.getLogger("contact")
router = APIRouter(prefix="/admin/messages")

PUBLIC_BASE_URL = (os.environ.get("PUBLIC_BASE_URL") or "").rstrip("/")
DRY_RUN = (os.environ.get("CONTACT_EMAIL_DRY_RUN", "").lower() == "true"
           and ".preview.emergentagent.com" in PUBLIC_BASE_URL)
SEND_TIMEOUT = int(os.environ.get("CONTACT_SEND_TIMEOUT_SECONDS") or 300)
NOTICE_VERSION = "contact-mention-v1"
JOBS = ("owner_notification", "confirmation")
MAX_AUTO_ATTEMPTS = 3
BACKOFF = (60, 300)
WORKER_EVERY = 20
PARIS = ZoneInfo("Europe/Paris")
MARK_FAIL, MARK_REFUSE, MARK_SLOW = "[SIMULER-ECHEC]", "[SIMULER-REFUS]", "[SIMULER-LENT]"
ERR_LABEL = {
    "temporary": "Erreur temporaire du fournisseur e-mail",
    "refused": "Refusé par le fournisseur e-mail",
    "refused_local": "Refusé par le filtre de sécurité des e-mails du site",
}
_tasks = set()


def now():
    return datetime.now(timezone.utc)


def iso(dt=None):
    return (dt or now()).isoformat()


def fr_date(s: str) -> str:
    return datetime.fromisoformat(s).astimezone(PARIS).strftime("%d/%m/%Y à %H:%M")


def _text(v: str) -> str:
    return escape(v or "").replace("\n", "<br>")


# ---------- Modèles d'e-mails ----------
def _layout(tagline: str, inner: str) -> str:
    return (
        '<table role="presentation" width="100%" style="background:#FAF8F5;padding:32px 0;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td align="center">'
        '<table role="presentation" width="560" style="background:#FFFFFF;border:1px solid #E2DDD5;border-radius:16px;overflow:hidden">'
        '<tr><td style="background:#1E3A2B;padding:26px 32px">'
        '<span style="color:#FAF8F5;font-size:22px;font-weight:bold">La Maison d\'Auben</span><br>'
        f'<span style="color:#87A987;font-size:13px">{escape(tagline)}</span></td></tr>'
        f'<tr><td style="padding:30px 32px;color:#2C332E;font-size:15px;line-height:1.6">{inner}'
        '<p style="font-size:12px;color:#888;margin-top:26px">Envoyé par La Maison d\'Auben. '
        'Nous ne vous demanderons jamais votre mot de passe ou vos informations bancaires par e-mail.</p>'
        '</td></tr></table></td></tr></table>'
    )


def owner_notification_html(m: dict, with_content: bool = True) -> str:
    rows = [("Nom", m["name"]), ("E-mail", m["email"])]
    if with_content:
        rows.append(("Sujet", m.get("subject") or "(sans objet)"))
    rows.append(("Reçu le", fr_date(m["created_at"])))
    table = "".join(f'<tr><td style="padding:6px 0;color:#626D66;vertical-align:top;width:120px">{k}</td>'
                    f'<td style="padding:6px 0">{_text(v)}</td></tr>' for k, v in rows)
    body = (f'<div style="background:#F2EDE4;border-radius:12px;padding:16px 18px;margin:18px 0">{_text(m["message"])}</div>'
            if with_content else
            '<p style="background:#FCEFD9;border-radius:12px;padding:14px 16px;margin:18px 0;color:#8A5A12">'
            'Le sujet et le contenu de ce message n\'ont pas pu être inclus dans cet e-mail (filtre de sécurité). '
            'Ils sont conservés intégralement dans le tableau de bord.</p>')
    return _layout("Nouveau message", (
        '<h1 style="color:#1E3A2B;font-size:20px;margin:0 0 14px">Nouveau message reçu</h1>'
        f'<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">{table}</table>{body}'
        f'<p style="font-size:14px">Consultez l\'onglet « Messages » du <a href="{escape(PUBLIC_BASE_URL + "/admin")}" '
        'style="color:#3B6B4C">tableau de bord administrateur</a> pour répondre.</p>'
    ))


def confirmation_html(m: dict, with_subject: bool = True) -> str:
    subj = (f'<p>Objet de votre demande : <strong>{_text(m["subject"])}</strong></p>'
            if with_subject and m.get("subject") else "")
    return _layout("L'aubaine pour mieux s'organiser.", (
        f'<h1 style="color:#1E3A2B;font-size:20px;margin:0 0 14px">Merci pour votre message, {_text(m["name"])}</h1>'
        f'<p>Nous avons bien reçu votre message le {fr_date(m["created_at"])}.</p>{subj}'
        '<p>L\'équipe de La Maison d\'Auben va l\'étudier et vous répondra par e-mail à cette adresse.</p>'
        '<p style="color:#626D66;font-size:13px">Vous recevez cet e-mail parce que vous nous avez écrit via le formulaire '
        'de contact. Vos coordonnées servent uniquement à traiter cette demande : ce n\'est pas une inscription à notre newsletter.</p>'
    ))


def reply_html(m: dict, body: str) -> str:
    subj = (" — « " + _text(m["subject"]) + " »") if m.get("subject") else ""
    return _layout("Réponse à votre message", (
        f'<p>Bonjour {_text(m["name"])},</p>'
        f'<div style="margin:16px 0">{_text(body)}</div>'
        '<p>L\'équipe de La Maison d\'Auben</p>'
        f'<p style="color:#626D66;font-size:13px;border-top:1px solid #E2DDD5;padding-top:14px">En réponse à votre message du '
        f'{fr_date(m["created_at"])}{subj}. Vous pouvez répondre directement à cet e-mail.</p>'
    ))


# ---------- Envoi ----------
async def deliver(*, to: str, subject: str, html: str, reply_to: str = None) -> dict:
    if DRY_RUN:
        try:
            _assert_safe_email(subject, html)
        except ValueError as e:
            return {"id": None, "kind": "refused_local", "error": str(e)}
        if MARK_SLOW in html:
            await asyncio.sleep(30)
        if MARK_FAIL in html:
            return {"id": None, "kind": "temporary", "error": "Échec simulé (fournisseur indisponible)."}
        if MARK_REFUSE in html:
            return {"id": None, "kind": "refused", "error": "Refus simulé du fournisseur."}
        logger.info(f"[SIMULATION] e-mail non envoyé : {subject!r}")
        return {"id": f"simulated-{uuid.uuid4().hex[:12]}"}
    try:
        return await send_email_result(to=to, subject=subject, html=html, reply_to=reply_to)
    except Exception as e:
        logger.error(f"Contact e-mail : erreur inattendue ({type(e).__name__})")
        return {"id": None, "kind": "temporary", "error": type(e).__name__}


async def _deliver_job(kind: str, m: dict) -> dict:
    owner = os.environ.get("OWNER_EMAIL")
    if kind == "owner_notification":
        if not owner:
            return {"id": None, "kind": "refused", "error": "OWNER_EMAIL non configurée."}
        subject = "Nouveau message reçu — La Maison d'Auben"
        r = await deliver(to=owner, subject=subject, html=owner_notification_html(m))
        if r.get("kind") == "refused_local":
            r2 = await deliver(to=owner, subject=subject, html=owner_notification_html(m, with_content=False))
            return {**r2, "content_omitted": True, "first_error": r["error"]} if r2.get("id") else r2
        return r
    subject = "Nous avons bien reçu votre message — La Maison d'Auben"
    r = await deliver(to=m["email"], subject=subject, html=confirmation_html(m), reply_to=owner)
    if r.get("kind") == "refused_local" and m.get("subject"):
        r2 = await deliver(to=m["email"], subject=subject, html=confirmation_html(m, with_subject=False), reply_to=owner)
        return {**r2, "content_omitted": True, "first_error": r["error"]} if r2.get("id") else r2
    return r


async def run_job(mid: str, kind: str) -> None:
    t = iso()
    m = await db.contact_messages.find_one_and_update(
        {"id": mid, f"{kind}.status": "pending", f"{kind}.next_at": {"$lte": t}},
        {"$set": {f"{kind}.status": "sending", f"{kind}.started_at": t}, "$inc": {f"{kind}.attempts": 1}},
        projection={"_id": 0}, return_document=True)
    if not m:
        return
    r = await _deliver_job(kind, m)
    job = m[kind]
    if r.get("id"):
        upd = {"status": "sent", "email_id": r["id"], "sent_at": iso(), "error": None, "error_kind": None,
               "simulated": DRY_RUN, "content_omitted": bool(r.get("content_omitted")), "first_error": r.get("first_error")}
    elif r["kind"] == "temporary" and job["attempts"] < MAX_AUTO_ATTEMPTS:
        upd = {"status": "pending", "error": r["error"], "error_kind": r["kind"],
               "next_at": iso(now() + timedelta(seconds=BACKOFF[job["attempts"] - 1]))}
    else:
        upd = {"status": "failed", "error": r["error"], "error_kind": r["kind"], "failed_at": iso()}
        logger.error(f"Contact {mid} : {kind} en échec ({r['kind']}: {r['error']})")
    await db.contact_messages.update_one({"id": mid, f"{kind}.status": "sending"},
                                         {"$set": {f"{kind}.{k}": v for k, v in upd.items()}})


async def process_message(mid: str) -> None:
    for kind in JOBS:
        try:
            await run_job(mid, kind)
        except Exception as e:
            logger.error(f"Contact {mid} : {kind} interrompu ({type(e).__name__})")


def schedule(mid: str) -> None:
    t = asyncio.create_task(process_message(mid))
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)


def new_job() -> dict:
    return {"status": "pending", "attempts": 0, "next_at": iso()}


async def mark_stuck() -> int:
    cutoff = iso(now() - timedelta(seconds=SEND_TIMEOUT))
    n = 0
    for kind in JOBS:
        r = await db.contact_messages.update_many(
            {f"{kind}.status": "sending", f"{kind}.started_at": {"$lt": cutoff}},
            {"$set": {f"{kind}.status": "uncertain", f"{kind}.uncertain_at": iso()}})
        n += r.modified_count
    r = await db.contact_messages.update_many(
        {"replies": {"$elemMatch": {"status": "sending", "started_at": {"$lt": cutoff}}}},
        {"$set": {"replies.$[x].status": "uncertain", "replies.$[x].uncertain_at": iso()}},
        array_filters=[{"x.status": "sending", "x.started_at": {"$lt": cutoff}}])
    n += r.modified_count
    if n:
        logger.warning(f"Contact : {n} envoi(s) bloqué(s) passé(s) en « incertain »")
    return n


async def worker_tick() -> None:
    await mark_stuck()
    t = iso()
    q = {"$or": [{f"{k}.status": "pending", f"{k}.next_at": {"$lte": t}} for k in JOBS]}
    async for m in db.contact_messages.find(q, {"_id": 0, "id": 1}).limit(50):
        await process_message(m["id"])


async def _worker():
    while True:
        try:
            await worker_tick()
        except Exception as e:
            logger.error(f"Contact worker : {type(e).__name__}")
        await asyncio.sleep(WORKER_EVERY)


def start_worker() -> None:
    t = asyncio.create_task(_worker())
    _tasks.add(t)


# ---------- Routes admin ----------
class ReplyInput(BaseModel):
    request_id: str = Field(min_length=8, max_length=64)
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10000)

    @field_validator("subject", "body")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Champ obligatoire.")
        return v.strip()


class RetryInput(BaseModel):
    request_id: str = Field(min_length=8, max_length=64)
    confirm_duplicate_risk: bool = False


class StatusInput(BaseModel):
    status: Literal["new", "handled"]


async def _get(mid: str) -> dict:
    m = await db.contact_messages.find_one({"id": mid}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Message introuvable.")
    return m


def _fail_detail(r: dict) -> str:
    hint = {"temporary": " Vous pourrez réessayer.",
            "refused": " Le fournisseur a refusé cet e-mail.",
            "refused_local": " Reformulez la réponse (évitez notamment les demandes de mot de passe, de code ou de données bancaires, et les liens non https)."}
    return f"La réponse n'a pas été envoyée : {ERR_LABEL[r['kind']]} ({r['error']}).{hint[r['kind']]}"


async def _send_reply(m: dict, subject: str, body: str, request_id: str, retry_of: str = None) -> dict:
    try:
        validate_email(m["email"], check_deliverability=False)
    except EmailNotValidError:
        raise HTTPException(400, "L'adresse e-mail du client n'est pas valide : aucune réponse ne peut être envoyée.")
    cutoff = iso(now() - timedelta(seconds=SEND_TIMEOUT))
    rid = str(uuid.uuid4())
    entry = {"id": rid, "request_id": request_id, "subject": subject, "body": body, "status": "sending",
             "created_at": iso(), "started_at": iso(), "retry_of": retry_of}
    res = await db.contact_messages.update_one(
        {"id": m["id"], "replies.request_id": {"$ne": request_id},
         "replies": {"$not": {"$elemMatch": {"status": "sending", "started_at": {"$gte": cutoff}}}}},
        {"$push": {"replies": entry}})
    if not res.modified_count:
        raise HTTPException(409, "Un envoi est déjà en cours pour ce message ou cette réponse a déjà été traitée.")
    r = await deliver(to=m["email"], subject=subject, html=reply_html(m, body), reply_to=os.environ.get("OWNER_EMAIL"))
    if r.get("id"):
        done = {"status": "sent", "email_id": r["id"], "sent_at": iso(), "simulated": DRY_RUN}
    else:
        done = {"status": "failed", "error": r["error"], "error_kind": r["kind"], "failed_at": iso()}
    upd = {f"replies.$.{k}": v for k, v in done.items()}
    if r.get("id"):
        upd["status"] = "answered"
    await db.contact_messages.update_one({"id": m["id"], "replies": {"$elemMatch": {"id": rid, "status": "sending"}}},
                                         {"$set": upd})
    if not r.get("id"):
        logger.error(f"Réponse au message {m['id']} en échec ({r['kind']})")
        raise HTTPException(424, _fail_detail(r))
    return {"ok": True, "email_id": r["id"], "simulated": DRY_RUN}


@router.get("/email-mode")
async def email_mode(admin=Depends(get_current_admin)):
    return {"dry_run": DRY_RUN, "owner_email_configured": bool(os.environ.get("OWNER_EMAIL")),
            "send_timeout_seconds": SEND_TIMEOUT}


@router.post("/{message_id}/reply")
async def reply(message_id: str, inp: ReplyInput, admin=Depends(get_current_admin)):
    return await _send_reply(await _get(message_id), inp.subject, inp.body, inp.request_id)


@router.post("/{message_id}/replies/{reply_id}/retry")
async def retry_reply(message_id: str, reply_id: str, inp: RetryInput, admin=Depends(get_current_admin)):
    m = await _get(message_id)
    orig = next((r for r in m.get("replies", []) if r["id"] == reply_id), None)
    if not orig:
        raise HTTPException(404, "Réponse introuvable.")
    if orig.get("retried_by"):
        raise HTTPException(409, "Cette réponse a déjà été renvoyée.")
    if orig["status"] == "uncertain" and not inp.confirm_duplicate_risk:
        raise HTTPException(400, "Confirmez le risque de doublon avant de renvoyer un envoi incertain.")
    if orig["status"] not in ("failed", "uncertain") or orig.get("error_kind") in ("refused", "refused_local"):
        raise HTTPException(400, "Cette réponse ne peut pas être renvoyée telle quelle.")
    out = await _send_reply_and_link(m, orig, inp.request_id)
    return out


async def _send_reply_and_link(m: dict, orig: dict, request_id: str) -> dict:
    try:
        return await _send_reply(m, orig["subject"], orig["body"], request_id, retry_of=orig["id"])
    finally:
        fresh = await db.contact_messages.find_one({"id": m["id"]}, {"_id": 0, "replies": 1})
        new = next((r for r in fresh.get("replies", []) if r.get("request_id") == request_id), None)
        if new:
            await db.contact_messages.update_one({"id": m["id"], "replies.id": orig["id"]},
                                                 {"$set": {"replies.$.retried_by": new["id"]}})


@router.post("/{message_id}/notifications/{kind}/retry")
async def retry_notification(message_id: str, kind: Literal["owner_notification", "confirmation"], inp: RetryInput,
                             admin=Depends(get_current_admin)):
    m = await _get(message_id)
    job = m.get(kind) or {}
    if job.get("status") == "uncertain" and not inp.confirm_duplicate_risk:
        raise HTTPException(400, "Confirmez le risque de doublon avant de renvoyer un envoi incertain.")
    if job.get("status") not in ("failed", "uncertain") or job.get("error_kind") == "refused_local":
        raise HTTPException(400, "Cet envoi ne peut pas être relancé.")
    res = await db.contact_messages.update_one(
        {"id": message_id, f"{kind}.status": job["status"]},
        {"$set": {f"{kind}.status": "pending", f"{kind}.attempts": 0, f"{kind}.next_at": iso(),
                  f"{kind}.manual_retry_at": iso()}})
    if not res.modified_count:
        raise HTTPException(409, "Cet envoi a déjà été relancé.")
    await run_job(message_id, kind)
    return {"ok": True, "job": (await _get(message_id)).get(kind)}


@router.post("/{message_id}/status")
async def set_status(message_id: str, inp: StatusInput, admin=Depends(get_current_admin)):
    m = await _get(message_id)
    sent = any(r.get("status") == "sent" for r in m.get("replies", []))
    status = "answered" if inp.status == "new" and sent else inp.status
    await db.contact_messages.update_one({"id": message_id}, {"$set": {"status": status, "status_at": iso()}})
    return {"ok": True, "status": status}
