FROM node:20-slim

WORKDIR /app

# Install git + CA certificates + Python + build tools for native modules
RUN apt-get update && apt-get install -y git ca-certificates python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Clone HCI repository
RUN git clone https://github.com/xaspx/hermes-control-interface.git .

# Configure npm to use python3 for native modules
RUN npm config set python /usr/bin/python3

# Install dependencies and build
RUN npm install && npm run build

# Copy default env (can be overridden by docker-compose)
COPY .env.example .env

EXPOSE 10274

CMD ["node", "server.js"]
