"""Compress a completed ImageGen asset for web delivery; do not alter its content."""
import argparse
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('recipe_id', type=int)
parser.add_argument('--prompt-file', type=Path, required=True)
args = parser.parse_args()
recipes = json.loads((root / '.wrangler/image-plan.json').read_text())
recipe = next((r for r in recipes if r['id'] == args.recipe_id), None)
if not recipe:
    raise SystemExit('Unknown recipe')
folder = root / 'assets/recipes/catalog'
folder.mkdir(parents=True, exist_ok=True)
dest = folder / f"{args.recipe_id}.webp"
with Image.open(args.source) as photo:
    photo = photo.convert('RGB')
    photo.thumbnail((960, 960), Image.Resampling.LANCZOS)
    photo.save(dest, 'WEBP', quality=83, method=6)
meta = root / '.wrangler/generated-recipes'
meta.mkdir(parents=True, exist_ok=True)
(meta / f"{args.recipe_id}.json").write_text(json.dumps({
    'id': recipe['id'], 'name': recipe['name'],
    'path': dest.relative_to(root).as_posix(),
    'origin': 'OpenAI ImageGen, built-in tool',
    'illustrative': True, 'prompt': args.prompt_file.read_text(),
    'width': photo.width, 'height': photo.height,
}, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'id': args.recipe_id, 'bytes': dest.stat().st_size}))
