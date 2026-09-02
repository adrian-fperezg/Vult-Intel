const fs = require('fs');
const files = [
  'src/pages/social-studio/ComposeView.tsx',
  'src/pages/social-studio/AccountsView.tsx',
  'src/pages/social-studio/QueueView.tsx',
  'src/pages/social-studio/AnalyticsView.tsx'
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');

  content = content.replace(/<video([^>]*)src=\{([^}]+)\}/g, (match, p1, p2) => {
    if (p2.includes('getMediaUrl') || p2.includes('URL.createObjectURL')) return match;
    return `<video${p1}src={getMediaUrl(${p2})}`;
  });
  
  fs.writeFileSync(f, content, 'utf8');
  console.log('Fixed', f);
});
