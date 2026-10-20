#!/bin/sh
set -e

PORT="${PORT:-10000}"
echo "Configuring Nginx for PORT=${PORT}..."

# Generate Nginx configuration dynamically ensuring 0.0.0.0 binding
cat <<EOF > /etc/nginx/http.d/default.conf
server {
    listen 0.0.0.0:${PORT} default_server;
    listen [::]:${PORT} default_server;
EOF

if [ "$PORT" != "80" ]; then
    cat <<EOF >> /etc/nginx/http.d/default.conf
    listen 0.0.0.0:80;
    listen [::]:80;
EOF
fi

cat <<'EOF' >> /etc/nginx/http.d/default.conf
    server_name _;
    root /var/www/html/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    charset utf-8;

    client_max_body_size 64M;

    access_log /dev/stdout;
    error_log /dev/stderr warn;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass 127.0.0.1:9000;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
        fastcgi_read_timeout 300;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
EOF

echo "Testing Nginx configuration..."
nginx -t

# Ensure storage link exists
php artisan storage:link --force || true

# Ensure Chromium temp directories exist with full permissions
mkdir -p /tmp/.chromium-config /tmp/.chromium-cache /tmp/chrome-user-data
chown -R www-data:www-data /tmp/.chromium-config /tmp/.chromium-cache /tmp/chrome-user-data || true
chmod -R 777 /tmp || true

# Clear cached config and route for fresh container startup
php artisan config:clear
php artisan route:clear

# Run database migrations if configured
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running database migrations..."
    php artisan migrate --force
fi

# Run PDF generator pre-flight test
echo "Verifying server-side PDF generation engine..."
php artisan pdf:test || echo "PDF pre-flight completed with non-zero exit code."

echo "Starting Supervisor (Nginx + PHP-FPM)..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
