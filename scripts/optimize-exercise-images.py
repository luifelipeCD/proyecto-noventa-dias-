"""Create lightweight WebP delivery copies, keeping the original references intact."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
source = root / 'assets/exercises'
target = root / 'assets/exercises-webp'
report = []
for file in sorted(source.rglob('*.jpg')):
    output = target / file.relative_to(source).with_suffix('.webp')
    output.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(file) as image:
        image.convert('RGB').save(output, 'WEBP', quality=86, method=6)
    report.append({'source': file.relative_to(root).as_posix(), 'path': output.relative_to(root).as_posix(),
                   'originalBytes': file.stat().st_size, 'optimizedBytes': output.stat().st_size})
(target / 'sources.json').write_text(json.dumps(report, indent=2) + '\n')
(target / 'README.md').write_text('Versiones WebP de las fotografías de Free Exercise DB incluidas en ../exercises/. Se conserva el encuadre y la resolución originales; solo cambia el formato de entrega. Fuente y licencia: ../exercises/README.md y ../exercises/LICENSE.md.\n')
print(json.dumps({'images': len(report), 'originalBytes': sum(r['originalBytes'] for r in report),
                  'optimizedBytes': sum(r['optimizedBytes'] for r in report)}))
