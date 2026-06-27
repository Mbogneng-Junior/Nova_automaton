FROM node:20-slim

WORKDIR /app

# Install git + CA certificates for HTTPS cloning
RUN apt-get update && apt-get install -y git ca-certificates --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Clone HCI repository
RUN git clone https://github.com/xaspx/hermes-control-interface.git .

# Install dependencies and build
RUN npm install && npm run build

# Copy default env (can be overridden by docker-compose)
COPY .env.example .env

EXPOSE 10274

CMD ["node", "server.js"]
