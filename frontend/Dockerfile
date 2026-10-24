FROM mcr.microsoft.com/playwright:v1.63.0-noble AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG SITE_URL=https://velio.cub1z.es
ENV SITE_URL=$SITE_URL
RUN pnpm build && pnpm prerender

FROM nginx:1.27-alpine
ENV API_UPSTREAM=http://backend:8000
COPY nginx/velio.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
