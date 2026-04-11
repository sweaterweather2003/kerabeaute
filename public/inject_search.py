import os
import glob

directory = "."
script_tag = '\n<script src="/search_redirect.js"></script>\n'
count = 0

# Find all HTML files recursively
files = glob.glob(os.path.join(directory, '**', '*.html'), recursive=True)
print(f"Found {len(files)} HTML files.")

for filepath in files:
    try:
        # Skip search_redirect.js itself if it was somehow found (though glob is for .html)
        if not filepath.endswith('.html'):
            continue

        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        if 'search_redirect.js' in content:
            continue
        
        if '</body>' in content:
            new_content = content.replace('</body>', f'{script_tag}</body>')
        else:
            new_content = content + script_tag
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        count += 1
        
        if count % 100 == 0:
            print(f"Processed {count} files...")
            
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

print(f"Successfully injected search script into {count} files.")
