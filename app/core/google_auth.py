from fastapi import HTTPException, status
from google.oauth2 import id_token

from app.core.config import settings


def verify_google_id_token(token: str) -> dict:
    allowed_audiences = {
        value
        for value in (
            settings.GOOGLE_WEB_CLIENT_ID,
            settings.GOOGLE_IOS_CLIENT_ID,
            settings.GOOGLE_ANDROID_CLIENT_ID,
        )
        if value and not value.startswith("REPLACE_WITH_")
    }

    if not allowed_audiences:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google Sign-In no está configurado todavía.",
        )

    try:
        from google.auth.transport import requests
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falta instalar la dependencia requests para usar Google Sign-In.",
        ) from exc

    try:
        payload = id_token.verify_oauth2_token(token, requests.Request())
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No fue posible validar la cuenta de Google.",
        ) from exc

    if payload.get("aud") not in allowed_audiences:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token de Google no pertenece a esta aplicación.",
        )

    if not payload.get("email"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google no devolvió un correo válido.",
        )

    return payload
