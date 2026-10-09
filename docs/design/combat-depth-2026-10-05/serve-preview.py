"""Read-only local preview server. Uses the checkout's tracked light artwork."""
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit,unquote
ROOT=Path(__file__).resolve().parents[3]
class Handler(SimpleHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.mjs':'text/javascript'}
    def log_message(self,*args):pass
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def translate_path(self,path):
        original=super().translate_path(path)
        rel=unquote(urlsplit(path).path).lstrip('/')
        if rel.startswith('assets/') and not Path(original).is_file():
            twin=(ROOT/'assets-mobile'/rel.removeprefix('assets/')).resolve()
            if twin.is_relative_to(ROOT/'assets-mobile') and twin.is_file():return str(twin)
        return original
print('Combat art preview: http://127.0.0.1:4189/docs/design/combat-depth-2026-10-05/',flush=True)
ThreadingHTTPServer.request_queue_size=128
ThreadingHTTPServer(('127.0.0.1',4189),Handler).serve_forever()
