FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
COPY relay/ relay/
COPY src/data/CompetitionTypes.ts src/data/CompetitionTypes.ts
RUN bun install --production
EXPOSE 9001
CMD ["bun", "run", "relay/server.ts"]
