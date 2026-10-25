export const GRADIENTS: Record<string, string> = {
  gradient_1: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  gradient_2: 'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)',
  gradient_3: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  gradient_4: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  gradient_5: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  gradient_6: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  gradient_7: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  gradient_8: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  gradient_9: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  gradient_10: 'linear-gradient(to top, #fbc2eb 0%, #a6c1ee 100%)',
  solid_red: '#e16259',
  solid_yellow: '#f9c74f',
  solid_blue: '#4a90d9',
  solid_beige: '#f3e9dc',
};

export const GALLERY_PHOTOS = [
  'photo-1500530855697-b586d89ba3ee',
  'photo-1469474968028-56623f02e42e',
  'photo-1441974231531-c6227db76b6e',
  'photo-1501785888041-af3ef285b470',
  'photo-1470071459604-3b5ec3a7fe05',
  'photo-1447752875215-b2761acb3c5d',
  'photo-1433086966358-54859d0ed716',
  'photo-1472214103451-9374bd1c798e',
  'photo-1506744038136-46273834b3fb',
  'photo-1519681393784-d120267933ba',
  'photo-1464822759023-fed622ff2c3b',
  'photo-1490750967868-88aa4486c946',
].map((id) => `https://images.unsplash.com/${id}?w=1500&q=80`);

export function coverStyle(cover: string | undefined, pos = 50): React.CSSProperties | null {
  if (!cover) return null;
  if (GRADIENTS[cover]) return { background: GRADIENTS[cover] };
  return { backgroundImage: `url("${cover}")`, backgroundSize: 'cover', backgroundPosition: `center ${pos}%` };
}

export function randomCover() {
  const all = [...Object.keys(GRADIENTS).filter((k) => k.startsWith('gradient')), ...GALLERY_PHOTOS];
  return all[Math.floor(Math.random() * all.length)];
}
