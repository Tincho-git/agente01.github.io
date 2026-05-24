import http from 'node:http';
import { URL } from 'node:url';
import { config } from './config.js';
import { CalendarAgent } from './agent.js';
import { GoogleCalendarClient } from './googleCalendar.js';
import { WhatsAppClient, extractMessagesFromWebhook, extractStatusesFromWebhook } from './whatsapp.js';

const calendar = new GoogleCalendarClient(config.google);
const whatsapp = new WhatsAppClient(config.whatsapp);
const agent = new CalendarAgent({
  calendar,
  timezone: config.agent.timezone,
  businessName: config.agent.businessName
});

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      return sendJson(response, 200, { ok: true });
    }

    if (request.method === 'GET' && url.pathname === '/webhook/whatsapp') {
      return verifyWhatsAppWebhook(url, response);
    }

    if (request.method === 'POST' && url.pathname === '/webhook/whatsapp') {
      return handleWhatsAppWebhook(request, response);
    }

    if (request.method === 'POST' && url.pathname === '/webhook/twilio/whatsapp') {
      return handleTwilioWhatsAppWebhook(request, response);
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Internal server error' });
  }
});

server.listen(config.port, () => {
  console.log(`WhatsApp Calendar Agent listening on http://localhost:${config.port}`);
  console.log(
    `WhatsApp config phoneNumberId=${config.whatsapp.phoneNumberId} `
    + `graphApiVersion=${config.whatsapp.graphApiVersion} `
    + `token=${maskToken(config.whatsapp.accessToken)}`
  );
});

function verifyWhatsAppWebhook(url, response) {
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken && challenge) {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end(challenge);
    return;
  }

  sendJson(response, 403, { error: 'Webhook verification failed' });
}

async function handleWhatsAppWebhook(request, response) {
  const payload = await readJson(request);
  const messages = extractMessagesFromWebhook(payload);
  const statuses = extractStatusesFromWebhook(payload);

  logWhatsAppWebhook({ messages, statuses });

  sendJson(response, 200, { received: true });

  for (const message of messages) {
    try {
      const reply = message.unsupportedType
        ? `Recibi un ${message.unsupportedType}, pero por ahora solo entiendo texto.`
        : await agent.handleMessage(message.text);

      await whatsapp.sendText(message.from, reply);
    } catch (error) {
      console.error('Failed to process WhatsApp message', error);
      try {
        await whatsapp.sendText(
          message.from,
          'Tuve un problema procesando el pedido. Revisa la configuracion del agente o intenta de nuevo.'
        );
      } catch (sendError) {
        console.error('Failed to send WhatsApp error reply', sendError);
      }
    }
  }
}

async function handleTwilioWhatsAppWebhook(request, response) {
  const form = await readForm(request);
  const from = form.get('From') || 'unknown';
  const body = form.get('Body') || '';

  console.log(`Twilio WhatsApp message received from ${from}: ${body}`);

  try {
    const reply = await agent.handleMessage(body);
    sendXml(response, 200, twilioMessageResponse(reply));
  } catch (error) {
    console.error('Failed to process Twilio WhatsApp message', error);
    sendXml(
      response,
      200,
      twilioMessageResponse('Tuve un problema procesando el pedido. Revisa la configuracion del agente o intenta de nuevo.')
    );
  }
}

function logWhatsAppWebhook({ messages, statuses }) {
  if (messages.length === 0 && statuses.length === 0) {
    console.log('WhatsApp webhook received without messages or statuses');
    return;
  }

  for (const message of messages) {
    console.log(`WhatsApp message received from ${message.from}: ${message.text || message.unsupportedType}`);
  }

  for (const status of statuses) {
    const errorSummary = status.errors
      .map((error) => `${error.code} ${error.title || error.message || 'Unknown error'}`)
      .join('; ');

    console.log(
      `WhatsApp status ${status.status} for ${status.recipientId || 'unknown recipient'}`
      + (errorSummary ? ` errors: ${errorSummary}` : '')
    );
  }
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error('Request body too large'));
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function readForm(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error('Request body too large'));
      }
    });
    request.on('end', () => {
      resolve(new URLSearchParams(body));
    });
    request.on('error', reject);
  });
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

function sendXml(response, statusCode, body) {
  response.writeHead(statusCode, { 'Content-Type': 'text/xml' });
  response.end(body);
}

function twilioMessageResponse(message) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `<Message>${escapeXml(message)}</Message>`,
    '</Response>'
  ].join('');
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function maskToken(token) {
  if (!token || token.length < 12) {
    return 'not-set';
  }

  return `${token.slice(0, 6)}...${token.slice(-4)} length=${token.length}`;
}
