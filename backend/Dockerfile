FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN chmod +x /app/entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/app/entrypoint.sh"]
