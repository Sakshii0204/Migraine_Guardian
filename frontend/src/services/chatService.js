/**
 * Chat Service (Connected to External RAG Chatbot Backend)
 *
 * Connects to the real Migraine RAG backend API with multilingual support (en, hi, mr).
 * Target API URL configured via VITE_RAG_API_URL environment variable.
 */

import { apiClient } from './apiClient';
import { MOCK_CHAT_DATA } from '../data/mockChat';
import { translate } from '../i18n';

const SESSION_STORAGE_KEY = 'mg_rag_chat_session_id';

const getChatEndpoint = () => {
  if (import.meta.env.VITE_USE_DIRECT_RAG === 'true' && import.meta.env.VITE_RAG_API_URL) {
    const base = import.meta.env.VITE_RAG_API_URL.replace(/\/+$/, '');
    return `${base}/api/chat`;
  }
  return 'chat';
};

const getHealthEndpoint = () => {
  if (import.meta.env.VITE_USE_DIRECT_RAG === 'true' && import.meta.env.VITE_RAG_API_URL) {
    const base = import.meta.env.VITE_RAG_API_URL.replace(/\/+$/, '');
    return `${base}/health`;
  }
  return 'chat/health';
};

function getOrCreateSessionId() {
  try {
    let sid = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sid || !/^[A-Za-z0-9_-]{1,64}$/.test(sid)) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      sessionStorage.setItem(SESSION_STORAGE_KEY, sid);
    }
    return sid;
  } catch {
    return `sess_${Date.now()}`;
  }
}

function getErrorKeyForStatus(status) {
  switch (status) {
    case 400:
      return 'chat.errorBadRequest';
    case 429:
      return 'chat.errorRateLimit';
    case 500:
      return 'chat.errorServerError';
    case 503:
    case 504:
    case 0:
      return 'chat.errorServerUnavailable';
    default:
      return 'chat.errorMessage';
  }
}

export const chatService = {
  getInitialChatContext: () => {
    return MOCK_CHAT_DATA;
  },

  getSuggestedQuestions: () => {
    return MOCK_CHAT_DATA.suggestedQuestions;
  },

  getConversationHistory: () => {
    try {
      const stored = sessionStorage.getItem('mg_chat_recent_topics');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  },

  addConversationTopic: (topicTitle) => {
    if (!topicTitle || typeof topicTitle !== 'string') return;
    try {
      const stored = sessionStorage.getItem('mg_chat_recent_topics');
      const list = stored ? JSON.parse(stored) : [];
      const cleanTitle = topicTitle.trim().slice(0, 36);
      if (!list.some((item) => item.title === cleanTitle)) {
        list.unshift({
          id: `topic_${Date.now()}`,
          title: cleanTitle,
          date: 'Just now',
          active: true,
        });
        sessionStorage.setItem('mg_chat_recent_topics', JSON.stringify(list.slice(0, 6)));
      }
    } catch {}
  },

  getSessionId: () => {
    return getOrCreateSessionId();
  },

  resetSession: () => {
    try {
      sessionStorage.removeItem('mg_chat_recent_topics');
      const newSid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      sessionStorage.setItem(SESSION_STORAGE_KEY, newSid);
      return newSid;
    } catch {
      return `sess_${Date.now()}`;
    }
  },

  checkHealth: async () => {
    try {
      const endpoint = getHealthEndpoint();
      const response = await apiClient.get(endpoint);
      return response.ok && (response.data?.status === 'ok' || response.raw?.status === 'ok');
    } catch {
      return false;
    }
  },

  sendMessage: async (query, options = {}) => {
    // Send language='auto' so the RAG backend detects the message language itself.
    // The UI display language (en/hi/mr) is deliberately NOT forwarded — it controls
    // the app interface only, not the chatbot response language.
    // Callers may still pass an explicit language via options.language if needed.
    let language = 'auto';
    let sessionId = getOrCreateSessionId();

    if (typeof options === 'string') {
      language = options;
    } else if (options && typeof options === 'object') {
      // Only accept an explicit language if it is a supported code.
      // 'auto' is passed through unchanged; UI locale values are ignored.
      if (options.language && ['en', 'hi', 'mr', 'auto'].includes(options.language)) {
        language = options.language;
      }
      if (options.sessionId) {
        sessionId = options.sessionId;
      }
    }

    const endpoint = getChatEndpoint();

    try {
      const response = await apiClient.post(endpoint, {
        message: query,
        sessionId,
        language,
      });

      if (response.ok && response.data && typeof response.data.answer === 'string' && response.data.answer.trim()) {
        return {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: response.data.answer,
          language: response.data.language || language,
          sources: Array.isArray(response.data.sources) ? response.data.sources : [],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: false,
        };
      }

      // If backend returned non-ok status or malformed response
      const status = response.status || 0;
      const isMalformed = response.ok && (!response.data || typeof response.data.answer !== 'string');
      const errorKey = isMalformed ? 'chat.errorMalformedResponse' : getErrorKeyForStatus(status);
      let errorText = translate(language, errorKey);

      // Use specific server error message if available
      if (!response.ok && response.error) {
        const serverMsg = typeof response.error === 'string' ? response.error : response.error.message;
        if (serverMsg && typeof serverMsg === 'string' && serverMsg.trim()) {
          errorText = serverMsg;
        }
      }

      console.warn(`[chatService] API request returned status ${status}. Error: ${errorText}`);

      return {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: errorText,
        language,
        sources: [],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
        errorKey,
      };
    } catch (error) {
      console.error('[chatService] Exception during send message:', error);
      const errorKey = 'chat.errorServerUnavailable';
      const errorText = translate(language, errorKey);

      return {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: errorText,
        language,
        sources: [],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
        errorKey,
      };
    }
  },
};

export default chatService;
