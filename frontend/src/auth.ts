export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: "ADMIN" | "CANDIDATE";
  is_active: boolean;
}

const TOKEN_KEY = "examshield_access_token";
const USER_KEY = "examshield_user";

export function saveSession(
  accessToken: string,
  user: AuthUser
): void {
  localStorage.setItem(
    TOKEN_KEY,
    accessToken
  );

  localStorage.setItem(
    USER_KEY,
    JSON.stringify(user)
  );
}

export function getAccessToken(): string | null {
  return localStorage.getItem(
    TOKEN_KEY
  );
}

export function getStoredUser(): AuthUser | null {
  const rawUser = localStorage.getItem(
    USER_KEY
  );

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(
    TOKEN_KEY
  );

  localStorage.removeItem(
    USER_KEY
  );
}

export function isAuthenticated(): boolean {
  return Boolean(
    getAccessToken()
  );
}