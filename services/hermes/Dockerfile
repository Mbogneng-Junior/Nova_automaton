FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV HERMES_HOME=/home/hermes/.hermes
ENV PATH="/home/hermes/.local/bin:$PATH"

# Install system dependencies for Hermes + Playwright/Chromium
RUN apt-get update && apt-get install -y \
    git \
    curl \
    xz-utils \
    build-essential \
    ca-certificates \
    wget \
    # Playwright/Chromium dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    fonts-liberation \
    libappindicator3-1 \
    && rm -rf /var/lib/apt/lists/*

# Create hermes user
RUN useradd -m -s /bin/bash hermes

USER hermes
WORKDIR /home/hermes

# Install Hermes Agent (official installer)
# The installer handles: uv, Python 3.11, Node.js v22, ripgrep, ffmpeg
RUN curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash

# Ensure PATH includes hermes
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/hermes/.bashrc

# Expose Hermes gateway port
EXPOSE 8123

# Copy entrypoint
COPY --chown=hermes:hermes entrypoint.sh /home/hermes/entrypoint.sh
RUN chmod +x /home/hermes/entrypoint.sh

ENTRYPOINT ["/home/hermes/entrypoint.sh"]
