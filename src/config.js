import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

loadDotEnv();

export const config = {
  port: numberFromEnv('PORT', 3000),
  whatsapp: {
    verifyToken: requiredEnv('WHATSAPP_VERIFY_TOKEN'),
    accessToken: requiredEnv('WHATSAPP_ACCESS_TOKEN'),
    phoneNumberId: requiredEnv('WHATSAPP_PHONE_NUMBER_ID'),
    graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0'
  },
  google: {
    clientId: requiredEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requiredEnv('GOOGLE_CLIENT_SECRET'),
    refreshToken: requiredEnv('GOOGLE_REFRESH_TOKEN'),
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary'
  },
  agent: {
    timezone: process.env.DEFAULT_TIMEZONE || 'America/Argentina/Buenos_Aires',
    businessName: process.env.BUSINESS_NAME || 'Asistente'
  }
};

export function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function numberFromEnv(name, fallback) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }

  return parsed;
}
