// 排序引擎回归测试（Node 内置 node:test + node:assert/strict，零第三方依赖）
// 被测对象：public/js/algorithms/*（由另一子代理实现）、public/js/arrayGen.js、public/js/player.js
// 约定：本文件只用字符串拼接拼消息，不用模板字符串。
import { describe, it, after } from "node:test";
import { ALGORITHMS, byId } from "../public/js/algorithms/index.js";
import { ARRAY_TYPES, generateArray } from "../public/js/arrayGen.js";
import { createPlayer } from "../public/js/player.js";
import {
  asrt,
  counters,
  ctx,
  fmtArray,
  replay,
  firstUnsortedIndex,
  makeRng,
  createFakeRaf,
} from "./helpers.mjs";

/* ======================= 常量 ======================= */

const FIXED = [5, 3, 8, 1, 9, 2, 7, 4, 6, 0];
const EXPECTED_ORDER = [
  "bubble",
  "selection",
  "insertion",
  "merge",
  "quick",
  "cocktail",
  "oddEven",
  "counting",
];
const VALID_OPS = new Set(["compare", "swap", "write", "mark", "done"]);
const RANDOM_CASES = 100;
const DETERMINISM_CASES = 10;

// 供 after() 汇总打印的实测值（回归时可直接看到数值漂移）
const observed = {};

// 原站复杂度数据，逐字比对（O(n²) 用上标 ²）
const EXPECTED_COMPLEXITY = {
  bubble: {
    time: { worst: "O(n²)", average: "O(n²)", best: "O(n)" },
    space: "O(1)",
    inPlace: "是",
    stable: "是",
  },
  selection: {
    time: { worst: "O(n²)", average: "O(n²)", best: "O(n²)" },
    space: "O(1)",
    inPlace: "是",
    stable: "否",
  },
  insertion: {
    time: { worst: "O(n²)", average: "O(n²)", best: "O(n)" },
    space: "O(1)",
    inPlace: "是",
    stable: "是",
  },
  merge: {
    time: { worst: "O(nlogn)", average: "O(nlogn)", best: "O(nlogn)" },
    space: "O(n)",
    inPlace: "否",
    stable: "是",
  },
  quick: {
    time: { worst: "O(n²)", average: "O(nlogn)", best: "O(nlogn)" },
    space: "O(1)",
    inPlace: "是",
    stable: "否",
  },
  cocktail: {
    time: { worst: "O(n²)", average: "O(n²)", best: "O(n)" },
    space: "O(1)",
    inPlace: "是",
    stable: "是",
  },
  oddEven: {
    time: { worst: "O(n²)", average: "O(n²)", best: "O(n)" },
    space: "O(1)",
    inPlace: "是",
    stable: "是",
  },
  counting: {
    time: { worst: "O(n+k)", average: "O(n+k)", best: "O(n+k)" },
    space: "O(k)",
    inPlace: "否",
    stable: "是",
  },
};

/* ======================= 工具 ======================= */

const at = (id, input, extra) => ctx(id, input) + (extra ? " " + extra : "");

// 固定种子：同一 k 永远得到同一组输入，保证测试可重复
function randomArray(rng, k) {
  const ranges = [
    [0, 3],
    [0, 9],
    [30, 500],
    [-25, 25],
  ];
  const range = ranges[k % ranges.length];
  const len = rng.int(10, 100);
  const out = new Array(len);
  for (let i = 0; i < len; i++) out[i] = rng.int(range[0], range[1]);
  return out;
}

// 校验步骤合法性，返回问题列表（空数组 = 通过）；只收集前 8 条，避免刷屏
function collectStepProblems(algo, input, steps) {
  const id = algo.meta.id;
  const problems = [];
  const push = (m) => {
    if (problems.length < 8) problems.push(m);
  };
  if (!Array.isArray(steps)) return ["sort() 返回值不是数组"];

  const n = input.length;
  const pseudoLen = algo.meta.pseudocode.length;
  let doneCount = 0;
  let doneIndex = -1;

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s || typeof s !== "object") {
      push("step#" + i + " 不是对象");
      continue;
    }
    if (!VALID_OPS.has(s.op)) {
      push("step#" + i + " op=" + String(s.op) + " 不在白名单");
      continue;
    }
    if (!Number.isInteger(s.line) || s.line < 0 || s.line >= pseudoLen) {
      push("step#" + i + " (" + s.op + ") line=" + s.line + " 不在 [0," + pseudoLen + ")");
    }
    if (s.op === "compare" || s.op === "swap") {
      for (const key of ["a", "b"]) {
        const v = s[key];
        if (!Number.isInteger(v) || v < 0 || v >= n) {
          push("step#" + i + " (" + s.op + ") " + key + "=" + v + " 不在 [0," + (n - 1) + "]");
        }
      }
    }
    if (s.op === "write" || s.op === "mark") {
      const v = s.index;
      if (!Number.isInteger(v) || v < 0 || v >= n) {
        push("step#" + i + " (" + s.op + ") index=" + v + " 不在 [0," + (n - 1) + "]");
      }
      if (s.op === "write" && !Number.isInteger(s.value)) {
        push("step#" + i + " (write) value=" + String(s.value) + " 不是整数");
      }
    }
    if (s.op === "done") {
      doneCount += 1;
      doneIndex = i;
    }
  }

  if (doneCount !== 1) push("done 步骤数量=" + doneCount + "，应恰好 1 个");
  if (doneCount === 1 && doneIndex !== steps.length - 1) {
    push("done 位于 #" + doneIndex + "，应位于末位 #" + (steps.length - 1));
  }
  return problems;
}

