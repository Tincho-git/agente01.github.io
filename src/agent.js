const DAY_MS = 24 * 60 * 60 * 1000;

export class CalendarAgent {
  constructor({ calendar, timezone, businessName }) {
    this.calendar = calendar;
    this.timezone = timezone;
    this.businessName = businessName;
  }

  async handleMessage(text) {
    const normalized = normalize(text);

    if (!normalized) {
      return 'Por ahora solo puedo procesar mensajes de texto.';
    }

    if (isHelp(normalized)) {
      return this.help();
    }

    if (wantsAgenda(normalized)) {
      return this.describeAgenda(normalized);
    }

    if (wantsCreateEvent(normalized)) {
      return this.createEventFromText(text, normalized);
    }

    return [
      `Soy ${this.businessName}. Puedo ayudarte con tu calendario.`,
      'Prueba con: "que tengo hoy" o "agenda llamada con Juan mañana a las 15".'
    ].join('\n');
  }

  help() {
    return [
      'Puedo consultar y crear eventos.',
      'Ejemplos:',
      '- que tengo hoy',
      '- que tengo mañana',
      '- agenda reunion con Ana el 2026-05-25 a las 10:30'
    ].join('\n');
  }

  async describeAgenda(normalized) {
    const range = resolveRange(normalized);
    const events = await this.calendar.listUpcoming({
      timeMin: range.start,
      timeMax: range.end,
      maxResults: 10
    });

    if (events.length === 0) {
      return `No encontre eventos para ${range.label}.`;
    }

    const lines = events.map((event) => {
      const start = event.start?.dateTime || event.start?.date;
      return `- ${formatDateTime(start, this.timezone)}: ${event.summary || 'Sin titulo'}`;
    });

    return [`Tu agenda para ${range.label}:`, ...lines].join('\n');
  }

  async createEventFromText(original, normalized) {
    const parsedDate = parseRequestedDate(normalized);
    const parsedTime = parseRequestedTime(normalized);

    if (!parsedDate || !parsedTime) {
      return 'Necesito fecha y hora para crear el evento. Ejemplo: "agenda reunion mañana a las 15".';
    }

    const title = extractTitle(original) || 'Evento desde WhatsApp';
    const start = new Date(parsedDate);
    start.setHours(parsedTime.hour, parsedTime.minute, 0, 0);

    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    const event = await this.calendar.createEvent({
      summary: title,
      description: `Creado por ${this.businessName} desde WhatsApp.`,
      start,
      end,
      timezone: this.timezone
    });

    return [
      `Listo, cree el evento: ${event.summary || title}`,
      `Inicio: ${formatDateTime(event.start?.dateTime || start.toISOString(), this.timezone)}`,
      event.htmlLink ? `Link: ${event.htmlLink}` : ''
    ].filter(Boolean).join('\n');
  }
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

function isHelp(text) {
  return ['ayuda', 'help', 'menu', 'opciones'].includes(text);
}

function wantsAgenda(text) {
  return /(que tengo|agenda|calendario|eventos|reuniones)/.test(text) && !wantsCreateEvent(text);
}

function wantsCreateEvent(text) {
  return /(agenda|agendar|crear|programa|programar|reserva|reservar)/.test(text);
}

function resolveRange(text) {
  const now = new Date();
  const start = startOfDay(now);

  if (/manana/.test(text)) {
    const tomorrow = new Date(start.getTime() + DAY_MS);
    return {
      label: 'mañana',
      start: tomorrow,
      end: new Date(tomorrow.getTime() + DAY_MS)
    };
  }

  if (/semana/.test(text)) {
    return {
      label: 'los proximos 7 dias',
      start,
      end: new Date(start.getTime() + 7 * DAY_MS)
    };
  }

  return {
    label: 'hoy',
    start,
    end: new Date(start.getTime() + DAY_MS)
  };
}

function parseRequestedDate(text) {
  const today = startOfDay(new Date());

  if (/pasado manana/.test(text)) {
    return new Date(today.getTime() + 2 * DAY_MS);
  }

  if (/manana/.test(text)) {
    return new Date(today.getTime() + DAY_MS);
  }

  if (/\bhoy\b/.test(text)) {
    return today;
  }

  const isoDate = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoDate) {
    return new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
  }

  const shortDate = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (shortDate) {
    const year = shortDate[3] ? Number(shortDate[3]) : today.getFullYear();
    return new Date(year, Number(shortDate[2]) - 1, Number(shortDate[1]));
  }

  return null;
}

function parseRequestedTime(text) {
  const explicit = text.match(/\b(?:a las|alas|@)\s*(\d{1,2})(?::|\.|h)?(\d{2})?\b/);
  const fallback = text.match(/\b(\d{1,2})(?::|\.|h)(\d{2})?\b/);
  const match = explicit || fallback;

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

function extractTitle(text) {
  return text
    .replace(/^(agenda|agendar|crear|programa|programar|reserva|reservar)\s+/i, '')
    .replace(/\s+(hoy|mañana|manana|pasado mañana|pasado manana)\b.*$/i, '')
    .replace(/\s+el\s+\d{4}-\d{2}-\d{2}.*$/i, '')
    .replace(/\s+el\s+\d{1,2}\/\d{1,2}(?:\/\d{4})?.*$/i, '')
    .replace(/\s+a las\s+\d{1,2}(?::\d{2})?.*$/i, '')
    .trim();
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateTime(value, timezone) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone
  }).format(new Date(value));
}
