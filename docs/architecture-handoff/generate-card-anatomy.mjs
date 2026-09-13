import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
// Preserve the old bookmark while using the atlas's shared card implementation.
const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AshenSpire · Shared card anatomy</title><style>body{background:#211a12;color:#eee2ce;font:1rem system-ui;padding:2rem}a{color:#d5af68}</style><p><a href="wireframe-gallery.html?preview=example#WC2c1">Open the shared card anatomy and its component references</a></p><script>location.replace("wireframe-gallery.html?preview=example#WC2c1")</script></html>';
fs.writeFileSync(fileURLToPath(new URL('./card-anatomy.html',import.meta.url)),html);
