// Research fixture only: operates on fresh temporary repositories, never the host task store.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const kit = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(kit, 'dist/cli/index.js');
const { initProject } = await import(join(kit, 'dist/core/init/index.js'));
const { renderTaskMarkdown, loadTaskFile, readTaskBaseline, captureTaskEvidenceSubject } = await import(join(kit, 'dist/core/tasks/index.js'));
const { evaluateTaskCompletionGate } = await import(join(kit, 'dist/core/tasks/gate.js'));
const { readTaskEvidence, compareTaskEvidenceFreshness } = await import(join(kit, 'dist/core/tasks/evidence.js'));
const { buildTaskProvenance } = await import(join(kit, 'dist/core/tasks/provenance.js'));
const { resolveCanonicalRunBinding } = await import(join(kit, 'dist/core/work/session.js'));
const taskPath = '.tasks/0001-handoff.md';
const localPaths = ['.agentic/agents', '.agentic/runs', '.agentic/evidence.jsonl', '.agentic/task-baselines.jsonl', '.agentic/reviews', '.agentic/sessions'];
// Isolate both CLI subprocesses and imported core Git calls from host Git overrides.
// The fixture relies on POSIX executable-bit semantics for its mode counterexample.
assert.notEqual(process.platform, 'win32', 'Run this offline research fixture on a POSIX filesystem.');
for (const key of Object.keys(process.env)) if (key.startsWith('GIT_')) delete process.env[key];
Object.assign(process.env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' });
const gitEnv = { ...process.env };

function command(root, executable, args, expectedCode = 0) {
  let stdout = '', stderr = '', code = 0;
  try {
    stdout = execFileSync(executable, args, { cwd: root, env: gitEnv, encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    code = typeof error.status === 'number' ? error.status : -1;
    stdout = String(error.stdout ?? ''); stderr = String(error.stderr ?? '');
  }
  assert.equal(code, expectedCode, `${executable} ${args.join(' ')}: ${stdout}\n${stderr}`);
  return { code, stdout, stderr };
}
const git = (root, ...args) => command(root, 'git', args).stdout;
const apk = (root, args, expectedCode = 0) => command(root, process.execPath, [cli, ...args], expectedCode);
async function exists(path) { try { await stat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function records(root) {
  return Object.fromEntries(await Promise.all(localPaths.map(async path => {
    if (!(await exists(join(root, path)))) return [path, false];
    const metadata = await stat(join(root, path));
    return [path, metadata.isDirectory() ? (await readdir(join(root, path))).some(name => name !== '.gitkeep') : metadata.size > 0];
  })));
}

async function scenario(base, state) {
  const source = join(base, `${state}-source`), destination = join(base, `${state}-destination`);
  await mkdir(source);
  const initialized = await initProject(source);
  await rm(join(source, '.tasks'), { recursive: true, force: true });
  await mkdir(join(source, '.tasks'));
  await mkdir(join(source, 'src'));
  await writeFile(join(source, 'src/work.txt'), 'before\n');
  await writeFile(join(source, taskPath), renderTaskMarkdown({
    id: '0001', title: 'Synthetic unfinished handoff', state: 'todo', owner: 'none', mode: 'maintenance',
    lane: 'research', scope: ['handoff'], risk: 'medium', parallel: false, dependsOn: [], tags: [],
    goal: 'Observe local context loss across a plain clone.', contextFiles: ['AGENTS.md'],
    allowedFiles: ['src/work.txt'], forbiddenFiles: ['private/**'], steps: ['Change the fixture text.'],
    acceptanceCriteria: ['The fixture text is changed.'], verificationCommands: ['node -e "process.exit(0)"'],
    documentationUpdates: ['docs/progress.md'], notes: ['Synthetic test identities and data only.'],
  }));
  git(source, 'init', '-q');
  git(source, 'config', 'user.name', 'Synthetic Handoff');
  git(source, 'config', 'user.email', 'handoff@example.invalid');
  git(source, 'add', '--', ...initialized.created.filter(path => !path.startsWith('.tasks/')), taskPath, 'src/work.txt');
  git(source, 'commit', '-qm', 'synthetic baseline');
  apk(source, ['agent', 'register', '--id', 'fixture-owner', '--platform', 'fixture', '--model', 'fixture']);
  apk(source, ['agent', 'register', '--id', 'fixture-reviewer', '--platform', 'fixture', '--model', 'fixture']);
  apk(source, ['claim', '0001', '--owner', 'fixture-owner']);
  const work = JSON.parse(apk(source, ['work', '0001', '--owner', 'fixture-owner', '--target', 'agents', '--role', 'implement', '--write-session', '--json']).stdout);
  await writeFile(join(source, 'src/work.txt'), 'after\n');
  if (state === 'review') apk(source, ['review', '0001', '--owner', 'fixture-owner']);
  git(source, 'add', '--', taskPath, 'src/work.txt');
  git(source, 'commit', '-qm', `synthetic ${state} candidate`);
  apk(source, ['task', 'verify', '0001', '--owner', 'fixture-owner']);
  // Preparation supplies authentic local review metadata without issuing a fake PASS.
  apk(source, ['review', '0001', '--reviewer', 'fixture-reviewer', '--prompt']);
  const sourceGate = await evaluateTaskCompletionGate({ rootDirectory: source, taskDirectory: '.tasks', taskId: '0001' });
  assert.equal(sourceGate.passed, true, sourceGate.blockers.join('; '));
  const sourceRecords = await records(source);
  assert.ok(Object.values(sourceRecords).every(Boolean), 'all six operational record families must exist on source');
  assert.equal(git(source, 'status', '--porcelain', '--untracked-files=all'), '', 'source handoff must be clean');
  git(base, 'clone', '--quiet', '--no-local', source, destination);
  const destinationRecords = await records(destination);
  assert.ok(Object.values(destinationRecords).every(value => !value), 'plain clone must omit operational records');
  assert.deepEqual(await readFile(join(source, taskPath)), await readFile(join(destination, taskPath)));
  assert.equal(git(source, 'rev-parse', 'HEAD'), git(destination, 'rev-parse', 'HEAD'));
  assert.equal((await loadTaskFile(join(destination, taskPath))).task.state, state);
  const destinationGate = await evaluateTaskCompletionGate({ rootDirectory: destination, taskDirectory: '.tasks', taskId: '0001' });
  const provenance = await buildTaskProvenance(destination, '.tasks', '0001');
  assert.equal(destinationGate.passed, false);
  assert.equal(await readTaskBaseline(destination, '0001'), undefined);
  assert.equal(provenance.baseline, undefined);
  assert.ok(destinationGate.blockers.some(message => /verification evidence/i.test(message)));
  const ownerAttempt = apk(destination, ['review', '0001', '--owner', 'fixture-owner'], 1);
  assert.match(ownerAttempt.stderr + ownerAttempt.stdout, /registered|Unknown agent/i);
  const binding = await resolveCanonicalRunBinding(destination, '0001', work.runId);
  assert.equal(binding.status, 'missing');

  // Read-only identity counterexample: supply the original baseline as an API value,
  // never install it into the destination store or promote any copied evidence.
  const baseline = await readTaskBaseline(source, '0001');
  assert.ok(baseline);
  const task = (await loadTaskFile(join(destination, taskPath))).task;
  const withSourceBaseline = await captureTaskEvidenceSubject(destination, task, ['src/work.txt'], baseline, { taskPath });
  const sourceEvidence = (await readTaskEvidence(source)).find(record => record.taskId === '0001' && record.result === 'pass' && record.checkId);
  assert.ok(sourceEvidence);
  const subject = { ...withSourceBaseline, baselineId: baseline.baselineId };
  const copiedFreshness = compareTaskEvidenceFreshness(sourceEvidence, subject);
  assert.equal(copiedFreshness.freshness, 'current');
  const forgedFreshness = compareTaskEvidenceFreshness({ ...sourceEvidence, agent: 'forged-agent', result: 'pass' }, subject);
  assert.equal(forgedFreshness.freshness, 'current', 'freshness is identity comparison, not authentication');
  const originalBytes = await readFile(join(destination, 'src/work.txt'));
  await chmod(join(destination, 'src/work.txt'), 0o755);
  const modeSubject = await captureTaskEvidenceSubject(destination, task, ['src/work.txt'], baseline, { taskPath });
  assert.deepEqual(await readFile(join(destination, 'src/work.txt')), originalBytes);
  assert.notEqual(modeSubject.candidateId, subject.candidateId, 'mode is material despite identical bytes');
  await chmod(join(destination, 'src/work.txt'), 0o644);
  assert.deepEqual(await records(destination), destinationRecords, 'read-only comparisons must not install context');
  assert.equal((await evaluateTaskCompletionGate({ rootDirectory: destination, taskDirectory: '.tasks', taskId: '0001' })).passed, false);
  const bounded = text => text.replaceAll(base, '<temporary-fixture>').slice(0, 2048).trim();
  return {
    state, trackedContractBytesMatch: true, gitHeadMatches: true, sourceClean: true,
    sourceRecords, destinationRecords, sourceGate: sourceGate.passed ? 'pass' : 'blocked', destinationGate: 'blocked',
    destinationBlockers: destinationGate.blockers.map(bounded).slice(0, 12),
    destinationDiagnostics: destinationGate.diagnostics.map(bounded).slice(0, 12),
    destinationComparisonKnown: destinationGate.comparisonKnown,
    ownerTransition: { code: ownerAttempt.code, diagnostic: bounded(ownerAttempt.stderr || ownerAttempt.stdout) },
    destinationProvenance: { baselinePresent: Boolean(provenance.baseline), evidenceCount: provenance.evidence?.length ?? null },
    canonicalWorkerBinding: binding.status,
    readOnlyIdentityComparison: { sourceBaselineSuppliedOnlyInMemory: true, originalRecordFreshness: copiedFreshness.freshness, forgedAgentFreshness: forgedFreshness.freshness, identicalBytesDifferentModeChangesCandidate: true, destinationGateStillBlocked: true },
  };
}

const root = await mkdtemp(join(tmpdir(), 'apk-handoff-research-'));
try {
  const observations = [];
  for (const state of ['doing', 'review']) observations.push(await scenario(root, state));
  console.log(JSON.stringify({ fixture: 'task-handoff-v1', runtime: process.version, observations, boundary: 'Observed current CLI/core behavior only; no handoff importer or trust promotion implemented.' }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
}
