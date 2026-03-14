import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from src.config.settings import settings


async def send_otp_email(email: str, otp: str):
    html = f"""
    <div style="font-family:sans-serif;max-width:400px;margin:auto;
                padding:24px;border:1px solid #eee;border-radius:8px;">
      <h2 style="color:#1a1a2e;">CoreInventory</h2>
      <p>Your one-time password for account reset:</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;
                  color:#4f46e5;text-align:center;padding:16px;">
        {otp}
      </div>
      <p style="color:#888;font-size:13px;">
        This OTP expires in {settings.OTP_EXPIRES_MINUTES} minutes.
        Do not share it.
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your Password Reset OTP"
    msg["From"]    = settings.SMTP_USER
    msg["To"]      = email
    msg.attach(MIMEText(html, "html"))

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASS,
        start_tls=True,
    )
