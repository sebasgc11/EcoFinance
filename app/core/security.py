import base64
import hashlib
import hmac
import secrets


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"{base64.b64encode(salt).decode()}:{base64.b64encode(digest).decode()}"


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash or ":" not in password_hash:
        return False

    salt_b64, digest_b64 = password_hash.split(":", 1)
    salt = base64.b64decode(salt_b64.encode())
    expected_digest = base64.b64decode(digest_b64.encode())
    actual_digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, 100_000
    )
    return hmac.compare_digest(actual_digest, expected_digest)
