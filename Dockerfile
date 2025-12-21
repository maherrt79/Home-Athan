FROM python:3.11-slim-bookworm

# Set timezone to avoid potential issues (can be overridden by docker-compose)
ENV TZ=UTC

# Install system dependencies
# tzdata: often needed for accurate prayer time calc if system time is relied upon
# build-essential, gcc, etc.: needed for libraries that compile C extensions (like islamic-times/numpy)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata \
    build-essential \
    gcc \
    python3-dev \
    cmake \
    libgdal-dev \
    gdal-bin \
    proj-bin \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

# Set PROJ_DIR to help pyproj find the installation
ENV PROJ_DIR=/usr

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
# Using piwheels for pre-compiled binaries on ARM (much faster)
# --prefer-binary avoids compiling from source if a wheel exists
RUN pip install --no-cache-dir \
    --default-timeout=1000 \
    --extra-index-url https://www.piwheels.org/simple \
    --prefer-binary \
    -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose port (Internal documentation)
EXPOSE 8000

# Command to run the application
CMD ["python", "main.py"]
