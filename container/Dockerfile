# build srt-live-transmit
FROM debian:stable-slim AS buildsrt

ARG SRT_VER=v1.4.3

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
FROM debian:stable-slim AS buildvnc

ARG VNC_VER=0.9.13

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      git ca-certificates gcc cmake make automake chrpath libtool \
      libssl-dev libjpeg-dev libpng-dev libvncserver-dev libdbus-1-dev \
      libxext-dev libxdamage-dev libxinerama-dev libxfixes-dev libxtst-dev libxrandr-dev libxss-dev \
 && rm -rf /var/lib/apt/lists/*

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

# build nodejs app
FROM debian:stable-slim AS buildapp

ARG NODE_VER=14

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN curl -sLo - https://deb.nodesource.com/setup_${NODE_VER}.x | bash
RUN apt-get update \
 && apt-get install -y nodejs \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm@7

COPY saaba-docker /tmp
WORKDIR /tmp
RUN npm install && npm run build

# build obs
FROM debian:stable-slim as buildobs

ARG OBS_VER=27.0.1
ARG OWS_VER=4.9.1
ARG CEF_VER=4280

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl ca-certificates git cmake swig pkg-config build-essential \
      libudev-dev libmbedtls-dev libcurl4-openssl-dev libjansson-dev \
      libjack-jackd2-dev libasound2-dev libpulse-dev libspeexdsp-dev \
      libv4l-dev libx264-dev libglvnd-dev libgles2-mesa libgles2-mesa-dev \
      libswresample-dev libswscale-dev libfontconfig-dev libfreetype6-dev \
      libwayland-dev libxss-dev libx11-dev libxcomposite-dev libx11-xcb-dev \
      libnss3-dev libnspr4-dev libatk1.0-dev libatk-bridge2.0-dev libatspi2.0-dev \
      libavcodec-dev libavfilter-dev libavdevice-dev libavformat-dev libavutil-dev \
      libqt5svg5-dev libqt5x11extras5-dev qtbase5-dev qtbase5-private-dev qtwayland5 \
      libxcb1-dev libxcb-shm0-dev libxcb-xinerama0-dev libxcb-randr0-dev libxcb-xfixes0-dev \
 && rm -rf /var/lib/apt/*

WORKDIR /tmp

RUN curl -sL https://cdn-fastly.obsproject.com/downloads/cef_binary_${CEF_VER}_linux64.tar.bz2 | tar xj
RUN git clone https://github.com/obsproject/obs-studio.git

WORKDIR /tmp/obs-studio
RUN git checkout ${OBS_VER}
RUN git submodule update --init plugins/obs-browser

RUN sed -i '/.*decklink.*/d' UI/frontend-plugins/CMakeLists.txt
RUN cmake -B build -DUNIX_STRUCTURE=1 \
      -DBUILD_VST=OFF -DENABLE_PIPEWIRE=OFF -DDISABLE_DECKLINK=1 \
      -DBUILD_BROWSER=ON -DCEF_ROOT_DIR="../cef_binary_${CEF_VER}_linux64"

RUN cmake --build build
WORKDIR /tmp/obs-studio/build
RUN DESTDIR=/built make install
RUN ln -s /built/usr/local/lib/libobs-frontend-api.so.0.0 /usr/local/lib/libobs-frontend-api.so

RUN apt-get update \
 && apt-get install -y --no-install-recommends libboost-all-dev \
 && rm -rf /var/lib/apt/*

WORKDIR /tmp
RUN git clone --recursive https://github.com/Palakis/obs-websocket.git
WORKDIR /tmp/obs-websocket/build
RUN git checkout ${OWS_VER}
RUN cmake -DLIBOBS_INCLUDE_DIR="/tmp/obs-studio/libobs/" -DCMAKE_INSTALL_PREFIX=/usr/local ..
RUN make && DESTDIR=/built make install

# main
FROM debian:stable-slim as main

# libxtst6, liblzo2 for x11vnc
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl ca-certificates nginx xvfb libxtst6 liblzo2-2 \
 && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libjansson4 libfontconfig1 libfreetype6 libswscale5 \
      libavfilter7 libavcodec58 libavformat58 libavutil56 libavdevice58 \
      libasound2 libjack0 libpulse0 libudev1 libspeexdsp1 libv4l-0 libwayland-egl1 \
      libcurl3-gnutls libnss3 libmbedtls12 libcups2 libatk1.0-0 libatk-bridge2.0-0 \
      libxcb-shm0 libxcb-xfixes0 libxcb-xinerama0 libxcb1 libxcomposite1 libxfixes3 \
      libqt5core5a libqt5gui5 libqt5svg5 libqt5xml5 libqt5widgets5 libqt5x11extras5 \
 && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

COPY --from=buildobs /built/usr /usr
COPY --from=buildsrt /tmp/srt/srt-live-transmit /usr/bin/slt
COPY --from=buildvnc /tmp/build/libvnc* /usr/lib/x86_64-linux-gnu/
COPY --from=buildvnc /usr/local/bin/x11vnc /usr/bin/vnc
COPY --from=buildapp /tmp/dist/saaba-docker /usr/bin/saaba
RUN ldconfig

COPY files/etc /etc
COPY files/obs-studio /root/.config/obs-studio
COPY files/startup.sh /

WORKDIR /root
ENV DISPLAY :1

EXPOSE 80
EXPOSE 1900-1999/udp

HEALTHCHECK --interval=60s CMD curl -f http://localhost/

CMD ["/startup.sh"]
