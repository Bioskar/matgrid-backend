import os
import re

def fix_imports_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Pattern to match imports from relative paths
    # Matches: from './path' or from "../path"
    pattern = r"from\s+(['\"])(\.\./[^'\"]+|\.\/[^'\"]+)(['\"])"
    
    def replacer(match):
        quote1 = match.group(1)
        path = match.group(2)
        quote2 = match.group(3)
        
        # Don't add .ts if path already ends with an extension
        if not (path.endswith('.ts') or path.endswith('.js') or path.endswith('.json')):
            return f'from {quote1}{path}.ts{quote2}'
        return match.group(0)
    
    content = re.sub(pattern, replacer, content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    src_dir = './src'
    count = 0
    
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.ts'):
                filepath = os.path.join(root, file)
                if fix_imports_in_file(filepath):
                    count += 1
                    print(f'Fixed: {filepath}')
    
    print(f'\nTotal files updated: {count}')

if __name__ == '__main__':
    main()
