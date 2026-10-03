const isJwtSecretConfigured = (secret) => {
  if (typeof secret !== 'string') {
    return false;
  }

  const normalized = secret.trim();

  return normalized.length >= 32 &&
    !/^(your|change[-_ ]?me|replace|example|default|secret)/i.test(normalized);
};

module.exports = {
  isJwtSecretConfigured
};