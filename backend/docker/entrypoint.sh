#!/bin/sh
set -e

# Dynamically adjust port for Render ($PORT)
if [ -n "$PORT" ]; then
    sed -i "s/listen [0-9]*;/listen $PORT;/" /etc/nginx/http.d/default.conf
fi

# Ensure storage link exists
php artisan storage:link --force || true

# Clear cached config and route for fresh container startup
php artisan config:clear
php artisan route:clear

# Run database migrations if configured
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running database migrations..."
    php artisan migrate --force
fi

echo "Starting Supervisor (Nginx + PHP-FPM)..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
