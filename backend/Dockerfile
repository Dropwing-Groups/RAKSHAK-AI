# RAKSHAK AI — Backend (Django + multi-agent AI core)
FROM python:3.11-slim

# System deps needed by opencv/ultralytics/shapely at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgeos-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn rakshak.wsgi:application --bind 0.0.0.0:8000 --workers 4"]
