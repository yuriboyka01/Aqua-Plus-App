import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { normalizePhoneNumber } from '../utils/businessLogic.ts';

export function verifyMetaSignature(rawBody: Buffer, signature: string | undefined, appSecret: string): boolean {
  if (!signature || !appSecret || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const received = Buffer.from(signature.slice(7), 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function verifyMetaChallenge(mode: string | null, token: string, expected: string): boolean {
  if (mode !== 'subscribe' || expected.length < 24 || !token) return false;
  const a = Buffer.from(token), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseMetaPayload(rawBody: Buffer): any {
  const payload = JSON.parse(rawBody.toString('utf8'));
  if (!payload || payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
    throw new Error('Malformed WhatsApp webhook payload.');
  }
  for (const entry of payload.entry) {
    if (!Array.isArray(entry?.changes)) throw new Error('Malformed WhatsApp webhook payload.');
    for (const change of entry.changes) {
      if (change?.field !== 'messages' || !change.value || typeof change.value !== 'object') throw new Error('Malformed WhatsApp webhook payload.');
    }
  }
  return payload;
}

const optOutWords = new Set(['STOP', 'UNSUBSCRIBE', 'CANCEL', 'நிறுத்து', 'நிறுத்தவும்', 'வேண்டாம்']);
const supportedStatuses = new Set(['sent', 'delivered', 'read', 'failed']);

/** Admin Firestore is injected to keep event parsing/signature checks unit-testable. */
export async function processMetaWebhook(db: any, payload: any): Promise<{ processed: number; duplicates: number; ambiguousOptOuts: number }> {
  let processed = 0, duplicates = 0, ambiguousOptOuts = 0;
  const events: Array<{ kind: 'status' | 'inbound'; data: any }> = [];
  for (const entry of payload.entry) for (const change of entry.changes) {
    for (const status of change.value.statuses || []) if (supportedStatuses.has(status.status)) events.push({ kind: 'status', data: status });
    for (const message of change.value.messages || []) events.push({ kind: 'inbound', data: message });
  }
  for (const event of events) {
    const data = event.data;
    const eventHash = createHash('sha256').update(JSON.stringify({ kind: event.kind, data })).digest('hex');
    const eventRef = db.collection('whatsappWebhookEvents').doc(eventHash);
    const outcome = await db.runTransaction(async (tx: any) => {
      if ((await tx.get(eventRef)).exists) return 'duplicate';
      const at = data.timestamp ? new Date(Number(data.timestamp) * 1000).toISOString() : new Date().toISOString();
      if (event.kind === 'status') {
        if (typeof data.id !== 'string' || !data.id) throw new Error('Malformed WhatsApp status event.');
        const id = createHash('sha256').update(`${data.id}:${data.status}:${data.timestamp || ''}`).digest('hex');
        const deliveryRef = db.collection('messageDeliveryEvents').doc(id);
        const attemptMatches = await tx.get(db.collection('messageAttempts').where('providerMessageId', '==', data.id));
        const attemptId = attemptMatches.empty ? null : attemptMatches.docs[0].id;
        const ownerId = attemptMatches.empty ? 'aquaplus-business' : attemptMatches.docs[0].data().ownerId;
        tx.create(deliveryRef, {
          id, providerMessageId: data.id, status: data.status, timestamp: at,
          attemptId, ownerId,
          recipientPhone: typeof data.recipient_id === 'string' ? data.recipient_id : null,
          errorCode: data.errors?.[0]?.code ? String(data.errors[0].code) : null,
          createdAt: new Date().toISOString(),
        });
        const stateId = createHash('sha256').update(data.id).digest('hex');
        const statusRef = db.collection('messageDeliveryStatus').doc(stateId);
        const current = await tx.get(statusRef);
        if (!current.exists || Date.parse(current.data()?.timestamp || '') <= Date.parse(at)) {
          tx.set(statusRef, {
            providerMessageId: data.id, attemptId, ownerId, status: data.status, timestamp: at,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      } else {
        if (typeof data.from !== 'string' || typeof data.type !== 'string') throw new Error('Malformed WhatsApp inbound message.');
        const body = data.type === 'text' && typeof data.text?.body === 'string' ? data.text.body.trim().toUpperCase() : '';
        if (optOutWords.has(body)) {
          const snapshot = await tx.get(db.collection('customers'));
          const matches = snapshot.docs.filter((doc: any) => normalizePhoneNumber(doc.data().primaryPhone || '') === normalizePhoneNumber(data.from) || (doc.data().alternatePhone && normalizePhoneNumber(doc.data().alternatePhone) === normalizePhoneNumber(data.from)));
          if (matches.length === 1) {
            const customer = matches[0];
            tx.update(customer.ref, { whatsappConsent: false, consentTimestamp: at, consentSource: 'WhatsApp inbound opt-out' });
            const auditRef = db.collection('auditEvents').doc(`whatsapp_optout_${eventHash}`);
            tx.create(auditRef, { id: auditRef.id, action: 'WHATSAPP_OPT_OUT', details: 'Customer opted out through an inbound WhatsApp message.', entityType: 'Customer', entityId: customer.id, ownerId: customer.data().ownerId, timestamp: at });
          } else if (matches.length > 1) {
            tx.create(eventRef, { kind: event.kind, outcome: 'ambiguous', receivedAt: new Date().toISOString() });
            return 'ambiguous';
          }
        }
      }
      tx.create(eventRef, { kind: event.kind, receivedAt: new Date().toISOString() });
      return 'processed';
    });
    if (outcome === 'duplicate') duplicates++;
    else if (outcome === 'ambiguous') ambiguousOptOuts++;
    else processed++;
  }
  return { processed, duplicates, ambiguousOptOuts };
}
