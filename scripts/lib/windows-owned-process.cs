// The existing QA child owner freshly builds this source into a task-owned, source-bound directory.
// Windows 10+ only. This is a native launch/cleanup port, not a command selector or runner.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

internal static class WindowsOwnedProcess
{
    private const uint KillOnJobClose = 0x00002000;
    private const uint Breakaway = 0x00000800;
    private const uint SilentBreakaway = 0x00001000;
    private const uint WaitObject0 = 0;
    private const uint WaitTimeout = 258;
    private const uint WaitFailed = 0xffffffff;
    private const uint ForcedExitCode = 0xe0000001;
    private static readonly IntPtr InvalidHandle = new IntPtr(-1);
    private static readonly ManualResetEvent ControlReceived = new ManualResetEvent(false);
    private static readonly ManualResetEvent HelperFinished = new ManualResetEvent(false);
    private static readonly object ControlLock = new object();
    private static string controlReason;
    private static long controlStartedTicks;

    [StructLayout(LayoutKind.Sequential)]
    private struct SecurityAttributes { public uint Length; public IntPtr Descriptor; [MarshalAs(UnmanagedType.Bool)] public bool Inherit; }
    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfo {
        public uint Size; public IntPtr Reserved; public IntPtr Desktop; public IntPtr Title;
        public uint X; public uint Y; public uint XSize; public uint YSize; public uint XChars; public uint YChars;
        public uint Fill; public uint Flags; public ushort Show; public ushort ReservedBytes;
        public IntPtr Reserved2; public IntPtr Stdin; public IntPtr Stdout; public IntPtr Stderr;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfoEx { public StartupInfo Startup; public IntPtr Attributes; }
    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInformation { public IntPtr Process; public IntPtr Thread; public uint Pid; public uint Tid; }
    [StructLayout(LayoutKind.Sequential)]
    private struct BasicLimits {
        public long ProcessTime; public long JobTime; public uint Flags;
        public UIntPtr MinimumWorkingSet; public UIntPtr MaximumWorkingSet; public uint ActiveProcessLimit;
        public UIntPtr Affinity; public uint Priority; public uint Scheduling;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct IoCounters { public ulong ReadOperations; public ulong WriteOperations; public ulong OtherOperations; public ulong ReadBytes; public ulong WriteBytes; public ulong OtherBytes; }
    [StructLayout(LayoutKind.Sequential)]
    private struct ExtendedLimits {
        public BasicLimits Basic; public IoCounters Io;
        public UIntPtr ProcessMemory; public UIntPtr JobMemory; public UIntPtr PeakProcessMemory; public UIntPtr PeakJobMemory;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct BasicAccounting {
        public long UserTime; public long KernelTime; public long PeriodUserTime; public long PeriodKernelTime;
        public uint PageFaults; public uint TotalProcesses; public uint ActiveProcesses; public uint TerminatedProcesses;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct FileTime { public uint Low; public uint High; }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObjectW(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetInformationJobObject(IntPtr job, int informationClass, ref ExtendedLimits limits, uint length);
    [DllImport("kernel32.dll", EntryPoint = "QueryInformationJobObject", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool QueryLimits(IntPtr job, int informationClass, out ExtendedLimits limits, uint length, IntPtr returnedLength);
    [DllImport("kernel32.dll", EntryPoint = "QueryInformationJobObject", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool QueryAccounting(IntPtr job, int informationClass, out BasicAccounting accounting, uint length, IntPtr returnedLength);
    [DllImport("kernel32.dll", EntryPoint = "QueryInformationJobObject", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool QueryProcessIds(IntPtr job, int informationClass, IntPtr list, uint length, IntPtr returnedLength);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsProcessInJob(IntPtr process, IntPtr job, [MarshalAs(UnmanagedType.Bool)] out bool result);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool TerminateJobObject(IntPtr job, uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool TerminateProcess(IntPtr process, uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, uint flags, ref IntPtr size);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returnedSize);
    [DllImport("kernel32.dll")]
    private static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CreateProcessW(string application, StringBuilder commandLine, IntPtr processAttributes, IntPtr threadAttributes,
        [MarshalAs(UnmanagedType.Bool)] bool inheritHandles, uint flags, IntPtr environment, string currentDirectory,
        ref StartupInfoEx startup, out ProcessInformation process);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetProcessTimes(IntPtr process, out FileTime creation, out FileTime exit, out FileTime kernel, out FileTime user);
    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int standardHandle);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DuplicateHandle(IntPtr sourceProcess, IntPtr source, IntPtr targetProcess, out IntPtr target, uint access,
        [MarshalAs(UnmanagedType.Bool)] bool inherit, uint options);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateFileW(string name, uint access, uint share, ref SecurityAttributes attributes, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetHandleInformation(IntPtr handle, out uint flags);

    private sealed class NativeFailure : Exception {
        public readonly string Stage;
        public readonly int Code;
        public NativeFailure(string stage, int code) { Stage = stage; Code = code; }
    }

    private static NativeFailure Error(string stage) { return new NativeFailure(stage, Marshal.GetLastWin32Error()); }
    private static Dictionary<string, object> Map(params object[] values) {
        Dictionary<string, object> result = new Dictionary<string, object>();
        for (int i = 0; i < values.Length; i += 2) result.Add((string)values[i], values[i + 1]);
        return result;
    }
    private static void RequestControl(string reason) {
        lock (ControlLock) {
            if (controlReason == null) { controlStartedTicks = Stopwatch.GetTimestamp(); controlReason = reason; ControlReceived.Set(); }
        }
    }
    private static string ReadControlReason() { lock (ControlLock) { return controlReason; } }
    private static void Watchdog(Stopwatch lifetime, int limitMs, int cleanupMs) {
        // A blocked main-thread file/API operation must not keep the private job alive indefinitely.
        // Self-exit closes our only job handle. Missing final evidence is a BLOCKED result for the JS owner.
        while (!HelperFinished.WaitOne(25)) {
            long controlledAt;
            lock (ControlLock) { controlledAt = controlStartedTicks; }
            bool controlExpired = controlledAt != 0 && (Stopwatch.GetTimestamp() - controlledAt) * 1000.0 / Stopwatch.Frequency >= cleanupMs + 1000L;
            if (controlExpired || lifetime.ElapsedMilliseconds >= (long)limitMs + cleanupMs + 1000L) Environment.Exit(5);
        }
    }
    private static void ControlLoop() {
        try {
            using (StreamReader input = new StreamReader(Console.OpenStandardInput(), Encoding.UTF8, false, 256)) {
                StringBuilder line = new StringBuilder();
                for (;;) {
                    int next = input.Read();
                    if (next < 0) { RequestControl("owner_lost"); return; }
                    if (next == '\r') continue;
                    if (next != '\n') {
                        if (line.Length >= 1024) { RequestControl("invalid_control"); return; }
                        line.Append((char)next); continue;
                    }
                    Dictionary<string, object> message = new JavaScriptSerializer().DeserializeObject(line.ToString()) as Dictionary<string, object>;
                    object command, reason;
                    if (message == null || message.Count != 2 || !message.TryGetValue("command", out command) || !message.TryGetValue("reason", out reason)
                        || !(command is string) || (string)command != "cancel" || !(reason is string)
                        || !new HashSet<string>(new string[] { "cancelled", "timeout", "output_limit", "owner_shutdown" }).Contains((string)reason)) {
                        RequestControl("invalid_control"); return;
                    }
                    RequestControl((string)reason); return;
                }
            }
        } catch { RequestControl("invalid_control"); }
    }
    private static string QuoteArgument(string value) {
        StringBuilder result = new StringBuilder("\""); int slashes = 0;
        foreach (char character in value) {
            if (character == '\\') { slashes++; continue; }
            if (character == '"') { result.Append('\\', slashes * 2 + 1); result.Append('"'); slashes = 0; continue; }
            result.Append('\\', slashes); slashes = 0; result.Append(character);
        }
        result.Append('\\', slashes * 2); return result.Append('"').ToString();
    }
    private static void ValidateEvidencePath(string file) {
        if (!Path.IsPathRooted(file) || !String.Equals(Path.GetFullPath(file), file, StringComparison.OrdinalIgnoreCase)) throw new NativeFailure("evidence_path", 0);
        string directory = Path.GetDirectoryName(file);
        if (!Directory.Exists(directory) || File.Exists(file) || Directory.Exists(file)) throw new NativeFailure("evidence_exists_or_parent_missing", 0);
        for (DirectoryInfo parent = new DirectoryInfo(directory); parent != null; parent = parent.Parent)
            if ((parent.Attributes & FileAttributes.ReparsePoint) != 0) throw new NativeFailure("evidence_reparse_parent", 0);
    }
    private static void WriteExclusive(string file, object value) {
        byte[] bytes = new UTF8Encoding(false).GetBytes(new JavaScriptSerializer().Serialize(value) + "\n");
        using (FileStream output = new FileStream(file, FileMode.CreateNew, FileAccess.Write, FileShare.Read)) {
            output.Write(bytes, 0, bytes.Length); output.Flush(true);
        }
    }
    private static IntPtr DuplicateStandard(int kind) {
        IntPtr source = GetStdHandle(kind), target;
        if (source == IntPtr.Zero || source == InvalidHandle) throw new NativeFailure("stdio_missing", 0);
        if (!DuplicateHandle(GetCurrentProcess(), source, GetCurrentProcess(), out target, 0, true, 2)) throw Error("duplicate_stdio");
        return target;
    }
    private static BasicAccounting Accounting(IntPtr job) {
        BasicAccounting value;
        if (!QueryAccounting(job, 1, out value, (uint)Marshal.SizeOf(typeof(BasicAccounting)), IntPtr.Zero)) throw Error("query_accounting");
        return value;
    }
    private static long[] ProcessIds(IntPtr job) {
        int capacity = 16;
        for (int attempt = 0; attempt < 8; attempt++) {
            int size = checked(8 + capacity * IntPtr.Size); IntPtr memory = Marshal.AllocHGlobal(size);
            try {
                if (!QueryProcessIds(job, 3, memory, (uint)size, IntPtr.Zero)) {
                    int error = Marshal.GetLastWin32Error();
                    if (error != 234) throw new NativeFailure("query_job_members", error);
                    uint needed = unchecked((uint)Marshal.ReadInt32(memory, 0));
                    capacity = Math.Max(capacity * 2, checked((int)needed));
                    if (capacity > 4096) throw new NativeFailure("job_member_read_bound", 0);
                    continue;
                }
                uint count = unchecked((uint)Marshal.ReadInt32(memory, 4));
                if (count > capacity) throw new NativeFailure("job_member_count", 0);
                long[] values = new long[count];
                for (int i = 0; i < values.Length; i++) values[i] = IntPtr.Size == 8 ? Marshal.ReadInt64(memory, 8 + i * IntPtr.Size) : (long)unchecked((uint)Marshal.ReadInt32(memory, 8 + i * IntPtr.Size));
                return values;
            } finally { Marshal.FreeHGlobal(memory); }
        }
        throw new NativeFailure("job_member_read_retries", 0);
    }
    private static bool RootExited(IntPtr root) {
        if (root == IntPtr.Zero) return true;
        uint wait = WaitForSingleObject(root, 0);
        if (wait == WaitFailed) throw Error("wait_root");
        return wait == WaitObject0;
    }
    private static long? ExitCode(IntPtr root) {
        if (root == IntPtr.Zero || !RootExited(root)) return null;
        uint code;
        if (!GetExitCodeProcess(root, out code)) throw Error("root_exit_code");
        return (long)code;
    }
    private static void Remember(ref NativeFailure failure, NativeFailure next) { if (failure == null) failure = next; }

    public static int Main(string[] args) {
        string identityPath = null, receiptPath = null, executable = null;
        int limitMs = 0, cleanupMs = 0, firstArgument = -1;
        // Parse and validate the complete fixed protocol before allocating a process or job.
        try {
            if (args.Length < 10 || args[0] != "--identity" || args[2] != "--receipt" || args[4] != "--limit-ms" || args[6] != "--cleanup-ms" || args[8] != "--") return 2;
            identityPath = args[1]; receiptPath = args[3]; executable = args[9]; firstArgument = 9;
            if (!Int32.TryParse(args[5], out limitMs) || limitMs <= 0 || limitMs > 86400000
                || !Int32.TryParse(args[7], out cleanupMs) || cleanupMs <= 0 || cleanupMs > 60000) return 2;
            ValidateEvidencePath(identityPath); ValidateEvidencePath(receiptPath);
            if (String.Equals(identityPath, receiptPath, StringComparison.OrdinalIgnoreCase)
                || !String.Equals(Path.GetDirectoryName(identityPath), Path.GetDirectoryName(receiptPath), StringComparison.OrdinalIgnoreCase)
                || !Path.IsPathRooted(executable) || !File.Exists(executable)) return 2;
        } catch { return 2; }

        Stopwatch lifetime = Stopwatch.StartNew();
        string jobToken = Guid.NewGuid().ToString(), reason = "setup_failure";
        int helperPid = Process.GetCurrentProcess().Id;
        IntPtr job = IntPtr.Zero, attributeList = IntPtr.Zero, jobArray = IntPtr.Zero, handleArray = IntPtr.Zero;
        IntPtr stdout = IntPtr.Zero, stderr = IntPtr.Zero, stdin = IntPtr.Zero;
        bool attributeListInitialized = false, assigned = false, resumed = false, forced = false, jobTerminated = false, jobClosed = false, jobNonInheritable = false;
        bool rootExitedBeforeCleanup = false, rootHandleExited = false, treeVerified = false, unstartedRootTerminated = false;
        uint effectiveFlags = 0; long? rootCode = null; uint? activeBefore = null, activeAfter = null, total = null;
        long[] membersBefore = null, membersAfter = null;
        string rootCreationFileTime = null, rootCreationUtc = null;
        Dictionary<string, object> jobBeforeResume = null;
        ProcessInformation root = new ProcessInformation(); NativeFailure failure = null;
        Thread control = new Thread(ControlLoop); control.IsBackground = true; control.Start();
        Thread watchdog = new Thread(delegate() { Watchdog(lifetime, limitMs, cleanupMs); }); watchdog.IsBackground = true; watchdog.Start();
        try {
            if (ControlReceived.WaitOne(0)) { reason = ReadControlReason(); return FinishWithoutProcess(receiptPath, helperPid, jobToken, reason); }
            job = CreateJobObjectW(IntPtr.Zero, null);
            if (job == IntPtr.Zero) throw Error("create_job");
            uint jobHandleFlags;
            if (!GetHandleInformation(job, out jobHandleFlags)) throw Error("job_handle_information");
            if ((jobHandleFlags & 1) != 0) throw new NativeFailure("job_handle_inheritable", 0);
            jobNonInheritable = true;
            ExtendedLimits requested = new ExtendedLimits(); requested.Basic.Flags = KillOnJobClose;
            if (!SetInformationJobObject(job, 9, ref requested, (uint)Marshal.SizeOf(typeof(ExtendedLimits)))) throw Error("set_job_limits");
            ExtendedLimits effective;
            if (!QueryLimits(job, 9, out effective, (uint)Marshal.SizeOf(typeof(ExtendedLimits)), IntPtr.Zero)) throw Error("query_job_limits");
            effectiveFlags = effective.Basic.Flags;
            if ((effectiveFlags & KillOnJobClose) == 0 || (effectiveFlags & (Breakaway | SilentBreakaway)) != 0) throw new NativeFailure("job_limit_verification", 0);
            stdout = DuplicateStandard(-11); stderr = DuplicateStandard(-12);
            SecurityAttributes security = new SecurityAttributes(); security.Length = (uint)Marshal.SizeOf(typeof(SecurityAttributes)); security.Inherit = true;
            stdin = CreateFileW("NUL", 0x80000000, 3, ref security, 3, 0x80, IntPtr.Zero);
            if (stdin == InvalidHandle) { stdin = IntPtr.Zero; throw Error("root_stdin"); }
            IntPtr size = IntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero, 2, 0, ref size);
            if (size == IntPtr.Zero) throw Error("attribute_list_size");
            attributeList = Marshal.AllocHGlobal(size);
            if (!InitializeProcThreadAttributeList(attributeList, 2, 0, ref size)) throw Error("attribute_list_initialize");
            attributeListInitialized = true;
            jobArray = Marshal.AllocHGlobal(IntPtr.Size); Marshal.WriteIntPtr(jobArray, job);
            if (!UpdateProcThreadAttribute(attributeList, 0, new IntPtr(0x0002000d), jobArray, new IntPtr(IntPtr.Size), IntPtr.Zero, IntPtr.Zero)) throw Error("attribute_job_list");
            handleArray = Marshal.AllocHGlobal(IntPtr.Size * 3);
            Marshal.WriteIntPtr(handleArray, 0, stdin); Marshal.WriteIntPtr(handleArray, IntPtr.Size, stdout); Marshal.WriteIntPtr(handleArray, IntPtr.Size * 2, stderr);
            if (!UpdateProcThreadAttribute(attributeList, 0, new IntPtr(0x00020002), handleArray, new IntPtr(IntPtr.Size * 3), IntPtr.Zero, IntPtr.Zero)) throw Error("attribute_handle_list");
            StartupInfoEx startup = new StartupInfoEx(); startup.Startup.Size = (uint)Marshal.SizeOf(typeof(StartupInfoEx));
            startup.Startup.Flags = 0x00000100; startup.Startup.Stdin = stdin; startup.Startup.Stdout = stdout; startup.Startup.Stderr = stderr; startup.Attributes = attributeList;
            StringBuilder commandLine = new StringBuilder();
            for (int i = firstArgument; i < args.Length; i++) { if (i != firstArgument) commandLine.Append(' '); commandLine.Append(QuoteArgument(args[i])); }
            if (commandLine.Length >= 32767) throw new NativeFailure("command_line_bound", 0);
            if (ControlReceived.WaitOne(0)) { reason = ReadControlReason(); }
            else {
                // JOB_LIST associates containment during CreateProcess, before any root instruction.
                if (!CreateProcessW(executable, commandLine, IntPtr.Zero, IntPtr.Zero, true, 0x08080404, IntPtr.Zero, null, ref startup, out root)) throw Error("create_root_in_job");
                bool inJob;
                if (!IsProcessInJob(root.Process, job, out inJob)) throw Error("verify_root_membership");
                if (!inJob) throw new NativeFailure("root_outside_job", 0);
                assigned = true;
                FileTime creation, exit, kernel, user;
                if (!GetProcessTimes(root.Process, out creation, out exit, out kernel, out user)) throw Error("root_creation_time");
                long fileTime = unchecked((long)(((ulong)creation.High << 32) | creation.Low));
                rootCreationFileTime = fileTime.ToString(System.Globalization.CultureInfo.InvariantCulture);
                rootCreationUtc = DateTime.FromFileTimeUtc(fileTime).ToString("o");
                BasicAccounting beforeResumeAccounting = Accounting(job);
                long[] beforeResumeMembers = ProcessIds(job);
                bool rootListed = false;
                foreach (long member in beforeResumeMembers) if (member == root.Pid) rootListed = true;
                if (!rootListed || beforeResumeAccounting.ActiveProcesses < 1) throw new NativeFailure("root_missing_before_resume", 0);
                jobBeforeResume = Map("totalProcesses", beforeResumeAccounting.TotalProcesses,
                    "activeProcesses", beforeResumeAccounting.ActiveProcesses, "processIds", beforeResumeMembers);
                WriteExclusive(identityPath, Map("schema", 1, "jobToken", jobToken, "helperPid", helperPid, "rootPid", root.Pid, "rootPpid", helperPid,
                    "rootCreationTimeFileTime", rootCreationFileTime, "rootCreationTimeUtc", rootCreationUtc,
                    "ownerJobAssignedBeforeResume", true, "jobHandleNonInheritable", jobNonInheritable,
                    "effectiveLimitFlags", effectiveFlags, "jobBeforeResume", jobBeforeResume, "createdUtc", DateTime.UtcNow.ToString("o")));
                if (ControlReceived.WaitOne(0)) reason = ReadControlReason();
                else if (lifetime.ElapsedMilliseconds >= limitMs) reason = "timeout";
                else {
                    if (ResumeThread(root.Thread) == 0xffffffff) throw Error("resume_root");
                    resumed = true;
                    for (;;) {
                        if (ControlReceived.WaitOne(0)) { reason = ReadControlReason(); break; }
                        uint wait = WaitForSingleObject(root.Process, 25);
                        if (wait == WaitObject0) { rootCode = ExitCode(root.Process); reason = "completed"; break; }
                        if (wait == WaitFailed) throw Error("wait_root");
                        if (lifetime.ElapsedMilliseconds >= limitMs) { reason = "timeout"; break; }
                    }
                }
            }
        } catch (NativeFailure error) { failure = error; reason = resumed ? "native_failure" : "setup_failure"; }
        catch { failure = new NativeFailure(resumed ? "managed_execution" : "managed_setup", 0); reason = resumed ? "native_failure" : "setup_failure"; }
        finally {
            if (attributeListInitialized) DeleteProcThreadAttributeList(attributeList);
            if (attributeList != IntPtr.Zero) Marshal.FreeHGlobal(attributeList);
            if (jobArray != IntPtr.Zero) Marshal.FreeHGlobal(jobArray);
            if (handleArray != IntPtr.Zero) Marshal.FreeHGlobal(handleArray);
            if (stdin != IntPtr.Zero) CloseHandle(stdin);
            if (stdout != IntPtr.Zero) CloseHandle(stdout);
            if (stderr != IntPtr.Zero) CloseHandle(stderr);
        }

        Stopwatch cleanup = Stopwatch.StartNew();
        try {
            rootExitedBeforeCleanup = RootExited(root.Process);
            if (rootExitedBeforeCleanup && root.Process != IntPtr.Zero) rootCode = ExitCode(root.Process);
        } catch (NativeFailure error) { Remember(ref failure, error); }
        // Even a failed membership verification must dispose of this exact, still-suspended root.
        // This is the retained handle returned by our CreateProcess call, never a PID lookup.
        if (root.Process != IntPtr.Zero && !assigned && !rootExitedBeforeCleanup) {
            forced = true;
            if (!TerminateProcess(root.Process, ForcedExitCode)) Remember(ref failure, Error("terminate_unstarted_owned_root"));
            else unstartedRootTerminated = true;
        }
        if (job != IntPtr.Zero) {
            try { BasicAccounting initial = Accounting(job); activeBefore = initial.ActiveProcesses; total = initial.TotalProcesses; membersBefore = ProcessIds(job); }
            catch (NativeFailure error) { Remember(ref failure, error); }
            catch { Remember(ref failure, new NativeFailure("managed_cleanup_snapshot", 0)); }
            // Keep the private handle open while proving the job drained; close-on-owner-death is an additional fail-safe.
            if (!activeBefore.HasValue || activeBefore.Value != 0) {
                forced = true;
                if (!TerminateJobObject(job, ForcedExitCode)) Remember(ref failure, Error("terminate_owned_job"));
                else jobTerminated = true;
            }
            try {
                for (;;) {
                    BasicAccounting current = Accounting(job); activeAfter = current.ActiveProcesses; total = current.TotalProcesses;
                    membersAfter = ProcessIds(job); rootHandleExited = RootExited(root.Process);
                    if (activeAfter == 0 && membersAfter.Length == 0 && rootHandleExited) { treeVerified = true; break; }
                    if (cleanup.ElapsedMilliseconds >= cleanupMs) throw new NativeFailure("cleanup_deadline", 0);
                    Thread.Sleep(10);
                }
                if (!rootCode.HasValue && root.Process != IntPtr.Zero) rootCode = ExitCode(root.Process);
            } catch (NativeFailure error) { Remember(ref failure, error); }
            catch { Remember(ref failure, new NativeFailure("managed_cleanup", 0)); }
            if (!CloseHandle(job)) Remember(ref failure, Error("close_job")); else jobClosed = true;
        } else { rootHandleExited = root.Process == IntPtr.Zero; treeVerified = rootHandleExited; activeAfter = 0; membersAfter = new long[0]; }
        if (root.Thread != IntPtr.Zero && !CloseHandle(root.Thread)) Remember(ref failure, Error("close_root_thread"));
        if (root.Process != IntPtr.Zero && !CloseHandle(root.Process)) Remember(ref failure, Error("close_root_process"));
        bool passed = failure == null && treeVerified;
        Dictionary<string, object> receipt = Map("schema", 1, "status", passed ? "PASS" : "BLOCKED", "reason", reason,
            "jobToken", jobToken, "helperPid", helperPid, "rootPid", root.Pid == 0 ? null : (object)root.Pid, "rootPpid", helperPid,
            "rootCreationTimeFileTime", rootCreationFileTime, "rootCreationTimeUtc", rootCreationUtc,
            "ownerJobAssignedBeforeResume", assigned, "jobHandleNonInheritable", jobNonInheritable, "effectiveLimitFlags", effectiveFlags, "resumeSucceeded", resumed,
            "jobBeforeResume", jobBeforeResume,
            "rootExitCode", rootCode.HasValue ? (object)rootCode.Value : null, "rootSignal", null,
            "durationMs", lifetime.ElapsedMilliseconds, "cleanupDurationMs", cleanup.ElapsedMilliseconds,
            "nativeFailure", failure == null ? null : Map("stage", failure.Stage, "win32Code", failure.Code),
            "cleanup", Map("status", passed ? "PASS" : "BLOCKED", "method", "windows-private-job", "rootExitedBeforeCleanup", rootExitedBeforeCleanup,
                "forcedTermination", forced, "jobTerminated", jobTerminated, "jobHandleClosed", jobClosed, "unstartedRootTerminated", unstartedRootTerminated,
                "activeProcessesBeforeCleanup", activeBefore.HasValue ? (object)activeBefore.Value : null,
                "activeProcessesAfterCleanup", activeAfter.HasValue ? (object)activeAfter.Value : null,
                "activeProcessIdsBeforeCleanup", membersBefore, "activeProcessIdsAfterCleanup", membersAfter,
                "totalProcesses", total.HasValue ? (object)total.Value : null, "rootHandleExited", rootHandleExited, "processTreeVerified", treeVerified));
        try { WriteExclusive(receiptPath, receipt); }
        catch { HelperFinished.Set(); return 3; }
        HelperFinished.Set();
        return passed ? 0 : 4;
    }

    private static int FinishWithoutProcess(string receiptPath, int helperPid, string token, string reason) {
        try {
            WriteExclusive(receiptPath, Map("schema", 1, "status", "PASS", "reason", reason, "jobToken", token, "helperPid", helperPid,
                "rootPid", null, "rootPpid", helperPid, "rootExitCode", null, "rootSignal", null, "resumeSucceeded", false,
                "ownerJobAssignedBeforeResume", false, "effectiveLimitFlags", 0, "jobBeforeResume", null, "nativeFailure", null,
                "cleanup", Map("status", "PASS", "method", "windows-private-job", "processTreeVerified", true, "rootHandleExited", true,
                    "forcedTermination", false, "activeProcessesBeforeCleanup", 0, "activeProcessesAfterCleanup", 0,
                    "activeProcessIdsBeforeCleanup", new long[0], "activeProcessIdsAfterCleanup", new long[0], "totalProcesses", 0)));
            HelperFinished.Set(); return 0;
        } catch { HelperFinished.Set(); return 3; }
    }
}
