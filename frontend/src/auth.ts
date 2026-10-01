export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: "ADMIN" | "CANDIDATE";
  is_active: boolean;
}

const TOKEN_KEY =
  "examshield_access_token";

const USER_KEY =
  "examshield_user";

/*
 * Authentication is intentionally kept in
 * sessionStorage so two browser tabs can hold
 * independent admin/candidate demo sessions.
 *
 * Clear the previous localStorage auth keys once
 * to remove stale sessions created by older builds.
 */
if (typeof window !== "undefined") {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function saveSession(
  accessToken: string,
  user: AuthUser
): void {
  sessionStorage.setItem(
    TOKEN_KEY,
    accessToken
  );

  sessionStorage.setItem(
    USER_KEY,
    JSON.stringify(user)
  );

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(
    TOKEN_KEY
  );
}

export function isLocalDemoSession(): boolean {
  const token =
    getAccessToken();

  return Boolean(
    token &&
    token.startsWith("demo-local-")
  );
}

export function getStoredUser(): AuthUser | null {
  const rawUser =
    sessionStorage.getItem(
      USER_KEY
    );

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(
      rawUser
    ) as AuthUser;
  } catch {
    sessionStorage.removeItem(
      USER_KEY
    );
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(
    TOKEN_KEY
  );

  sessionStorage.removeItem(
    USER_KEY
  );

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
