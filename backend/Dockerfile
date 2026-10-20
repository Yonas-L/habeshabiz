FROM php:8.4-fpm-alpine

# Install nginx, supervisor, curl, chromium, and fonts for server-side PDF generation
RUN apk add --no-cache \
    nginx \
    supervisor \
    curl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    gcompat \
    libstdc++ \
    udev \
    fontconfig

# Chromium environment variables for container headless execution
ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/bin/chromium-browser \
    LARAVEL_PDF_CHROME_BINARY=/usr/bin/chromium-browser \
    LARAVEL_PDF_CHROME_NO_SANDBOX=true \
    XDG_CONFIG_HOME=/tmp/.chromium-config \
    XDG_CACHE_HOME=/tmp/.chromium-cache \
    HOME=/tmp \
    TMPDIR=/tmp

# Configure PHP-FPM to keep environment variables and create Chromium temp directories
RUN echo "clear_env = no" >> /usr/local/etc/php-fpm.d/www.conf \
    && echo "clear_env = no" >> /usr/local/etc/php-fpm.d/docker.conf \
    && mkdir -p /tmp/.chromium-config /tmp/.chromium-cache /tmp/chrome-user-data \
    && chown -R www-data:www-data /tmp/.chromium-config /tmp/.chromium-cache /tmp/chrome-user-data \
    && chmod -R 777 /tmp

# Install PHP extensions using official binary extension installer
ADD --chmod=0755 https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/

RUN install-php-extensions pdo_pgsql pgsql bcmath gd zip intl opcache pcntl

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Copy application files
COPY . /var/www/html

# Ensure all required Laravel storage and cache directories exist before composer scripts run
RUN mkdir -p \
    /var/www/html/storage/app/public \
    /var/www/html/storage/framework/cache/data \
    /var/www/html/storage/framework/sessions \
    /var/www/html/storage/framework/views \
    /var/www/html/storage/framework/testing \
    /var/www/html/storage/logs \
    /var/www/html/bootstrap/cache \
    && chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Copy deployment configurations
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Install production PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction --ignore-platform-reqs

# Permissions
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache \
    && chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

EXPOSE 10000 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
