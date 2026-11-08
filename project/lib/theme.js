export const THEME_STORAGE_KEY = 'waterboard-theme';

// Runs before the page paints so a saved light preference never flashes dark.
export const THEME_BOOTSTRAP = `(() => {
  let theme = 'cyberpunk';
  try { if (localStorage.getItem('waterboard-theme') === 'light') theme = 'light'; } catch {}
  document.documentElement.dataset.theme = theme;
})();`;
