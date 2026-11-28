import assert from 'node:assert/strict';

export function SampleTest(actual, other)
{
    assert.equal(actual, 'expected', 'the value matches');
    assert.equal(other, 'expected', 'the value matches');
}
