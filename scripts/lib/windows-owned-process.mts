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
    activeProcessIdsAfterCleanup: number[]; totalProcesses: number; rootHandleExited: boolean; processTreeVerified: boolean; jobHandleClosed?: boolean;
    retainedOwnedProcessHandles?: number; retainedOwnedProcessIds?: number[]; retainedOwnedHandlesSignaled?: boolean };
  residualMemberEvidence?: { members: { pid: number; creationTimeFileTime: string | null; inExactJob: boolean;
    signaledAfterCleanup: boolean | null; processHandleClosed: boolean | null }[] } | null;
  nativeFailure: { stage: string; win32Code: number } | null };
export type WindowsStopReason = "cancelled" | "timeout" | "output_limit" | "owner_shutdown";
type NativeCleanup = { status: "PASS"; platform: string; method: string; processTreeVerified: boolean; forcedTermination: boolean;
  observedProcesses: number; liveProcesses: number; residualProcessesAfterExit: number; nativeJobReceipt: WindowsJobReceipt | null };

type ClosureMember = { pid: number; creationTimeFileTime: string };
type ClosureCheckpoint = { schema: number; kind: string; jobToken: string; helperPid: number; helperCreationTimeFileTime: string;
  rootPid: number; rootCreationTimeFileTime: string; ownerJobAssignedBeforeResume: boolean; jobHandleNonInheritable: boolean;
  effectiveLimitFlags: number; privateUnnamedJob: boolean; jobHandleOwner: string; jobHandlesExported: number; processHandlesOnly: boolean;
  activeProcesses: number; processIds: number[]; members: ClosureMember[]; membershipCompleteAtCapture: boolean; capturedUtc: string };
type ClosureReady = { phase: string; jobToken: string; helperPid: number; memberPids: number[]; processHandlesOnly: boolean; allHandlesLive: boolean };
type ClosureCertificate = { schema: number; kind: string; status: string; jobToken: string; helperPid: number; helperCreationTimeFileTime: string;
  rootPid: number; rootCreationTimeFileTime: string; readyBeforeClosure: boolean; processHandlesOnly: boolean; jobHandlesRetained: number;
  processAccessMask: number; processHandlesInheritable: boolean; observationHandleCount: number; closedObservationHandleCount: number;
  allObservationHandlesClosed: boolean; jobQueriedAfterClosure: boolean; nativeFailure: unknown;
  observation: { deadlineMs: number; elapsedMs: number; wallElapsedMs: number; startedUtc: string; endedUtc: string; helperSignaled: boolean; allMembersSignaled: boolean;
    helperExitCode: number; members: Array<ClosureMember & { signaled: boolean; exitCode: number }> } };
function closureFileTime(value: unknown) {
  return typeof value === "string" && /^[1-9]\d{11,19}$/u.test(value);
}
function closureUtcMillis(value: unknown) {
  assert.ok(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/u.test(value), "Native closure UTC must retain its canonical round-trip string.");
  const parsed = Date.parse(value);
  assert.ok(Number.isFinite(parsed) && new Date(parsed).toISOString() === value.replace(/(\.\d{3})\d{4}Z$/u, "$1Z"), "Native closure UTC is invalid.");
  return parsed;
}
function closureCheckpoint(identity: WindowsJobIdentity, value: unknown): ClosureCheckpoint {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Native closure checkpoint is missing or malformed.");
  const proof = value as ClosureCheckpoint;
  assert.ok(proof.schema === 1 && proof.kind === "windows-job-pre-close" && identity.ownerJobAssignedBeforeResume === true
    && identity.jobHandleNonInheritable === true && identity.effectiveLimitFlags === 0x2000
    && identity.rootPpid === identity.helperPid && identity.jobBeforeResume.activeProcesses >= 1
    && identity.jobBeforeResume.processIds.includes(identity.rootPid), "Native closure identity is unqualified.");
  for (const key of ["jobToken", "helperPid", "rootPid", "rootCreationTimeFileTime"] as const)
    assert.equal(proof[key], identity[key], "Native closure checkpoint identity differs.");
  assert.ok(typeof proof.jobToken === "string" && /^[a-fA-F0-9-]{32,36}$/u.test(proof.jobToken) && Number.isSafeInteger(proof.helperPid) && proof.helperPid > 0
    && Number.isSafeInteger(proof.rootPid) && proof.rootPid > 0 && proof.helperPid !== proof.rootPid
    && closureFileTime(proof.helperCreationTimeFileTime) && closureFileTime(proof.rootCreationTimeFileTime), "Native closure birth identity is malformed.");
  assert.ok(proof.ownerJobAssignedBeforeResume === true && proof.jobHandleNonInheritable === true && proof.effectiveLimitFlags === 0x2000
    && proof.privateUnnamedJob === true && proof.jobHandleOwner === "helper-only" && proof.jobHandlesExported === 0
    && proof.processHandlesOnly === true && proof.membershipCompleteAtCapture === true, "Native closure handle or containment contract is unqualified.");
  assert.ok(Array.isArray(proof.processIds) && Array.isArray(proof.members) && Number.isSafeInteger(proof.activeProcesses)
    && proof.activeProcesses > 0 && proof.activeProcesses <= 4096 && proof.activeProcesses === proof.processIds.length
    && proof.members.length === proof.processIds.length && new Set(proof.processIds).size === proof.processIds.length
    && proof.processIds.every(pid => Number.isSafeInteger(pid) && pid > 0 && pid !== proof.helperPid), "Native closure membership is incomplete.");
  assert.deepEqual(proof.members.map(member => member.pid).sort((a, b) => a - b), [...proof.processIds].sort((a, b) => a - b), "Native closure member identities differ.");
  assert.ok(proof.members.every(member => closureFileTime(member.creationTimeFileTime))
    && proof.members.find(member => member.pid === proof.rootPid)?.creationTimeFileTime === proof.rootCreationTimeFileTime,
  "Native closure member birth identity is unqualified.");
  closureUtcMillis(proof.capturedUtc);
  return proof;
}