// 单例完整校验：不修改入参 + 步骤合法 + 回放非递减 + done 唯一且末位
function checkCase(algo, input, label) {
  const id = algo.meta.id;
  const tag = at(id, input, label);
  const snapshot = JSON.stringify(input);

  const steps = algo.sort(input);

  asrt.ok(Array.isArray(steps), tag + " sort() 必须返回数组");
  asrt.equal(JSON.stringify(input), snapshot, tag + " sort() 不得修改入参数组");

  asrt.deepEqual(collectStepProblems(algo, input, steps), [], tag + " 步骤不合法");

  const result = replay(steps, input);
  asrt.deepEqual(
    result.doneIndices,
    [steps.length - 1],
    tag + " done 必须唯一且在末位，实际=" + JSON.stringify(result.doneIndices)
  );
  asrt.equal(
    firstUnsortedIndex(result.array),
    -1,
    tag + " 回放后必须非递减，实际=" + fmtArray(result.array)
  );

  return { steps, result };
}

/* ======================= 0. 回放工具自测 ======================= */

describe("0. 回放工具自测（防止测试工具本身有 bug）", () => {
  it("swap 交换两位、write 覆写一位、compare/mark/done 不动数组", () => {
    const initial = [3, 1, 2];
    const steps = [
      { op: "compare", a: 0, b: 1, line: 0 },
      { op: "swap", a: 0, b: 1, line: 0 },
      { op: "mark", index: 2, line: 0 },
      { op: "write", index: 2, value: 9, line: 0 },
      { op: "compare", a: 0, b: 2, line: 0 },
      { op: "done", line: 0 },
    ];
    const { array, stats, doneIndices } = replay(steps, initial);
    asrt.deepEqual(array, [1, 3, 9], "回放结果错误");
    asrt.deepEqual(stats, { comparisons: 2, swaps: 1, writes: 1, marks: 1 }, "回放计数错误");
    asrt.deepEqual(doneIndices, [5], "done 下标识别错误");
  });

  it("回放不修改入参数组", () => {
    const initial = [2, 1];
    replay([{ op: "swap", a: 0, b: 1, line: 0 }, { op: "done", line: 0 }], initial);
    asrt.deepEqual(initial, [2, 1], "replay 不得修改传入数组");
  });

  it("未知 op 必须抛错（不允许静默跳过）", () => {
    asrt.throws(() => replay([{ op: "explode", line: 0 }], []), /未知 op/, "未知 op 未抛错");
    asrt.throws(() => replay(null, []), /steps 必须是数组/, "非法 steps 未抛错");
  });

  it("firstUnsortedIndex 能定位逆序位置", () => {
    asrt.equal(firstUnsortedIndex([1, 2, 3]), -1, "已有序应返回 -1");
    asrt.equal(firstUnsortedIndex([1, 3, 2]), 1, "逆序位置识别错误");
    asrt.equal(firstUnsortedIndex([]), -1, "空数组应返回 -1");
  });
});

/* ======================= A. 正确性 ======================= */

describe("A. 排序正确性", () => {
  for (const algo of ALGORITHMS) {
    const id = algo.meta.id;

    it(id + " · 固定用例 [5,3,8,1,9,2,7,4,6,0]", () => {
      const { result } = checkCase(algo, FIXED.slice(), "固定用例");
      asrt.deepEqual(result.array, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], at(id, FIXED, "结果错误"));
    });

    it(id + " · " + RANDOM_CASES + " 组随机用例（长度 10..100，含重复值）", () => {
      const seed = 0x51ee01 + EXPECTED_ORDER.indexOf(id) * 7919;
      const rng = makeRng(seed);
      for (let k = 0; k < RANDOM_CASES; k++) {
        checkCase(algo, randomArray(rng, k), "随机#" + k);
      }
    });
  }
});

/* ======================= B. 步骤合法性 ======================= */

