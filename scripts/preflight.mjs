/**
 * Environment preflight check.
 *
 * Fails fast with an actionable message instead of letting a contributor hit a
 * cryptic `linker 'link.exe' not found` five minutes into a build. Run it before
 * `pnpm verify`, or on its own with `pnpm preflight`.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const MIN_NODE = [22, 12, 0];
const EXPECTED_PROTOCOL_MAJOR = 28;
const WASM_TARGET = "wasm32v1-none";
const WSL_DISTRO = "Ubuntu-24.04";

const results = [];
let hardFailures = 0;

/** Records one check. `level` is "ok", "warn" or "fail". */
function record(name, level, detail, hint) {
  results.push({ name, level, detail, hint });
  if (level === "fail") hardFailures += 1;
}

/** Runs a command and returns trimmed stdout, or null if it cannot run. */
function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      ...options,
    }).trim();
  } catch {
    return null;
  }
}

function checkNode() {
  const parts = process.versions.node.split(".").map(Number);
  const ok = parts.some((value, index) => value > MIN_NODE[index])
    || parts.every((value, index) => value >= MIN_NODE[index]);
  const wanted = MIN_NODE.join(".");
  if (ok) {
    record("Node.js", "ok", process.version);
  } else {
    record(
      "Node.js",
      "fail",
      `${process.version} (need >= ${wanted})`,
      `@stellar/stellar-sdk declares engines.node >= ${wanted}.`,
    );
  }
}

function checkRust() {
  const rustc = run("rustc", ["--version"]);
  if (!rustc) {
    record("Rust", "fail", "rustc not found", "Install via https://rustup.rs");
    return;
  }
  record("Rust", "ok", rustc);

  const targets = run("rustup", ["target", "list", "--installed"]);
  if (targets === null) {
    record("Wasm target", "warn", "rustup not found, cannot verify");
  } else if (targets.split(/\r?\n/).includes(WASM_TARGET)) {
    record("Wasm target", "ok", WASM_TARGET);
  } else {
    record(
      "Wasm target",
      "fail",
      `${WASM_TARGET} missing`,
      `rustup target add ${WASM_TARGET}`,
    );
  }
}

function checkStellarCli() {
  const version = run("stellar", ["--version"]);
  if (!version) {
    record("Stellar CLI", "fail", "not found on PATH", "cargo install --locked stellar-cli");
    return;
  }
  const line = version.split(/\r?\n/)[0];
  const major = Number(line.match(/(\d+)\.\d+\.\d+/)?.[1]);
  if (major === EXPECTED_PROTOCOL_MAJOR) {
    record("Stellar CLI", "ok", line);
  } else {
    record(
      "Stellar CLI",
      "warn",
      `${line} (expected major ${EXPECTED_PROTOCOL_MAJOR})`,
      "The CLI major version should track the network protocol version.",
    );
  }
}

/**
 * Soroban builds need a host C toolchain because soroban-sdk-macros is a
 * proc-macro crate: it compiles for the host even when the contract targets
 * wasm32v1-none. Having the Wasm target installed is not sufficient.
 */
function checkHostLinker() {
  if (process.platform !== "win32") {
    record("Host linker", "ok", `${process.platform}, assumed present`);
    return;
  }

  const vswhere = join(
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
    "Microsoft Visual Studio",
    "Installer",
    "vswhere.exe",
  );
  const installPath = existsSync(vswhere)
    ? run(vswhere, [
      "-products", "*",
      "-requires", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
      "-property", "installationPath",
      "-latest",
    ])
    : null;

  if (installPath) {
    record("Host linker (MSVC)", "ok", installPath);
    return;
  }

  const wslDistros = run("wsl.exe", ["-l", "-q"], { encoding: "utf16le" }) ?? "";
  const hasDistro = wslDistros.split(/\r?\n/).some((line) => line.trim() === WSL_DISTRO);

  if (hasDistro) {
    record(
      "Host linker (MSVC)",
      "warn",
      "not installed — contract builds must run in WSL",
      `Use the win:* scripts, e.g. "pnpm win:verify". WSL ${WSL_DISTRO} is available.`,
    );
  } else {
    record(
      "Host linker (MSVC)",
      "fail",
      "no MSVC C++ tools and no WSL fallback",
      "Install the Visual Studio \"Desktop development with C++\" workload, "
        + `or install WSL ${WSL_DISTRO} with a Rust + Stellar CLI toolchain.`,
    );
  }
}

/**
 * The Stellar CLI keystore lives in ~/.config/stellar, and WSL has a different
 * home directory than Windows. Identities do not cross the boundary, so a deploy
 * run in WSL cannot see a key created on Windows.
 */
function noteKeystoreSplit() {
  if (process.platform !== "win32") return;
  record(
    "Keystore",
    "warn",
    "Windows and WSL keep separate Stellar CLI keystores",
    "Create the deploy identity in whichever environment runs the deploy.",
  );
}

checkNode();
checkRust();
checkStellarCli();
checkHostLinker();
noteKeystoreSplit();

const icon = { ok: "OK  ", warn: "WARN", fail: "FAIL" };
console.log("\nShowUp environment preflight\n");
for (const { name, level, detail, hint } of results) {
  console.log(`  ${icon[level]}  ${name.padEnd(20)} ${detail}`);
  if (hint) console.log(`        ${" ".repeat(20)} -> ${hint}`);
}
console.log();

if (hardFailures > 0) {
  console.error(`${hardFailures} blocking problem(s). Fix them before building.\n`);
  process.exitCode = 1;
}
