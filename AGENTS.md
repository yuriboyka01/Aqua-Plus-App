# Agent & Developer Instructions — AquaPlus Service App

## CRITICAL: Repository Boundary Rules

This repository is **Aqua-Plus-App** (the mobile application and technician field service OS).
* **App Repository URL**: `https://github.com/yuriboyka01/Aqua-Plus-App.git`
* **Website Repository URL**: `https://github.com/yuriboyka01/Aqua-plus.git` (DO NOT TOUCH FROM THIS WORKSPACE)

### Safety Rules:
1. **NEVER modify or set git remote to the website repository** (`https://github.com/yuriboyka01/Aqua-plus.git`).
2. The remote for this codebase must always remain `https://github.com/yuriboyka01/Aqua-Plus-App.git`.
3. Pushes to any destination other than `Aqua-Plus-App` are strictly blocked by the `.githooks/pre-push` hook.
4. Before running any git push or remote commands, always verify with `git remote -v`.
5. Never execute `git push --force` or `git reset --hard` without explicit user permission.