describe("B. 步骤合法性（固定用例上的显式检查）", () => {
  for (const algo of ALGORITHMS) {
    const id = algo.meta.id;

    it(id + " · op 白名单 / 下标范围 / line 范围 / done 唯一", () => {
      const input = FIXED.slice();
      const tag = at(id, input, "固定用例");
      const steps = algo.sort(input);

      asrt.deepEqual(collectStepProblems(algo, input, steps), [], tag + " 步骤不合法");
      asrt.ok(steps.length > 0, tag + " 不得返回空步骤");

      const hist = {};
      for (const s of steps) hist[s.op] = (hist[s.op] || 0) + 1;
      const unknown = Object.keys(hist).filter((op) => !VALID_OPS.has(op));
      asrt.deepEqual(unknown, [], tag + " 出现未知 op");
      asrt.equal(hist.done, 1, tag + " done 数量应恰好 1");
      asrt.ok(
        (hist.compare || 0) + (hist.swap || 0) + (hist.write || 0) > 0,
        tag + " 至少应产生 compare/swap/write 中的一种"
      );
      asrt.equal(steps[steps.length - 1].op, "done", tag + " 末位必须是 done");
    });
  }
});

/* ======================= C. 不变式 ======================= */

describe("C. 不变式：不修改入参 / 确定性", () => {
  for (const algo of ALGORITHMS) {
    const id = algo.meta.id;

    it(id + " · sort() 不修改入参（深比较快照）", () => {
      const input = FIXED.slice();
      const snapshot = input.slice();
      algo.sort(input);
      asrt.deepEqual(input, snapshot, at(id, input, "sort() 修改了入参数组"));
    });

    it(id + " · 同一数组两次调用步骤序列相同", () => {
      const rng = makeRng(0xbeef01 + EXPECTED_ORDER.indexOf(id) * 104729);
      const cases = [FIXED.slice()];
      for (let k = 0; k < DETERMINISM_CASES; k++) cases.push(randomArray(rng, k));
      for (const input of cases) {
        const first = JSON.stringify(algo.sort(input));
        const second = JSON.stringify(algo.sort(input));
        asrt.equal(
          second !== "" && second === first,
          true,
          at(id, input, "两次排序得到的步骤序列不一致（非确定性）")
        );
      }
    });
  }
});

/* ======================= D. 边界 ======================= */

describe("D. 边界输入", () => {
  const asc100 = Array.from({ length: 100 }, (_, i) => i);
  const desc100 = Array.from({ length: 100 }, (_, i) => 99 - i);

  const EDGES = [
    { name: "空数组 []", input: [] },
    { name: "单元素 [7]", input: [7] },
    { name: "全相同值 (20 个 5)", input: new Array(20).fill(5) },
    { name: "两个元素逆序 [2,1]", input: [2, 1] },
    { name: "两个元素正序 [1,2]", input: [1, 2] },
    { name: "已升序 100", input: asc100 },
    { name: "已降序 100（快排最坏输入）", input: desc100 },
  ];

  for (const algo of ALGORITHMS) {
    const id = algo.meta.id;

    it(id + " · 7 种边界输入", () => {
      for (const edge of EDGES) {
        checkCase(algo, edge.input.slice(), edge.name);
      }
    });

    it(id + " · 降序 100 不得栈溢出且步数有限", () => {
      const input = desc100.slice();
      const steps = algo.sort(input);
      asrt.ok(Number.isFinite(steps.length) && steps.length > 0, at(id, input, "步数异常"));
      asrt.ok(steps.length < 1000000, at(id, input, "步数爆炸：" + steps.length));
      asrt.equal(replay(steps, input).array.join(","), asc100.join(","), at(id, input, "降序输入排序错误"));
    });
  }
});

/* ======================= E. meta 自洽 ======================= */

