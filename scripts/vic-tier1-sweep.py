import re
from pathlib import Path
import shutil

def rewrite(path, pairs):
    p = Path(path)
    if not p.exists():
        print('MISS', path)
        return
    s = p.read_text(encoding='utf-8')
    o = s
    for old, new in pairs:
        s = s.replace(old, new)
    p.write_text(s, encoding='utf-8')
    print('OK', path, 'changed:', s != o)

# 1. Protocol scheme
rewrite('packages/desktop/src/process/utils/deepLink.ts', [
    ("PROTOCOL_SCHEME = 'aionui';", "PROTOCOL_SCHEME = 'headmaster';"),
    ('Parse an aionui:// URL into action and params.', 'Parse a headmaster:// URL into action and params.'),
    ('  1. aionui://add-provider?base_url=xxx&api_key=xxx', '  1. headmaster://add-provider?base_url=xxx&api_key=xxx'),
    ('  2. aionui://provider/add?v=1&data=<base64 JSON>', '  2. headmaster://provider/add?v=1&data=<base64 JSON>'),
])
for f in [
    'packages/desktop/src/index.ts',
    'packages/desktop/electron-builder.yml',
    'packages/desktop/electron.vite.config.ts',
    'packages/desktop/src/common/config/storage.ts',
]:
    rewrite(f, [
        ("'aionui://", "'headmaster://"),
        ('aionui://', 'headmaster://'),
        ("registerSchemesAsPrivileged([{ scheme: 'aionui'", "registerSchemesAsPrivileged([{ scheme: 'headmaster'"),
        ("'aionui'", "'headmaster'"),
    ])

# 2. HTTP Referer + CDN host
rewrite('packages/desktop/src/common/api/ClientFactory.ts', [
    ("'HTTP-Referer': 'https://aionui.com'", "'HTTP-Referer': 'https://gcaplabs.com'"),
])
rewrite('packages/desktop/src/process/bridge/updateBridge.ts', [
    ("const CDN_HOST = 'static.aionui.com';", "const CDN_HOST = 'static.gcaplabs.com';"),
])

# 3. CSS variable tokens
rewrite('packages/desktop/src/renderer/styles/arco-override.css', [
    ('--aion-overlay-bg', '--headmaster-overlay-bg'),
    ('--aion-overlay-border', '--headmaster-overlay-border'),
    ('--aion-overlay-text', '--headmaster-overlay-text'),
    ('--aion-overlay-hover', '--headmaster-overlay-hover'),
    ('--aion-overlay-shadow', '--headmaster-overlay-shadow'),
    ('--aion-overlay-radius', '--headmaster-overlay-radius'),
    ('--aion-overlay-padding', '--headmaster-overlay-padding'),
    ('var(--aion-overlay-', 'var(--headmaster-overlay-'),
    ('.aion-model-menu--sticky-group', '.headmaster-model-menu--sticky-group'),
])

# 4. CSS class names
rewrite('packages/desktop/src/renderer/components/base/AionModal.tsx', [('aionui-modal', 'headmaster-modal')])
rewrite('packages/desktop/src/renderer/components/base/ModalWrapper.tsx', [('aionui-modal', 'headmaster-modal')])
rewrite('packages/desktop/src/renderer/components/base/AionSteps.tsx', [('aionui-steps', 'headmaster-steps')])
rewrite('packages/desktop/src/renderer/components/base/StepsWrapper.tsx', [('aionui-steps', 'headmaster-steps')])
rewrite('packages/desktop/src/renderer/components/base/AionSelect.tsx', [('aion-select', 'headmaster-select')])
rewrite('packages/desktop/src/renderer/components/media/WebviewHost.tsx', [('aion-url-viewer-toolbar', 'headmaster-url-viewer-toolbar')])
rewrite('packages/desktop/src/renderer/components/settings/SettingsModal/contents/SystemModalContent/DirInputItem.tsx', [('aion-dir-input', 'headmaster-dir-input')])
rewrite('packages/desktop/src/renderer/pages/conversation/Preview/components/viewers/MarkdownViewer.tsx', [('aionui-markdown', 'headmaster-markdown')])
rewrite('packages/desktop/src/renderer/pages/conversation/platforms/aionrs/AionrsModelSelector.tsx', [('aion-model-menu--sticky-group', 'headmaster-model-menu--sticky-group')])
rewrite('packages/desktop/src/renderer/pages/guid/components/GuidModelSelector.tsx', [('aion-model-menu--sticky-group', 'headmaster-model-menu--sticky-group')])
rewrite('packages/desktop/src/renderer/pages/settings/AppearanceSettings/presets/discourse-horizon.css', [('aion-file-changes-panel', 'headmaster-file-changes-panel')])
rewrite('packages/desktop/src/renderer/pages/settings/AppearanceSettings/presets/retroma-y2k.css', [('aion-file-changes-panel', 'headmaster-file-changes-panel')])

