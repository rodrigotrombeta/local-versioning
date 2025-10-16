# Installing Local Versioning

## Quick Install

1. Download `Local Versioning-1.0.0-arm64.dmg`
2. Open the `.dmg` file
3. Drag "Local Versioning" to Applications folder
4. **Important:** Run this command in Terminal before opening:
   ```bash
   xattr -d com.apple.quarantine "/Applications/Local Versioning.app"
   ```
5. Launch from Applications or Spotlight (Cmd+Space)

## Why This Command?

The app is not signed with an Apple Developer certificate, so macOS blocks it with a "damaged app" error. The command above removes this security flag safely.

The app itself is safe - you can review all source code in this repository.

## Requirements

- macOS 10.12 or later (macOS Sierra+)
- Git installed (comes pre-installed on macOS)
- ARM64 Mac (Apple Silicon: M1, M2, M3, M4)

For Intel Macs or more details, see [README.md](README.md)