describe("E. meta 自洽性", () => {
  it("注册顺序与长度", () => {
    asrt.equal(ALGORITHMS.length, 8, "算法数量应为 8");
    asrt.deepEqual(
      ALGORITHMS.map((a) => a.meta.id),
      EXPECTED_ORDER,
      "ALGORITHMS 顺序必须为 " + EXPECTED_ORDER.join(",")
    );
  });

  it("byId 能按 id 取回算法，未知 id 返回 null", () => {
    for (const id of EXPECTED_ORDER) {
      const found = byId(id);
      asrt.ok(found, "byId(" + id + ") 未命中");
      asrt.equal(found.meta.id, id, "byId(" + id + ") meta.id 不一致");
      asrt.equal(typeof found.sort, "function", "byId(" + id + ").sort 不是函数");
    }
    asrt.equal(byId("__nope__"), null, "未知 id 应返回 null");
  });

  it("8 个算法都有 zh / en / pseudocode(>=6) / complexity 六项", () => {
    for (const algo of ALGORITHMS) {
      const { meta } = algo;
      asrt.equal(typeof meta.zh, "string", meta.id + " meta.zh 必须是字符串");
      asrt.ok(meta.zh.length > 0, meta.id + " meta.zh 不得为空");
      asrt.equal(typeof meta.en, "string", meta.id + " meta.en 必须是字符串");
      asrt.ok(meta.en.length > 0, meta.id + " meta.en 不得为空");
      asrt.ok(Array.isArray(meta.pseudocode), meta.id + " meta.pseudocode 必须是数组");
      asrt.ok(meta.pseudocode.length >= 6, meta.id + " 伪代码至少 6 行，实际=" + meta.pseudocode.length);
      for (let i = 0; i < meta.pseudocode.length; i++) {
        asrt.equal(
          typeof meta.pseudocode[i] === "string" && meta.pseudocode[i].length > 0,
          true,
          meta.id + " 伪代码第 " + i + " 行不是非空字符串"
        );
      }
      const c = meta.complexity;
      asrt.ok(c && typeof c === "object", meta.id + " 缺少 complexity");
      asrt.ok(c.time && typeof c.time === "object", meta.id + " 缺少 complexity.time");
      for (const key of ["worst", "average", "best"]) {
        asrt.ok(typeof c.time[key] === "string" && c.time[key].length > 0, meta.id + " complexity.time." + key + " 缺失");
      }
      for (const key of ["space", "inPlace", "stable"]) {
        asrt.ok(typeof c[key] === "string" && c[key].length > 0, meta.id + " complexity." + key + " 缺失");
      }
    }
  });

  it("复杂度九项逐字等于原站数据", () => {
    for (const algo of ALGORITHMS) {
      const expected = EXPECTED_COMPLEXITY[algo.meta.id];
      asrt.ok(expected, algo.meta.id + " 不在期望表中");
      asrt.deepEqual(algo.meta.complexity, expected, algo.meta.id + " 复杂度数据与契约不一致");
    }
  });
});

/* ======================= F. arrayGen ======================= */

describe("F. arrayGen 数组生成器", () => {
  const inRange = (arr) => arr.every((v) => Number.isInteger(v) && v >= 30 && v <= 500);
  const hasDup = (arr) => new Set(arr).size !== arr.length;

  it("ARRAY_TYPES 四种类型逐字匹配", () => {
    asrt.deepEqual(
      ARRAY_TYPES,
      [
        { id: "random", zh: "随机" },
        { id: "almost", zh: "基本有序" },
        { id: "asc", zh: "升序" },
        { id: "desc", zh: "降序" },
      ],
      "ARRAY_TYPES 与契约不一致"
    );
  });

  it("默认参数：长度 25、类型 random", () => {
    const arr = generateArray();
    asrt.equal(arr.length, 25, "默认长度应为 25");
    asrt.equal(inRange(arr), true, "默认值域应在 30..500 的整数，实际=" + fmtArray(arr));
  });

  it("length 夹取到 10..100", () => {
    const cases = [
      [0, 10],
      [5, 10],
      [9, 10],
      [10, 10],
      [25, 25],
      [100, 100],
      [1000, 100],
    ];
    for (const [input, expected] of cases) {
      const arr = generateArray(input);
      asrt.equal(arr.length, expected, "generateArray(" + input + ") 长度应为 " + expected + "，实际=" + arr.length);
      asrt.equal(inRange(arr), true, "generateArray(" + input + ") 值域越界：" + fmtArray(arr));
    }
  });

  it("四种类型的长度与值域", () => {
    for (const type of ["random", "almost", "asc", "desc"]) {
      for (const len of [10, 25, 100]) {
        const arr = generateArray(len, type);
        asrt.equal(arr.length, len, type + " 类型长度错误：" + arr.length);
        asrt.equal(inRange(arr), true, type + " 类型值域越界：" + fmtArray(arr));
      }
    }
  });

  it("asc 非递减、desc 非递增", () => {
    for (const len of [10, 37, 100]) {
      const asc = generateArray(len, "asc");
      const desc = generateArray(len, "desc");
      asrt.equal(firstUnsortedIndex(asc), -1, "asc 必须非递减，实际=" + fmtArray(asc));
      for (let i = 1; i < desc.length; i++) {
        asrt.equal(desc[i - 1] >= desc[i], true, "desc 必须非递增，实际=" + fmtArray(desc));
      }
    }
  });

  it("random 在 100 长度下允许重复值（20 次采样至少出现一次重复）", () => {
    let dupSamples = 0;
    for (let k = 0; k < 20; k++) {
      const arr = generateArray(100, "random");
      asrt.equal(inRange(arr), true, "random 值域越界：" + fmtArray(arr));
      if (hasDup(arr)) dupSamples += 1;
    }
    asrt.ok(
      dupSamples >= 1,
      "20 次 100 长度采样中一次重复值都没有出现（" + dupSamples + "/20），arrayGen 仍在生成互不相同的值"
    );
  });
});

