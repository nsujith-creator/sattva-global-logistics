import re

f = r'C:\sattva\src\pages\HomePage.jsx'
with open(f, 'r', encoding='utf-8') as fh:
    content = fh.read()

# Find the exact text around WhatsApp Shipment Details
idx = content.find('WhatsApp Shipment Details')
chunk = content[idx-400:idx+60]
print("RAW REPR:")
print(repr(chunk))

# Use regex to do a flexible match inserting onClick
pattern = r'(<a\s+href=\{pageWhatsAppLink\("/"\)\}\s+target="_blank"\s+rel="noopener noreferrer"\s+)(style=\{\{ \.\.\.st\.bs)'
replacement = r'\1onClick={() => trackWhatsAppClick(\'hero\')}\n                \2'

new_content, n = re.subn(pattern, replacement, content)
if n == 1:
    with open(f, 'w', encoding='utf-8') as fh:
        fh.write(new_content)
    print(f"REPLACED OK via regex ({n} substitution)")
else:
    print(f"REGEX FAILED, n={n}")
