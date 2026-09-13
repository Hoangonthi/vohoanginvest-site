from pathlib import Path

path = Path('assets/js/site-header.js')
text = path.read_text(encoding='utf-8')
marker = '\n    .vh-auth-backdrop{'
positions = []
start = 0
while True:
    i = text.find(marker, start)
    if i < 0:
        break
    positions.append(i)
    start = i + len(marker)

# Keep the first full shared block. A second full block was accidentally inserted
# before the mobile .vh-search-backdrop rule; remove only that duplicate block.
if len(positions) > 1:
    second = positions[1]
    search_after = text.find('\n    .vh-search-backdrop{', second)
    if search_after < 0:
        raise SystemExit('Cannot locate mobile search rule after duplicate auth CSS')
    text = text[:second] + text[search_after:]

# Safety checks: exactly one full shared auth CSS block; functional JS remains.
if text.count(marker) != 1:
    raise SystemExit(f'Expected one full auth CSS block, found {text.count(marker)}')
for required in [
    'function createAccountDialogs()',
    'data-login-dialog',
    'data-change-password',
    'openPasswordChange',
    'signOut({ scope: "global" })',
]:
    if required not in text:
        raise SystemExit(f'Missing required auth feature: {required}')

path.write_text(text, encoding='utf-8')
print('Cleaned duplicate auth CSS')