/* ======================= G. player ======================= */

const SYNTH_INITIAL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// count 个合法 compare + 末尾 done，用来测量每帧推进的步数
function syntheticSteps(count = 200) {
  const steps = [];
  for (let i = 0; i < count; i++) steps.push({ op: "compare", a: i % 10, b: (i + 1) % 10, line: 0 });
  steps.push({ op: "done", line: 0 });
  return steps;
}

function setupPlayer(options = {}) {
  const fake = createFakeRaf(options);
  const log = { frames: [], frameTs: [], finishes: [], errors: [] };
  const player = createPlayer({
    onFrame: (f) => {
      log.frames.push(f);
      log.frameTs.push(fake.clock());
    },
    onFinish: (r) => log.finishes.push(r),
    onError: (e) => log.errors.push(e),
    raf: fake.raf,
    cancel: fake.cancel,
  });
  return { fake, log, player };
}

// 只统计真正触发 onFrame 的帧（没推进就不回调）：
// deltas[i] = 该帧推进的步数（首帧相对 cursor=-1 计）
// gaps[i]   = 与上一次触发相隔多少帧（按假时钟换算）
function measurePerFrame(configure, frameCount = 200) {
  const env = setupPlayer();
  if (typeof configure === "function") configure(env.player);
  env.player.load(syntheticSteps(frameCount), SYNTH_INITIAL);
  env.player.play();
  env.fake.drain(20000);

  const deltas = [];
  const gaps = [];
  let prev = -1;
  let prevTs = null;
  for (let i = 0; i < env.log.frames.length; i++) {
    const f = env.log.frames[i];
    deltas.push(f.stepIndex - prev);
    prev = f.stepIndex;
    const ts = env.log.frameTs[i];
    if (prevTs !== null) gaps.push(Math.round((ts - prevTs) / env.fake.frameMs));
    prevTs = ts;
  }
  return { deltas, gaps, ...env };
}

