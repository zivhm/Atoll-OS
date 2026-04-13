# Runtime GUI Sidecar Image

Generic GUI sidecar for any Atoll runtime type.

Includes:
- `xvfb` virtual display
- `openbox` window manager
- `chromium`
- Playwright WS server on `:3000/playwright`
- optional `x11vnc` + `noVNC`

Build:

```powershell
docker build -t atoll-gui-sidecar -f docker/runtime-gui-sidecar/Dockerfile .
```

Use with runtime option keys:
- `gui.enabled`: enable sidecar provisioning
- `gui.enableVnc`: enable VNC + noVNC services
- `gui.noVncPort`: optional host loopback port for noVNC (container port 6080)

Runtime env contract exposed to the main runtime container:
- `ATOLL_GUI_PLAYWRIGHT_WS_ENDPOINT=ws://<sidecar-container>:3000/playwright`
- `ATOLL_GUI_SIDECAR_CONTAINER=<sidecar-container>`
