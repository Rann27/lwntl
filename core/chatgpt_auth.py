"""
ChatGPT plan — Sign in with ChatGPT for open-source, locally hosted apps.

OpenAI's official token-sharing flow (developers.openai.com/siwc/token-sharing-open-source)
lets a user run LWNTL's requests on their ChatGPT plan instead of an API key:

    1. Dynamic registration + PKCE in the system browser, redirected to a loopback
       listener on 127.0.0.1. The first sign-in uses client_id=dynamic_agent_client;
       the callback returns the client_id issued for this user (oaiapp_…), which
       every later sign-in reuses.
    2. The code is exchanged for access / refresh / ID tokens (public client, no
       secret). The ID token is verified against OpenAI's JWKS, and the
       chatgpt.tokens.use.direct scope must have been granted.
    3. Requests go to the public Responses API with the access token as bearer,
       store=false and stream=true (see LLMClient). Access tokens live one hour;
       the refresh token rotates on every refresh.

Credentials stay on this machine in <app data>/chatgpt_auth.json (owner-only where
the OS supports it) and are never written to config.json or logs. ext_agent_host_id
identifies this installation and is generated once.
"""

import base64
import hashlib
import json
import os
import secrets
import threading
import time
import uuid
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, Optional
from urllib.parse import parse_qs, urlencode, urlparse

import httpx

from .storage.config import get_app_data_dir

ISSUER = "https://auth.openai.com"
AUTHORIZE_URL = f"{ISSUER}/api/accounts/authorize"
TOKEN_URL = f"{ISSUER}/api/accounts/oauth/token"
DISCOVERY_URL = f"{ISSUER}/.well-known/openid-configuration"
RESOURCE = "https://api.openai.com/v1"
SCOPE = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct"
PLAN_SCOPE = "chatgpt.tokens.use.direct"
REGISTRATION_CLIENT = "dynamic_agent_client"
APP_NAME = "LWNTL"
MANAGE_USAGE_URL = "https://chatgpt.com/settings/usage"
LOGIN_TIMEOUT_SECONDS = 600
# Refresh a little before the hour is up so a long request never starts on a dying token.
REFRESH_MARGIN_SECONDS = 120

# Refresh errors after which the grant is gone: sign in again.
_DEAD_GRANT = ("invalid_grant", "invalid_refresh_token", "token_expired", "refresh_token_expired",
               "refresh_token_invalidated", "refresh_token_reused")


class ChatGPTAuthError(Exception):
    """The ChatGPT connection needs the user's attention (not connected, expired, revoked)."""


_lock = threading.RLock()
_login: Dict[str, Any] = {"status": "idle"}


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

def _path():
    return get_app_data_dir() / "chatgpt_auth.json"


