import os
import glob

directory = r"c:\Users\91879\Desktop\kerabeaute\public"
count = 0

for filepath in glob.glob(os.path.join(directory, '**', '*.html'), recursive=True):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = content.replace('https://kerabeaute.com', '')
        new_content = new_content.replace('http://kerabeaute.com', '')
        new_content = new_content.replace('https:\\/\\/kerabeaute.com', '')
        new_content = new_content.replace('http:\\/\\/kerabeaute.com', '')
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            count += 1
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

print(f"Updated {count} files.")
