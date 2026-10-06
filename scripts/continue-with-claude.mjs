import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const prompt = readFileSync(new URL('../docs/ENCARGO-CLAUDE-CODE.md', import.meta.url), 'utf8');
let workspace = root;
let temporary = false;
function git(args, cwd = root) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'No se pudo preparar Git.');
  return result.stdout.trim();
}
try {
  if (root.split(path.sep).some(segment => /\s$/.test(segment))) {
    if (git(['status', '--porcelain'])) {
      console.error('Guarda los cambios pendientes del proyecto en Git antes de continuar con Claude Code. No se ha cambiado ningún archivo.');
      process.exit(1);
    }
    workspace = path.join(mkdtempSync(path.join(tmpdir(), 'noventa-claude-')), 'project');
    const remote = git(['remote', 'get-url', 'origin']);
    git(['clone', '--local', '--no-hardlinks', root, workspace]);
    git(['remote', 'set-url', 'origin', remote], workspace);
    temporary = true;
    console.log('Claude trabajará en una copia con una ruta compatible y subirá a tu mismo repositorio.');
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const result = spawnSync('claude', [
  '-p', '--permission-mode', 'acceptEdits',
  '--allowedTools',
  'Read', 'Edit', 'Write', 'Glob', 'Grep',
  'Bash(npm test)', 'Bash(node --check *)', 'Bash(node --test *)',
  'Bash(git status *)', 'Bash(git diff *)', 'Bash(git log *)',
  'Bash(git add *)', 'Bash(git commit *)',
  'Bash(git push origin stripe-suscripcion)',
  'Bash(git ls-remote origin refs/heads/stripe-suscripcion)',
], { cwd: workspace, input: prompt, stdio: ['pipe', 'inherit', 'inherit'] });
if (result.error) {
  console.error('No se pudo abrir Claude Code. Instálalo desde su fuente oficial e inicia sesión con claude auth login.');
  process.exit(1);
}
if (temporary) {
  console.log('Copia de trabajo conservada en: ' + workspace);
  if (result.status === 0) {
    try {
      if (git(['status', '--porcelain'])) throw new Error('Hay cambios locales nuevos; integra la versión de GitHub después de guardarlos.');
      git(['fetch', 'origin']);
      const branch = git(['branch', '--show-current']);
      git(['merge', '--ff-only', 'origin/' + branch]);
      console.log('La carpeta original quedó actualizada desde GitHub.');
    } catch (error) {
      console.error('Los archivos originales se conservan. ' + error.message);
    }
  }
}
process.exit(result.status ?? 1);
