# Demandes de contact : notifications, confirmation, réponses admin par e-mail (avec consentement par demande).
import logging
import os
import uuid
from datetime import datetime, timezone
from html import escape
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from auth import get_current_admin
from database import db
from emailer import send_email, _assert_safe_email

logger = logging.getLogger("contact")
router = APIRouter(prefix="/admin/messages")

PUBLIC_BASE_URL = (os.environ.get("PUBLIC_BASE_URL") or "").rstrip("/")
DRY_RUN = (os.environ.get("CONTACT_EMAIL_DRY_RUN", "").lower() == "true"
           and ".preview.emergentagent.com" in PUBLIC_BASE_URL)
CONSENT_VERSION = "contact-suivi-v1"
CONSENT_TEXT = ("Je souhaite recevoir par email une confirmation de mon message ainsi que les réponses "
                "et le suivi de cette demande.")
PARIS = ZoneInfo("Europe/Paris")
FAIL_MARK = "[SIMULER-ECHEC]"


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def fr_date(iso: str) -> str:
    return datetime.fromisoformat(iso).astimezone(PARIS).strftime("%d/%m/%Y à %H:%M")


def _text(v: str) -> str:
    return escape(v or "").replace("\n", "<br>")


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


def owner_notification_html(m: dict) -> str:
    consent = "Oui — le client accepte le suivi par e-mail" if m.get("followup_consent") else \
        "Non — aucune réponse par e-mail ne pourra lui être envoyée"
    rows = [("Nom", m["name"]), ("E-mail", m["email"]), ("Sujet", m.get("subject") or "(sans objet)"),
            ("Reçu le", fr_date(m["created_at"])), ("Suivi par e-mail", consent)]
    table = "".join(f'<tr><td style="padding:6px 0;color:#626D66;vertical-align:top;width:140px">{k}</td>'
                    f'<td style="padding:6px 0">{_text(v)}</td></tr>' for k, v in rows)
    link = f'{PUBLIC_BASE_URL}/admin'
    return _layout("Nouveau message", (
        '<h1 style="color:#1E3A2B;font-size:20px;margin:0 0 14px">Nouveau message reçu</h1>'
        f'<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">{table}</table>'
        f'<div style="background:#F2EDE4;border-radius:12px;padding:16px 18px;margin:18px 0">{_text(m["message"])}</div>'
        f'<p style="font-size:14px">Consultez l\'onglet « Messages » du <a href="{escape(link)}" '
        'style="color:#3B6B4C">tableau de bord administrateur</a> pour traiter cette demande.</p>'
    ))


def confirmation_html(m: dict) -> str:
    subj = f'<p>Objet de votre demande : <strong>{_text(m["subject"])}</strong></p>' if m.get("subject") else ""
    return _layout("L'aubaine pour mieux s'organiser.", (
        f'<h1 style="color:#1E3A2B;font-size:20px;margin:0 0 14px">Merci pour votre message, {_text(m["name"])}</h1>'
        f'<p>Nous avons bien reçu votre message le {fr_date(m["created_at"])}.</p>{subj}'
        '<p>L\'équipe de La Maison d\'Auben l\'a bien enregistré et pourra vous répondre par e-mail.</p>'
        '<p style="color:#626D66;font-size:13px">Vous recevez cet e-mail car vous avez demandé une confirmation et le suivi '
        'de cette demande. Il ne s\'agit pas d\'une inscription à notre newsletter.</p>'
    ))


def reply_html(m: dict, body: str) -> str:
    return _layout("Réponse à votre message", (
        f'<p>Bonjour {_text(m["name"])},</p>'
        f'<div style="margin:16px 0">{_text(body)}</div>'
        '<p>L\'équipe de La Maison d\'Auben</p>'
        f'<p style="color:#626D66;font-size:13px;border-top:1px solid #E2DDD5;padding-top:14px">En réponse à votre message du '
        f'{fr_date(m["created_at"])}{(" — « " + _text(m["subject"]) + " »") if m.get("subject") else ""}. '
        'Vous recevez cet e-mail car vous avez demandé le suivi de cette demande. Vous pouvez répondre directement à cet e-mail.</p>'
    ))


