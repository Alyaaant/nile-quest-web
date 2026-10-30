FROM node:22.16.0-bookworm-slim
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY docker-entrypoint.sh /usr/local/bin/nile-entrypoint
RUN chmod 755 /usr/local/bin/nile-entrypoint && mkdir -p /data && chown node:node /data
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/nile-entrypoint"]
