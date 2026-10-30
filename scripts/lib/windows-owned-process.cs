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
    private static int checkpointState;

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
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint access, [MarshalAs(UnmanagedType.Bool)] bool inherit, uint pid);

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
                    if (message != null && message.Count == 1 && message.TryGetValue("command", out command) && command is string && (string)command == "checkpoint") {
                        if (Interlocked.CompareExchange(ref checkpointState, 1, 0) != 0) { RequestControl("invalid_control"); return; }
                        line.Length = 0; continue;
                    }
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
    private static long[] ProcessIds(IntPtr job, bool requireComplete = false) {
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
                if (requireComplete && unchecked((uint)Marshal.ReadInt32(memory, 0)) != count) {
                    uint assignedCount = unchecked((uint)Marshal.ReadInt32(memory, 0));
                    capacity = Math.Max(capacity * 2, checked((int)assignedCount));
                    if (capacity > 4096) throw new NativeFailure("job_member_read_bound", 0);
                    continue;
                }
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

    private sealed class ObservedProcess {
        public uint Pid;
        public string Creation;
        public IntPtr Handle;
        public bool Signaled;
        public long? Code;
    }
    private static string CreationTime(IntPtr process, string stage) {
        FileTime creation, exit, kernel, user;
        if (!GetProcessTimes(process, out creation, out exit, out kernel, out user)) throw Error(stage);
        long value = unchecked((long)(((ulong)creation.High << 32) | creation.Low));
        if (value <= 0) throw new NativeFailure(stage, 0);
        return value.ToString(System.Globalization.CultureInfo.InvariantCulture);
    }
    private static ObservedProcess OpenObserved(uint pid, string expectedCreation, List<ObservedProcess> opened) {
        // Observation never obtains a job handle, termination rights, or inherited handles.
        IntPtr handle = OpenProcess(0x00101000, false, pid);
        if (handle == IntPtr.Zero) throw Error("observation_open_process");
        ObservedProcess observed = new ObservedProcess { Pid = pid, Handle = handle }; opened.Add(observed);
        uint flags;
        if (!GetHandleInformation(handle, out flags)) throw Error("observation_handle_flags");
        if ((flags & 1) != 0) throw new NativeFailure("observation_inherited_handle", 0);
        observed.Creation = CreationTime(handle, "observation_creation_time");
        if (expectedCreation != null && observed.Creation != expectedCreation) throw new NativeFailure("observation_identity_mismatch", 0);
        if (RootExited(handle)) throw new NativeFailure("observation_not_live", 0);
        return observed;
    }
    private static bool SameIds(long[] first, long[] second) {
        if (first.Length != second.Length) return false;
        for (int i = 0; i < first.Length; i++) if (first[i] != second[i]) return false;
        return true;
    }
    private static long[] CompleteIds(IntPtr job, uint active) {
        long[] ids = ProcessIds(job, true); Array.Sort(ids);
        if (ids.Length != active || ids.Length == 0) throw new NativeFailure("checkpoint_incomplete_membership", 0);
        for (int i = 0; i < ids.Length; i++)
            if (ids[i] <= 0 || ids[i] > UInt32.MaxValue || (i > 0 && ids[i] == ids[i - 1])) throw new NativeFailure("checkpoint_member_id", 0);
        return ids;
    }
    private static double WallElapsed(DateTime started) { return (DateTime.UtcNow - started).TotalMilliseconds; }
    private static void CheckBound(Stopwatch elapsed, DateTime started, int deadline, string stage) {
        double wall = WallElapsed(started);
        if (wall < 0 || wall > deadline || elapsed.ElapsedMilliseconds > deadline) throw new NativeFailure(stage, 0);
    }
    private static void WriteClosureCheckpoint(string path, IntPtr job, ProcessInformation root, string rootCreation, string token, int helperPid) {
        Stopwatch elapsed = Stopwatch.StartNew(); DateTime started = DateTime.UtcNow;
        ValidateEvidencePath(path);
        for (;;) {
            List<ObservedProcess> opened = new List<ObservedProcess>(); NativeFailure failure = null;
            Dictionary<string, object> checkpoint = null;
            try {
                CheckBound(elapsed, started, 1000, "checkpoint_deadline");
                uint flags; ExtendedLimits limits;
                if (!GetHandleInformation(job, out flags)) throw Error("checkpoint_job_handle_flags");
                if ((flags & 1) != 0) throw new NativeFailure("checkpoint_job_handle_inheritable", 0);
                if (!QueryLimits(job, 9, out limits, (uint)Marshal.SizeOf(typeof(ExtendedLimits)), IntPtr.Zero)) throw Error("checkpoint_job_limits");
                if (limits.Basic.Flags != KillOnJobClose) throw new NativeFailure("checkpoint_job_policy", 0);
                BasicAccounting first = Accounting(job); long[] ids = CompleteIds(job, first.ActiveProcesses);
                bool rootListed = false; List<object> members = new List<object>();
                foreach (long pid in ids) {
                    CheckBound(elapsed, started, 1000, "checkpoint_deadline");
                    if (pid == helperPid) throw new NativeFailure("checkpoint_helper_in_job", 0);
                    ObservedProcess member = OpenObserved((uint)pid, pid == root.Pid ? rootCreation : null, opened);
                    bool inJob;
                    if (!IsProcessInJob(member.Handle, job, out inJob)) throw Error("checkpoint_exact_job_membership");
                    if (!inJob) throw new NativeFailure("checkpoint_member_outside_job", 0);
                    if (pid == root.Pid) rootListed = true;
                    members.Add(Map("pid", pid, "creationTimeFileTime", member.Creation));
                }
                if (!rootListed) throw new NativeFailure("checkpoint_root_missing", 0);
                BasicAccounting second = Accounting(job); long[] secondIds = CompleteIds(job, second.ActiveProcesses);
                if (first.TotalProcesses == second.TotalProcesses && SameIds(ids, secondIds)) {
                    foreach (ObservedProcess member in opened) if (RootExited(member.Handle)) throw new NativeFailure("checkpoint_member_exited", 0);
                    CheckBound(elapsed, started, 1000, "checkpoint_deadline");
                    checkpoint = Map("schema", 1, "kind", "windows-job-pre-close", "jobToken", token,
                        "helperPid", helperPid, "helperCreationTimeFileTime", CreationTime(GetCurrentProcess(), "checkpoint_helper_creation"),
                        "rootPid", root.Pid, "rootCreationTimeFileTime", rootCreation,
                        "ownerJobAssignedBeforeResume", true, "jobHandleNonInheritable", true, "effectiveLimitFlags", limits.Basic.Flags,
                        "privateUnnamedJob", true, "jobHandleOwner", "helper-only", "jobHandlesExported", 0, "processHandlesOnly", true,
                        "activeProcesses", second.ActiveProcesses, "processIds", ids, "members", members,
                        "membershipCompleteAtCapture", true, "capturedUtc", DateTime.UtcNow.ToString("o"));
                }
            } catch (NativeFailure error) { failure = error; }
            finally {
                foreach (ObservedProcess member in opened)
                    if (!CloseHandle(member.Handle) && failure == null) failure = Error("checkpoint_close_process");
            }
            if (failure != null) throw failure;
            CheckBound(elapsed, started, 1000, "checkpoint_deadline");
            if (checkpoint != null) { WriteExclusive(path, checkpoint); return; }
            Thread.Sleep(1);
        }
    }
    private static void ValidateExistingEvidence(string file) {
        if (!Path.IsPathRooted(file) || !String.Equals(Path.GetFullPath(file), file, StringComparison.OrdinalIgnoreCase)
            || !File.Exists(file) || (File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0) throw new NativeFailure("checkpoint_path", 0);
        for (DirectoryInfo parent = new DirectoryInfo(Path.GetDirectoryName(file)); parent != null; parent = parent.Parent)
            if ((parent.Attributes & FileAttributes.ReparsePoint) != 0) throw new NativeFailure("checkpoint_reparse_parent", 0);
    }
    private static object Required(Dictionary<string, object> map, string key) {
        object value; if (map == null || !map.TryGetValue(key, out value)) throw new NativeFailure("checkpoint_schema", 0); return value;
    }
    private static long Number(Dictionary<string, object> map, string key, long minimum, long maximum) {
        object value = Required(map, key);
        if (!(value is int) && !(value is long)) throw new NativeFailure("checkpoint_number", 0);
        long number = Convert.ToInt64(value, System.Globalization.CultureInfo.InvariantCulture);
        if (number < minimum || number > maximum) throw new NativeFailure("checkpoint_number_bound", 0); return number;
    }
    private static string Text(Dictionary<string, object> map, string key, string exact) {
        string value = Required(map, key) as string;
        if (value == null || (exact != null && value != exact)) throw new NativeFailure("checkpoint_text", 0); return value;
    }
    private static void True(Dictionary<string, object> map, string key) {
        object value = Required(map, key); if (!(value is bool) || !(bool)value) throw new NativeFailure("checkpoint_boolean", 0);
    }
    private static string FileTimeText(Dictionary<string, object> map, string key) {
        string value = Text(map, key, null); long time;
        if (!Int64.TryParse(value, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out time) || time <= 0
            || time.ToString(System.Globalization.CultureInfo.InvariantCulture) != value) throw new NativeFailure("checkpoint_creation_time", 0);
        try { DateTime.FromFileTimeUtc(time); } catch { throw new NativeFailure("checkpoint_creation_time", 0); }
        return value;
    }
    private static int ObserveClose(string[] args) {
        if (args.Length != 4) return 2;
        int deadline;
        if (!Int32.TryParse(args[3], out deadline) || deadline <= 0 || deadline > 6000) return 2;
        string checkpointPath = args[1], observationPath = args[2];
        try {
            ValidateEvidencePath(observationPath);
            if (!checkpointPath.EndsWith(".closure.json", StringComparison.Ordinal)
                || !String.Equals(Path.GetDirectoryName(checkpointPath), Path.GetDirectoryName(observationPath), StringComparison.OrdinalIgnoreCase)
                || String.Equals(checkpointPath, observationPath, StringComparison.OrdinalIgnoreCase)) return 2;
        } catch { return 2; }
        Stopwatch elapsed = Stopwatch.StartNew(); DateTime started = DateTime.UtcNow;
        string token = null, helperCreation = null, rootCreation = null; long helperPid = 0, rootPid = 0;
        bool ready = false, allClosed = true; int closedCount = 0;
        ObservedProcess helper = null; List<ObservedProcess> members = new List<ObservedProcess>();
        List<ObservedProcess> opened = new List<ObservedProcess>();
        NativeFailure failure = null;
        try {
            ValidateExistingEvidence(checkpointPath);
            Dictionary<string, object> checkpoint;
            using (FileStream input = new FileStream(checkpointPath, FileMode.Open, FileAccess.Read, FileShare.Read)) {
                if (input.Length <= 0 || input.Length > 1048576) throw new NativeFailure("checkpoint_byte_bound", 0);
                using (StreamReader reader = new StreamReader(input, new UTF8Encoding(false, true), false)) {
                    JavaScriptSerializer serializer = new JavaScriptSerializer(); serializer.MaxJsonLength = 1048576; serializer.RecursionLimit = 16;
                    checkpoint = serializer.DeserializeObject(reader.ReadToEnd()) as Dictionary<string, object>;
                }
            }
            if (checkpoint == null || checkpoint.Count != 19) throw new NativeFailure("checkpoint_schema", 0);
            Number(checkpoint, "schema", 1, 1); Text(checkpoint, "kind", "windows-job-pre-close");
            token = Text(checkpoint, "jobToken", null); Guid parsedToken;
            if (!Guid.TryParseExact(token, "D", out parsedToken)) throw new NativeFailure("checkpoint_job_token", 0);
            helperPid = Number(checkpoint, "helperPid", 1, UInt32.MaxValue); rootPid = Number(checkpoint, "rootPid", 1, UInt32.MaxValue);
            if (helperPid == rootPid || helperPid == Process.GetCurrentProcess().Id || rootPid == Process.GetCurrentProcess().Id) throw new NativeFailure("checkpoint_pid_identity", 0);
            helperCreation = FileTimeText(checkpoint, "helperCreationTimeFileTime"); rootCreation = FileTimeText(checkpoint, "rootCreationTimeFileTime");
            True(checkpoint, "ownerJobAssignedBeforeResume"); True(checkpoint, "jobHandleNonInheritable"); Number(checkpoint, "effectiveLimitFlags", KillOnJobClose, KillOnJobClose);
            True(checkpoint, "privateUnnamedJob"); Text(checkpoint, "jobHandleOwner", "helper-only"); Number(checkpoint, "jobHandlesExported", 0, 0);
            True(checkpoint, "processHandlesOnly"); True(checkpoint, "membershipCompleteAtCapture");
            DateTime captured;
            if (!DateTime.TryParseExact(Text(checkpoint, "capturedUtc", null), "o", System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out captured) || captured.Kind != DateTimeKind.Utc || captured > started) throw new NativeFailure("checkpoint_capture_time", 0);
            long active = Number(checkpoint, "activeProcesses", 1, 4096);
            object[] ids = Required(checkpoint, "processIds") as object[], records = Required(checkpoint, "members") as object[];
            if (ids == null || records == null || ids.Length != active || records.Length != active) throw new NativeFailure("checkpoint_member_count", 0);
            List<uint> memberPids = new List<uint>(); List<string> creations = new List<string>(); bool rootListed = false;
            for (int i = 0; i < records.Length; i++) {
                Dictionary<string, object> member = records[i] as Dictionary<string, object>;
                if (member == null || member.Count != 2 || (!(ids[i] is int) && !(ids[i] is long))) throw new NativeFailure("checkpoint_member_schema", 0);
                long pid = Number(member, "pid", 1, UInt32.MaxValue);
                if (Convert.ToInt64(ids[i], System.Globalization.CultureInfo.InvariantCulture) != pid || pid == helperPid
                    || (i > 0 && pid <= memberPids[i - 1])) throw new NativeFailure("checkpoint_member_identity", 0);
                string creation = FileTimeText(member, "creationTimeFileTime");
                if (pid == rootPid) { if (creation != rootCreation) throw new NativeFailure("checkpoint_root_identity", 0); rootListed = true; }
                memberPids.Add((uint)pid); creations.Add(creation);
            }
            if (!rootListed) throw new NativeFailure("checkpoint_root_missing", 0);
            CheckBound(elapsed, started, deadline, "observation_deadline");
            helper = OpenObserved((uint)helperPid, helperCreation, opened);
            for (int i = 0; i < memberPids.Count; i++) {
                CheckBound(elapsed, started, deadline, "observation_deadline");
                members.Add(OpenObserved(memberPids[i], creations[i], opened));
            }
            if (RootExited(helper.Handle)) throw new NativeFailure("observation_helper_not_live", 0);
            foreach (ObservedProcess member in members) if (RootExited(member.Handle)) throw new NativeFailure("observation_member_not_live", 0);
            CheckBound(elapsed, started, deadline, "observation_deadline");
            Console.Out.WriteLine(new JavaScriptSerializer().Serialize(Map("phase", "READY", "jobToken", token, "helperPid", helperPid,
                "memberPids", memberPids, "processHandlesOnly", true, "allHandlesLive", true))); Console.Out.Flush(); ready = true;
            for (;;) {
                CheckBound(elapsed, started, deadline, "observation_deadline");
                helper.Signaled = RootExited(helper.Handle); bool allMembers = true;
                foreach (ObservedProcess member in members) { member.Signaled = RootExited(member.Handle); if (!member.Signaled) allMembers = false; }
                // A resumed machine cannot turn an expired observation into a successful certificate.
                CheckBound(elapsed, started, deadline, "observation_deadline");
                if (helper.Signaled && allMembers) break;
                Thread.Sleep(10);
            }
            helper.Code = ExitCode(helper.Handle); foreach (ObservedProcess member in members) member.Code = ExitCode(member.Handle);
            CheckBound(elapsed, started, deadline, "observation_deadline");
        } catch (NativeFailure error) { failure = error; }
        catch { failure = new NativeFailure("observation_managed", 0); }
        finally {
            foreach (ObservedProcess member in opened) {
                if (CloseHandle(member.Handle)) closedCount++; else { allClosed = false; Remember(ref failure, Error("observation_close_member")); }
            }
        }
        DateTime ended = DateTime.UtcNow; double wallElapsed = (ended - started).TotalMilliseconds;
        if (failure == null && (wallElapsed < 0 || wallElapsed > deadline || elapsed.ElapsedMilliseconds > deadline)) failure = new NativeFailure("observation_deadline", 0);
        List<object> terminalMembers = new List<object>(); bool allSignaled = members.Count != 0;
        foreach (ObservedProcess member in members) { if (!member.Signaled) allSignaled = false; terminalMembers.Add(Map("pid", member.Pid, "creationTimeFileTime", member.Creation,
            "signaled", member.Signaled, "exitCode", member.Code.HasValue ? (object)member.Code.Value : null)); }
        bool passed = failure == null && ready && helper != null && helper.Signaled && allSignaled && allClosed && opened.Count == closedCount;
        try {
            WriteExclusive(observationPath, Map("schema", 1, "kind", "windows-job-last-handle-close", "status", passed ? "PASS" : "BLOCKED",
                "jobToken", token, "helperPid", helperPid, "helperCreationTimeFileTime", helperCreation, "rootPid", rootPid, "rootCreationTimeFileTime", rootCreation,
                "readyBeforeClosure", ready, "processHandlesOnly", true, "processAccessMask", 0x00101000, "processHandlesInheritable", false, "jobHandlesRetained", 0,
                "observation", Map("deadlineMs", deadline, "elapsedMs", elapsed.ElapsedMilliseconds, "startedUtc", started.ToString("o"), "endedUtc", ended.ToString("o"),
                    "wallElapsedMs", wallElapsed, "helperSignaled", helper != null && helper.Signaled, "allMembersSignaled", allSignaled, "members", terminalMembers,
                    "helperExitCode", helper != null && helper.Code.HasValue ? (object)helper.Code.Value : null),
                "nativeFailure", failure == null ? null : Map("stage", failure.Stage, "win32Code", failure.Code),
                "allObservationHandlesClosed", allClosed && opened.Count == closedCount, "observationHandleCount", opened.Count, "closedObservationHandleCount", closedCount,
                "jobQueriedAfterClosure", false));
        } catch { return 3; }
        return passed ? 0 : 4;
    }
    private static int ProbeBreakaway(string[] args) {
        if (args.Length != 3 || !Path.IsPathRooted(args[1]) || !File.Exists(args[1])) return 2;
        string readyPath = args[2], releasePath = readyPath + ".release.json";
        try { ValidateEvidencePath(readyPath); ValidateEvidencePath(releasePath); } catch { return 2; }
        NativeFailure failure = null; ProcessInformation root = new ProcessInformation();
        bool created = false, terminated = false, signaled = false, closed = true, assigned = false, jobClosed = false, guardZero = false, readyWritten = false, released = false, guardTerminated = false;
        bool jobNonInheritable = false, attributeInitialized = false;
        IntPtr guard = IntPtr.Zero, attributes = IntPtr.Zero, jobArray = IntPtr.Zero;
        int nativeCode = 0, probePid = Process.GetCurrentProcess().Id; uint effectiveFlags = 0;
        string challenge = Guid.NewGuid().ToString(), candidateCreation = null, probeCreation = null;
        uint? activeAfter = null; long[] membersAfter = null;
        Stopwatch releaseElapsed = null; DateTime releaseStarted = DateTime.MinValue, releaseEnded = DateTime.MinValue;
        try {
            bool currentInJob;
            if (!IsProcessInJob(GetCurrentProcess(), IntPtr.Zero, out currentInJob)) throw Error("breakaway_current_membership");
            if (!currentInJob) throw new NativeFailure("breakaway_requires_owned_job", 0);
            probeCreation = CreationTime(GetCurrentProcess(), "breakaway_probe_creation");
            // This separate guard disposes of the suspended candidate if this probe dies.
            // It does not establish membership in the outer owner's exact private job.
            guard = CreateJobObjectW(IntPtr.Zero, null);
            if (guard == IntPtr.Zero) throw Error("breakaway_create_guard");
            uint handleFlags;
            if (!GetHandleInformation(guard, out handleFlags)) throw Error("breakaway_guard_handle_flags");
            if ((handleFlags & 1) != 0) throw new NativeFailure("breakaway_guard_handle_inheritable", 0);
            jobNonInheritable = true;
            ExtendedLimits requested = new ExtendedLimits(); requested.Basic.Flags = KillOnJobClose;
            if (!SetInformationJobObject(guard, 9, ref requested, (uint)Marshal.SizeOf(typeof(ExtendedLimits)))) throw Error("breakaway_set_guard_limits");
            ExtendedLimits effective;
            if (!QueryLimits(guard, 9, out effective, (uint)Marshal.SizeOf(typeof(ExtendedLimits)), IntPtr.Zero)) throw Error("breakaway_query_guard_limits");
            effectiveFlags = effective.Basic.Flags;
            if (effectiveFlags != KillOnJobClose) throw new NativeFailure("breakaway_guard_policy", 0);
            IntPtr size = IntPtr.Zero; InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref size);
            if (size == IntPtr.Zero) throw Error("breakaway_attribute_size");
            attributes = Marshal.AllocHGlobal(size);
            if (!InitializeProcThreadAttributeList(attributes, 1, 0, ref size)) throw Error("breakaway_attribute_initialize");
            attributeInitialized = true;
            jobArray = Marshal.AllocHGlobal(IntPtr.Size); Marshal.WriteIntPtr(jobArray, guard);
            if (!UpdateProcThreadAttribute(attributes, 0, new IntPtr(0x0002000d), jobArray, new IntPtr(IntPtr.Size), IntPtr.Zero, IntPtr.Zero)) throw Error("breakaway_attribute_guard");
            StartupInfoEx startup = new StartupInfoEx(); startup.Startup.Size = (uint)Marshal.SizeOf(typeof(StartupInfoEx)); startup.Attributes = attributes;
            // Atomic guard membership, BREAKAWAY, and SUSPENDED; the candidate is never resumed.
            created = CreateProcessW(args[1], new StringBuilder(QuoteArgument(args[1]) + " -e \"process.exit(0)\""), IntPtr.Zero, IntPtr.Zero,
                false, 0x09080004, IntPtr.Zero, null, ref startup, out root);
            if (!created) { nativeCode = Marshal.GetLastWin32Error(); if (nativeCode != 5) throw new NativeFailure("breakaway_unexpected_error", nativeCode); }
            else {
                bool inGuard;
                if (!IsProcessInJob(root.Process, guard, out inGuard)) throw Error("breakaway_verify_guard_membership");
                if (!inGuard) throw new NativeFailure("breakaway_candidate_outside_guard", 0);
                assigned = true; candidateCreation = CreationTime(root.Process, "breakaway_candidate_creation");
                if (RootExited(root.Process)) throw new NativeFailure("breakaway_candidate_not_live", 0);
            }
            releaseElapsed = Stopwatch.StartNew(); releaseStarted = DateTime.UtcNow;
            WriteExclusive(readyPath, Map("schema", 1, "kind", "windows-job-breakaway-ready", "challenge", challenge,
                "createdSuspended", created, "win32Code", nativeCode, "candidatePid", created ? (object)root.Pid : null,
                "candidateCreationTimeFileTime", candidateCreation, "probePid", probePid, "probeCreationTimeFileTime", probeCreation, "rootResumed", false,
                "guard", Map("privateUnnamedJob", true, "jobHandleNonInheritable", jobNonInheritable, "effectiveLimitFlags", effectiveFlags,
                    "ownerAssignedBeforeResume", assigned, "jobHandlesExported", 0)));
            readyWritten = true;
            CheckBound(releaseElapsed, releaseStarted, 2500, "breakaway_release_deadline");
            {
                for (;;) {
                    CheckBound(releaseElapsed, releaseStarted, 2500, "breakaway_release_deadline");
                    if (File.Exists(releasePath)) {
                        ValidateExistingEvidence(releasePath);
                        Dictionary<string, object> release;
                        using (FileStream input = new FileStream(releasePath, FileMode.Open, FileAccess.Read, FileShare.Read)) {
                            if (input.Length <= 0 || input.Length > 4096) throw new NativeFailure("breakaway_release_byte_bound", 0);
                            using (StreamReader reader = new StreamReader(input, new UTF8Encoding(false, true), false))
                                release = new JavaScriptSerializer().DeserializeObject(reader.ReadToEnd()) as Dictionary<string, object>;
                        }
                        if (release == null || release.Count != 2) throw new NativeFailure("breakaway_release_schema", 0);
                        Number(release, "schema", 1, 1); Text(release, "challenge", challenge);
                        CheckBound(releaseElapsed, releaseStarted, 2500, "breakaway_release_deadline");
                        released = true; break;
                    }
                    Thread.Sleep(10);
                }
            }
            releaseEnded = DateTime.UtcNow;
        } catch (NativeFailure error) { failure = error; }
        catch { failure = new NativeFailure("breakaway_managed", 0); }
        finally {
            if (releaseStarted != DateTime.MinValue && releaseEnded == DateTime.MinValue) releaseEnded = DateTime.UtcNow;
            if (releaseElapsed != null) releaseElapsed.Stop();
            if (attributeInitialized) DeleteProcThreadAttributeList(attributes);
            if (attributes != IntPtr.Zero) Marshal.FreeHGlobal(attributes);
            if (jobArray != IntPtr.Zero) Marshal.FreeHGlobal(jobArray);
            // Only our guard and retained CreateProcess handles may be used for disposal.
            if (created && !assigned) {
                try {
                    if (!RootExited(root.Process) && !TerminateProcess(root.Process, ForcedExitCode)) Remember(ref failure, Error("breakaway_terminate_unverified_suspended_root"));
                } catch (NativeFailure error) { Remember(ref failure, error); }
                catch { Remember(ref failure, new NativeFailure("breakaway_unverified_root_cleanup", 0)); }
            }
            if (guard != IntPtr.Zero) {
                if (!TerminateJobObject(guard, ForcedExitCode)) Remember(ref failure, Error("breakaway_terminate_guard")); else { guardTerminated = true; terminated = created; }
                Stopwatch cleanup = Stopwatch.StartNew(); DateTime cleanupStarted = DateTime.UtcNow;
                try {
                    for (;;) {
                        CheckBound(cleanup, cleanupStarted, 1000, "breakaway_cleanup_deadline");
                        BasicAccounting accounting = Accounting(guard); activeAfter = accounting.ActiveProcesses; membersAfter = ProcessIds(guard, true);
                        bool candidateExited = RootExited(root.Process); signaled = created && candidateExited;
                        CheckBound(cleanup, cleanupStarted, 1000, "breakaway_cleanup_deadline");
                        if (activeAfter == 0 && membersAfter.Length == 0 && candidateExited) { guardZero = true; break; }
                        Thread.Sleep(10);
                    }
                } catch (NativeFailure error) { Remember(ref failure, error); }
                catch { Remember(ref failure, new NativeFailure("breakaway_managed_cleanup", 0)); }
                if (!CloseHandle(guard)) { closed = false; Remember(ref failure, Error("breakaway_close_guard")); } else jobClosed = true;
            }
            if (root.Thread != IntPtr.Zero && !CloseHandle(root.Thread)) { closed = false; Remember(ref failure, Error("breakaway_close_thread")); }
            if (root.Process != IntPtr.Zero && !CloseHandle(root.Process)) { closed = false; Remember(ref failure, Error("breakaway_close_process")); }
        }
        bool completed = failure == null && readyWritten && released && closed && jobClosed && guardZero && (!created ? nativeCode == 5 : assigned);
        Console.Out.WriteLine(new JavaScriptSerializer().Serialize(Map("schema", 1, "kind", "windows-job-breakaway-negative", "status", completed ? (created ? "OBSERVED_SUSPENDED" : "PASS") : "BLOCKED",
            "expectedWin32Code", 5, "win32Code", nativeCode, "createdSuspended", created, "rootResumed", false,
            "challenge", challenge, "candidatePid", created ? (object)root.Pid : null, "candidateCreationTimeFileTime", candidateCreation,
            "probePid", probePid, "probeCreationTimeFileTime", probeCreation, "releaseObserved", released, "readyWritten", readyWritten,
            "ancestorContainmentQualified", false,
            "releaseWait", Map("deadlineMs", 2500, "elapsedMs", releaseElapsed == null ? 0 : releaseElapsed.ElapsedMilliseconds,
                "startedUtc", releaseStarted == DateTime.MinValue ? null : releaseStarted.ToString("o"), "endedUtc", releaseEnded == DateTime.MinValue ? null : releaseEnded.ToString("o"),
                "wallElapsedMs", releaseStarted == DateTime.MinValue ? 0 : (releaseEnded - releaseStarted).TotalMilliseconds),
            "guard", Map("privateUnnamedJob", true, "jobHandleNonInheritable", jobNonInheritable, "effectiveLimitFlags", effectiveFlags,
                "ownerAssignedBeforeResume", assigned, "jobHandlesExported", 0, "jobTerminated", guardTerminated, "jobHandleClosed", jobClosed,
                "activeProcessesAfterCleanup", activeAfter.HasValue ? (object)activeAfter.Value : null, "activeProcessIdsAfterCleanup", membersAfter, "processTreeVerified", guardZero),
            "unexpectedRootTerminated", terminated, "unexpectedRootSignaled", signaled, "allProbeHandlesClosed", closed,
            "nativeFailure", failure == null ? null : Map("stage", failure.Stage, "win32Code", failure.Code)))); Console.Out.Flush();
        return completed ? 0 : 4;
    }

    public static int Main(string[] args) {
        if (args.Length > 0 && args[0] == "--observe-close") return ObserveClose(args);
        if (args.Length > 0 && args[0] == "--probe-breakaway") return ProbeBreakaway(args);
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
                        if (Interlocked.CompareExchange(ref checkpointState, 2, 1) == 1)
                            WriteClosureCheckpoint(identityPath + ".closure.json", job, root, rootCreationFileTime, jobToken, helperPid);
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
