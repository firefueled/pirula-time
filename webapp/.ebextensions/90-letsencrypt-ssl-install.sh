#!/usr/bin/env bash

echo ========= STARTING LETS ENCRYPT

ENV=$(sudo sh /opt/elasticbeanstalk/bin/get-config environment -k ENV)
echo "ENV: $ENV"

DOMAIN_NAME='pirula-time.me'
if [ "$ENV" = "STAGING" ]; then
    DOMAIN_NAME='test.pirula-time.me'
fi

echo "domain name: $DOMAIN_NAME"
echo "certbot installed:"

if [ ! -f ~/certbot/certbot-auto ]; then
    echo 'nope'
    # Install certbot
    mkdir ~/certbot
    cd ~/certbot
    wget https://dl.eff.org/certbot-auto
    chmod a+x certbot-auto

    # Create certificate
    sudo ./certbot-auto certonly --agree-tos --email slpkvol3@gmail.com --apache --debug --non-interactive -d $DOMAIN_NAME
else
    echo 'yep'
    cd ~/certbot
    sudo ./certbot-auto renew --debug
fi

# Install crontab
sudo crontab /tmp/cronjob

# copy apache ssl.conf
if sudo [ -f /etc/letsencrypt/live/$DOMAIN_NAME/cert.pem ]; then
    # substitute domain name
    sudo sed "s/__DOMAIN_NAME__/$DOMAIN_NAME/g" -i /tmp/ssl.conf

    sudo cp /tmp/ssl.conf /etc/httpd/conf.d/ssl.conf
    sudo cp /tmp/ssl_rewrite.conf /etc/httpd/conf.d/ssl_rewrite.conf
else
    sudo rm -f /etc/httpd/conf.d/ssl.conf
    sudo rm -f /etc/httpd/conf.d/ssl_rewrite.conf
fi

sudo service httpd reload

echo ========= ENDING LETS ENCRYPT
