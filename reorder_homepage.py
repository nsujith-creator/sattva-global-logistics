import re

filepath = r'C:\sattva\src\pages\HomePage.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File loaded: {len(content)} chars")

# Find each section by searching for its unique comment text,
# then walking back to the opening {/*
def find_section_start(text, marker):
    idx = text.find(marker)
    if idx == -1:
        print(f"  WARNING: '{marker}' not found")
        return -1
    comment_start = text.rfind('{/*', 0, idx)
    if comment_start == -1:
        print(f"  WARNING: no {{/* before '{marker}'")
        return -1
    # Walk back to start of line
    line_start = text.rfind('\n', 0, comment_start) + 1
    return line_start

anchors = {
    'CARGO FOCUS':   'CARGO FOCUS',
    'WHY SATTVA':    'WHY SATTVA TEASER',
    'TRADE LANES':   'TRADE LANES DARK SECTION',
    'SERVICES':      'SERVICES OVERVIEW',
    'HOW WE WORK':   'HOW WE WORK',
    'CARRIER':       'CARRIER NETWORK',
    'OPERATIONAL':   'OPERATIONAL PROOF',
    'FAQ':           '\u2500\u2500 FAQ',
}

positions = {}
for key, marker in anchors.items():
    pos = find_section_start(content, marker)
    positions[key] = pos
    print(f"  {key}: pos {pos}")

# Ordered as they appear in file
file_order = ['CARGO FOCUS', 'WHY SATTVA', 'TRADE LANES', 'SERVICES',
              'HOW WE WORK', 'CARRIER', 'OPERATIONAL', 'FAQ']

# Validate order makes sense
for i in range(len(file_order) - 1):
    a, b = file_order[i], file_order[i+1]
    if positions[a] >= positions[b]:
        print(f"ORDER ERROR: {a} ({positions[a]}) >= {b} ({positions[b]})")

# Extract sections
sections = {}
for i, key in enumerate(file_order):
    start = positions[key]
    if i + 1 < len(file_order):
        end = positions[file_order[i + 1]]
    else:
        # FAQ section — ends at the last </> of the return fragment
        end = content.rfind('\n    </>')
    sections[key] = content[start:end]
    print(f"  {key}: {len(sections[key])} chars extracted")

# Preamble = everything before CARGO FOCUS (includes HERO)
preamble = content[:positions['CARGO FOCUS']]

# Postamble = closing </> ); } of the component
postamble_start = content.rfind('\n    </>')
postamble = content[postamble_start:]
print(f"  Postamble starts at {postamble_start}: {repr(postamble[:40])}")

# Standalone CTA section (replaces full FAQ block)
cta_block = (
    '      {/* \u2500\u2500 CTA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}\n'
    '      <section style={{ background: B.g1 }}>\n'
    '        <div style={st.sec}>\n'
    '          <CTA\n'
    '            eyebrow="Ready to Move?"\n'
    '            headline="Tell us your route and cargo \u2014 we\'ll take it from there"\n'
    '            copy="Start with the quote form for supported lanes. If your shipment needs a direct conversation, the team is ready for that too."\n'
    '            primaryLabel="Get a Freight Quote"\n'
    '            primaryTo="/quote"\n'
    '            secondaryLabel="View Trade Lanes"\n'
    '            secondaryTo="/trade-lanes"\n'
    '            st={st}\n'
    '            I={I}\n'
    '          />\n'
    '        </div>\n'
    '      </section>\n'
)

# New order: WHY SATTVA → TRADE LANES → OPERATIONAL → CARRIER → SERVICES → CTA
new_content = (
    preamble +
    sections['WHY SATTVA'] +
    sections['TRADE LANES'] +
    sections['OPERATIONAL'] +
    sections['CARRIER'] +
    sections['SERVICES'] +
    cta_block +
    postamble
)

print(f"\nOriginal: {len(content)} chars")
print(f"New:      {len(new_content)} chars")
print(f"Removed:  {len(content) - len(new_content)} chars (CARGO FOCUS + HOW WE WORK + FAQ questions)")

# Safety check: file should still be substantial
if len(new_content) < len(content) * 0.6:
    print("SAFETY ABORT: new file too small, something went wrong")
    exit(1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("\nDone. HomePage.jsx rewritten.")
