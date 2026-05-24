const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_URL = 'https://www.googleapis.com/calendar/v3';

export class GoogleCalendarClient {
  constructor({ clientId, clientSecret, refreshToken, calendarId }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.calendarId = calendarId;
    this.cachedToken = null;
  }

  async listUpcoming({ timeMin, timeMax, maxResults = 10 }) {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(maxResults),
      timeMin: timeMin.toISOString()
    });

    if (timeMax) {
      params.set('timeMax', timeMax.toISOString());
    }

    const response = await this.request(`/calendars/${encodeURIComponent(this.calendarId)}/events?${params}`);
    return response.items || [];
  }

  async createEvent({ summary, description, start, end, timezone }) {
    return this.request(`/calendars/${encodeURIComponent(this.calendarId)}/events`, {
      method: 'POST',
      body: JSON.stringify({
        summary,
        description,
        start: {
          dateTime: start.toISOString(),
          timeZone: timezone
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: timezone
        }
      })
    });
  }

  async deleteEvent(eventId) {
    return this.request(`/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE'
    });
  }

  async request(path, options = {}) {
    const token = await this.getAccessToken();
    const response = await fetch(`${GOOGLE_CALENDAR_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Calendar API error ${response.status}: ${text}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async getAccessToken() {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.accessToken;
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google OAuth error ${response.status}: ${text}`);
    }

    const data = await response.json();
    this.cachedToken = {
      accessToken: data.access_token,
      expiresAt: now + data.expires_in * 1000
    };

    return this.cachedToken.accessToken;
  }
}
