// 测试辅助：回放器 / 固定种子 LCG / 假 rAF 帧泵 / 计数断言。
// 只依赖 node 内置模块，零第三方依赖。本文件内部不使用模板字符串，便于整文件生成。
import nodeAssert from "node:assert/strict";

/* ---------------- 断言计数 ---------------- */

export const counters = { assertions: 0 };

const counted = (fn) => (...args) => {
  counters.assertions += 1;
  return fn(...args);
};

export const asrt = {
  ok: counted(nodeAssert.ok),
  equal: counted(nodeAssert.equal),
  notEqual: counted(nodeAssert.notEqual),
  deepEqual: counted(nodeAssert.deepEqual),
  throws: counted(nodeAssert.throws),
  fail: counted(nodeAssert.fail),
};

/* ---------------- 失败信息上下文 ---------------- */

export const fmtArray = (arr) => {
  if (!Array.isArray(arr)) return String(arr);
  const head = arr.slice(0, 40).join(",");
  if (arr.length > 40) return "[" + head + ",...](" + arr.length + " 个)";
  return "[" + head + "]";
};

export const ctx = (id, arr) => "[" + id + "] 输入=" + fmtArray(arr);

/* ---------------- 回放器 ---------------- */

// 按契约回放 Step[]：compare/mark/done 不改数组，swap 交换两位，write 覆写一位。
// 未知 op 直接抛错，防止回放器自己把问题静默吞掉。
export function replay(steps, initialArray) {
  if (!Array.isArray(steps)) throw new TypeError("replay: steps 必须是数组");
  const array = Array.isArray(initialArray) ? initialArray.slice() : [];
  const stats = { comparisons: 0, swaps: 0, writes: 0, marks: 0 };
  const doneIndices = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step || typeof step !== "object") {
      throw new TypeError("replay: step#" + i + " 不是对象");
    }
    switch (step.op) {
      case "compare":
        stats.comparisons += 1;
        break;
      case "swap": {
        const t = array[step.a];
        array[step.a] = array[step.b];
        array[step.b] = t;
        stats.swaps += 1;
        break;
      }
      case "write":
        array[step.index] = step.value;
        stats.writes += 1;
        break;
      case "mark":
        stats.marks += 1;
        break;
      case "done":
        doneIndices.push(i);
        break;
      default:
        throw new Error("replay: 未知 op " + JSON.stringify(step.op) + " (step#" + i + ")");
    }
  }
  return { array, stats, doneIndices };
}

// 返回第一个破坏非递减的位置（已有序返回 -1）
export function firstUnsortedIndex(arr) {
  for (let i = 1; i < arr.length; i++) if (arr[i - 1] > arr[i]) return i - 1;
  return -1;
}

export const isNonDecreasing = (arr) => firstUnsortedIndex(arr) === -1;

/* ---------------- 固定种子随机数（32 位 LCG） ---------------- */

export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
  };
}

/* ---------------- 假 requestAnimationFrame ---------------- */

// cancelMode = "drop"：取消时把回调从队列移除（与真实 rAF 语义一致）
// cancelMode = "noop"：取消什么都不做，用于验证播放器内部的 token 兜底
// frameMs：每执行一帧推进的模拟毫秒数（默认 16.7 ≈ 60fps）。播放器按时间戳累计推进，
//          回调必须拿到递增的时间戳，否则 dt 恒为 0，播放器会永久停滞。
export function createFakeRaf({ cancelMode = "drop", frameMs = 16.7, startAt = 0 } = {}) {
  const queue = new Map();
  let nextId = 1;
  let now = startAt; // 模拟时钟（毫秒）
  let pumped = 0;

  const raf = (cb) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  };

  const cancel = (id) => {
    if (cancelMode === "drop") queue.delete(id);
  };

  // 手动推进 n 帧，返回真正执行的帧回调数；每次执行都把模拟时钟前进 frameMs
  const pump = (n = 1) => {
    let ran = 0;
    for (let k = 0; k < n; k++) {
      const head = queue.entries().next();
      if (head.done) break;
      const [id, cb] = head.value;
      queue.delete(id);
      ran += 1;
      pumped += 1;
      now += frameMs;
      cb(now);
    }
    return ran;
  };

  const drain = (maxFrames = 100000) => {
    let frames = 0;
    while (frames < maxFrames && pump(1) > 0) frames += 1;
    return frames;
  };

  return {
    raf,
    cancel,
    pump,
    drain,
    frameMs,
    clock: () => now,
    pumped: () => pumped,
    pending: () => queue.size,
  };
}
