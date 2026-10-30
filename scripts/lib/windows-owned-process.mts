import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { release } from "node:os";

// Native launch/handle port only. Selection, cancellation policy, logs and admission
// remain in runOwnedVerificationChild. No shell, downloads or persistent binary cache.
const ROOT = resolve(import.meta.dirname, "../..");
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
type Build = Readonly<{ executable: string; executableSha256: string; sourceSha256: string; sourceSnapshot: string;
  compiler: string; compilerSha256: string; provenance: string; provenanceSha256: string;
  frameworkReferences: readonly Readonly<{ file: string; sha256: string }>[] }>;
let build: Build | undefined;
function nativeBuild(): Build {
  assert.equal(process.platform, "win32", "Windows native ownership is only available on Windows.");
  assert.ok(Number(release().split(".")[0]) >= 10 && process.arch === "x64", "Native job launch requires Windows10+ x64.");
  const source = join(ROOT, "scripts/lib/windows-owned-process.cs"), bytes = readFileSync(source);
  assert.equal(realpathSync(source), source, "Native source cannot traverse links.");
  if (build) {
    assert.equal(hash(bytes), build.sourceSha256, "Native source changed during this invocation.");
    assert.equal(hash(readFileSync(build.sourceSnapshot)), build.sourceSha256, "Native captured source changed during this invocation.");
    assert.equal(hash(readFileSync(build.compiler)), build.compilerSha256, "Native compiler changed during this invocation.");
    assert.equal(hash(readFileSync(build.executable)), build.executableSha256, "Native executable changed during this invocation.");
    assert.equal(hash(readFileSync(build.provenance)), build.provenanceSha256, "Native build provenance changed during this invocation.");
    for (const reference of build.frameworkReferences) assert.equal(hash(readFileSync(reference.file)), reference.sha256, "Native framework input changed during this invocation.");
    return build;
  }
  const framework = join(process.env.SystemRoot ?? "C:\\Windows", "Microsoft.NET/Framework64/v4.0.30319");
  const compiler = join(framework, "csc.exe");
  assert.ok(lstatSync(compiler).isFile() && realpathSync(compiler) === compiler, "The installed .NET Framework compiler is required.");
  const evidenceRoot = join(ROOT, ".tmp-qa"); mkdirSync(evidenceRoot, { recursive: true });
  assert.equal(realpathSync(evidenceRoot), evidenceRoot, "Native build evidence cannot traverse links.");
  const directory = mkdtempSync(join(evidenceRoot, "windows-native-build-")), executable = join(directory, "windows-owned-process.exe");
  const sourceSnapshot = join(directory, "windows-owned-process.cs"), sourceSha256 = hash(bytes), compilerSha256 = hash(readFileSync(compiler));
  writeFileSync(sourceSnapshot, bytes, { flag: "wx", mode: 0o600 });
  const frameworkReferences = ["mscorlib.dll", "System.dll", "System.Core.dll", "System.Web.dll", "System.Web.Extensions.dll"]
    .map(name => ({ file: join(framework, name), sha256: hash(readFileSync(join(framework, name))) }));
  const flags = ["/nologo", "/noconfig", "/target:exe", "/platform:x64", "/optimize+", "/out:" + executable,
    ...frameworkReferences.filter(reference => !reference.file.endsWith("mscorlib.dll")).map(reference => "/r:" + reference.file), sourceSnapshot];
  execFileSync(compiler, flags, { windowsHide: true, cwd: ROOT, timeout: 60_000, maxBuffer: 1_000_000,
    env: { NODE_ENV: "test", SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, TEMP: process.env.TEMP, TMP: process.env.TMP }, stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(hash(readFileSync(source)), sourceSha256, "Native source changed during compilation.");
  assert.equal(hash(readFileSync(sourceSnapshot)), sourceSha256, "Native captured source changed during compilation.");
  assert.equal(hash(readFileSync(compiler)), compilerSha256, "Native compiler changed during compilation.");
  for (const reference of frameworkReferences) assert.equal(hash(readFileSync(reference.file)), reference.sha256, "Native framework input changed during compilation.");
  const provenance = join(directory, "build.json");
  const candidate = Object.freeze({ executable, sourceSha256, sourceSnapshot, compiler, compilerSha256, executableSha256: hash(readFileSync(executable)), provenance,
    frameworkReferences: Object.freeze(frameworkReferences.map(reference => Object.freeze(reference))) });
  const provenanceBytes = JSON.stringify({ ...candidate, schema: 1, flags, node: process.version, platform: process.platform,
    arch: process.arch, builtUtc: new Date().toISOString(), distribution: "Fresh local build from tracked C# source; no binary or cache trusted across invocations" }, null, 2) + "\n";
  writeFileSync(provenance, provenanceBytes, { flag: "wx", mode: 0o600 });
  const provenanceSha256 = hash(provenanceBytes);
  assert.equal(hash(readFileSync(provenance)), provenanceSha256, "Native build provenance was not preserved.");
  build = Object.freeze({ ...candidate, provenanceSha256 });
  return build;
}

export function windowsOwnedProcessCapability() {
  try { const native = nativeBuild(); return { status: "PASS" as const, native }; }
  catch { return { status: "BLOCKED" as const, missingProof: "windows_native_job_launch_unavailable" }; }
}

export type WindowsJobIdentity = { jobToken: string; helperPid: number; rootPid: number; rootPpid: number;
  rootCreationTimeFileTime: string; rootCreationTimeUtc: string; ownerJobAssignedBeforeResume: boolean; effectiveLimitFlags: number; jobHandleNonInheritable: boolean;
  jobBeforeResume: { totalProcesses: number; activeProcesses: number; processIds: number[] } };
export type WindowsJobReceipt = Omit<WindowsJobIdentity, "rootPid"> & { rootPid: number | null; status: string; reason: string; rootExitCode: number | null; resumeSucceeded: boolean;
  cleanup: { status: string; method: string; rootExitedBeforeCleanup: boolean; forcedTermination: boolean;
    activeProcessesBeforeCleanup: number; activeProcessesAfterCleanup: number; activeProcessIdsBeforeCleanup: number[];
    activeProcessIdsAfterCleanup: number[]; totalProcesses: number; rootHandleExited: boolean; processTreeVerified: boolean; jobHandleClosed?: boolean };
  nativeFailure: { stage: string; win32Code: number } | null };
export type WindowsStopReason = "cancelled" | "timeout" | "output_limit" | "owner_shutdown";
type NativeCleanup = { status: "PASS"; platform: string; method: string; processTreeVerified: boolean; forcedTermination: boolean;
  observedProcesses: number; liveProcesses: number; residualProcessesAfterExit: number; nativeJobReceipt: WindowsJobReceipt | null };

export function spawnWindowsOwnedProcess(options: { args: string[]; cwd: string; env: NodeJS.ProcessEnv;
  identityPath: string; receiptPath: string; limitMs: number }) {
  const native = nativeBuild(), { identityPath, receiptPath } = options;
  assert.ok(!existsSync(identityPath) && !existsSync(receiptPath), "Native evidence cannot be replaced.");
  for (const file of [identityPath, receiptPath]) assert.equal(realpathSync(dirname(file)), dirname(file), "Native evidence cannot traverse links.");
  const child = spawn(native.executable, ["--identity", identityPath, "--receipt", receiptPath, "--limit-ms", String(Math.ceil(options.limitMs)),
    "--cleanup-ms", "10000", "--", process.execPath, ...options.args], { cwd: options.cwd, env: options.env,
    windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  // Only this owner holds the control pipe. The native root receives NUL stdin,
  // so owner death closes this pipe and cannot be hidden by inherited descendants.
  child.stdin.on("error", () => undefined);
  const closed = new Promise<void>(done => { child.once("close", () => done()); child.once("error", () => done()); });
  const readIdentity = (): WindowsJobIdentity | null => existsSync(identityPath) ? JSON.parse(readFileSync(identityPath, "utf8")) : null;
  const readReceipt = (): WindowsJobReceipt | null => existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, "utf8")) : null;
  let stopped: Promise<NativeCleanup> | undefined;
  const verifiedCleanup = (): NativeCleanup => {
    const identity = readIdentity(), result = readReceipt();
    assert.ok(result, "Native job cleanup evidence is missing.");
    if (!identity) {
      assert.ok(result.helperPid === child.pid && /^[a-fA-F0-9-]{32,36}$/u.test(result.jobToken) && result.rootPid === null
        && result.resumeSucceeded === false && result.rootExitCode === null && result.status === "PASS" && result.nativeFailure === null
        && result.cleanup.status === "PASS" && result.cleanup.activeProcessesAfterCleanup === 0
        && result.cleanup.activeProcessIdsAfterCleanup.length === 0 && result.cleanup.totalProcesses === 0 && result.cleanup.rootHandleExited
        && child.exitCode === 0, "Native preallocation cancellation did not prove zero allocated roots.");
      return { status: "PASS" as const, platform: "win32", method: "windows-private-job-no-root", processTreeVerified: false,
        forcedTermination: result.cleanup.forcedTermination, observedProcesses: 0, liveProcesses: 0, residualProcessesAfterExit: 0, nativeJobReceipt: result };
    }
    assert.ok(/^[a-fA-F0-9-]{32,36}$/u.test(identity.jobToken) && identity.helperPid === child.pid && identity.rootPid > 0
      && identity.rootPpid === child.pid && identity.ownerJobAssignedBeforeResume === true && identity.effectiveLimitFlags === 0x2000 && identity.jobHandleNonInheritable === true,
    "Native creation-time job ownership is unqualified.");
    assert.ok(identity.jobBeforeResume.activeProcesses >= 1 && identity.jobBeforeResume.processIds.includes(identity.rootPid),
      "Native job did not observe the suspended root before first execution.");
    for (const key of ["jobToken", "helperPid", "rootPid", "rootPpid", "rootCreationTimeFileTime", "ownerJobAssignedBeforeResume", "effectiveLimitFlags", "jobHandleNonInheritable"] as const)
      assert.equal(result[key], identity[key], "Native evidence identity differs.");
    assert.deepEqual(result.jobBeforeResume, identity.jobBeforeResume, "Native pre-execution job membership differs.");
    assert.ok(result.status === "PASS" && result.nativeFailure === null && result.cleanup.status === "PASS" && result.cleanup.jobHandleClosed === true
      && result.cleanup.processTreeVerified === true && result.cleanup.activeProcessesAfterCleanup === 0
      && result.cleanup.activeProcessIdsAfterCleanup.length === 0 && result.cleanup.rootHandleExited === true,
    "Native cleanup did not prove zero owned processes.");
    assert.ok(Number.isSafeInteger(result.rootExitCode) && result.rootExitCode! >= 0 && result.rootExitCode! <= 0xffffffff,
      "Native root exit status is missing.");
    assert.equal(child.exitCode, 0, "Native capability failed independently of the root exit.");
    return { status: "PASS" as const, platform: "win32", method: "windows-private-job", processTreeVerified: true,
      forcedTermination: result.cleanup.forcedTermination, observedProcesses: result.cleanup.totalProcesses, liveProcesses: 0,
      residualProcessesAfterExit: result.cleanup.rootExitedBeforeCleanup ? result.cleanup.activeProcessesBeforeCleanup : 0,
      nativeJobReceipt: result };
  };
  const cleanup = (reason: WindowsStopReason = "owner_shutdown") => stopped ??= (async () => {
    if (!child.pid) {
      await closed;
      assert.equal(child.pid, undefined, "An unstarted native helper unexpectedly allocated a process.");
      return { status: "PASS" as const, platform: "win32", method: "unstarted-native-helper", processTreeVerified: false,
        forcedTermination: false, observedProcesses: 0, liveProcesses: 0, residualProcessesAfterExit: 0, nativeJobReceipt: null };
    }
    if (child.exitCode === null && child.signalCode === null && child.stdin.writable) child.stdin.end(JSON.stringify({ command: "cancel", reason }) + "\n");
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([closed, new Promise<never>((_, reject) => { deadline = setTimeout(() => {
      // Retained ChildProcess handle only. Kernel last-job-handle-close contains
      // descendants even if the native helper becomes unresponsive; missing
      // zero-membership evidence still fails closed.
      child.kill(); reject(new Error("Native job owner exceeded its independent cleanup bound."));
    }, 20_000); })]); }
    finally { if (deadline) clearTimeout(deadline); }
    return verifiedCleanup();
  })();
  Object.defineProperties(child, { verificationWindowsCleanup: { value: cleanup }, verificationWindowsIdentity: { value: readIdentity },
    verificationWindowsReceipt: { value: readReceipt }, verificationWindowsBuild: { value: native } });
  return { child, readIdentity, readReceipt, native };
}
