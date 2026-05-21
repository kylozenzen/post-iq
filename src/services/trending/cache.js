(function(global){
  const PREFIX = 'postiq:trending:';
  function read(key){
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }
  function write(key, data){
    try { localStorage.setItem(PREFIX + key, JSON.stringify(data)); } catch {}
  }
  function getFresh(key, ttlMs){
    const entry = read(key);
    if (!entry || !entry.savedAt) return null;
    return (Date.now() - entry.savedAt) <= ttlMs ? entry : null;
  }
  global.PostIQTrendingCache = { read, write, getFresh };
})(window);