def _load() -> Dict[str, Any]:
    try:
        return json.loads(_path().read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _save(data: Dict[str, Any]):
    path = _path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        os.chmod(tmp, 0o600)
    except OSError:
        pass
    os.replace(tmp, path)


def _host_id(data: Dict[str, Any]) -> str:
    """Stable, opaque id of this installation (one per install, kept across sign-ins)."""
    if not data.get("ext_agent_host_id"):
        data["ext_agent_host_id"] = f"urn:uuid:{uuid.uuid4()}"
        _save(data)
    return data["ext_agent_host_id"]


def _set_account_in_config(email: str):
    """Mirror the connected account into config so pickers know the provider is usable."""
    from .storage.config import get_config, save_config
    try:
        cfg = get_config()
        if cfg.get("chatgptAccount", "") != email:
            cfg["chatgptAccount"] = email
            save_config(cfg)
    except Exception as e:
        # The session itself is saved; only the picker hint failed.
        print(f"[ChatGPT] Could not update config: {e}")


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------

def _verify_id_token(id_token: str, client_id: str, nonce: Optional[str]) -> Dict[str, Any]:
    import jwt

    try:
        jwks_uri = httpx.get(DISCOVERY_URL, timeout=15).json().get("jwks_uri") or f"{ISSUER}/.well-known/jwks.json"
    except Exception:
        jwks_uri = f"{ISSUER}/.well-known/jwks.json"
    key = jwt.PyJWKClient(jwks_uri).get_signing_key_from_jwt(id_token).key
    claims = jwt.decode(id_token, key, algorithms=["RS256"], audience=client_id, issuer=ISSUER)
    if nonce is not None and claims.get("nonce") != nonce:
        raise ChatGPTAuthError("ID token nonce tidak cocok — login dibatalkan")
    return claims


def _store_tokens(data: Dict[str, Any], tok: Dict[str, Any], client_id: str, claims: Dict[str, Any]):
    data.update({
        "issuer": ISSUER,
        "client_id": client_id,
        "email": claims.get("email") or data.get("email", ""),
        "subject": claims.get("sub") or data.get("subject", ""),
        "id_token": tok.get("id_token") or data.get("id_token", ""),
        "access_token": tok["access_token"],
        "refresh_token": tok.get("refresh_token") or data.get("refresh_token", ""),
        "token_type": tok.get("token_type", "Bearer"),
        "expires_in": int(tok.get("expires_in", 3600)),
        "scopes": (tok.get("scope") or SCOPE).split(),
        "saved_at": time.time(),
        "saved_at_utc": datetime.utcnow().isoformat() + "Z",
    })
    _save(data)


def _clear_tokens(data: Dict[str, Any]):
    """Forget the session but keep client_id and host id for the next sign-in."""
    for k in ("access_token", "refresh_token", "id_token", "expires_in", "saved_at", "saved_at_utc", "scopes"):
        data.pop(k, None)
    _save(data)
    _set_account_in_config("")


def access_token() -> str:
    """A valid access token, refreshed when it is about to expire."""
    with _lock:
        data = _load()
        if not data.get("access_token"):
            raise ChatGPTAuthError("Akun ChatGPT belum terhubung — hubungkan di Settings → Provider")
        expires_at = float(data.get("saved_at", 0)) + int(data.get("expires_in", 3600))
        if time.time() < expires_at - REFRESH_MARGIN_SECONDS:
            return data["access_token"]
        if not data.get("refresh_token"):
            _clear_tokens(data)
            raise ChatGPTAuthError("Sesi ChatGPT berakhir — hubungkan ulang di Settings → Provider")
        r = httpx.post(TOKEN_URL, data={
            "grant_type": "refresh_token",
            "refresh_token": data["refresh_token"],
            "client_id": data["client_id"],
            "resource": RESOURCE,
        }, timeout=30)
        if r.status_code != 200:
            try:
                err = r.json().get("error", "")
            except Exception:
                err = ""
            if err in _DEAD_GRANT or r.status_code in (400, 401):
                _clear_tokens(data)
                raise ChatGPTAuthError("Sesi ChatGPT berakhir — hubungkan ulang di Settings → Provider")
            raise ChatGPTAuthError(f"Gagal memperbarui token ChatGPT ({r.status_code} {err})")
        tok = r.json()
        _store_tokens(data, tok, data["client_id"], {})
        return tok["access_token"]


def invalidate_session():
    """Called on a 401 from the API: the docs say sign in again rather than refresh-and-retry."""
    with _lock:
        _clear_tokens(_load())


def status() -> Dict[str, Any]:
    data = _load()
    connected = bool(data.get("access_token") and data.get("refresh_token"))
    return {
        "connected": connected,
        "email": data.get("email", "") if connected else "",
        "login": {k: v for k, v in _login.items() if k in ("status", "error", "url")},
        "manageUsageUrl": MANAGE_USAGE_URL,
    }


def disconnect() -> bool:
    with _lock:
        _clear_tokens(_load())
    return True


# ---------------------------------------------------------------------------
# Sign-in (PKCE + loopback)
# ---------------------------------------------------------------------------

def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


_DONE_PAGE = """<!doctype html><meta charset="utf-8"><title>LWNTL</title>
<body style="font-family:system-ui;background:#F8F3EA;display:grid;place-items:center;height:100vh;margin:0">
<div style="border:2.5px solid #111;box-shadow:4px 4px 0 #111;background:#fff;padding:24px 32px;max-width:420px">
<h2 style="margin:0 0 8px">{title}</h2><p style="margin:0">{body}</p></div></body>"""


def start_login() -> Dict[str, Any]:
    """
    Open the system browser on the ChatGPT sign-in page. The result arrives at a
    one-shot loopback listener; poll status() for the outcome.
    """
    with _lock:
        if _login.get("status") == "pending":
            return {"status": "pending", "url": _login.get("url", "")}
        data = _load()
        host_id = _host_id(data)
        client_id = data.get("client_id") or REGISTRATION_CLIENT
        state, nonce = secrets.token_urlsafe(24), secrets.token_urlsafe(24)
        verifier = _b64url(secrets.token_bytes(48))
        challenge = _b64url(hashlib.sha256(verifier.encode("ascii")).digest())

        outcome: Dict[str, Any] = {}

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):  # keep tokens and codes out of the console
                pass

            def do_GET(self):
                parsed = urlparse(self.path)
                if parsed.path != "/callback":
                    self.send_response(404)
                    self.end_headers()
                    return
                outcome.update({k: v[0] for k, v in parse_qs(parsed.query).items()})
                ok = outcome.get("state") == state and "code" in outcome
                page = _DONE_PAGE.format(
                    title="Terhubung ke ChatGPT" if ok else "Login gagal",
                    body="Kembali ke LWNTL — jendela ini boleh ditutup." if ok
                    else (outcome.get("error_description") or outcome.get("error") or "Permintaan tidak valid."),
                )
                body = page.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        server = HTTPServer(("127.0.0.1", 0), Handler)
        server.timeout = 1
        redirect_uri = f"http://127.0.0.1:{server.server_address[1]}/callback"
        params = {
            "client_id": client_id,
            "agent_name_hint": APP_NAME,
            "ext_agent_host_id": host_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": SCOPE,
            "resource": RESOURCE,
            "state": state,
            "nonce": nonce,
            "code_challenge_method": "S256",
            "code_challenge": challenge,
        }
        if client_id != REGISTRATION_CLIENT and data.get("id_token"):
            params["id_token_hint"] = data["id_token"]
        url = f"{AUTHORIZE_URL}?{urlencode(params)}"
        _login.clear()
        _login.update({"status": "pending", "url": url, "error": ""})

    def wait():
        deadline = time.time() + LOGIN_TIMEOUT_SECONDS
        try:
            while not outcome and time.time() < deadline and _login.get("status") == "pending":
                server.handle_request()
        finally:
            server.server_close()
        try:
            if not outcome:
                raise ChatGPTAuthError("Login dibatalkan atau melewati batas waktu")
            if outcome.get("state") != state:
                raise ChatGPTAuthError("State tidak cocok — login dibatalkan demi keamanan")
            if "code" not in outcome:
                raise ChatGPTAuthError(outcome.get("error_description") or outcome.get("error") or "Login ditolak")
            issued = outcome.get("client_id") or client_id
            r = httpx.post(TOKEN_URL, data={
                "grant_type": "authorization_code",
                "client_id": issued,
                "code": outcome["code"],
                "code_verifier": verifier,
                "redirect_uri": redirect_uri,
                "resource": RESOURCE,
            }, timeout=30)
            if r.status_code != 200:
                raise ChatGPTAuthError(f"Penukaran kode gagal ({r.status_code}): {r.text[:200]}")
            tok = r.json()
            if PLAN_SCOPE not in (tok.get("scope") or "").split():
                raise ChatGPTAuthError("Izin memakai paket ChatGPT tidak diberikan")
            claims = _verify_id_token(tok["id_token"], issued, nonce)
            with _lock:
                fresh = _load()
                _store_tokens(fresh, tok, issued, claims)
                _set_account_in_config(fresh.get("email", ""))
                _login.update({"status": "done", "error": "", "url": ""})
        except Exception as e:
            _login.update({"status": "error", "error": str(e), "url": ""})

    threading.Thread(target=wait, daemon=True).start()
    try:
        webbrowser.open(url)
    except Exception:
        pass  # the UI also offers the link to open by hand
    return {"status": "pending", "url": url}


def cancel_login() -> bool:
    if _login.get("status") == "pending":
        _login.update({"status": "idle", "url": ""})
    return True


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

def list_models() -> list:
    """Models this ChatGPT plan can use: [{id, name}] from the visible catalog entries."""
    r = httpx.get(f"{RESOURCE}/models", headers={"Authorization": f"Bearer {access_token()}"}, timeout=30)
    if r.status_code == 401:
        invalidate_session()
        raise ChatGPTAuthError("Sesi ChatGPT ditolak — hubungkan ulang di Settings → Provider")
    r.raise_for_status()
    body = r.json()
    items = body.get("data") or body.get("models") or []
    out = []
    for it in items:
        if it.get("visibility", "list") != "list":
            continue
        mid = it.get("slug") or it.get("id")
        if mid:
            out.append({"id": mid, "name": it.get("display_name") or mid,
                        "description": it.get("description", "")})
    return out