async def deliver(*, to: str, subject: str, html: str, reply_to: str = None):
    """Retourne (email_id, erreur)."""
    try:
        if DRY_RUN:
            _assert_safe_email(subject, html)
            if FAIL_MARK in html:
                return None, "Échec simulé du fournisseur (mode simulation)."
            logger.info(f"[SIMULATION] e-mail non envoyé : {subject!r}")
            return f"simulated-{uuid.uuid4().hex[:12]}", None
        eid = await send_email(to=to, subject=subject, html=html, reply_to=reply_to)
        return (eid, None) if eid else (None, "Le fournisseur e-mail a refusé ou n'a pas confirmé l'envoi.")
    except ValueError as e:
        logger.warning(f"Contact e-mail bloqué par le filtre de sécurité : {e}")
        return None, "Contenu bloqué par le filtre de sécurité e-mail."
    except Exception as e:
        logger.error(f"Contact e-mail : erreur inattendue ({type(e).__name__})")
        return None, "Erreur inattendue lors de l'envoi."


def _status(eid, err):
    return {"status": "sent" if eid else "failed", "email_id": eid, "error": err, "at": now_iso(), "simulated": DRY_RUN}


async def notify_new_message(m: dict) -> None:
    owner = os.environ.get("OWNER_EMAIL")
    upd = {}
    if owner:
        upd["owner_notification"] = _status(*await deliver(
            to=owner, subject="Nouveau message reçu — La Maison d'Auben", html=owner_notification_html(m)))
    else:
        upd["owner_notification"] = _status(None, "OWNER_EMAIL non configurée.")
    if m.get("followup_consent"):
        upd["confirmation"] = _status(*await deliver(
            to=m["email"], subject="Nous avons bien reçu votre message — La Maison d'Auben",
            html=confirmation_html(m), reply_to=owner))
    for k, v in upd.items():
        if v["status"] == "failed":
            logger.error(f"Contact {m['id']} : {k} en échec ({v['error']})")
    await db.contact_messages.update_one({"id": m["id"]}, {"$set": upd})


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


class StatusInput(BaseModel):
    status: Literal["new", "handled"]


@router.get("/email-mode")
async def email_mode(admin=Depends(get_current_admin)):
    return {"dry_run": DRY_RUN, "owner_email_configured": bool(os.environ.get("OWNER_EMAIL"))}


@router.post("/{message_id}/reply")
async def reply(message_id: str, inp: ReplyInput, admin=Depends(get_current_admin)):
    m = await db.contact_messages.find_one({"id": message_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Message introuvable.")
    if m.get("followup_consent") is not True or not m.get("followup_consent_at"):
        raise HTTPException(403, "Le client n'a pas autorisé le suivi par e-mail pour cette demande : aucune réponse ne peut lui être envoyée.")
    if any(r.get("request_id") == inp.request_id for r in m.get("replies", [])):
        raise HTTPException(409, "Cette réponse a déjà été traitée (double envoi évité).")
    rid = str(uuid.uuid4())
    entry = {"id": rid, "request_id": inp.request_id, "subject": inp.subject, "body": inp.body,
             "status": "sending", "created_at": now_iso(), "admin": admin.get("email")}
    res = await db.contact_messages.update_one(
        {"id": message_id, "replies.request_id": {"$ne": inp.request_id}, "replies.status": {"$ne": "sending"}},
        {"$push": {"replies": entry}})
    if not res.modified_count:
        raise HTTPException(409, "Un envoi est déjà en cours ou cette réponse a déjà été traitée.")
    eid, err = await deliver(to=m["email"], subject=inp.subject, html=reply_html(m, inp.body),
                             reply_to=os.environ.get("OWNER_EMAIL"))
    done = {"replies.$.status": "sent" if eid else "failed", "replies.$.email_id": eid, "replies.$.error": err,
            "replies.$.sent_at": now_iso() if eid else None, "replies.$.simulated": DRY_RUN}
    if eid:
        done["status"] = "answered"
    await db.contact_messages.update_one({"id": message_id, "replies.id": rid}, {"$set": done})
    if not eid:
        logger.error(f"Réponse au message {message_id} en échec : {err}")
        raise HTTPException(424, f"La réponse n'a pas été envoyée : {err} Elle est conservée comme « échec » ; vous pouvez réessayer.")
    return {"ok": True, "email_id": eid, "simulated": DRY_RUN}


@router.post("/{message_id}/status")
async def set_status(message_id: str, inp: StatusInput, admin=Depends(get_current_admin)):
    m = await db.contact_messages.find_one({"id": message_id}, {"_id": 0, "replies": 1})
    if not m:
        raise HTTPException(404, "Message introuvable.")
    sent = any(r.get("status") == "sent" for r in m.get("replies", []))
    status = "answered" if inp.status == "new" and sent else inp.status
    await db.contact_messages.update_one({"id": message_id}, {"$set": {"status": status, "status_at": now_iso()}})
    return {"ok": True, "status": status}
