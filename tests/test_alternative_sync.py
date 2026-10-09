import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync', ROOT / 'tools/alternative-sync.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)
POLICY = json.loads((ROOT / '.github/alternative-battlefield-policy.json').read_text())
ART = 'docs/design/combat-depth-2026-10-05/'


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        self.git('init', '-b', 'dev')
        self.git('config', 'user.name', 'Sync test')
        self.git('config', 'user.email', 'sync@example.invalid')
        self.git('config', 'core.autocrlf', 'false')
        for path in ['src/ui/scene.js', 'styles/combat.css', 'src/engine/rules.js',
                     ART + 'editor/layout.json', ART + 'masters/hero.png', 'assets-mobile/bg/test.webp']:
            self.write(path, 'base\n')
        self.commit('base')
        self.git('branch', 'alternative/dev')

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.repo, stderr=subprocess.PIPE).decode().strip()

    def write(self, path, value):
        p = self.repo / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(value, encoding='utf-8')

    def commit(self, title):
        self.git('add', '.')
        self.git('commit', '-m', title)
        return self.git('rev-parse', 'HEAD')

    def prepare(self):
        return sync.prepare(self.repo, 'dev', 'alternative/dev', POLICY)

    def test_merge_keeps_battlefield_but_accepts_rules_and_art(self):
        self.write('src/ui/scene.js', 'upstream renderer\n')
        self.write(ART + 'editor/layout.json', 'upstream layout\n')
        self.write('src/engine/rules.js', 'new rule\n')
        self.write(ART + 'masters/hero.png', 'new sprite\n')
        self.write('assets-mobile/bg/test.webp', 'new background\n')
        source = self.commit('dev changes')
        self.git('checkout', 'alternative/dev')
        self.write('src/ui/scene.js', 'alternative renderer\n')
        self.write(ART + 'editor/layout.json', 'alternative layout\n')
        before = self.commit('alternative layout')
        report = self.prepare()
        self.assertTrue(report['mergeNeeded'])
        self.assertEqual((self.repo / 'src/ui/scene.js').read_text(), 'alternative renderer\n')
        self.assertEqual((self.repo / (ART + 'editor/layout.json')).read_text(), 'alternative layout\n')
        self.assertEqual((self.repo / 'src/engine/rules.js').read_text(), 'new rule\n')
        self.assertEqual((self.repo / (ART + 'masters/hero.png')).read_text(), 'new sprite\n')
        self.assertEqual((self.repo / 'assets-mobile/bg/test.webp').read_text(), 'new background\n')
        self.git('commit', '-m', 'sync')
        self.assertEqual(self.git('show', '-s', '--format=%P').split(), [before, source])
        sync.assert_preserved(self.repo, before, POLICY, 'HEAD')
        # A later dev merge is still visible after the protected merge's ancestry.
        self.git('branch', '-f', 'alternative/dev', 'HEAD')
        self.git('checkout', 'dev')
        self.write('src/engine/rules.js', 'next rule\n')
        self.commit('next dev')
        self.prepare()
        self.assertEqual((self.repo / 'src/engine/rules.js').read_text(), 'next rule\n')
        self.assertEqual((self.repo / 'src/ui/scene.js').read_text(), 'alternative renderer\n')

    def test_protected_additions_and_deletions_cannot_change_layout(self):
        self.git('rm', 'styles/combat.css')
        self.write('styles/new-layout.css', 'new rules\n')
        self.commit('replace styles')
        self.prepare()
        self.assertEqual((self.repo / 'styles/combat.css').read_text(), 'base\n')
        self.assertFalse((self.repo / 'styles/new-layout.css').exists())

    def test_unprotected_conflict_aborts_without_leaving_a_merge(self):
        self.write('src/engine/rules.js', 'upstream\n')
        self.commit('upstream')
        self.git('checkout', 'alternative/dev')
        self.write('src/engine/rules.js', 'alternative\n')
        before = self.commit('alternative')
        with self.assertRaisesRegex(RuntimeError, 'Unprotected merge conflicts'):
            self.prepare()
        self.assertEqual(self.git('rev-parse', 'HEAD'), before)
        self.assertEqual(self.git('status', '--porcelain'), '')
        self.assertNotEqual(subprocess.run(['git', 'rev-parse', '--verify', 'MERGE_HEAD'], cwd=self.repo, capture_output=True).returncode, 0)

    def test_independent_build_outputs_are_seeded_for_regeneration(self):
        self.write('buildordinal.json', json.dumps({'release': '0.7.1', 'ordinal': 9, 'digest': 'dev'}))
        self.write('src/content/changelog.generated.js', 'upstream generated receipt\n')
        self.commit('dev build')
        self.git('checkout', 'alternative/dev')
        self.write('buildordinal.json', json.dumps({'release': '0.7.1', 'ordinal': 8, 'digest': 'alternative'}))
        self.write('src/content/changelog.generated.js', 'alternative generated receipt\n')
        self.commit('alternative build')
        report = self.prepare()
        self.assertEqual(report['regenerate'], ['buildordinal.json', 'src/content/changelog.generated.js'])
        self.assertEqual(json.loads((self.repo / 'buildordinal.json').read_text())['ordinal'], 9)
        self.assertEqual(self.git('diff', '--name-only', '--diff-filter=U'), '')

    def test_verifier_rejects_tampering_after_prepare(self):
        self.write('src/engine/rules.js', 'new rule\n')
        self.commit('upstream')
        report = self.prepare()
        self.write('src/ui/scene.js', 'unexpected overwrite\n')
        self.git('add', '.')
        with self.assertRaisesRegex(RuntimeError, 'Protected battlefield'):
            sync.assert_preserved(self.repo, report['before'], POLICY)

    def test_cross_boundary_rename_stops(self):
        self.git('mv', 'src/ui/scene.js', 'src/engine/moved-scene.js')
        self.commit('move presentation out')
        with self.assertRaisesRegex(RuntimeError, 'Cross-boundary rename'):
            self.prepare()

    def test_noop_and_dirty_checkout(self):
        self.assertFalse(self.prepare()['mergeNeeded'])
        self.write('local.txt', 'unsaved\n')
        with self.assertRaisesRegex(RuntimeError, 'clean, isolated'):
            self.prepare()

    def test_allowlist_is_only_art_and_metadata(self):
        self.assertFalse(sync.protected(ART + 'layers/sky.png', POLICY))
        self.assertTrue(sync.protected(ART + 'layers/layout.js', POLICY))
        self.assertTrue(sync.protected(ART + 'editor/starting-layout-v2.json', POLICY))
        self.assertTrue(sync.protected('content/config/ui/components/card.json', POLICY))
        self.assertTrue(sync.protected('src/config/generated/ui.js', POLICY))
        self.assertTrue(sync.protected('src/ui/alternativeCardStage.js', POLICY))
        self.assertTrue(sync.protected('src/ui/alternativeAuraRenderer.js', POLICY))
        self.assertFalse(sync.protected('src/content/enemyArt.js', POLICY))


if __name__ == '__main__':
    unittest.main()
