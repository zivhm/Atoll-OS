

# Atoll OS

<div align="center">

<img src="web/src/assets/logo/atoll-lockup.svg" alt="Atoll" width="150" />

### Convierte agentes en blanco en asistentes listos para trabajar.

[Página principal](https://zivhm.github.io/Atoll-OS/) · [Inicio rápido](#-quick-start) · [Docker Compose](#-docker-compose) · [Conceptos clave](#-core-concepts) · [Configuración](#%EF%B8%8F-configuration)

[![Live site](https://img.shields.io/badge/site-live-22A4B4?style=flat-square)](https://zivhm.github.io/Atoll-OS/)
[![Deploy](https://img.shields.io/github/actions/workflow/status/zivhm/Atoll-OS/deploy-pages.yml?style=flat-square&label=deploy)](https://github.com/zivhm/Atoll-OS/actions/workflows/deploy-pages.yml)
[![License](https://img.shields.io/github/license/zivhm/Atoll-OS?style=flat-square)](LICENSE)

![Self-hosted](https://img.shields.io/badge/self--hosted-control%20plane-1C1F2A?style=flat-square)
![Runtime](https://img.shields.io/badge/runtime-Docker-2496ED?style=flat-square)
![Web](https://img.shields.io/badge/web-React%20%2B%20Vite-61DAFB?style=flat-square)
![API](https://img.shields.io/badge/api-Fastify%20%2B%20TypeScript-000000?style=flat-square)

</div>

---

## 🏝️ Por qué Atoll

La mayoría de las herramientas de agentes te entregan una pizarra en blanco y esperan que te encargues del resto.
Para un freelancer o un propietario no técnico, eso es un callejón sin salida. La mayoría simplemente no tiene el tiempo o el contexto para construir desde cero.

Atoll entrega asistentes que ya conocen su trabajo.
Elige un rol (contador, agente de soporte, gestor de redes sociales o define el tuyo) y el asistente viene precargado con la identidad, objetivos y comportamiento adecuados.

El motor de ejecución subyacente no cambia. Simplemente le damos un propósito antes de que lo abras.

**Atoll se centra en la capa operativa alrededor del agente.**

- 🤖 Crea asistentes con identidades reutilizables, definiciones de roles y contexto de habilidades/herramientas
- 📁 Comparte archivos directamente con los asistentes
- 🐳 Procciona entornos de ejecución contenerizados sin cablear manualmente cada instancia
- 🔗 Coloca asistentes en espacios de trabajo compartidos o dedicados
- 💬 Configura canales de Telegram y Discord desde la misma interfaz
- 🛠 Opera asistentes desde el navegador: chat, registros, estado, reparación, reconciliación, historial de eventos
- 🛡 Los asistentes se ejecutan en sus propios contenedores de Docker aislados con volúmenes y redes dedicados

---

## Visión general

| Capacidad | Descripción |
| --- | --- |
| **Configuración rápida de asistentes** | Inicia un asistente, asigna un espacio de trabajo y provisiona un entorno de ejecución en minutos |
| **Catálogo de identidades** | Gestiona identidades empresariales reutilizables y preajustes de asistentes desde la interfaz |
| **Operaciones del entorno de ejecución** | Inspecciona el estado, registros, eventos, acciones de reparación y flujos de reconciliación |
| **Conexión de canales** | Expone configuraciones de mensajería compartida en la interfaz y configuraciones avanzadas nativas del entorno de ejecución donde difieren las semánticas |
| **Un solo host** | Ejecuta localmente durante el desarrollo o en Docker Compose para un despliegue autoalojado |

---


## Vista previa de la aplicación

![Chat view](landing/public/images/chat.png)

<table>
  <tr>
    <td><img src="landing/public/images/setup-1.png" alt="Helper setup" /></td>
    <td><img src="landing/public/images/set-d.png" alt="Helper settings" /></td>
    <td><img src="landing/public/images/ids-d.png" alt="Identity catalog" /></td>
  </tr>
</table>

---

## 🚀 Inicio rápido

### Requisitos previos

- Node.js `20+` y `npm`
- Docker Desktop u otro motor de Docker accesible

### Pasos

**1. Copia el archivo de entorno de ejemplo**

```bash
cp .env.example .env
```

**2. Establece las variables obligatorias en `.env`**

```env
ATOLL_SECRETS_KEY=<long-random-string>         # required
ATOLL_LLM_PROVIDER_API_KEY=<your-api-key>      # optional to set default
```

**3. Instala las dependencias**

```bash
npm install
```

**4. Inicia la API y la aplicación juntas**

```bash
npm run dev
```

**5. Abre en tu navegador**

Abre [http://127.0.0.1:8450](http://127.0.0.1:8450)

---

## 🐳 Docker Compose

Para un despliegue autoalojado en contenedores:

```bash
cp .env.example .env          # set ATOLL_SECRETS_KEY inside
docker compose up --build
```

Abre [http://127.0.0.1:8450](http://127.0.0.1:8450)

---

## 🧩 Conceptos clave

### Espacios de trabajo
Atoll utiliza inquilinos como espacios de trabajo.

| Tipo | Descripción |
| --- | --- |
| `default` | Espacio de trabajo individual para asistentes, para configuración rápida |
| `dedicated` | Espacio de trabajo compartido con contexto de red y almacenamiento reutilizable |

### Asistentes
Un asistente es el registro del agente visible para el usuario: nombre, avatar, título de rol, preajuste, habilidades y configuración de canales.

### Entornos de ejecución
Un entorno de ejecución es el entorno de ejecución gestionado adjunto a un asistente. Atoll lo provisiona a través de Docker, rastrea su estado y expone acciones del ciclo de vida a través de la API y la interfaz.

### Identidades
Los preajustes de identidades reutilizables se encuentran en [`src/business-identities`](src/business-identities) y son editables en la pantalla `/identities`. Estos preajustes proporcionan datos de origen a los documentos de identidad, alma y herramientas del asistente.

---

## ⚙️ Configuración

Toda la configuración importante reside en el `.env` en la raíz del repositorio.

| Variable | Requerida | Propósito |
| --- | :---: | --- |
| `ATOLL_SECRETS_KEY` | ✅ | Clave de cifrado para secretos almacenados y configuración sensible del entorno de ejecución |
| `ATOLL_LLM_PROVIDER_API_KEY` | | Clave de API del proveedor predeterminada cuando un asistente no tiene ninguna |
| `PORT` | | Puerto de la API (predeterminado `8450`) |
| `HOST` | | Host de enlace de la API |
| `RUNTIME_PROVIDER` | | Proveedor de LLM predeterminado para nuevos asistentes |
| `RUNTIME_MODEL` | | Modelo de LLM predeterminado para nuevos asistentes |
| `RUNTIME_HTTP_TIMEOUT_MS` | | Tiempo de espera HTTP del entorno de ejecución en ms (predeterminado `3600000`) |
| `RUNTIME_OPENCLAW_IMAGE` | ✅ | Imagen del entorno de ejecución OpenClaw |
| `RUNTIME_ZEROCLAW_IMAGE` | ✅ | Imagen del entorno de ejecución ZeroClaw |
| `RUNTIME_HERMES_IMAGE` | ✅ | Imagen del entorno de ejecución Hermes |
| `RUNTIME_GUI_SIDECAR_IMAGE` | ✅ | Imagen del entorno de ejecución sidecar de GUI (requerido cuando se usa `gui.enabled`) |
| `RUNTIME_STARTUP_VALIDATION` | | Validación de requisitos previos: `strict`, `warn` o `off` |
| `RUNTIME_ALLOW_PUBLIC_BIND` | | Si las puertas de enlace de los asistentes se enlazan al bucle local del host de forma predeterminada |
| `RUNTIME_REQUIRE_PAIRING` | | Si es necesario el emparejamiento para los entornos de ejecución compatibles |
| `ATOLL_CORS_ALLOWED_ORIGINS` | | Necesario cuando la aplicación web se encuentra en un origen diferente al de la API |

> La pantalla de Configuración escribe los valores predeterminados del entorno de ejecución gestionado de nuevo en `.env`. Los cambios requieren un reinicio de la API para aplicarse por completo.

Fuentes de las imágenes del entorno de ejecución:
- `RUNTIME_OPENCLAW_IMAGE`: imagen publicada (predeterminado en `.env.example`: `zivhm/openclaw`).
- `RUNTIME_ZEROCLAW_IMAGE`: imagen publicada (predeterminado en `.env.example`: `zivhm/zeroclaw-runtime`).
- `RUNTIME_HERMES_IMAGE`: imagen publicada (predeterminado en `.env.example`: `nousresearch/hermes-agent`).
- `RUNTIME_GUI_SIDECAR_IMAGE`: imagen local construida a partir de [`docker/runtime-gui-sidecar/Dockerfile`](docker/runtime-gui-sidecar/Dockerfile) (etiqueta predeterminada en `.env.example`: `atoll-gui-sidecar`).

Opciones del entorno de ejecución sidecar de GUI (disponibles en todos los tipos de entorno de ejecución):
- `gui.enabled`: crea y reconcilia un sidecar de GUI para el contenedor del entorno de ejecución.

---

## 📡 Superficie de la API

| Grupo de rutas | Propósito |
| --- | --- |
| `/api/healthz` | Verificación de estado |
| `/api/auth/me` | Contexto de autenticación |
| `/api/settings/config` | Valores predeterminados del entorno de ejecución |
| `/api/tenants` | Gestión de espacios de trabajo |
| `/api/agents` | CRUD de asistentes |
| `/api/agent-presets` | Catálogo de preajustes |
| `/api/runtime/catalog` | Tipos de entorno de ejecución disponibles |
| `/api/runtime/provision-jobs` | Seguimiento de trabajos de provisionado |
| `/api/runtime/instances/*` | Ciclo de vida, chat, diagnósticos |
| `/api/runtime/events` | Historial de eventos |
| `/api/runtime/model-catalog` | Listado de modelos de LLM |

---

## 📁 Estructura del proyecto

```
src/                      Fastify API, runtime orchestration, storage, identity presets
src/http/routes/          API route modules
src/business-identities/  Reusable helper identity presets
web/                      React/Vite control-plane frontend
landing/                  GitHub Pages landing site
scripts/                  Development helpers
tests/                    API/runtime-focused tests
Dockerfile                Production image build
docker-compose.yml        Single-host deployment
atoll-state.json          Local persisted state file
```

---

## Notas sobre el entorno de ejecución

| Configuración | Valor |
| --- | --- |
| Entornos de ejecución compatibles | OpenClaw, ZeroClaw, Hermes |
| Tipo de entorno de ejecución predeterminado | `openclaw` |
| Proveedor alojado predeterminado | `openrouter` |
| Modelo alojado predeterminado | `anthropic/claude-sonnet-4.6` |
| Dirección a largo plazo | Soporte de entorno de ejecución agnóstico al Harness/Proveedor |

---

## 🌐 Página principal

El sitio público está alojado en GitHub Pages, separado de la aplicación de plano de control autoalojada.

- **Sitio:** [https://zivhm.github.io/Atoll-OS/](https://zivhm.github.io/Atoll-OS/)
- **Código fuente:** [`landing/`](landing/)

---

## Licencia

Consulta [`LICENSE`](LICENSE).
