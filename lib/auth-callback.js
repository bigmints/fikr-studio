function sameCallbackLocation(actual, expected) {
  return actual.protocol === expected.protocol
    && actual.hostname === expected.hostname
    && actual.port === expected.port
    && actual.pathname === expected.pathname;
}

function consumeAuthCallback(
  url,
  expectedState,
  expiresAt,
  now = Date.now(),
  expectedCallbackUrl = 'fikr-studio://auth/callback',
) {
  try {
    const parsed = new URL(url);
    const expectedCallback = new URL(expectedCallbackUrl);
    const states = parsed.searchParams.getAll('state');
    const tokens = parsed.searchParams.getAll('token');
    const accepted = sameCallbackLocation(parsed, expectedCallback)
      && states.length === 1
      && tokens.length === 1
      && Boolean(tokens[0])
      && Boolean(expectedState)
      && states[0] === expectedState
      && now < expiresAt;
    return accepted ? { accepted: true, token: tokens[0] } : { accepted: false, token: null };
  } catch {
    return { accepted: false, token: null };
  }
}

module.exports = { consumeAuthCallback, sameCallbackLocation };
