import { Router } from 'express';

const router = Router();

const DEFAULT_RAG_URL = 'https://migraine-rag-chatbot.onrender.com/api/chat';

/**
 * Health check proxy for RAG Chatbot
 */
router.get('/health', async (req, res) => {
  const ragChatbotUrl = process.env.RAG_CHATBOT_URL || DEFAULT_RAG_URL;
  const healthUrl = ragChatbotUrl.replace(/\/api\/chat\/?$/, '/health');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await response.json();
    return res.status(response.ok ? 200 : 503).json({ status: data.status || 'ok', remote: true });
  } catch (err) {
    return res.status(503).json({ status: 'unavailable', error: err.message });
  }
});

/**
 * POST /api/chat - Proxy chat message to hosted RAG chatbot
 */
router.post('/', async (req, res) => {
  const { message, language, sessionId } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      error: 'Message is required and must be a non-empty string.',
    });
  }

  const ragChatbotUrl = process.env.RAG_CHATBOT_URL || DEFAULT_RAG_URL;

  try {
    const controller = new AbortController();
    // 35s timeout to handle free-tier Render server wakeups
    const timeout = setTimeout(() => controller.abort(), 35000);

    const payload = {
      message: message.trim(),
    };
    if (language && language !== 'auto') {
      payload.language = language;
    }
    if (sessionId) {
      payload.sessionId = sessionId;
    }

    const response = await fetch(ragChatbotUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.error || data?.message || `External chat service returned HTTP ${response.status}`;
      return res.status(response.status).json({
        error: errorMsg,
      });
    }

    if (!data || typeof data.answer !== 'string') {
      return res.status(502).json({
        error: 'Received malformed response from external chat service.',
      });
    }

    return res.status(200).json({
      answer: data.answer,
      sources: Array.isArray(data.sources) ? data.sources : [],
      language: data.language || language || 'en',
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: 'The AI companion timed out while generating a response. Hosted server may be waking up, please retry.',
      });
    }
    console.error('[Chat Proxy] Error querying hosted chatbot:', err.message);
    return res.status(503).json({
      error: 'Could not connect to the AI companion service. Please check network connection and try again.',
    });
  }
});

export default router;
