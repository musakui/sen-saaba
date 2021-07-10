#!/bin/bash -e
if [ -z "$AUTH_TOKEN" ]; then
  echo "Error: AUTH_TOKEN is required" 1>&2
  exit 1
fi

echo -n "[INIT] writing files "

function auth_hash () {
  echo -n $1 | openssl dgst -binary -sha256 | base64
}

sed -i "s/%AUTH_TOKEN%/${AUTH_TOKEN}/" /etc/nginx/sites-enabled/default
sed -i "s|worker_processes .*|worker_processes ${NGINX_WORKERS:-1};|" /etc/nginx/nginx.conf
echo -n "."

PASSWORD="$(openssl rand -base64 12)"
echo -n "${PASSWORD}" > .password
chmod 400 .password
echo -n "."

vnc -storepasswd "${PASSWORD}" .vncpass 2>/dev/null
chmod 400 .vncpass
echo -n "."

OBS_CONFIG=/root/.config/obs-studio/basic/profiles/default/basic.ini
WS_SALT="$(auth_hash ${RANDOM})"
echo "AuthSalt=${WS_SALT}" >> $OBS_CONFIG
echo "AuthSecret=$(auth_hash "${PASSWORD}${WS_SALT}")" >> $OBS_CONFIG
echo -n "."

unset WS_SALT
unset PASSWORD

if [ -n "$CERT_URL" ]; then
  FULC="$(echo | openssl s_client -showcerts -verify 5 -connect "${CERT_URL}:443" 2>/dev/null)"
  echo "${FULC}" | sed -ne '/-BEGIN CERTIFICATE-/,/-END CERTIFICATE-/p' >> /etc/nginx/ssl/nginx.crt
  sed -i 's|#_SSL_#||' /etc/nginx/sites-enabled/default
  echo "-----BEGIN PRIVATE KEY-----" > /etc/nginx/ssl/nginx.key
  echo "${CERT_STR}" | sed 's/.\{64\}/&\n/g' >> /etc/nginx/ssl/nginx.key
  echo "-----END PRIVATE KEY-----" >> /etc/nginx/ssl/nginx.key
  unset FULC
  export CERT_URL=
  export CERT_STR=
  echo -n "."
fi

echo " OK"

echo -n "[INIT] services "

nginx -c /etc/nginx/nginx.conf
echo -n "."

Xvfb :1 -screen 0 ${RESOLUTION:-1080x720}x24 &
echo -n "."

echo " OK"

exec saaba
