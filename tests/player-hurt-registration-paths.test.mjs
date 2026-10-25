import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const tool=fileURLToPath(new URL('../tools/player-hurt-registration.py',import.meta.url));
const script=String.raw`
import importlib.util, json, os, pathlib, sys, tempfile, types
# This is a source-path/metadata regression, not an image or geometry test.
# Fail if any real decoder is reached. No image files are created or rendered.
pil=types.ModuleType('PIL')
class ForbiddenImage:
    @staticmethod
    def open(*args, **kwargs): raise AssertionError('image decoding is out of scope')
pil.Image=ForbiddenImage;sys.modules['PIL']=pil
spec=importlib.util.spec_from_file_location('hurt_paths_fixture',sys.argv[1])
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
scenario=sys.argv[2]
with tempfile.TemporaryDirectory(prefix='hurt-path-fixture-') as temporary:
    base=pathlib.Path(temporary);game=base/'game';art=base/'art checkout';cache=base/'explicit HURT cache'
    game.mkdir();art.mkdir();cache.mkdir()
    relative='assets-display/alternative/card-reaver-ready.webp'
    loose=game/relative;loose.parent.mkdir(parents=True);loose.write_text('wrong loose game bytes')
    source=art/'common'/relative;source.parent.mkdir(parents=True);source.write_text('reviewed external ready bytes')
    module.ROOT=str(game)
    os.environ.pop('ASHEN_ART_CHECKOUT',None)
    if scenario=='external':
        os.environ['ASHEN_ART_CHECKOUT']=str(art)
        resolved=module.ready_source(relative)
        assert resolved==source and resolved.read_text()=='reviewed external ready bytes'
        assert loose.read_text()=='wrong loose game bytes'
    elif scenario=='explicit':
        sys.argv=['fixture','--asset-root',str(art)]
        assert module.ready_source(relative)==source
        assert '--asset-root' not in sys.argv
    elif scenario=='missing':
        try: module.ready_source(relative)
        except ValueError as error: assert 'ASHEN_ART_CHECKOUT' in str(error)
        else: raise AssertionError('loose Game fallback was used')
        cached=game/'.art-cache'/'release';cached.mkdir(parents=True)
        try: module.ready_source(relative,asset_root=str(cached))
        except ValueError as error: assert 'runtime cache' in str(error)
        else: raise AssertionError('release cache accepted as authoring root')
    elif scenario=='cache-and-output':
        os.environ['ASHEN_ART_CHECKOUT']=str(art)
        ready={};expected_hurt=[];expected_ready=[]
        for actor,candidates in module.HURT_CANDIDATES.items():
            image=candidates[0]
            for tier,folder in [('high','assets'),('light','assets-mobile')]:
                path=cache/tier/folder/image;path.parent.mkdir(parents=True,exist_ok=True);path.write_text('fixture HURT bytes')
            relative='assets-display/alternative/'+actor+'-ready.webp'
            path=art/'common'/relative;path.parent.mkdir(parents=True,exist_ok=True);path.write_text('external '+actor)
            wrong=game/relative;wrong.parent.mkdir(parents=True,exist_ok=True);wrong.write_text('wrong local '+actor)
            ready[actor]={'frames':{'ready':{'path':relative}}}
            expected_hurt.append(str(cache/'high'/'assets'/image));expected_ready.append(str(path))
        content=game/'src/content';content.mkdir(parents=True)
        module.CATALOG=str(content/'alternativeCardAnimations.js')
        pathlib.Path(module.CATALOG).write_text('export const alternativeCardAnimations = '+json.dumps({'classes':ready})+';')
        module.OUT=str(content/'playerHurtFrames.js')
        opened=[]
        def alpha_box(path):
            opened.append(os.fspath(path));assert pathlib.Path(path).is_file()
            return (10,10,100,200),(256,256)
        module.alpha_box=alpha_box
        module.main(['--cache',str(cache)])
        assert opened[::2]==expected_hurt
        assert opened[1::2]==expected_ready
        output=pathlib.Path(module.OUT).read_text()
        assert 'export const playerHurtFrames' in output and all(actor in output for actor in ready)
        assert not (art/'src/content/playerHurtFrames.js').exists()
        assert not (game/'.art-cache').exists(), 'explicit cache selection changed meaning'
    else: raise AssertionError(scenario)
    print(json.dumps({'scenario':scenario,'result':'PASS'}))
`;

for(const scenario of ['external','explicit','missing','cache-and-output']) {
  test(`player HURT registration source ownership: ${scenario}`,()=>{
    const result=spawnSync(process.env.PYTHON||(process.platform==='win32'?'python':'python3'),
      ['-I','-c',script,tool,scenario],{encoding:'utf8',timeout:10_000});
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(result.stdout),{scenario,result:'PASS'});
  });
}
