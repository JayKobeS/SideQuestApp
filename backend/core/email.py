import os
import smtplib
from email.message import EmailMessage


def send_password_reset_email(recipient: str, reset_url: str) -> None:
    """Wysyła link resetu przez skonfigurowany SMTP; bez konfiguracji nie udaje sukcesu."""
    host = os.getenv("SMTP_HOST")
    sender = os.getenv("SMTP_FROM")
    if not host or not sender:
        raise RuntimeError("Usługa odzyskiwania hasła nie jest jeszcze skonfigurowana.")

    message = EmailMessage()
    message["Subject"] = "SideQuest — reset hasła"
    message["From"] = sender
    message["To"] = recipient
    message.set_content(
        f"Otrzymaliśmy prośbę o zmianę hasła do SideQuest.\n\n"
        f"Otwórz ten link w ciągu 30 minut:\n{reset_url}\n\n"
        "Jeżeli to nie Ty, zignoruj tę wiadomość."
    )

    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    with smtplib.SMTP(host, port, timeout=15) as server:
        server.starttls()
        if username and password:
            server.login(username, password)
        server.send_message(message)