/** Separate fail-safe qualification; never substitutes for the execution's native result receipt. */
export function qualifyWindowsClosureEvidence(input: { identity: WindowsJobIdentity; checkpoint: unknown; ready: unknown; certificate: unknown;
  observerExit: { code: number | null; signal: NodeJS.Signals | null } }) {
  const checkpoint = closureCheckpoint(input.identity, input.checkpoint), ready = input.ready as ClosureReady, certificate = input.certificate as ClosureCertificate;
  assert.ok(ready && ready.phase === "READY" && ready.jobToken === checkpoint.jobToken && ready.helperPid === checkpoint.helperPid
    && ready.processHandlesOnly === true && ready.allHandlesLive === true, "Independent native observer was not live before closure.");
  assert.deepEqual([...ready.memberPids].sort((a, b) => a - b), [...checkpoint.processIds].sort((a, b) => a - b), "Observer ready membership differs.");
  assert.ok(certificate && certificate.schema === 1 && certificate.kind === "windows-job-last-handle-close" && certificate.status === "PASS"
    && certificate.readyBeforeClosure === true && certificate.processHandlesOnly === true && certificate.jobHandlesRetained === 0
    && certificate.processAccessMask === 0x101000 && certificate.processHandlesInheritable === false
    && certificate.observationHandleCount === checkpoint.members.length + 1 && certificate.closedObservationHandleCount === certificate.observationHandleCount
    && certificate.allObservationHandlesClosed === true && certificate.jobQueriedAfterClosure === false && certificate.nativeFailure === null,
  "Native last-handle closure certificate is unqualified.");
  for (const key of ["jobToken", "helperPid", "helperCreationTimeFileTime", "rootPid", "rootCreationTimeFileTime"] as const)
    assert.equal(certificate[key], checkpoint[key], "Native closure certificate identity differs.");
  const observation = certificate.observation;
  const observationStarted = closureUtcMillis(observation?.startedUtc), observationEnded = closureUtcMillis(observation?.endedUtc);
  assert.ok(observation && Number.isSafeInteger(observation.deadlineMs) && observation.deadlineMs >= 50 && observation.deadlineMs <= 6000
    && Number.isFinite(observation.elapsedMs) && observation.elapsedMs >= 0 && observation.elapsedMs <= observation.deadlineMs
    && Number.isFinite(observation.wallElapsedMs) && observation.wallElapsedMs >= 0 && observation.wallElapsedMs <= observation.deadlineMs
    && observation.helperSignaled === true && observation.allMembersSignaled === true && Number.isSafeInteger(observation.helperExitCode)
    && observation.helperExitCode >= 0 && observation.helperExitCode <= 0xffffffff, "Native closure observation exceeded its bound or lacks helper exit.");
  assert.ok(observationStarted >= closureUtcMillis(checkpoint.capturedUtc)
    && observationEnded >= observationStarted && observationEnded - observationStarted <= observation.deadlineMs,
  "Native closure observation wall-clock interval is unqualified.");
  assert.ok(Array.isArray(observation.members) && observation.members.length === checkpoint.members.length, "Native closure observation omitted a member.");
  for (const member of checkpoint.members) {
    const matches = observation.members.filter(value => value.pid === member.pid && value.creationTimeFileTime === member.creationTimeFileTime);
    assert.ok(matches.length === 1 && matches[0]!.signaled === true && Number.isSafeInteger(matches[0]!.exitCode)
      && matches[0]!.exitCode >= 0 && matches[0]!.exitCode <= 0xffffffff, "A retained native member handle did not signal within the bound.");
  }
  assert.deepEqual(input.observerExit, { code: 0, signal: null }, "Native observer failed independently of the owned run.");
  return { status: "PASS" as const, method: "windows-kernel-last-handle-close", processTreeVerified: true, liveProcesses: 0,
    observedProcesses: checkpoint.members.length, jobQueriedAfterClosure: false, checkpoint, certificate };
}

