"""Local preview with enough queued connections for synchronized outfit playback."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

parser=argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=8843)
args=parser.parse_args()
class PreviewServer(ThreadingHTTPServer):
    request_queue_size=128
root=Path(__file__).resolve().parents[2]
server=PreviewServer(('127.0.0.1',args.port),partial(SimpleHTTPRequestHandler,directory=str(root)))
print(f'http://127.0.0.1:{args.port}/art/dagger-outfits-2026-09-19/',flush=True)
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
