# WhatsApp Calendar Agent

Implementacion propia en Node.js para recibir mensajes de WhatsApp, interpretar pedidos simples y conectarse con Google Calendar.

## Que hace

- Expone un webhook compatible con WhatsApp Cloud API.
- Verifica el webhook con `WHATSAPP_VERIFY_TOKEN`.
- Recibe mensajes entrantes de WhatsApp.
- Responde por WhatsApp usando la API de Meta.
- Consulta eventos proximos de Google Calendar.
- Crea eventos simples en Google Calendar a partir de mensajes.

## Requisitos

- Node.js 20 o superior.
- Una app de Meta con WhatsApp Cloud API configurada.
- Un proyecto de Google Cloud con Calendar API habilitada.
- Credenciales OAuth de Google con un `refresh_token`.

## Configuracion

1. Copia `.env.example` a `.env`.
2. Completa las variables de WhatsApp y Google Calendar.
3. Inicia el agente:

```bash
npm start
```

El servidor levanta por defecto en `http://localhost:3000`.

## Obtener el refresh token de Google

Completa primero `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env`.

Luego genera la URL de consentimiento:

```bash
npm run google:auth-url
```

Abre la URL, autoriza Calendar y copia el codigo. Despues cambialo por un refresh token:

```bash
npm run google:exchange-code -- CODIGO_DE_GOOGLE
```

Pega el resultado `GOOGLE_REFRESH_TOKEN=...` en `.env`.

## Endpoints

- `GET /health`: estado del servicio.
- `GET /webhook/whatsapp`: verificacion de WhatsApp.
- `POST /webhook/whatsapp`: entrada de mensajes.

## Ejemplos de mensajes

- `que tengo hoy`
- `que tengo manana`
- `agenda llamada con Juan manana a las 15`
- `crear reunion con Ana el 2026-05-25 a las 10:30`

## Webhook publico

WhatsApp necesita una URL HTTPS publica. Para desarrollo puedes usar un tunel como ngrok o Cloudflare Tunnel y apuntar el webhook de Meta a:

```text
https://tu-url-publica/webhook/whatsapp
```

## Notas importantes

- Este agente no guarda conversaciones en base de datos; esta pensado como base inicial.
- Antes de usarlo en produccion conviene agregar autenticacion interna, logs persistentes, confirmaciones antes de crear eventos y manejo de errores mas detallado.
- La integracion usa solo APIs oficiales: WhatsApp Cloud API y Google Calendar API.