describe("G. player 播放器（注入假 rAF，时间戳递增手动泵帧）", () => {
  it("正常跑完触发 onFinish，统计与手工回放一致（默认 80ms 档）", () => {
    const algo = byId("bubble");
    const steps = algo.sort(FIXED);
    const { fake, log, player } = setupPlayer();

    player.load(steps, FIXED);
    asrt.equal(player.getStatus(), "idle", "load 后状态应为 idle");
    player.play();
    asrt.equal(player.getStatus(), "playing", "play 后状态应为 playing");
    const frames = fake.drain(5000);

    asrt.ok(frames > 0, "至少应推进一帧");
    asrt.equal(log.errors.length, 0, "正常路径不得触发 onError");
    asrt.equal(log.finishes.length, 1, "onFinish 必须恰好触发一次，实际=" + log.finishes.length);
    asrt.equal(player.getStatus(), "finished", "跑完后状态应为 finished");

    const manual = replay(steps, FIXED);
    const result = log.finishes[0];
    asrt.deepEqual(result.array, manual.array, "onFinish.array 与手工回放不一致");
    asrt.equal(result.comparisons, manual.stats.comparisons, "comparisons 计数不一致");
    asrt.equal(result.swaps, manual.stats.swaps, "swaps 计数不一致");
    asrt.equal(result.writes, manual.stats.writes, "writes 计数不一致");

    const lastFrame = log.frames[log.frames.length - 1];
    asrt.deepEqual(lastFrame.array, manual.array, "最后一帧数组应为已排序");
    asrt.equal(lastFrame.progress, 1, "最后一帧 progress 应为 1");
    asrt.equal(lastFrame.total, steps.length, "total 应等于步骤总数");
  });

  it("onFrame 负载形状 {array,highlight,line,progress,stepIndex,total}", () => {
    const { fake, log, player } = setupPlayer();
    player.load(syntheticSteps(5), SYNTH_INITIAL);
    player.play();
    fake.drain(200);

    asrt.ok(log.frames.length > 0, "应有帧回调");
    const f = log.frames[0];
    asrt.equal(Array.isArray(f.array), true, "frame.array 必须是数组");
    asrt.equal(f.array.length, SYNTH_INITIAL.length, "frame.array 长度应等于初始数组长度");
    asrt.ok(f.highlight === null || typeof f.highlight === "object", "frame.highlight 类型错误");
    asrt.equal(Number.isInteger(f.line), true, "frame.line 必须是整数");
    asrt.equal(typeof f.progress, "number", "frame.progress 必须是数字");
    asrt.ok(f.progress >= 0 && f.progress <= 1, "frame.progress 应在 [0,1]，实际=" + f.progress);
    asrt.equal(Number.isInteger(f.stepIndex), true, "frame.stepIndex 必须是整数");
    asrt.equal(f.total, syntheticSteps(5).length, "frame.total 应等于步骤总数");
  });

  it("interval 400 → 每次回调恰 1 步，帧间隔 ∈ {23,24}（每步 400ms）", () => {
    const { deltas, gaps, log, fake } = measurePerFrame((p) => p.setSpeed(400));
    asrt.equal(log.errors.length, 0, "不得触发 onError");
    asrt.ok(deltas.length > 5, "回调次数太少：" + deltas.length);

    asrt.deepEqual(
      deltas.filter((d) => d !== 1),
      [],
      "interval=400 时每次回调应恰 1 步，异常帧步数=" + JSON.stringify(deltas.filter((d) => d !== 1).slice(0, 5))
    );
    const badGaps = gaps.filter((g) => g !== 23 && g !== 24);
    asrt.deepEqual(
      badGaps,
      [],
      "interval=400 的帧间隔应 ∈ {23,24}（400/16.7≈23.95），异常间隔=" + JSON.stringify(badGaps.slice(0, 5))
    );
    // 慢档必须真的慢：绝大多数帧没有额度、不推进也不回调
    asrt.ok(
      log.frames.length < fake.pumped() * 0.1,
      "400ms 档的回调次数应远少于泵帧数，实际 回调=" + log.frames.length + " / 泵帧=" + fake.pumped()
    );
  });

  it("interval 0.5 → 首帧 1 步（play 预置额度），之后每帧 33 步", () => {
    const { deltas, log } = measurePerFrame((p) => p.setSpeed(0.5));
    asrt.equal(log.errors.length, 0, "不得触发 onError");
    asrt.equal(deltas[0], 1, "首帧应恰好 1 步（play 预置一个步长的额度），实际=" + deltas[0]);
    asrt.ok(deltas.length > 2, "帧数太少：" + deltas.length);

    const body = deltas.slice(1, -1);
    asrt.deepEqual(
      body.filter((d) => d !== 33),
      [],
      "interval=0.5 时第 2 帧起应为 33 步/帧（= floor(16.7/0.5)），实际=" + JSON.stringify(deltas.slice(0, 6))
    );
    const last = deltas[deltas.length - 1];
    asrt.ok(last >= 1 && last <= 33, "末帧步数应在 1..33（遇到 done 提前收尾），实际=" + last);
  });

  it("默认 80ms → 每次回调 1 步、帧间隔 ∈ {4,5}；setSpeed 夹取 [0.5,400] 且忽略 NaN", () => {
    const byDefault = measurePerFrame(null);
    asrt.deepEqual(byDefault.deltas.filter((d) => d !== 1), [], "默认 80ms 时每次回调应恰 1 步");
    const badGaps = byDefault.gaps.filter((g) => g !== 4 && g !== 5);
    asrt.deepEqual(
      badGaps,
      [],
      "默认 80ms 的帧间隔应 ∈ {4,5}（80/16.7≈4.79），异常间隔=" + JSON.stringify(badGaps.slice(0, 5))
    );

    const tooFast = measurePerFrame((p) => p.setSpeed(10000));
    asrt.deepEqual(tooFast.deltas.filter((d) => d !== 1), [], "setSpeed(10000) 应夹取到 400（每次回调 1 步）");
    asrt.deepEqual(
      tooFast.gaps.filter((g) => g !== 23 && g !== 24),
      [],
      "setSpeed(10000) 夹取到 400 后帧间隔应 ∈ {23,24}，异常=" + JSON.stringify(tooFast.gaps.filter((g) => g !== 23 && g !== 24).slice(0, 5))
    );

    const tooSlow = measurePerFrame((p) => p.setSpeed(0.01));
    asrt.equal(tooSlow.deltas[0], 1, "setSpeed(0.01) 首帧应为 1 步，实际=" + tooSlow.deltas[0]);
    asrt.equal(tooSlow.deltas[1], 33, "setSpeed(0.01) 应夹取到 0.5（第 2 帧 33 步），实际=" + tooSlow.deltas[1]);

    const withNaN = measurePerFrame((p) => {
      p.setSpeed(0.5);
      p.setSpeed(NaN);
    });
    asrt.equal(withNaN.deltas[0], 1, "setSpeed(NaN) 后首帧仍应为 1 步，实际=" + withNaN.deltas[0]);
    asrt.equal(withNaN.deltas[1], 33, "setSpeed(NaN) 应被忽略并保留 0.5（第 2 帧 33 步），实际=" + withNaN.deltas[1]);
  });

  it("速度真的分档：400ms 档与 80ms 档的步进速率比约 5（±0.5）", () => {
    const sample = (interval) => {
      const { fake, log, player } = setupPlayer();
      player.setSpeed(interval);
      player.load(syntheticSteps(5000), SYNTH_INITIAL);
      player.play();
      fake.pump(1000);
      const advanced = log.frames.length > 0 ? log.frames[log.frames.length - 1].stepIndex + 1 : 0;
      const ms = fake.clock();
      return { advanced, ms, rate: advanced / ms };
    };

    const slow = sample(400);
    const fast = sample(80);
    asrt.ok(slow.advanced > 0, "400ms 档应至少推进若干步，实际=" + slow.advanced);
    asrt.ok(
      fast.advanced > slow.advanced,
      "80ms 档应比 400ms 档推进更多步：" + fast.advanced + " vs " + slow.advanced
    );

    const ratio = fast.rate / slow.rate;
    observed.speedRatio = ratio;
    observed.slowAdvanced = slow.advanced;
    observed.fastAdvanced = fast.advanced;
    observed.simMs = slow.ms;
    asrt.ok(
      ratio >= 4.5 && ratio <= 5.5,
      "80ms 与 400ms 的步进速率比应约 5（±0.5），实测=" +
        ratio.toFixed(3) +
        "（400ms 档 " +
        slow.advanced +
        " 步 / " +
        slow.ms.toFixed(0) +
        "ms；80ms 档 " +
        fast.advanced +
        " 步 / " +
        fast.ms.toFixed(0) +
        "ms）"
    );
  });

  it("counting · write 语义：writes === n，且 write 下标就是真实回填位置", () => {
    const rng = makeRng(0xc0ffee);
    const input = Array.from({ length: 25 }, () => rng.int(30, 60)); // 值域窄，必然含重复值
    const steps = byId("counting").sort(input);
    const sorted = input.slice().sort((x, y) => x - y);
    const writes = steps.filter((s) => s.op === "write");

    observed.countingWrites = writes.length;
    asrt.equal(writes.length, 25, "counting(n=25) 应只产生 n=25 个 write，实际=" + writes.length);
    asrt.equal(new Set(writes.map((w) => w.index)).size, 25, "每个下标应恰好被写一次（真实回填位置）");
    for (const w of writes) {
      asrt.equal(
        w.value,
        sorted[w.index],
        "write(index=" + w.index + ") 的值应等于最终有序数组中该下标的值 " + sorted[w.index] + "，实际=" + w.value
      );
    }
    asrt.deepEqual(replay(steps, input).array, sorted, "回放后应得到有序数组");

    const env = setupPlayer();
    env.player.setSpeed(0.5);
    env.player.load(steps, input);
    env.player.play();
    env.fake.drain(500);
    asrt.equal(env.log.finishes.length, 1, "counting 应能跑完并触发 onFinish，实际=" + env.log.finishes.length);
    observed.countingPlayerWrites = env.log.finishes[0].writes;
    asrt.equal(env.log.finishes[0].writes, 25, "onFinish.writes 应等于 n=25（不再虚高），实际=" + env.log.finishes[0].writes);
    asrt.deepEqual(env.log.finishes[0].array, sorted, "onFinish.array 应为有序数组");
  });

  it("stop 之后泵 10 帧，onFrame 触发 0 次", () => {
    for (const cancelMode of ["drop", "noop"]) {
      const { fake, log, player } = setupPlayer({ cancelMode });
      player.setSpeed(0.5); // 快档：保证 stop 之前确实推进过步骤
      player.load(syntheticSteps(), SYNTH_INITIAL);
      player.play();
      fake.pump(3);
      const before = log.frames.length;
      const idxBefore = log.frames[log.frames.length - 1].stepIndex;
      asrt.equal(before, 3, "cancelMode=" + cancelMode + "：stop 前应已触发 3 帧");
      asrt.ok(idxBefore > 0, "cancelMode=" + cancelMode + "：stop 前 stepIndex 必须已前进，实际=" + idxBefore);

      player.stop();
      asrt.equal(player.getStatus(), "stopped", "stop 后状态应为 stopped");
      fake.pump(10);

      asrt.equal(log.frames.length, before, "cancelMode=" + cancelMode + "：stop 后不得再触发 onFrame");
      asrt.equal(
        log.frames[log.frames.length - 1].stepIndex,
        idxBefore,
        "cancelMode=" + cancelMode + "：stop 后 stepIndex 不得前进"
      );
      asrt.equal(log.finishes.length, 0, "cancelMode=" + cancelMode + "：stop 后不得触发 onFinish");
      asrt.equal(log.errors.length, 0, "cancelMode=" + cancelMode + "：stop 后不得报错");
    }
  });

  it("pause 后不再触发 onFrame，resume 后继续且 stepIndex 前进", () => {
    const { fake, log, player } = setupPlayer();
    player.setSpeed(0.5);
    player.load(syntheticSteps(), SYNTH_INITIAL);
    player.play();
    fake.pump(3);

    const countBeforePause = log.frames.length;
    const idxBeforePause = log.frames[log.frames.length - 1].stepIndex;
    asrt.equal(countBeforePause, 3, "pause 前应已触发 3 帧");
    player.pause();
    asrt.equal(player.getStatus(), "paused", "pause 后状态应为 paused");
    fake.pump(5);
    asrt.equal(log.frames.length, countBeforePause, "pause 后不得再触发 onFrame");
    asrt.equal(log.frames[log.frames.length - 1].stepIndex, idxBeforePause, "pause 后 stepIndex 不得前进");

    player.resume();
    asrt.equal(player.getStatus(), "playing", "resume 后状态应为 playing");
    fake.pump(3);
    asrt.ok(log.frames.length > countBeforePause, "resume 后应继续触发 onFrame（首帧即响应）");
    const idxAfterResume = log.frames[log.frames.length - 1].stepIndex;
    asrt.ok(
      idxAfterResume > idxBeforePause,
      "resume 后 stepIndex 必须前进，实际 " + idxBeforePause + " -> " + idxAfterResume
    );
    asrt.equal(log.errors.length, 0, "pause/resume 不得触发 onError");
  });

  it("越界步骤被跳过：不抛错、不计数、不报错", () => {
    const initial = [3, 1, 2];
    const steps = [
      { op: "compare", a: 0, b: 1, line: 0 },
      { op: "compare", a: 0, b: 99, line: 0 },
      { op: "swap", a: -1, b: 0, line: 0 },
      { op: "write", index: 99, value: 123, line: 0 },
      { op: "mark", index: 42, line: 0 },
      { op: "swap", a: 1, b: 2, line: 0 },
      { op: "done", line: 0 },
    ];
    const { fake, log, player } = setupPlayer();
    player.setSpeed(0.5); // 快档：越界步骤不得让播放停滞
    player.load(steps, initial);
    player.play();
    fake.drain(100);

    asrt.equal(log.errors.length, 0, "越界步骤不得触发 onError：" + JSON.stringify(log.errors.map(String)));
    asrt.equal(log.finishes.length, 1, "越界步骤不得阻断播放，onFinish 应触发一次");
    const r = log.finishes[0];
    asrt.equal(r.comparisons, 1, "越界 compare 不得计数，实际 comparisons=" + r.comparisons);
    asrt.equal(r.swaps, 1, "越界 swap 不得计数，实际 swaps=" + r.swaps);
    asrt.equal(r.writes, 0, "越界 write 不得计数，实际 writes=" + r.writes);
    asrt.deepEqual(r.array, [3, 2, 1], "只有合法 swap(1,2) 生效，实际=" + fmtArray(r.array));
  });

  it("destroy 后泵帧不再触发任何回调", () => {
    const { fake, log, player } = setupPlayer();
    player.setSpeed(0.5);
    player.load(syntheticSteps(), SYNTH_INITIAL);
    player.play();
    fake.pump(2);
    const frames = log.frames.length;
    const finishes = log.finishes.length;
    asrt.equal(frames, 2, "destroy 前应已触发 2 帧");

    player.destroy();
    asrt.equal(player.getStatus(), "stopped", "destroy 后状态应为 stopped");
    fake.pump(10);
    asrt.equal(log.frames.length, frames, "destroy 后不得触发 onFrame");
    asrt.equal(log.finishes.length, finishes, "destroy 后不得触发 onFinish");
    asrt.equal(log.errors.length, 0, "destroy 后不得报错");
  });
});

/* ======================= 汇总 ======================= */

after(() => {
  console.log(
    "[测试汇总] 算法=" +
      ALGORITHMS.length +
      " 个；每个算法随机用例=" +
      RANDOM_CASES +
      " 组；确定性额外用例=" +
      DETERMINISM_CASES +
      " 组/算法；断言总数=" +
      counters.assertions +
      "；速率比(80ms/400ms)=" +
      (typeof observed.speedRatio === "number" ? observed.speedRatio.toFixed(3) : "n/a") +
      "（400ms 档 " +
      observed.slowAdvanced +
      " 步 / " +
      observed.simMs.toFixed(0) +
      "ms，80ms 档 " +
      observed.fastAdvanced +
      " 步）；counting writes=" +
      observed.countingWrites +
      "（播放器统计=" +
      observed.countingPlayerWrites +
      "）"
  );
});
