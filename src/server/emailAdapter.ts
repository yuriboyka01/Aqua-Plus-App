/** Server-side email adapter backed by Resend's REST API. */

export interface EmailConfig {
  apiKey?: string;
  fromEmail?: string;
}

export interface SendEmailResult {
  success: boolean;
  status: 'sent' | 'failed' | 'not_configured';
  messageId?: string;
  error?: string;
}

export function getEmailConfig(): EmailConfig {
  const env = typeof process !== 'undefined' && process?.env ? process.env : {};
  return {
    apiKey: env.RESEND_API_KEY || '',
    fromEmail: env.EMAIL_FROM || '',
  };
}

export function getEmailIntegrationStatus(): {
  status: 'not_configured' | 'configured' | 'error';
  details: string;
} {
  const config = getEmailConfig();
  if (!config.apiKey || !config.fromEmail) {
    return {
      status: 'not_configured',
      details: 'Set RESEND_API_KEY and EMAIL_FROM in the server environment to enable email delivery.',
    };
  }
  return { status: 'configured', details: 'Resend credentials are present. Provider connectivity and credential validity are not verified until a submission is attempted.' };
}

export async function sendOwnerDailyReportEmail(params: {
  recipientEmail: string;
  subject: string;
  textContent: string;
  reportDate: string;
}): Promise<SendEmailResult> {
  const config = getEmailConfig();
  if (!config.apiKey || !config.fromEmail) {
    return {
      success: false,
      status: 'not_configured',
      error: 'Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM on the server.',
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        from: config.fromEmail,
        to: [params.recipientEmail],
        subject: params.subject,
        text: params.textContent,
      }),
    });
    const result = await response.json() as { id?: string; message?: string; name?: string };
    if (!response.ok) {
      return {
        success: false,
        status: 'failed',
        error: result.message || result.name || `Email provider returned HTTP ${response.status}.`,
      };
    }
    if (!result.id) {
      return { success: false, status: 'failed', error: 'Email provider did not return a message ID.' };
    }
    return { success: true, status: 'sent', messageId: result.id };
  } catch (error) {
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Network error connecting to the email provider.',
    };
  }
}
