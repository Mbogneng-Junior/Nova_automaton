FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV HERMES_HOME=/home/hermes/.hermes
ENV PATH="/home/hermes/.local/bin:/home/hermes/.hermes/node/bin:$PATH"

# Install system dependencies for Hermes + Playwright/Chromium
RUN apt-get update && apt-get install -y \
    git \
    curl \
    xz-utils \
    build-essential \
    ca-certificates \
    wget \
    python3 \
    python3-venv \
    python3-pip \
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

# Install Node.js 22 as root (needed before switching user)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Create hermes user
RUN useradd -m -s /bin/bash hermes

USER hermes
WORKDIR /home/hermes

# 1. Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Clone Hermes repo
RUN git clone --depth 1 https://github.com/NousResearch/hermes-agent.git ~/.hermes/hermes-agent

# 3. Create venv + install Python deps
RUN cd ~/.hermes/hermes-agent && \
    ~/.local/bin/uv python install 3.11 && \
    ~/.local/bin/uv venv .venv --python 3.11 && \
    ~/.local/bin/uv pip install -e ".[all]"

# 4. Install Node deps for Hermes
RUN cd ~/.hermes/hermes-agent && npm install || true

# 5. Create hermes symlink
RUN mkdir -p ~/.local/bin && \
    ln -sf ~/.hermes/hermes-agent/.venv/bin/hermes ~/.local/bin/hermes

# 6. Verify hermes works
RUN hermes --version || true

# 7. Install hermes-control-interface
RUN git clone https://github.com/xaspx/hermes-control-interface.git ~/.hermes/hci && \
    cd ~/.hermes/hci && \
    npm install && npm run build

EXPOSE 8123

COPY --chown=hermes:hermes entrypoint.sh /home/hermes/entrypoint.sh
RUN chmod +x /home/hermes/entrypoint.sh

ENTRYPOINT ["/home/hermes/entrypoint.sh"]
