#!/usr/bin/env python
"""
Rewrite vendor URL references from upstream iOfficeAI/AionCore to point at the
GCAP-Labs repo the user owns. Backend binary dir stays `bundled-aioncore/` on
disk for now (portmap Tier 3 - out of scope for frontstuff pass).
"""
from pathlib import Path

# Repo the user provided
REPO = 'gcaplabs-headmaster'      # local repo name we treat as the canonical upstream
OWNER = 'mutvayzz-sys'            # the user behind the URL they shared

# 1. bundled-aioncore/.../manifest.json (backend binary download URL)
p = Path('resources/bundled-aioncore/win32-x64/manifest.json')
if p.exists():
    s = p.read_text(encoding='utf-8')
    s = s.replace('iOfficeAI', OWNER)
    s = s.replace('AionCore', 'gcaplabs-headmaster-runtime')
    s = s.replace('aioncore-v0.1.28', 'gcaplabs-headmaster-runtime-v0.1.28')
    p.write_text(s, encoding='utf-8')
    print('OK bundled manifest')

# 2. check all remaining references after that pass
import subprocess
out = subprocess.check_output(
    ['grep', '-rn', '-E', r'iOfficeAI|AionCore|AionHub|aionext-',
     '--include=*.ts', '--include=*.tsx', '--include=*.js', '--include=*.json',
     '--include=*.yml', '--include=*.md',
     'packages/', 'resources/', 'scripts/'],
    stderr=subprocess.DEVNULL, text=True,
    cwd='.',
)
# filter out the prepare-aioncore.js filename itself (not a leak, just a script name)
lines = [ln for ln in out.splitlines()
         if 'prepare-aioncore.js' not in ln
         and 'claude-notes' not in ln
         and 'HEADMASTER-' not in ln
         and '/out/' not in ln
         and 'node_modules' not in ln]
if lines:
    print('LEFTOVERS:')
    for ln in lines:
        print(' ', ln)
else:
    print('CLEAN: zero iOfficeAI/AionCore/AionHub/aionext- left in source.')
