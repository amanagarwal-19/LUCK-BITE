const SESSION_KEY = 'luckbite_session_id';

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = 'sess-' + crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
