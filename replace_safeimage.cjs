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

  // add import if not present
  if (!content.includes('SafeImage')) {
    content = content.replace(/(import .* from 'react';\n)/, "$1import { SafeImage } from '@/components/ui/SafeImage';\n");
  }

  // Replace <img src={...} /> with <SafeImage src={...} />
  // Careful with <img src={getMediaUrl(url)} ... />
  // We can just leave the getMediaUrl call as-is, SafeImage will just return it.
  content = content.replace(/<img\s([^>]+)>/gi, (match, p1) => {
    // If it's self-closing <img ... /> or <img ...>
    if (p1.endsWith('/')) {
        return `<SafeImage ${p1}>`;
    }
    return `<SafeImage ${p1} />`;
  });

  fs.writeFileSync(f, content, 'utf8');
  console.log('Fixed', f);
});
