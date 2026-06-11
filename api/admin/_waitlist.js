import { FieldValue } from '@google-cloud/firestore';
import { Resend } from 'resend';
import { setCors, verifyConsoleUser, requiredSupabaseEnvMissing } from './_lib.js';
import { buildBroadcastEmail } from './_email-templates.js';
import { getFirestoreClient } from '../_firestore.js';

const MAX_ENTRIES = 500;

async function fetchResendAudiences() {
  if (!process.env.RESEND_API_KEY) return [];
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const audiencesResp = await resend.audiences.list();
    const audiences = audiencesResp?.data?.data ?? [];
    const merged = [];
    for (const a of audiences) {
      try {
        const contactsResp = await resend.contacts.list({ audienceId: a.id });
        const contacts = contactsResp?.data?.data ?? [];
        for (const c of contacts) {
          if (!c.email) continue;
          merged.push({
            id: c.id ?? `resend:${a.id}:${c.email}`,
            email: c.email,
            firstName: c.first_name ?? '',
            lastName: c.last_name ?? '',
            source: `resend-audience:${a.name ?? a.id}`,
            audienceId: a.id,
            resendContactId: c.id,
            createdAt: c.created_at ?? new Date().toISOString(),
            unsubscribed: c.unsubscribed === true
          });
        }
      } catch {
        // skip individual audience errors
      }
    }
    return merged;
  } catch {
    return [];
  }
}

async function removeResendContact(entry) {
  if (!process.env.RESEND_API_KEY || !entry.audienceId) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    if (entry.resendContactId) {
      await resend.contacts.remove({
        id: entry.resendContactId,
        audienceId: entry.audienceId
      });
      return;
    }
    await resend.contacts.remove({
      email: entry.email,
      audienceId: entry.audienceId
    });
  } catch {
    // best effort
  }
}

async function collectWaitlistEntries() {
  const db = getFirestoreClient();
  const snap = await db.collection('waitlist').get();
  const firestoreEntries = snap.docs.map((doc) => {
    const data = doc.data() || {};
    const createdAtIso =
      data.createdAtIso ||
      (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null) ||
      null;
    return {
      id: data.id || doc.id,
      email: String(data.email || doc.id || '').toLowerCase(),
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      source: data.source || 'mesh-marketing-site',
      createdAt: createdAtIso,
      suppressed: data.suppressed === true,
      removedAt:
        data.removedAt?.toDate?.().toISOString?.() ||
        data.removedAt ||
        null,
      removedBy: data.removedBy || null
    };
  });

  const resendEntries = await fetchResendAudiences();
  const suppressed = new Set(
    firestoreEntries.filter((e) => e.suppressed).map((e) => e.email?.toLowerCase()).filter(Boolean)
  );

  const byEmail = new Map();
  for (const entry of [...resendEntries, ...firestoreEntries]) {
    const key = String(entry.email || '').toLowerCase();
    if (!key || suppressed.has(key)) continue;
    if (!byEmail.has(key)) byEmail.set(key, entry);
    else byEmail.set(key, { ...byEmail.get(key), ...entry });
  }

  const entries = [...byEmail.values()].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  const truncated = entries.length > MAX_ENTRIES;
  return {
    entries: entries.slice(0, MAX_ENTRIES),
    firestore: firestoreEntries.length,
    resendAudiences: resendEntries.length,
    truncated
  };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (requiredSupabaseEnvMissing()) {
    return res.status(503).json({ error: 'Admin Supabase environment is not configured' });
  }

  if (req.method === 'GET') {
    if (!(await verifyConsoleUser(req))) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { entries, firestore, resendAudiences, truncated } = await collectWaitlistEntries();
      return res.status(200).json({
        entries,
        total: entries.length,
        truncated,
        sources: {
          firestore,
          resendAudiences
        },
        emails: entries.map((e) => e.email?.toLowerCase()).filter(Boolean)
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to load waitlist' });
    }
  }

  if (req.method === 'DELETE') {
    const ctx = await verifyConsoleUser(req, { requireWrite: true });
    if (!ctx) return res.status(403).json({ error: 'Forbidden — read-only console role' });

    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'valid email required' });
    }

    try {
      const db = getFirestoreClient();
      await db
        .collection('waitlist')
        .doc(email)
        .set(
          {
            email,
            suppressed: true,
            removedAt: FieldValue.serverTimestamp(),
            removedBy: ctx.user.email || null,
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );

      const resendEntries = await fetchResendAudiences();
      const match = resendEntries.find((e) => e.email?.toLowerCase() === email);
      if (match) await removeResendContact(match);

      return res.status(200).json({ ok: true, email });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to remove from waitlist' });
    }
  }

  if (req.method === 'POST') {
    const ctx = await verifyConsoleUser(req, { requireWrite: true });
    if (!ctx) return res.status(403).json({ error: 'Forbidden — read-only console role' });

    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({ error: 'RESEND_API_KEY not configured' });
    }

    const { headline, message, subject, kicker, ctaLabel, ctaUrl } = req.body ?? {};
    const bodyText = String(message ?? '').trim();
    const mailSubject = String(subject ?? '').trim();
    const head = String(headline ?? '').trim();
    if (!mailSubject || !head || !bodyText) {
      return res.status(400).json({ error: 'subject, headline and message are required' });
    }

    const { entries } = await collectWaitlistEntries();
    if (!entries.length) {
      return res.status(400).json({ error: 'No waitlist recipients' });
    }

    const emailContent = buildBroadcastEmail({
      subject: mailSubject,
      headline: head,
      message: bodyText,
      kicker: String(kicker ?? '').trim() || undefined,
      ctaLabel: ctaLabel?.trim() || undefined,
      ctaUrl: ctaUrl?.trim() || undefined
    });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const results = { sent: 0, failed: 0, errors: [] };

    for (const entry of entries) {
      const to = entry.email;
      if (!to) continue;
      try {
        await resend.emails.send({
          from: 'Mesh <noreply@try-mesh.com>',
          to,
          subject: emailContent.subject,
          html: emailContent.html
        });
        results.sent++;
      } catch (e) {
        results.failed++;
        if (results.errors.length < 5) {
          results.errors.push({ email: to, error: e.message });
        }
      }
      await new Promise((r) => setTimeout(r, 120));
    }

    return res.status(200).json({
      ok: true,
      ...results,
      total: entries.length
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
