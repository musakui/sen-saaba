# saaba docker

[
![Docker Image Version (latest by date)](https://img.shields.io/docker/v/musakui/saaba)
](https://hub.docker.com/r/musakui/saaba/tags)
[
![Docker Image Size (tag)](https://img.shields.io/docker/image-size/musakui/saaba/latest)
](https://hub.docker.com/r/musakui/saaba)

## Quick Start

To run on port `8080`, exposing port `1935` for SRT connections

```sh
docker run -e AUTH_TOKEN=[AUTH_TOKEN] -p 8080:80 -p 1935:1935/udp musakui/saaba
```

**Note:** `AUTH_TOKEN` is required

## Components

The following programs are built in seperate stages

- [`x11vnc`](https://github.com/LibVNC/x11vnc)
- [`saaba-docker`](../packages/saaba-docker)
- [`srt-live-transmit`](https://github.com/Haivision/srt)
- [`obs-studio`](https://github.com/obsproject/obs-studio) (with [`obs-websocket`](https://github.com/Palakis/obs-websocket))

The final container uses `nginx` to route external traffic

### `nginx` endpoints

| endpoint | description     | notes               |
|----------|-----------------|---------------------|
| `/`      | Healthcheck     | Just returns `"ok"` |
| `/api`   | [Main API](../packages/saaba-docker)  | Requires Authorization (`AUTH_TOKEN`) |
| `/obs`   | [OBS WebSocket](https://github.com/Palakis/obs-websocket) | |
| `/vnc`   | [VNC WebSocket](https://github.com/LibVNC/x11vnc)         | Connect with a client like [noVNC](https://github.com/novnc/noVNC) |

Refer to the full [`nginx` configuration](files/etc/nginx)

## Building

The build context is the root folder, so the `Dockerfile` needs to be specified

```sh
docker build -f container/Dockerfile -t [tag] .
```

