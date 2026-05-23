export class WhatsAppClient {
  constructor({ accessToken, phoneNumberId, graphApiVersion }) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.graphApiVersion = graphApiVersion;
  }

  async sendText(to, body) {
    const response = await fetch(
      `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: {
            preview_url: false,
            body
          }
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WhatsApp API error ${response.status}: ${text}`);
    }

    return response.json();
  }
}

export function extractMessagesFromWebhook(payload) {
  const messages = [];

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const message of value.messages || []) {
        if (message.type !== 'text') {
          messages.push({
            from: message.from,
            text: '',
            unsupportedType: message.type
          });
          continue;
        }

        messages.push({
          from: message.from,
          text: message.text?.body || '',
          id: message.id
        });
      }
    }
  }

  return messages;
}
