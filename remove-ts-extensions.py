import os
import re

def remove_ts_extension_from_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Pattern to match imports from relative paths with .ts extension
    # Matches: from './path.ts' or from "../path.ts"
    pattern = r"from\s+(['\"])((?:\.\./|\.\/)[^'\"]+)\.ts(['\"])"
    
    def replacer(match):
        quote1 = match.group(1)
        path = match.group(2)
        quote2 = match.group(3)
        
        # Remove the .ts extension
        return f'from {quote1}{path}{quote2}'
    
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
                if remove_ts_extension_from_file(filepath):
                    count += 1
                    print(f'Fixed: {filepath}')
    
    print(f'\nTotal files updated: {count}')

if __name__ == '__main__':
    main()
