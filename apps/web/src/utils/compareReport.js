// Pure utility functions extracted from ComparePage for testability

export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const REPORT_GRADS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#fd746c,#ff9068)',
];

export function reportGrad(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return REPORT_GRADS[Math.abs(h) % REPORT_GRADS.length];
}

export function officialFilmForRow(categoryId, officialResults, categories, filmById) {
  const nid = officialResults?.[categoryId];
  if (!nid) return null;
  const cat = categories?.find(c => c.id === categoryId);
  const nom = cat?.nominees?.find(n => n.id === nid);
  return nom?.filmId ? filmById(nom.filmId) : null;
}
