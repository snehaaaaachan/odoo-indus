from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PORT: int = 8000
    ENV: str = "development"

    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "coreinventory"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "password"

    REDIS_URL: str = "redis://localhost:6379"

    JWT_SECRET: str = "changeme"
    JWT_EXPIRES_MINUTES: int = 10080

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""

    OTP_EXPIRES_MINUTES: int = 10

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
