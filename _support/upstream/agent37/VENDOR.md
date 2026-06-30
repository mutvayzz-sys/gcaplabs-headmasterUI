# Agent37 Vendor Manifest

This directory records the Agent37 source pins used by the Headmaster beta-readiness work.

Canonical working references live at workspace root:

- `C:\Users\Matve\Desktop\gcap-labs\_support\upstream\agent37\gateway`
- `C:\Users\Matve\Desktop\gcap-labs\_support\upstream\agent37\starter-kit`
- `C:\Users\Matve\Desktop\gcap-labs\_support\upstream\agent37\docs`
- `C:\Users\Matve\Desktop\gcap-labs\_support\upstream\agent37\examples`
- `C:\Users\Matve\Desktop\gcap-labs\_support\upstream\agent37\minions`

Pinned SHAs:

| Component | SHA |
| --- | --- |
| gateway | `4bfccef431dad75d7edb0f474c558097fabbbc13` |
| starter-kit | `c91bff7e9fca1c7077be238ac64324d8bc2e304b` |
| docs | `069a2f069fc42be1718fe3026dd3e84a94731fdd` |
| examples | `1e537e055d99a2267bae0391cb57d840e35e3a0a` |
| minions | `c25dd2eb6bdd2b9fb8e03df23edcbff6671318dc` |

Policy:

- Do not edit the workspace-root reference repos directly for Headmaster product code.
- If Headmaster needs self-contained source, mirror only the required Agent37 files into this directory with `.git` removed.
- Keep this manifest updated whenever the source pins change.
- `openclaw-host-kit` was not present in the local Agent37 references at the time of this manifest; use the minimal Headmaster host-kit spec in `veeplan.md` until the source is recovered.
