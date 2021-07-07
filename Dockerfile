# build srt-live-transmit
FROM ubuntu:20.04 AS buildsrt

ARG SRT_VER=v1.4.3

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      git ca-certificates cmake make gcc g++ libssl-dev tcl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp
RUN git clone https://github.com/Haivision/srt.git
WORKDIR /tmp/srt
RUN git checkout ${SRT_VER}
RUN ./configure && make srt-live-transmit

# build x11vnc
FROM ubuntu:20.04 AS buildvnc

ARG VNC_VER=0.9.13

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      git ca-certificates make cmake gcc \
      libssl-dev libjpeg-dev libpng-dev \
 && rm -rf /var/lib/apt/lists/*

RUN sed -i 's/^# deb-src /deb-src /' /etc/apt/sources.list
RUN apt-get update && apt-get build-dep -y --no-install-recommends x11vnc

WORKDIR /tmp
RUN git clone https://github.com/libvnc/x11vnc
WORKDIR /tmp/x11vnc
RUN autoreconf -fiv && ./configure \
 && make && make install

WORKDIR /tmp
RUN git clone https://github.com/libvnc/libvncserver
WORKDIR /tmp/libvncserver
RUN git checkout LibVNCServer-${VNC_VER}
WORKDIR /tmp/build
RUN cmake ../libvncserver && cmake --build .

# main
FROM ubuntu:20.04 as main

ARG OBS_PPA=obsproject/obs-studio
ARG OBS_PPA_KEY=F425E228

ARG OWS_VER=4.9.1

ENV DEBIAN_FRONTEND noninteractive

# CORE
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
   curl ca-certificates gnupg nginx \
 && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# OBS

# add-apt-repository ppa:obsproject/obs-studio
RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys ${OBS_PPA_KEY}
RUN echo "deb http://ppa.launchpad.net/${OBS_PPA}/ubuntu focal main" > /etc/apt/sources.list.d/obs.list

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
   xvfb ffmpeg obs-studio qt5-image-formats-plugins \
   libxtst6 liblzo2-2 \
 && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

RUN curl -sLo /ows.deb https://github.com/Palakis/obs-websocket/releases/download/${OWS_VER}/obs-websocket_${OWS_VER}-1_amd64.deb \
 && dpkg -i /ows.deb && rm /ows.deb \
 && rm /usr/lib/obs-plugins/decklink*

COPY --from=buildsrt /tmp/srt/srt-live-transmit /usr/bin/slt
COPY --from=buildvnc /tmp/build/libvnc* /usr/lib/x86_64-linux-gnu/
COPY --from=buildvnc /usr/local/bin/x11vnc /usr/bin/vnc

COPY docker/etc /etc
COPY docker/obs-studio /root/.config/obs-studio
COPY docker/startup.sh /
COPY dist/saaba-backend /usr/bin/saaba

WORKDIR /root
ENV DISPLAY :1

EXPOSE 80
EXPOSE 1935/udp

HEALTHCHECK --interval=60s CMD curl -f http://localhost/

CMD ["/startup.sh"]
