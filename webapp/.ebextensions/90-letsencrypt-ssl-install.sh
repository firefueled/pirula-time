#!/usr/bin/env bash

echo ========= STARTING LETS ENCRYPT

if [ ! -f ~/certbot/certbot-auto ]; then
    # Install certbot
    mkdir ~/certbot
    cd ~/certbot
    wget https://dl.eff.org/certbot-auto
    chmod a+x certbot-auto

    # Create certificate
    sudo ./certbot-auto certonly --agree-tos --email slpkvol3@gmail.com --apache --debug --non-interactive -d pirula-time.me
else
    cd ~/certbot
    sudo ./certbot-auto renew
fi

# Install crontab
sudo crontab /tmp/cronjob

# copy apache ssl.conf
if [ -f /etc/letsencrypt/live/pirula-time.me/cert.pem ]; then
    sudo cp /tmp/ssl.conf /etc/httpd/conf.d/ssl.conf
    sudo cp /tmp/ssl_rewrite.conf /etc/httpd/conf.d/ssl_rewrite.conf
else
    sudo rm -f /etc/httpd/conf.d/ssl.conf
    sudo rm -f /etc/httpd/conf.d/ssl_rewrite.conf
fi

sudo service httpd reload

echo ========= ENDING LETS ENCRYPT
