// 播放器：纯逻辑，不触碰 DOM；rAF 与取消函数可注入，便于测试。
const FRAME_MS = 16.7;
const DEFAULT_INTERVAL = 80;
const MIN_INTERVAL = 0.5;
const MAX_INTERVAL = 400;
const BACKLOG_STEPS = 4; // 突发保护：最多积压 4 步

const hasRaf = typeof globalThis.requestAnimationFrame === "function";
const defaultRaf = hasRaf
  ? (cb) => globalThis.requestAnimationFrame(cb)
  : (cb) => setTimeout(() => cb(Date.now()), 16);
const defaultCancel =
  hasRaf && typeof globalThis.cancelAnimationFrame === "function"
    ? (handle) => globalThis.cancelAnimationFrame(handle)
    : (handle) => clearTimeout(handle);

const isIndex = (value, length) => Number.isInteger(value) && value >= 0 && value < length;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createPlayer({ onFrame, onFinish, onError, raf, cancel, config } = {}) {
  const frameFn = typeof raf === "function" ? raf : defaultRaf;
  const cancelFn = typeof cancel === "function" ? cancel : defaultCancel;

  // 播放参数来自 config.json 的 playback 段，缺省时用模块内置默认值
  const conf = {
    frameMs: FRAME_MS,
    defaultIntervalMs: DEFAULT_INTERVAL,
    minIntervalMs: MIN_INTERVAL,
    maxIntervalMs: MAX_INTERVAL,
    backlogSteps: BACKLOG_STEPS,
    ...(config || {}),
  };

  let steps = [];
  let initial = [];
  let current = [];
  let status = "idle";
  let cursor = -1; // 已应用的最后一个步骤下标
  let stats = { comparisons: 0, swaps: 0, writes: 0 };
  let intervalMs = conf.defaultIntervalMs;
  let handle = null;
  let token = 0; // 用于作废已排队但尚未执行的帧回调
  let finishedOnce = false;
  let destroyed = false;
  let acc = 0; // 尚未走完的时间额度（毫秒）
  let lastTs = null; // 上一帧时间戳；null 表示下一帧 dt 记 0

  const emitError = (err) => {
    if (typeof onError === "function") onError(err);
  };

  function cancelFrame() {
    if (handle === null) return;
    const pending = handle;
    handle = null;
    try {
      cancelFn(pending);
    } catch {
      /* 取消失败不影响状态机 */
    }
  }

  function schedule() {
    if (destroyed || handle !== null || status !== "playing") return;
    const myToken = token;
    handle = frameFn((ts) => {
      handle = null;
      if (myToken !== token) return;
      tick(ts);
    });
  }

  // 应用单个步骤；越界下标直接跳过并返回 null（不产生高亮）
  function applyStep(step) {
    const length = current.length;
    switch (step.op) {
      case "compare": {
        if (!isIndex(step.a, length) || !isIndex(step.b, length)) return null;
        stats.comparisons += 1;
        return { indices: [step.a, step.b], kind: "compare" };
      }
      case "swap": {
        if (!isIndex(step.a, length) || !isIndex(step.b, length)) return null;
        const t = current[step.a];
        current[step.a] = current[step.b];
        current[step.b] = t;
        stats.swaps += 1;
        return { indices: [step.a, step.b], kind: "swap" };
      }
      case "write": {
        if (!isIndex(step.index, length)) return null;
        current[step.index] = step.value;
        stats.writes += 1;
        return { indices: [step.index], kind: "write" };
      }
      case "mark": {
        if (!isIndex(step.index, length)) return null;
        return { indices: [step.index], kind: "mark" };
      }
      default:
        return null;
    }
  }

  function framePayload(highlight, line) {
    const total = steps.length;
    const progress = total > 0 ? clamp01((cursor + 1) / total) : 1;
    return { array: current.slice(), highlight, line, progress, stepIndex: cursor, total };
  }

  function finish() {
    cancelFrame();
    token += 1;
    lastTs = null;
    status = "finished";
    if (finishedOnce) return;
    finishedOnce = true;
    if (typeof onFinish === "function") {
      onFinish({
        array: current.slice(),
        comparisons: stats.comparisons,
        swaps: stats.swaps,
        writes: stats.writes,
      });
    }
  }

  // 按累计时间推进：每 intervalMs 走一步（与原站 setTimeout 每步一次的语义一致）
  function tick(ts) {
    try {
      if (destroyed || status !== "playing") return;

      const now = typeof ts === "number" && Number.isFinite(ts) ? ts : Date.now();
      let dt = lastTs === null ? 0 : now - lastTs;
      lastTs = now;
      if (!Number.isFinite(dt) || dt < 0) dt = conf.frameMs;

      acc += dt;
      // 突发保护：最多积压 BACKLOG_STEPS 步；同时不得低于一帧的额度，
      // 否则高速档（如 0.5ms）会被压成每帧 4 步，快端反而失效。
      const backlogCap = Math.max(intervalMs * conf.backlogSteps, conf.frameMs);
      if (acc > backlogCap) acc = backlogCap;

      const due = Math.floor(acc / intervalMs);
      if (due > 0) acc -= due * intervalMs;

      let highlight = null;
      let line = 0;
      let applied = 0;
      let reachedDone = false;

      while (applied < due && cursor < steps.length - 1) {
        cursor += 1;
        const step = steps[cursor];
        if (step && typeof step === "object") {
          if (step.op === "done") {
            highlight = null;
            line = Number.isInteger(step.line) ? step.line : 0;
            reachedDone = true;
            applied += 1;
            break;
          }
          const result = applyStep(step);
          if (result) highlight = result;
          line = Number.isInteger(step.line) ? step.line : line;
        }
        applied += 1;
      }

      // 没有推进就不必惊动 UI
      if (applied > 0 && typeof onFrame === "function") onFrame(framePayload(highlight, line));

      if (reachedDone || cursor >= steps.length - 1) {
        finish();
        return;
      }
      schedule();
    } catch (err) {
      emitError(err);
      if (status === "playing") stop();
    }
  }

  function reset() {
    current = initial.slice();
    cursor = -1;
    stats = { comparisons: 0, swaps: 0, writes: 0 };
    finishedOnce = false;
    acc = 0;
    lastTs = null;
  }

  function load(nextSteps, initialArray) {
    if (destroyed) return;
    cancelFrame();
    token += 1;
    if (!Array.isArray(nextSteps)) {
      steps = [];
      emitError(new TypeError("player.load: steps 必须是数组"));
    } else {
      steps = nextSteps.slice();
    }
    if (!Array.isArray(initialArray)) {
      initial = [];
      emitError(new TypeError("player.load: initialArray 必须是数组"));
    } else {
      initial = initialArray.slice();
    }
    status = "idle";
    reset();
  }

  function play() {
    if (destroyed) return;
    if (status === "playing") return;
    cancelFrame();
    token += 1;
    // idle / finished：从头开始；paused / stopped：从冻结处继续
    if (status === "idle" || status === "finished") reset();
    // 预置一个步长的额度：点下播放后第一帧必然推进至少 1 步，
    // 否则最慢档（400ms）要等 400ms 才有第一根柱子变色，像是没反应。
    acc = intervalMs;
    lastTs = null;
    status = "playing";
    schedule();
  }

  function pause() {
    if (destroyed || status !== "playing") return;
    cancelFrame();
    token += 1;
    lastTs = null;
    status = "paused";
  }

  function stop() {
    if (destroyed) return;
    cancelFrame();
    token += 1;
    lastTs = null;
    status = "stopped";
  }

  function setSpeed(interval) {
    const v = Number(interval);
    if (!Number.isFinite(v)) return;
    intervalMs = Math.min(conf.maxIntervalMs, Math.max(conf.minIntervalMs, v));
  }

  function getStatus() {
    return status;
  }

  function destroy() {
    cancelFrame();
    token += 1;
    destroyed = true;
    status = "stopped";
    steps = [];
    initial = [];
    current = [];
  }

  return { load, play, pause, resume: play, stop, setSpeed, getStatus, destroy };
}
