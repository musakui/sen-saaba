#!/bin/bash -e

if [ -z "$1" ]; then
  echo "version required"
  exit 1
fi

if [[ $1 =~ ^([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
  echo "major: ${BASH_REMATCH[1]}"
  echo "minor: ${BASH_REMATCH[2]}"
  echo "patch: ${BASH_REMATCH[3]}"
else
  echo "invalid version"
  exit 1
fi

NAME="musakui/saaba"

docker build \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  -f container/Dockerfile \
  -t ${NAME} -t ${NAME}:$1 .

docker push ${NAME}:latest
docker push ${NAME}:$1
