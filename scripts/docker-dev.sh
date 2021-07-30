#!/bin/sh
docker build -f container/Dockerfile -t saaba:dev . \
 && docker image prune -f \
 && docker run \
      --rm --init --env-file .env \
      -p 8080:80 -p 1935:1935/udp \
      saaba:dev
