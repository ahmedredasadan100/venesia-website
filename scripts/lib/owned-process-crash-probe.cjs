// Optional diagnostic port of runOwnedVerificationChild. Never launches work,
// changes limits, intercepts errors, or handles cancellation. Native Job evidence
// remains the authority for process identity/exit, including fatal V8 exits.
/* eslint-disable @typescript-eslint/no-require-imports -- This synchronous Node --require preload is intentionally CommonJS. */
'use strict';
if (require('node:worker_threads').isMainThread) {
  const fs = require('node:fs');
  const path = require('node:path');
  const v8 = require('node:v8');
  let fd, timer, failed = false, samples = 0;
  try {
    const configPath = process.env.VENESIA_QA_CRASH_CONFIG;
    if (!configPath || !path.isAbsolute(configPath)) throw new Error();
    const bytes = fs.readFileSync(configPath);
    if (bytes.length > 1048576) throw new Error();
    const config = JSON.parse(bytes);
    if (config.schema !== 1 || !/^[a-zA-Z0-9:_-]{1,120}$/.test(config.gateId)
      || !Array.isArray(config.commands) || config.commands.length > 256
      || !path.isAbsolute(config.directory) || fs.realpathSync(config.directory) !== config.directory) throw new Error();
    let entry;
    try { entry = process.argv[1] ? fs.realpathSync(path.resolve(process.argv[1])) : undefined; } catch { /* unmapped entry stays unknown */ }
    const same = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
    const command = config.commands.find(row => typeof row.entry === 'string' && entry && same(row.entry, entry));
    const commandId = command && /^[a-zA-Z0-9:_.\/-]{1,160}$/.test(command.id) ? command.id : null;
    const entryKind = commandId ? 'allowlisted-entry' : process.execArgv.some(value => value === '-e' || value === '--eval') ? 'node-eval' : 'unmapped-entry';
    // Never persist argv, executable/source paths, environment, messages, stacks,
    // error objects, application state, heap contents, or automatic fatal reports.
    const probeId = require('node:crypto').randomUUID();
    fd = fs.openSync(path.join(config.directory, process.pid + '-' + probeId + '.node.jsonl'), 'wx', 0o600);
    const sample = (kind, exitCode = null) => {
      if (failed || samples >= 4096) return;
      try {
        samples++;
        const memory = process.memoryUsage(), heap = v8.getHeapStatistics(), usage = process.resourceUsage();
        fs.writeSync(fd, JSON.stringify({ schema: 1, kind, gateId: config.gateId, probeId,
          pid: process.pid, ppid: process.ppid, utc: new Date().toISOString(), monotonicMs: performance.now(),
          commandId, entryKind, sequence: samples, node: process.version, v8: process.versions.v8,
          memory: { rss: memory.rss, heapTotal: memory.heapTotal, heapUsed: memory.heapUsed,
            external: memory.external, arrayBuffers: memory.arrayBuffers },
          heap: { heapSizeLimit: heap.heap_size_limit, usedHeapSize: heap.used_heap_size,
            totalAvailableSize: heap.total_available_size, mallocedMemory: heap.malloced_memory,
            peakMallocedMemory: heap.peak_malloced_memory, externalMemory: heap.external_memory },
          usage: { maxRssKiB: usage.maxRSS, userCpuMicros: usage.userCPUTime, systemCpuMicros: usage.systemCPUTime },
          exitCode, sampleLimit: 4096, mainIsolateOnly: true }) + '\n');
      } catch { failed = true; }
    };
    sample('node_start');
    timer = setInterval(() => { if (samples < 4095) sample('node_memory'); }, 1000);
    timer.unref();
    process.once('exit', code => {
      clearInterval(timer);
      sample('node_exit', code);
      try { fs.closeSync(fd); } catch { /* missing terminal evidence is partial */ }
    });
  } catch {
    if (timer) clearInterval(timer);
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* no application failure substitution */ } }
    // A missing start record is explicitly incomplete in the owning qualifier.
    // No application exception is swallowed: this catch covers this probe only.
  }
}
