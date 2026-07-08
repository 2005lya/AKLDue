const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5090';

export type AuthTokens = {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
};

async function ensureSuccess(response: Response) {
  if (response.ok) {
    return;
  }

  const message = await response.text();
  throw new Error(message || `API returned ${response.status}`);
}

export async function register(
  email: string,
  password: string
): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  await ensureSuccess(response);
}

export async function login(
  email: string,
  password: string
): Promise<AuthTokens> {
  const response = await fetch(
    `${API_URL}/api/auth/login?useCookies=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    }
  );

  await ensureSuccess(response);

  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<AuthTokens> {
  const response = await fetch(
    `${API_URL}/api/auth/refresh`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken,
      }),
    }
  );

  await ensureSuccess(response);

  return response.json();
}