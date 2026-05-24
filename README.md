# agente01.github.io

Agente propio en Node.js para recibir mensajes de WhatsApp, interpretar pedidos simples y conectarse con Google Calendar.

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

## WhatsApp con Twilio

Tambien puedes usar Twilio en lugar de Meta Cloud API. Para Twilio, configura el webhook de mensajes entrantes con:

```text
https://agente01-github-io.onrender.com/webhook/twilio/whatsapp
```

En Twilio Sandbox for WhatsApp, pega esa URL en:

```text
When a message comes in
```

Metodo:

```text
POST
```

El endpoint de Twilio recibe `From` y `Body`, procesa el mensaje con el mismo agente de Calendar y responde con TwiML:

```xml
<Response><Message>...</Message></Response>
```

Para probar el sandbox, primero une tu WhatsApp al sandbox enviando el codigo `join ...` que Twilio muestra en la consola.

## Despliegue en Render

Render despliega este proyecto como Web Service Node.js y proporciona una URL HTTPS publica. El archivo `render.yaml` ya define:

- runtime: `node`
- build command: `npm install`
- start command: `npm start`
- health check: `/health`

En Render, crea un Blueprint o Web Service desde este repositorio:

```text
https://github.com/Tincho-git/agente01.github.io
```

Variables que debes cargar en Render:

```env
WHATSAPP_VERIFY_TOKEN=admin123
WHATSAPP_ACCESS_TOKEN=tu-token-de-meta
WHATSAPP_PHONE_NUMBER_ID=tu-phone-number-id
WHATSAPP_GRAPH_API_VERSION=v23.0
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
GOOGLE_REFRESH_TOKEN=tu-refresh-token
GOOGLE_CALENDAR_ID=primary
GOOGLE_REDIRECT_URI=tu-redirect-uri-configurado-en-google
DEFAULT_TIMEZONE=America/Argentina/Buenos_Aires
BUSINESS_NAME=Mi asistente
```

No subas `.env` a GitHub. En local usas `.env`; en Render cargas esas mismas claves desde el panel de Environment.

Si usas Twilio, las variables `WHATSAPP_*` de Meta pueden quedar vacias. Para el flujo basico de respuesta por TwiML no hace falta `TWILIO_ACCOUNT_SID` ni `TWILIO_AUTH_TOKEN`; Twilio usa la respuesta HTTP del webhook para contestar.

Cuando Render termine el deploy, usa la URL publica para configurar el webhook de Meta:

```text
Callback URL: https://tu-servicio.onrender.com/webhook/whatsapp
Verify token: admin123
```

Tambien verifica que el campo `messages` este suscripto en los webhooks de WhatsApp.

## GitHub Pages

El repositorio tambien conserva los archivos web existentes:

- `index.html`
- `privado.html`

## Notas importantes

- Este agente no guarda conversaciones en base de datos; esta pensado como base inicial.
- Antes de usarlo en produccion conviene agregar autenticacion interna, logs persistentes, confirmaciones antes de crear eventos y manejo de errores mas detallado.
- La integracion usa solo APIs oficiales: WhatsApp Cloud API y Google Calendar API.
