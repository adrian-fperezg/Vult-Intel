const fs = require('fs');
const files = [
  'src/pages/social-studio/ComposeView.tsx',
  'src/pages/social-studio/AccountsView.tsx',
  'src/pages/social-studio/QueueView.tsx',
  'src/pages/social-studio/AnalyticsView.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes('getMediaUrl')) return; // already done

  // add import
  content = content.replace(/import { cn } from '@\/lib\/utils';/, "import { cn, getMediaUrl } from '@/lib/utils';");
  // if `cn` is not there, we just add it after react
  if (!content.includes('getMediaUrl')) {
    content = content.replace(/(import .* from 'react';\n)/, "$1import { getMediaUrl } from '@/lib/utils';\n");
  }

  // Replace <img src={url} to <img src={getMediaUrl(url)}
  // Handle variables, properties, array accesses, etc.
  content = content.replace(/<img([^>]*)src=\{([^}]+)\}/g, (match, p1, p2) => {
    // If it already contains getMediaUrl or a string literal, ignore (maybe)
    if (p2.includes('getMediaUrl')) return match;
    return `<img${p1}src={getMediaUrl(${p2})}`;
  });

  fs.writeFileSync(f, content, 'utf8');
  console.log('Fixed', f);
});
