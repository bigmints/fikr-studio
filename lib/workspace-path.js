function resolveWorkspaceDirectory({ path, appHome, override }) {
  const fallback = path.join(appHome, '.fikr-studio');
  if (typeof override !== 'string' || !override.trim()) return fallback;

  const candidate = override.trim();
  if (!path.isAbsolute(candidate)) {
    throw new Error('FIKR_STUDIO_WORKSPACE_DIR must be an absolute path');
  }

  const resolved = path.resolve(candidate);
  if (resolved === path.parse(resolved).root) {
    throw new Error('FIKR_STUDIO_WORKSPACE_DIR cannot be a filesystem root');
  }
  return resolved;
}

module.exports = { resolveWorkspaceDirectory };
