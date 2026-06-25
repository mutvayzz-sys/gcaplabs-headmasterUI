# Local Workspace Layout

This repo is checked out locally under a workspace wrapper named after the product:

```text
C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-headmaster\
├── repo\
│   └── gcaplabs-headmasterUI\   # This Git checkout; remote: mutvayzz-sys/gcaplabs-headmasterUI
├── build\
│   └── headmaster-output\       # Windows junction to repo\gcaplabs-headmasterUI\out
└── README.md                    # Local wrapper readme
```

Canonical local paths:

- Repo root: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-headmaster\repo\gcaplabs-headmasterUI`
- Build output shortcut: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-headmaster\build\headmaster-output`
- Runnable EXE: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-headmaster\build\headmaster-output\win-unpacked\Headmaster.exe`

The old local folder `C:\Users\Matve\Desktop\GCAP-Labs\headmaster-desktop` was moved here on 2026-06-18. Do not use the old path.
