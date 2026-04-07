import smtplib
from email.message import EmailMessage

from fastapi import HTTPException, status

from app.core.config import settings


def send_password_reset_email(recipient_email: str, code: str) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "El servicio de correo no está configurado. "
                "Define SMTP_HOST y SMTP_FROM_EMAIL en el archivo .env."
            ),
        )

    message = EmailMessage()
    message["Subject"] = "Código para restablecer tu contraseña en EcoFinance"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = recipient_email
    message.set_content(
        (
            "Hola,\n\n"
            f"Tu código para restablecer la contraseña es: {code}\n"
            f"Este código vence en {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutos.\n\n"
            "Si no solicitaste este cambio, puedes ignorar este correo."
        )
    )

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(message)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No fue posible enviar el correo de recuperación.",
        ) from exc
