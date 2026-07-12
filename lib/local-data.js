function clearLocalFiles(fs, files) {
  const errors = [];
  for (const file of files) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch (error) {
      errors.push({ file, message: error instanceof Error ? error.message : 'Unknown deletion error' });
    }
  }
  const remaining = files.filter(file => {
    try { return fs.existsSync(file); } catch { return true; }
  });
  return { cleared: errors.length === 0 && remaining.length === 0, errors, remaining };
}

module.exports = { clearLocalFiles };
