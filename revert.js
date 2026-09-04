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
  
  // Specific prop replacements for NativeWind to twrnc
  content = content.replace(/contentContainerClassName=\{\`([\s\S]*?)\`\}/g, 'contentContainerStyle={tw`$1`}');
  content = content.replace(/handleIndicatorClassName=\{\`([\s\S]*?)\`\}/g, 'handleIndicatorStyle={tw`$1`}');
  content = content.replace(/backgroundClassName=\{\`([\s\S]*?)\`\}/g, 'backgroundStyle={tw`$1`}');
  
  // General styles
  content = content.replace(/className=\{\`([\s\S]*?)\`\} style=\{(.*?)\}/g, 'style={[tw`$1`, $2]}');
  content = content.replace(/className=\{\`([\s\S]*?)\`\}/g, 'style={tw`$1`}');
  
  // Imports
  content = content.replace(/import \{ useColorScheme \} from 'nativewind';/g, "import tw, { useAppColorScheme } from 'twrnc';");
  content = content.replace(/import \{ useColorScheme \} from \"nativewind\";/g, "import tw, { useAppColorScheme } from 'twrnc';");
  
  // Hooks
  content = content.replace(/const \{ colorScheme, toggleColorScheme \} = useColorScheme\(\);/g, "const [colorScheme, toggleColorScheme] = useAppColorScheme(tw);");
  content = content.replace(/const \{ colorScheme \} = useColorScheme\(\);/g, "const [colorScheme] = useAppColorScheme(tw);");

  fs.writeFileSync(file, content);
});
console.log('Reverted to twrnc complete');
