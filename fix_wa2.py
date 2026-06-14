f = r'C:\sattva\src\pages\HomePage.jsx'
with open(f, 'r', encoding='utf-8') as fh:
    content = fh.read()

# Fix the escaped quotes that Python regex inserted
bad  = "onClick={() => trackWhatsAppClick(\\'hero\\')}"
good = "onClick={() => trackWhatsAppClick('hero')}"

if bad in content:
    content = content.replace(bad, good)
    with open(f, 'w', encoding='utf-8') as fh:
        fh.write(content)
    print("FIXED escaped quotes")
else:
    # Show what's actually on that line
    for i, line in enumerate(content.splitlines(), 1):
        if 'trackWhatsAppClick' in line:
            print(f"Line {i}: {repr(line)}")
