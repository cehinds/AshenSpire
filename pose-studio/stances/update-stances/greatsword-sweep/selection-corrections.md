# Output attribution correction

The worker incorrectly selected files by sorting `/workspace/generated_images` by modification time after concurrent imagegen calls. That method attributed unrelated outputs to Sweep. Selection now uses only the explicit path returned by each imagegen call.

- Sweep B is `sheet-b.png`, SHA-256 `cbdc645cdc8efa0c7b8d586e911f866014ac9182f402733e2a27189ed3e6ce27`, returned path `exec-7fb1ee8e-8438-414a-a759-25cff29e34fe.png`.
- The A grip edit is `sheet-a.png`, SHA-256 `0fe543067cb65beecc2be7c214c75dbe35bd5e270dde92d9cb67998e6f271f3d`, returned path `exec-a9530da8-a1e8-44ed-add1-715e74287631.png`.
- Removed from this folder because root verified them under other stance families: SHA `d397a0dee7fbab250838e5385a47e7e9f54b342ca7896292cb7d78abc04ed8dd` (Evade A1) and SHA `ac43c85c1a98463114b4b94c8490316663adcd46db553a4796ea70fbb6a0b1f8` (Counter A2).
- Removed the unverified directory-selected output SHA `a072fe00348d8a904f2fd2ceef37bdf38b23d1c518e8b17a4a065613a2553919`; it was not the explicit returned path for a Sweep call.

This was a worker file-selection error. The image generation tool was not the cause.
