const fs = require('fs');

const files = [
  'app/(tabs)/index.tsx',
  'app/(tabs)/transactions.tsx',
  'app/(tabs)/budgets.tsx',
  'app/(tabs)/account.tsx',
  'app/(tabs)/_layout.tsx',
  'app/_layout.tsx',
  'app/reminders.tsx',
  'app/categories.tsx',
  'app/analytics.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Fix rogue array brackets
  content = content.replace(/style=\{\[tw\`([^`]*?)\`\}/g, 'style={tw`$1`}');
  content = content.replace(/style=\{\[tw\`([^`]*?)\`\]\}/g, 'style={tw`$1`}');

  // Fix badly converted inline styles: style={tw`...`, { ... ]}}
  content = content.replace(/style=\{tw\`([^`]*?)\`,\s*\{(.*?)]\}\}/g, 'style={[tw`$1`, {$2}]}');
  content = content.replace(/style=\{tw\`([^`]*?)\`,\s*\{(.*?)\}\}/g, 'style={[tw`$1`, {$2}]}');

  // Fix double style props
  content = content.replace(/style=\{tw\`([^`]*?)\`\}\s*style=\{\{(.*?)\}\}/g, 'style={[tw`$1`, {$2}]}');

  // Fix remaining classNames
  content = content.replace(/className=\{\`([^`]*?)\`\}/g, 'style={tw`$1`}');
  content = content.replace(/contentContainerClassName=\{\`([^`]*?)\`\}/g, 'contentContainerStyle={tw`$1`}');
  content = content.replace(/handleIndicatorClassName=\{\`([^`]*?)\`\}/g, 'handleIndicatorStyle={tw`$1`}');
  content = content.replace(/backgroundClassName=\{\`([^`]*?)\`\}/g, 'backgroundStyle={tw`$1`}');

  // Fix specific rgba typos
  content = content.replace(/\$\{r\]\}/g, '${r}');

  fs.writeFileSync(file, content);
});
console.log('Fixed');
