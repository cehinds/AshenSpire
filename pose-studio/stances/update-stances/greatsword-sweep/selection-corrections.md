# Output attribution correction

The worker initially selected files by sorting `/workspace/generated_images` by modification time after concurrent imagegen calls. That method included unrelated outputs. Selection now uses only the explicit path returned by each imagegen call. The unrelated files were removed from this folder; their hashes are retained here for audit.

- Sweep A grip edit: `sheet-a.png`, SHA-256 `0fe543067cb65beecc2be7c214c75dbe35bd5e270dde92d9cb67998e6f271f3d`, returned path `exec-a9530da8-a1e8-44ed-add1-715e74287631.png`; root approved as concept candidates.
- Sweep B source: `sheet-b-original.png`, SHA-256 `cbdc645cdc8efa0c7b8d586e911f866014ac9182f402733e2a27189ed3e6ce27`, returned path `exec-7fb1ee8e-8438-414a-a759-25cff29e34fe.png`.
- Sweep B edited output: `sheet-b.png`, SHA-256 `accc940c276cfe87eee1f49bcd5692cbdeef8d7b018dfe5af766fdd4bf1fecee`, returned path `exec-0c3f8c7f-1542-4764-a66b-2b40def40a91.png`.
- Removed because root verified them under other stance families: SHA `d397a0dee7fbab250838e5385a47e7e9f54b342ca7896292cb7d78abc04ed8dd` (Evade A1) and SHA `ac43c85c1a98463114b4b94c8490316663adcd46db553a4796ea70fbb6a0b1f8` (Counter A2).
- Removed the unverified directory-selected output SHA `a072fe00348d8a904f2fd2ceef37bdf38b23d1c518e8b17a4a065613a2553919`; it was not an explicit returned path for a Sweep call.

This was a worker file-selection error. The image generation tool was not the cause.

- Targeted Sweep B edit: `sheet-b.png`, SHA-256 `8b9deed36436a27db6e884d7009350b1698ddd6f61339383bf3dffea4bcc3dcc`, returned path `exec-532fb87d-d92c-4b85-959a-deca98504da6.png`. This edit targeted only SW17 and SW18; root review is pending.
- Standalone SW17 replacement: `sw17-replacement.png`, SHA-256 `36e1eaea0b21ef33fd2f02e926c5d1819b779443bd11c964ff31665d0387b18a`, returned path `exec-45790d79-4560-4788-aa70-c1863c89bbf0.png`. Root requested it replace only the rejected SW17 board slot. Tool returned 1254x1254 despite the 1024x1024 request; source bytes are unchanged.
