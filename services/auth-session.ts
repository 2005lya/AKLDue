type AccessTokenProvider =
  () => Promise<string | null>;

let tokenProvider: AccessTokenProvider | null = null;

export function setAccessTokenProvider(
  provider: AccessTokenProvider
) {
  tokenProvider = provider;

  return () => {
    if (tokenProvider === provider) {
      tokenProvider = null;
    }
  };
}

export async function getAccessToken() {
  if (tokenProvider === null) {
    return null;
  }

  return tokenProvider();
}