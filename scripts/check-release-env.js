// Runs on the EAS build server before installing (package.json "eas-build-pre-install").
// A store build with a wrong API address installs fine and then can't sign anyone in, so stop the build instead.
const profile = process.env.EAS_BUILD_PROFILE;
if (!profile) process.exit(0); // not an EAS build (local install)

const problems = [];
for (const name of ["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_WEB_URL"]) {
  const v = process.env[name] ?? "";
  if (!v) problems.push(`${name} is not set`);
  else if (v.includes("REPLACE")) problems.push(`${name} is still the placeholder in eas.json (${v})`);
  else if (!v.startsWith("https://")) problems.push(`${name} must be https:// for store builds (${v})`);
}
if (problems.length) {
  console.error(`\n✗ ${profile} build stopped:\n  - ${problems.join("\n  - ")}\n  Set the real addresses in eas.json → build.base.env.\n`);
  process.exit(1);
}
console.log(`✓ ${profile} build will use ${process.env.EXPO_PUBLIC_API_URL}`);
