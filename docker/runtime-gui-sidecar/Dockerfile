FROM debian:12-slim

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    chromium \
    dbus-x11 \
    fonts-liberation \
    nodejs \
    novnc \
    openbox \
    npm \
    python3 \
    websockify \
    x11vnc \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN npm install -g playwright@1.55.0 \
  && playwright install chromium \
  && npm cache clean --force

COPY docker/runtime-gui-sidecar/atoll-gui-sidecar /usr/local/bin/atoll-gui-sidecar

RUN chmod +x /usr/local/bin/atoll-gui-sidecar \
  && mkdir -p /atoll-gui-workspace

ENV DISPLAY=:99
ENV CHROME_BIN=/usr/bin/chromium
ENV ATOLL_GUI_SIDECAR_SCREEN=1440x900x24
ENV ATOLL_GUI_SIDECAR_ENABLE_VNC=0
ENV ATOLL_GUI_SIDECAR_VNC_PORT=5900
ENV ATOLL_GUI_SIDECAR_NOVNC_PORT=6080
ENV ATOLL_GUI_SIDECAR_PLAYWRIGHT_PORT=3000
ENV ATOLL_GUI_SIDECAR_PLAYWRIGHT_PATH=/playwright

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/atoll-gui-sidecar"]
