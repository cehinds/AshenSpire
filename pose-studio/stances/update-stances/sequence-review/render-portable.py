"""Encode discrete labeled existing-art frames; never generate in-between poses."""
import argparse
import json
from shutil import copyfile
from pathlib import Path, PureWindowsPath


def safe_render_path(root, name):
    """Keep all manifest paths inside the chosen output root, including links."""
    if not isinstance(name, str) or not name or '\\' in name:
        raise ValueError('Unsafe render filename: ' + repr(name))
    if Path(name).is_absolute() or PureWindowsPath(name).drive or any(part in ('', '.', '..') for part in name.split('/')):
        raise ValueError('Unsafe render filename: ' + repr(name))
    base = Path(root).resolve()
    target = base / name
    canonical = target.resolve()
    if canonical == base or not canonical.is_relative_to(base):
        raise ValueError('Render path escapes output root: ' + name)
    return target


def preflight(root, manifest):
    outputs = manifest['outputs']
    if not isinstance(outputs, list):
        raise ValueError('Render outputs must be a list')
    for output in outputs:
        for field in ('frames', 'gifAliases'):
            names = output.get(field, [])
            if not isinstance(names, list):
                raise ValueError(field + ' must be a list')
            for name in names:
                safe_render_path(root, name)
        if 'gif' in output:
            safe_render_path(root, output['gif'])
        if output.get('storyboard') is not None:
            safe_render_path(root, output['storyboard'])


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--renders-root', type=Path, default=Path(__file__).resolve().parent/'renders')
    root = parser.parse_args(argv).renders_root.resolve()
    manifest_path=safe_render_path(root,'manifest.json')
    manifest=json.loads(manifest_path.read_text())
    preflight(root,manifest)
    from PIL import Image, ImageDraw, ImageFont
    for output in manifest['outputs']:
        if 'frames' not in output:continue
        images=[Image.open(safe_render_path(root,name)).convert('RGB') for name in output['frames']]
        # Each numbered slot remains its own GIF frame even when the pose repeats.
        width,height=images[0].size
        palette=Image.new('RGB',(width,height*len(images)))
        for i,image in enumerate(images): palette.paste(image,(0,height*i))
        palette=palette.quantize(colors=256)
        encoded=[image.quantize(palette=palette,dither=Image.Dither.FLOYDSTEINBERG) for image in images]
        encoded[0].save(safe_render_path(root,output['gif']),save_all=True,append_images=encoded[1:],duration=output['durations'],loop=0,optimize=False,disposal=2)
        for alias in output.get('gifAliases',[]):copyfile(safe_render_path(root,output['gif']),safe_render_path(root,alias))
        gif=Image.open(safe_render_path(root,output['gif']))
        assert gif.n_frames==len(images),(output['key'],gif.n_frames,len(images))
        durations=[]
        for i in range(gif.n_frames):gif.seek(i);durations.append(gif.info['duration'])
        assert durations==output['durations'],durations
        if output['storyboard']:
            columns=6 if len(images)>=6 else len(images);rows=(len(images)+columns-1)//columns
            tile_width=384;tile_height=352
            board=Image.new('RGB',(columns*tile_width,rows*tile_height),(25,32,37))
            for i,image in enumerate(images):board.paste(image.resize((tile_width,tile_height),Image.Resampling.LANCZOS),((i%columns)*tile_width,(i//columns)*tile_height))
            board.save(safe_render_path(root,output['storyboard']))
        output['decodedFrameCount']=gif.n_frames;output['decodedDurationsMs']=durations
        # Intermediate full-size labeled slots are derivable; keep only portable outputs.
        for name in output['frames']:safe_render_path(root,name).unlink()
        del output['frames']
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
    print('Verified GIF frame counts and exact durations for every output.')


if __name__ == "__main__":
    main()
