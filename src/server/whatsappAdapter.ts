/**
 * Meta WhatsApp Business Platform Cloud API Server Adapter.
 * Communicates with the configured Meta Graph API version.
 * Never claims success unless Meta returns a successful message ID.
 */

export interface WhatsAppConfig {
  accessToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  templateName?: string;
  graphApiVersion?: string;
}

export interface SendWhatsAppResult {
  success: boolean;
  providerMessageId?: string;
  status: 'sent' | 'failed' | 'not_configured' | 'unknown';
  error?: string;
  httpStatus?: number;
}

export function getWhatsAppConfig(): WhatsAppConfig {
  const env = typeof process !== 'undefined' && process?.env ? process.env : {};
  return {
    accessToken: env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    templateName: env.WHATSAPP_TEMPLATE_NAME || 'service_maintenance_reminder',
    graphApiVersion: env.WHATSAPP_GRAPH_API_VERSION || 'v25.0',
  };
}

export function getWhatsAppIntegrationStatus(): {
  status: 'not_configured' | 'configured' | 'connected' | 'error';
  details: string;
  phoneNumberIdMasked?: string;
} {
  const config = getWhatsAppConfig();

  if (!config.accessToken || !config.phoneNumberId) {
    return {
      status: 'not_configured',
      details: 'Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID in server environment variables.',
    };
  }

  return {
    status: 'configured',
    details: 'Server credentials are present. Connectivity and token validity are not checked by a message-free probe; successful submissions are API accepted, and delivery is confirmed only by webhook status events.',
    phoneNumberIdMasked: config.phoneNumberId ? `...${config.phoneNumberId.slice(-4)}` : undefined,
  };
}

/**
 * Sends an official WhatsApp Template message through Meta Graph API
 */
export async function sendWhatsAppTemplateMessage(params: {
  recipientPhone: string;
  customerName: string;
  lastServiceDate: string;
  businessPhone: string;
  languageCode?: 'en' | 'ta';
}): Promise<SendWhatsAppResult> {
  const config = getWhatsAppConfig();

  if (!config.accessToken || !config.phoneNumberId) {
    return {
      success: false,
      status: 'not_configured',
      error: 'WhatsApp Business Cloud API is not configured on the server. Please provide WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in environment variables.',
    };
  }

  // Format recipient phone: numbers only with country code 91
  let cleanPhone = params.recipientPhone.replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }

  const graphVersion = /^v\d+\.0$/.test(config.graphApiVersion || '')
    ? config.graphApiVersion
    : 'v25.0';
  const endpoint = `https://graph.facebook.com/${graphVersion}/${config.phoneNumberId}/messages`;

  const isHelloWorld = (config.templateName || '').toLowerCase() === 'hello_world';
  const requestPayload = {
    messaging_product: 'whatsapp',
    to: cleanPhone,
    type: 'template',
    template: isHelloWorld
      ? {
          name: 'hello_world',
          language: {
            code: 'en_US',
          },
        }
      : {
          name: config.templateName || 'service_maintenance_reminder',
          language: {
            code: params.languageCode || 'en_US',
          },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: params.customerName },
                { type: 'text', text: params.lastServiceDate },
                { type: 'text', text: params.businessPhone },
              ],
            },
          ],
        },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(15_000),
    });

    const data: any = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || `Meta API HTTP ${response.status}`;
      return {
        success: false,
        status: 'failed',
        error: errorMsg,
        httpStatus: response.status,
      };
    }

    const messageId = data?.messages?.[0]?.id;
    if (typeof messageId !== 'string' || !messageId) {
      return {
        success: false,
        status: 'unknown',
        error: 'Meta response was malformed; provider outcome is unknown and requires reconciliation.',
        httpStatus: response.status,
      };
    }
    return {
      success: true,
      status: 'sent',
      providerMessageId: messageId,
      httpStatus: response.status,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'unknown',
      error: 'Meta request outcome is unknown due to a network or timeout error; reconcile before retrying.',
    };
  }
}
