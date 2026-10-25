"""Mutable AI-Art authoring roots; never write verified runtime caches."""
import os
import sys
from pathlib import Path


def authoring_root(game_root, asset_root=None):
    # Shared exporters accept the same explicit option without changing their
    # existing parsers. Consume it before an exporter parses its own options.
    if '--asset-root' in sys.argv:
        index = sys.argv.index('--asset-root')
        if index + 1 >= len(sys.argv):
            raise ValueError('--asset-root requires an AI-Art checkout directory')
        asset_root = sys.argv[index + 1]
        del sys.argv[index:index + 2]
    value = asset_root or os.environ.get('ASHEN_ART_CHECKOUT')
    if not value:
        raise ValueError('Set ASHEN_ART_CHECKOUT (or --asset-root) to a separate writable cehinds/AI-Art checkout on branch ashenspire; runtime release caches are read-only.')
    directory = Path(value).resolve()
    if not directory.is_dir():
        raise ValueError('The art authoring checkout directory does not exist: ' + str(directory))
    if '.art-cache' in directory.parts or directory == Path(game_root).resolve():
        raise ValueError('Use a separate AI-Art authoring checkout, never the game checkout or its runtime cache.')
    # Child builders and Node helpers receive the same explicit authoring root.
    os.environ['ASHEN_ART_CHECKOUT'] = str(directory)
    return directory


def art_path(game_root, relative, asset_root=None):
    rel = str(relative)
    if not rel or '\\' in rel or Path(rel).is_absolute() or any(p.startswith('.') or p == '..' for p in rel.split('/')):
        raise ValueError('Unsafe art path: ' + rel)
    if (rel.startswith('assets-display/') and rel.endswith(('.json', '.md'))) or (rel.startswith('music/score/') and rel.endswith(('.mjs', '.js'))):
        return Path(game_root) / rel
    root = authoring_root(game_root, asset_root)
    if rel.startswith('assets-display/'):
        rel = 'common/' + rel
    elif rel.startswith('assets-mobile/'):
        rel = 'light/assets/' + rel[len('assets-mobile/'):]
    elif rel.startswith(('assets/fonts/', 'music/', 'map-detail/')):
        rel = 'common/' + rel
    elif rel.startswith('assets/'):
        rel = 'hd/' + rel
    target = root / rel
    canonical = target.resolve()
    if not canonical.is_relative_to(root) or '.art-cache' in canonical.parts:
        raise ValueError('Art paths cannot follow links outside the authoring checkout or into a runtime cache.')
    return target
