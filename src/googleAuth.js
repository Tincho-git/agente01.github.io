import { readFileSync } from 'node:fs';

loadDotEnv();

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';

const command = process.argv[2];

if (command === 'url') {
  printAuthUrl();
} else if (command === 'exchange') {
  await exchangeCode();
} else {
  console.log('Uso:');
  console.log('  npm run google:auth-url');
  console.log('  npm run google:exchange-code -- CODIGO_DE_GOOGLE');
}

function printAuthUrl() {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');

  console.log('Abre esta URL, autoriza Calendar y copia el codigo:');
  console.log(url.toString());
}

async function exchangeCode() {
  const code = process.argv[3];
  if (!code) {
    throw new Error('Falta el codigo. Uso: npm run google:exchange-code -- CODIGO_DE_GOOGLE');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google OAuth error ${response.status}: ${text}`);
  }

  const data = await response.json();
  console.log('Pega esta variable en tu .env:');
  console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name} en .env`);
  }
  return value;
}

function loadDotEnv() {
  const envPath = new URL('../.env', import.meta.url);

  try {
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
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
  } catch {
    return;
  }
}