# 5. On-disk registry filename
rewrite('packages/desktop/src/process/utils/configureChromium.ts', [
    ('// Registry file: ~/.aionui-cdp-registry.json', '// Registry file: ~/.headmaster-cdp-registry.json'),
    ("const CDP_REGISTRY_FILE = path.join(os.homedir(), '.aionui-cdp-registry.json');",
     "const CDP_REGISTRY_FILE = path.join(os.homedir(), '.headmaster-cdp-registry.json');"),
])

# 6. Sentry tags + aioncore context keys
sent = Path('packages/desktop/src/sentry.ts')
s = sent.read_text(encoding='utf-8')
s = s.replace('aionui.', 'headmaster.')
s = s.replace('aionui_cdp_', 'headmaster_cdp_')
s = s.replace('"aionui.com"', '"gcaplabs.com"')
s = s.replace("'aionui.com'", "'gcaplabs.com'")
s = s.replace('aioncore_', 'backend_')
sent.write_text(s, encoding='utf-8')
print('OK sentry.ts')

# 7. Env var
rewrite('packages/desktop/electron.vite.config.ts', [
    ("'process.env.AIONUI_MULTI_INSTANCE'", "'process.env.HEADMASTER_MULTI_INSTANCE'"),
    ('process.env.AIONUI_MULTI_INSTANCE ??', 'process.env.HEADMASTER_MULTI_INSTANCE ??'),
])
for f in [
    'packages/desktop/src/index.ts',
    'scripts/build-with-builder.js',
    'scripts/postinstall.js',
    'packages/shared-scripts/src/prepare-aioncore.js',
]:
    rewrite(f, [('AIONUI_MULTI_INSTANCE', 'HEADMASTER_MULTI_INSTANCE')])

# 8. Image asset renames
img_map = {
    'resources/aionui-banner-1.png': 'resources/headmaster-banner-1.png',
    'resources/aionui_logo_black_bg.svg': 'resources/headmaster_logo_black_bg.svg',
    'resources/aionui_logo_no_border.png': 'resources/headmaster_logo_no_border.png',
    'resources/aionui_readme_header_0807.png': 'resources/headmaster_readme_header.png',
}
for old, new in img_map.items():
    op = Path(old)
    if not op.exists():
        print('NO ASSET', old)
        continue
    np = Path(new)
    np.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(op), str(np))
    print('MOVED', old, '->', new)

# Update references to old asset paths (filename only)
for old, new in img_map.items():
    base = old.split('/')[-1]
    newbase = new.split('/')[-1]
    skip_dirs={'node_modules','.git','out','dist','resources','bun.lock','bun.lockb'}
    stack=[Path('.')]
    while stack:
        d=stack.pop()
        try:
            entries=list(d.iterdir())
        except (PermissionError,FileNotFoundError,OSError):
            continue
        for f in entries:
            try:
                if f.is_dir():
                    if f.name not in skip_dirs:
                        stack.append(f)
                    continue
                if not f.is_file():
                    continue
                if f.suffix in {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'}:
                    continue
            except OSError:
                continue
        try:
            t = f.read_text(encoding='utf-8')
        except Exception:
            continue
        if base in t:
            t = t.replace(base, newbase)
            f.write_text(t, encoding='utf-8')
            print('UPD', f)

# 9. Copyright headers (aionui.com)
for f in Path('packages').rglob('*'):
    if not f.is_file():
        continue
    if f.suffix not in {'.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.md'}:
        continue
    try:
        t = f.read_text(encoding='utf-8')
    except Exception:
        continue
    if 'Copyright 2025 Headmaster (aionui.com)' in t:
        t = t.replace('Copyright 2025 Headmaster (aionui.com)', 'Copyright 2025 Headmaster (gcaplabs.com)')
        f.write_text(t, encoding='utf-8')

# 10. localStorage keys
rewrite('packages/desktop/src/renderer/pages/cron/useCronJobs.ts', [('aionui_cron_unread', 'headmaster_cron_unread')])
rewrite('packages/desktop/src/renderer/pages/conversation/GroupedHistory/hooks/useWorkspaceExpansionState.ts', [('aionui_workspace_expansion', 'headmaster_workspace_expansion')])
rewrite('packages/desktop/src/renderer/pages/conversation/Preview/context/PreviewContext.tsx', [('aionui_preview_', 'headmaster_preview_')])

# 11. AgentHubModal constant
rewrite('packages/desktop/src/renderer/pages/settings/AgentSettings/AgentHubModal.tsx', [('AION_HUB_REPO_URL', 'HEADMASTER_HUB_REPO_URL')])

# 12. NodePlatformServices path
rewrite('packages/desktop/src/common/platform/NodePlatformServices.ts', [
    ("return { name: 'aionui', version: '0.0.0' };", "return { name: 'headmaster', version: '0.0.0' };"),
    ("path.join(os.homedir(), '.aionui-server')", "path.join(os.homedir(), '.headmaster-server')"),
    ("path.join(os.homedir(), '.aionui-server', 'logs')", "path.join(os.homedir(), '.headmaster-server', 'logs')"),
    ("getName: () => _pkg.name ?? 'aionui'", "getName: () => _pkg.name ?? 'headmaster'"),
])

print('DONE')
