const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '');
export const apiUrl = API_URL;

type ApiError = { error?: { code?: string; message?: string; details?: string[] } };

const errorMessages: Record<string, string> = {
  NOT_FOUND: 'İstenen içerik bulunamadı.',
  INTERNAL_ERROR: 'Beklenmeyen bir hata oluştu.',
  NO_CURRENT_EDITION: 'Şu anda yapılandırılmış bir yarışma dönemi yok.',
  NOT_AVAILABLE: 'Jüri durumları şu anda gösterilemiyor.',
  RESULTS_HIDDEN: 'Sonuçlar henüz yayımlanmadı.',
  UNAUTHORIZED: 'Oturumunuz geçersiz veya süresi dolmuş.',
  RATE_LIMITED: 'Çok fazla giriş denemesi yapıldı. Lütfen biraz bekleyip yeniden deneyin.',
  INVALID_CREDENTIALS: 'Girdiğiniz şifre yanlış.',
  SESSION_ACTIVE: 'Bu jüri için zaten etkin bir oturum var. Mevcut tarayıcıyı kullanın veya oturumun sona ermesini bekleyin.',
  VOTING_CLOSED: 'Oylama şu anda açık değil.',
  INVALID_BALLOT: 'Oy pusulasındaki seçimleri kontrol edin.',
  BALLOT_ALREADY_SUBMITTED: 'Bu jüri oy pusulasını daha önce göndermiş.',
  INVALID_INPUT: 'Lütfen gerekli alanları doğru şekilde doldurun.',
  INVALID_PHASE: 'Geçersiz oylama aşaması.',
  INVALID_DISCORD_ID: 'Geçerli bir Discord kullanıcı kimliği girin.',
  INVALID_PASSWORD: 'Geçersiz şifre.',
  JURY_NOT_SUBMITTED: 'Bu jüri henüz oyunu göndermedi.',
  JURY_ALREADY_REVEALED: 'Bu jürinin oyları daha önce açıklandı.',
};

export async function api<T>(path: string, options: RequestInit & { token?: string | null } = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) {
    const error = new Error((payload.error?.code && errorMessages[payload.error.code]) || payload.error?.message || `İstek başarısız oldu (${response.status})`) as Error & { code?: string };
    error.code = payload.error?.code;
    throw error;
  }
  return payload;
}

export const juryToken = {
  get: () => sessionStorage.getItem('nexavision.juryToken'),
  set: (token: string) => sessionStorage.setItem('nexavision.juryToken', token),
  clear: () => sessionStorage.removeItem('nexavision.juryToken'),
};

export const adminToken = {
  get: () => sessionStorage.getItem('nexavision.adminToken'),
  set: (token: string) => sessionStorage.setItem('nexavision.adminToken', token),
  clear: () => sessionStorage.removeItem('nexavision.adminToken'),
};

