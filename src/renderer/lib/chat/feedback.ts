/**
 * Message rating submission.
 *
 * Best-effort: a failed rating is logged and dropped. Nothing about the chat
 * should break because the user pressed thumbs-up while offline.
 */

import { getApiUrl } from './apiUrl';

export async function submitMessageFeedback(
  messageId: string,
  rating: 'up' | 'down',
  sessionId?: string
): Promise<void> {
  try {
    const [token, apiUrl] = await Promise.all([
      window.electron.auth.getToken(),
      getApiUrl(),
    ]);
    if (!token) return;

    await fetch(`${apiUrl}/api/agi/feedback`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message_id: messageId,
        rating,
        session_id: sessionId,
        surface: 'menubar',
      }),
    });
  } catch (error) {
    console.warn('[feedback] Failed to submit rating:', error);
  }
}
