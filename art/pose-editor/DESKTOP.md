# Standalone desktop app

Pose Studio is maintained separately at `D:/repos/PoseStudio`. Its Windows build is installed at `%LOCALAPPDATA%/Programs/PoseStudio/Pose Studio.exe` with a desktop shortcut. It bundles the editor and all 202 catalog assets, so neither this checkout nor the port 4291 server is needed to run it.

The editor layout is organized as library, preview, frame properties and timeline. Open/save, sprite imports, help and transition requests have dedicated dialogs. A narrow window exposes properties through a toggle above the preview.

The desktop shell stores its own draft and named sequences. Transfer existing browser work using Export JSON, then Open / Import sequence JSON in the desktop app. Native export uses a Save as dialog; closing the app flushes the current draft before the window closes. Browser exports still use a download.

This remains a local, unmerged art tool. No game release files or runtime integration changed.