export function requestWindowsClosureCheckpoint(child: ReturnType<typeof spawn>) {
  const request = (child as typeof child & { verificationWindowsCheckpoint?: () => Promise<{ checkpointPath: string; checkpoint: ClosureCheckpoint }> }).verificationWindowsCheckpoint;
  assert.ok(process.platform === "win32" && request, "Closure checkpoint requires a registered native child.");
  return request();
}

/** Fixed read-only wait primitive in the same native capability, used by the existing lifecycle verifier. */
export function startWindowsClosureObservation(options: { identity: WindowsJobIdentity; checkpointPath: string; observationPath: string;
  deadlineMs: number; env: NodeJS.ProcessEnv }) {
  assert.ok(Number.isSafeInteger(options.deadlineMs) && options.deadlineMs >= 50 && options.deadlineMs <= 6000, "Native closure observation needs a finite bounded deadline.");
  assert.ok(!existsSync(options.observationPath) && resolve(options.checkpointPath) === options.checkpointPath
    && resolve(options.observationPath) === options.observationPath && dirname(options.checkpointPath) === dirname(options.observationPath)
    && realpathSync(dirname(options.observationPath)) === dirname(options.observationPath) && lstatSync(options.checkpointPath).isFile()
    && realpathSync(options.checkpointPath) === options.checkpointPath, "Native observation evidence must be fresh and owned.");
  const checkpoint = closureCheckpoint(options.identity, JSON.parse(readFileSync(options.checkpointPath, "utf8"))), native = nativeBuild();
  const child = spawn(native.executable, ["--observe-close", options.checkpointPath, options.observationPath, String(options.deadlineMs)], {
    windowsHide: true, env: options.env, stdio: ["ignore", "pipe", "pipe"], cwd: dirname(options.checkpointPath) });
  let stdout = "", stderr = "", readyValue: ClosureReady | undefined, failure: unknown;
  let readyResolve!: (value: ClosureReady) => void, readyReject!: (error: unknown) => void;
  const ready = new Promise<ClosureReady>((done, reject) => { readyResolve = done; readyReject = reject; });
  ready.catch(() => undefined);
  const closed = new Promise<void>(done => { child.once("close", () => done()); child.once("error", () => done()); });
  let boundReject!: (error: unknown) => void;
  const bound = new Promise<never>((_, reject) => { boundReject = reject; });
  const deadline = setTimeout(() => {
    failure = Error("Native closure observer exceeded its independent deadline.");
    try { child.kill(); } catch { /* The bounded failure retains an outstanding cleanup obligation. */ }
    readyReject(failure); boundReject(failure);
  }, options.deadlineMs + 2000);
  child.stdout.on("data", (bytes: Buffer) => {
    stdout += String(bytes);
    if (stdout.length > 65_536) { failure = Error("Native closure observer output exceeded its bound."); child.kill(); return; }
    if (stdout.includes("\n") && !readyValue && !failure) {
      try {
        const value = JSON.parse(stdout.trim()) as ClosureReady;
        assert.ok(value.phase === "READY" && value.jobToken === checkpoint.jobToken && value.helperPid === checkpoint.helperPid
          && value.processHandlesOnly === true && value.allHandlesLive === true, "Native observer readiness is unqualified.");
        assert.deepEqual([...value.memberPids].sort((a, b) => a - b), [...checkpoint.processIds].sort((a, b) => a - b));
        readyValue = value; readyResolve(value);
      } catch (error) { failure = error; readyReject(error); child.kill(); }
    }
  });
  child.stderr.on("data", (bytes: Buffer) => { stderr += String(bytes); if (stderr.length > 65_536) { failure = Error("Native observer stderr exceeded its bound."); child.kill(); } });
  child.once("error", error => { failure = error; readyReject(error); });
  const completed = (async () => {
    let certificate: unknown;
    try {
      await Promise.race([closed, bound]);
      if (existsSync(options.observationPath)) certificate = JSON.parse(readFileSync(options.observationPath, "utf8"));
      if (failure) throw failure;
      assert.ok(readyValue, "Native closure observer exited before live readiness.");
      return qualifyWindowsClosureEvidence({ identity: options.identity, checkpoint, ready: readyValue, certificate,
        observerExit: { code: child.exitCode, signal: child.signalCode } });
    } catch (error) {
      readyReject(error);
      if (error instanceof Error) Object.defineProperty(error, "closureObservation", { value: { certificate, observerExit: { code: child.exitCode, signal: child.signalCode },
        stdout, stderr, observationPath: options.observationPath, cleanupPending: child.exitCode === null && child.signalCode === null }, enumerable: true });
      throw error;
    } finally { clearTimeout(deadline); }
  })();
  completed.catch(() => undefined);
  return { child, ready, completed, native, cancel: async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([closed, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("Native observer cancellation did not close its retained process.")), 2000); })]); }
    finally { if (timer) clearTimeout(timer); }
  } };
}

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
  let checkpointRequested = false;
  const requestCheckpoint = async () => {
    assert.ok(!checkpointRequested && child.pid && child.exitCode === null && child.signalCode === null && child.stdin.writable,
      "Native closure checkpoint requires one live registered owner.");
    checkpointRequested = true;
    const checkpointPath = identityPath + ".closure.json";
    assert.equal(existsSync(checkpointPath), false, "Native closure checkpoint cannot replace evidence.");
    child.stdin.write(JSON.stringify({ command: "checkpoint" }) + "\n");
    const deadline = performance.now() + 2500, wallStarted = Date.now();
    for (;;) {
      const wallElapsed = Date.now() - wallStarted;
      assert.ok(child.exitCode === null && child.signalCode === null && performance.now() < deadline && wallElapsed >= 0 && wallElapsed < 2500,
        "Native closure checkpoint was not proved within its bound.");
      if (existsSync(checkpointPath)) {
        try { return { checkpointPath, checkpoint: closureCheckpoint(readIdentity()!, JSON.parse(readFileSync(checkpointPath, "utf8"))) }; }
        catch (error) { if (!(error instanceof SyntaxError)) throw error; }
      }
      await new Promise<void>(done => setTimeout(done, 10));
    }
  };
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
    assert.ok(result.cleanup.retainedOwnedHandlesSignaled === true
      && Number.isSafeInteger(result.cleanup.retainedOwnedProcessHandles) && result.cleanup.retainedOwnedProcessHandles! >= 0
      && Array.isArray(result.cleanup.retainedOwnedProcessIds)
      && result.cleanup.retainedOwnedProcessIds.length === result.cleanup.retainedOwnedProcessHandles
      && (result.residualMemberEvidence == null || Array.isArray(result.residualMemberEvidence.members))
      && (result.residualMemberEvidence?.members.filter(member => member.inExactJob === true).length ?? 0)
        === result.cleanup.retainedOwnedProcessHandles
      && new Set(result.cleanup.retainedOwnedProcessIds).size === result.cleanup.retainedOwnedProcessIds.length
      && result.cleanup.retainedOwnedProcessIds.every(pid => Number.isSafeInteger(pid) && pid > 0 && pid <= 0xffffffff
        && result.cleanup.activeProcessIdsBeforeCleanup.includes(pid)
        && Array.isArray(result.residualMemberEvidence?.members)
        && result.residualMemberEvidence.members.filter(member => member.pid === pid).length === 1
        && result.residualMemberEvidence.members.some(member => member.pid === pid && member.inExactJob === true
          && typeof member.creationTimeFileTime === "string" && /^[1-9][0-9]*$/u.test(member.creationTimeFileTime)
          && member.signaledAfterCleanup === true && member.processHandleClosed === true)),
    "Native cleanup did not prove termination of every retained owned process handle.");
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
    verificationWindowsReceipt: { value: readReceipt }, verificationWindowsBuild: { value: native }, verificationWindowsCheckpoint: { value: requestCheckpoint } });
  return { child, readIdentity, readReceipt, native, requestClosureCheckpoint: requestCheckpoint };
}
