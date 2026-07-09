# Stage 1: Build the static assets
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the production bundle
RUN npm run build

# Stage 2: Serve the static files with Nginx
FROM nginx:stable-alpine
WORKDIR /usr/share/nginx/html

# Clean default nginx static files
RUN rm -rf ./*

# Copy built assets from Stage 1
COPY --from=build /app/dist .

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create logs directory and assign write permissions to nginx user
RUN mkdir -p /usr/share/nginx/html/logs && \
    touch /usr/share/nginx/html/logs/access.log && \
    chown -R nginx:nginx /usr/share/nginx/html/logs

# Expose Nginx port
EXPOSE 80

# Healthcheck to verify Nginx is responding on port 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
