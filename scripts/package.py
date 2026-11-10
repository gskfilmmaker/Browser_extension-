"""Create a runtime-only unpacked-install ZIP; no keys, tests, or marketing assets."""
import json
import zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
version = json.loads((ROOT / 'manifest.json').read_text())['version']
output = ROOT / 'dist' / f'framepilot-{version}.zip'
output.parent.mkdir(exist_ok=True)
files = [ROOT/'manifest.json', ROOT/'service-worker.js', ROOT/'ui.css']
for folder in ['content', 'lib', 'sidepanel', 'options', 'icons']:
    files.extend(f for f in (ROOT/folder).rglob('*') if f.is_file())
files.extend(ROOT/'brand'/name for name in ['mark.svg', 'settings.svg'])
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(files):
        archive.write(file, file.relative_to(ROOT))
print(f'Created {output} ({output.stat().st_size:,} bytes)')
