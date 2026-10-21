// One explicit compatibility edge for the fixed-Evasion correction. Keep the
// immutable original profile and digest; only its rules are normalized on read.
// A later runtime must independently approve this edge instead of inheriting it.
const PREVIOUS_RUNTIME = 'sha256:0ca590715034b7f075d9ca81ad54ce1734e2d6af951ffd39e202d2148f2c10e9';
const FIXED_EVASION_RUNTIME = 'sha256:fd3088b4bbca6111a7095f8eb823ae3a30abd5badcb82b91dd32112b0f2e80e8';
export function coreEvasionCompatibleRuntime(profile, currentRuntime) {
  return currentRuntime === FIXED_EVASION_RUNTIME
    && profile?.lock?.runtimeHash === PREVIOUS_RUNTIME
    && profile.lock.runtimeABI === 'ashen.runtime@1'
    && profile.lock.numericPolicy === 'ashen.adapter-numbers@1'
    && profile.lock.core === 'ashen.core@2.0.0'
    && profile.foundation?.mode === 'configured'
    && profile.modules?.effects?.fixCoreVersion === 1
    ? PREVIOUS_RUNTIME : currentRuntime;
}
