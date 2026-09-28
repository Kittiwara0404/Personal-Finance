import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { validate } from '../middleware/validate.js';
import { prepareConversation, streamAdvice } from '../services/advisor.js';
import { advisorContext } from '../services/finance.js';
import { modulesAdvisorContext } from '../modules/index.js';
import { audit } from '../services/audit.js';

export const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(config.ai.maxInputChars * 4) }))
    .min(1)
    .max(config.ai.maxHistory * 2),
  shareContext: z.boolean().default(false),
  year: z.coerce.number().int().min(2020).max(2100).default(new Date().getFullYear()),
  stream: z.boolean().default(true),
});

export const advisorLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.userId,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'ถามบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' },
});

/** Shared handler for the in-app chat and the public API. Streams SSE unless stream=false. */
export async function handleChat(req, res) {
  const { messages, shareContext, year, stream } = req.valid;
  if (messages.at(-1).content.length > config.ai.maxInputChars) {
    return res.status(400).json({ error: `คำถามยาวเกิน ${config.ai.maxInputChars} ตัวอักษร` });
  }
  const prepared = await prepareConversation(messages);
  audit(req.userId, 'advisor_chat', req, { via: req.authMethod, allowed: prepared.ok, reason: prepared.reason ?? null, redactions: prepared.redactions ?? null });

  const context = prepared.ok && shareContext ? [advisorContext(req.userId, year), ...modulesAdvisorContext(req.userId)].join('\n') : null;

  if (!stream) {
    if (!prepared.ok) return res.json({ reply: prepared.reply, blocked: prepared.reason });
    let reply = '';
    const meta = await streamAdvice(prepared.messages, context, { onText: (t) => (reply += t) });
    return res.json({ reply, redactions: prepared.redactions, model: meta.model });
  }

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  if (!prepared.ok) {
    send('blocked', { reason: prepared.reason });
    send('text', { text: prepared.reply });
    send('done', {});
    return res.end();
  }
  if (Object.keys(prepared.redactions).length) send('redacted', prepared.redactions);

  const abort = new AbortController();
  res.on('close', () => abort.abort());
  try {
    const meta = await streamAdvice(prepared.messages, context, { onText: (text) => send('text', { text }), signal: abort.signal });
    send('done', { model: meta.model });
  } catch (err) {
    if (!abort.signal.aborted) {
      console.error('[advisor] stream failed:', err?.status ?? '', err?.message);
      send('error', { error: 'AI ขัดข้องชั่วคราว กรุณาลองใหม่' });
    }
  }
  res.end();
}

const router = Router();
router.get('/status', (req, res) => res.json({ enabled: config.ai.enabled, model: config.ai.enabled ? config.ai.model : 'offline' }));
router.post('/chat', advisorLimiter, validate(chatSchema), handleChat);
export default router;
