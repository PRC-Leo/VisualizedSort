// 交互装配层：把页面 DOM、算法注册表、播放器与各渲染模块接到一起。
import { ALGORITHMS, byId } from "./algorithms/index.js";
import { ARRAY_TYPES, generateArray } from "./arrayGen.js";
import { createPlayer } from "./player.js";
import { renderPseudocode, setActiveLine } from "./pseudocode.js";
import { renderComplexity } from "./complexity.js";
import { createGuide } from "./guide.js";

// 唯一的配置入口：服务端把项目根目录的 config.json 挂在 /config.json 上
const CONFIG_URL = "/config.json";

// 与 config.json 同构的兜底值：配置读不到时页面仍然可用
const DEFAULT_CONFIG = {
  array: {
    minLength: 10,
    maxLength: 100,
    defaultLength: 25,
    minValue: 30,
    maxValue: 500,
    defaultType: "random",
    almostSortedRatio: 0.15,
  },
  playback: {
    frameMs: 16.7,
    defaultIntervalMs: 80,
    minIntervalMs: 0.5,
    maxIntervalMs: 400,
    backlogSteps: 4,
    speedSlider: { min: 1, max: 100, default: 55, slowestMs: 400, fastestMs: 0.5, curve: 2 },
  },
  display: { denseThreshold: 30, compactBarWidth: 18 },
  ui: { defaultAlgorithm: "bubble", guideAutoOpen: true, guideStorageKey: "sortsimple-zh-guide-seen" },
};

let CFG = structuredClone(DEFAULT_CONFIG);

function mergeConfig(raw) {
  const base = structuredClone(DEFAULT_CONFIG);
  if (!raw || typeof raw !== "object") return base;
  for (const section of ["array", "playback", "display", "ui"]) {
    if (raw[section] && typeof raw[section] === "object") {
      base[section] = { ...base[section], ...raw[section] };
    }
  }
  base.playback.speedSlider = {
    ...DEFAULT_CONFIG.playback.speedSlider,
    ...(raw.playback && raw.playback.speedSlider ? raw.playback.speedSlider : {}),
  };
  return base;
}

async function loadConfig() {
  try {
    const response = await fetch(CONFIG_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return mergeConfig(await response.json());
  } catch (error) {
    console.warn("读取 config.json 失败，改用内置默认配置：", error);
    return structuredClone(DEFAULT_CONFIG);
  }
}

const BAR_CLASS = {
  idle: "bar bar--idle",
  compare: "bar bar--compare",
  swap: "bar bar--swap",
  write: "bar bar--write",
  mark: "bar bar--mark",
};

const LEGEND_ITEMS = [
  { kind: "idle", label: "待排序" },
  { kind: "compare", label: "正在比较" },
  { kind: "swap", label: "正在交换" },
  { kind: "write", label: "正在写入" },
  { kind: "mark", label: "已就位" },
];

const $ = (id) => document.getElementById(id);

const el = {
  algorithmSelect: $("algorithm-select"),
  arrayType: $("array-type"),
  btnGenerate: $("btn-generate"),
  btnSort: $("btn-sort"),
  btnStop: $("btn-stop"),
  sizeRange: $("size-range"),
  sizeValue: $("size-value"),
  speedRange: $("speed-range"),
  speedValue: $("speed-value"),
  statComparisons: $("stat-comparisons"),
  statSwaps: $("stat-swaps"),
  statusText: $("status-text"),
  arrayContainer: $("array-container"),
  legend: $("legend"),
  pseudocodeTitle: $("pseudocode-title"),
  pseudocodeList: $("pseudocode-list"),
  complexityBody: $("complexity-body"),
  btnGuide: $("btn-guide"),
  guideModal: $("guide-modal"),
  guideBody: $("guide-body"),
  guideDots: $("guide-dots"),
  guidePrev: $("guide-prev"),
  guideNext: $("guide-next"),
  guideSkip: $("guide-skip"),
  guideClose: $("guide-close"),
};

const state = {
  size: 25,
  type: "random",
  algorithmId: "bubble",
  speed: 55,
  array: [],
  bars: [],
  running: false,
  player: null,
  prefix: null,
  lastArray: [],
  sizeRaf: 0,
  guide: null,
};

// ---------- 通用小工具 ----------

function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

function setDisabled(node, disabled) {
  if (node && "disabled" in node) node.disabled = Boolean(disabled);
}

function addListener(target, type, handler) {
  if (!target || typeof target.addEventListener !== "function") return;
  target.addEventListener(type, () => {
    try {
      handler();
    } catch (error) {
      showError(error);
    }
  });
}

function messageOf(error) {
  if (error && typeof error.message === "string" && error.message) return error.message;
  return String(error);
}

function clampSize(value) {
  const a = CFG.array;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return a.defaultLength;
  return Math.min(a.maxLength, Math.max(a.minLength, Math.round(numeric)));
}

// 速度 1..100 -> 播放间隔（毫秒），1 最慢、100 最快
function currentInterval() {
  const s = CFG.playback.speedSlider;
  const span = s.max - s.min || 1;
  const normalized = Math.min(1, Math.max(0, (state.speed - s.min) / span));
  const interval = s.fastestMs + (s.slowestMs - s.fastestMs) * (1 - normalized) ** s.curve;
  return Math.round(interval * 10) / 10;
}

// ---------- 状态条 / 统计 / 控件 ----------

function setStatus(text, mode) {
  const node = el.statusText;
  if (!node) return;
  node.textContent = text;
  node.classList.remove("is-running", "is-done", "is-error");
  if (mode === "running" || mode === "done" || mode === "error") {
    node.classList.add("is-" + mode);
  }
}

function setStats(comparisons, swaps) {
  setText(el.statComparisons, String(comparisons));
  setText(el.statSwaps, String(swaps));
}

function resetStats() {
  setStats(0, 0);
}

function setRunning(running) {
  state.running = running;
  setDisabled(el.btnGenerate, running);
  setDisabled(el.sizeRange, running);
  setDisabled(el.arrayType, running);
  setDisabled(el.algorithmSelect, running);
  setDisabled(el.btnSort, running);
  setDisabled(el.btnStop, !running);
}

// ---------- 条形图 ----------

function rebuildBars(length) {
  const container = el.arrayContainer;
  if (!container) return;
  const fragment = document.createDocumentFragment();
  const bars = [];
  for (let i = 0; i < length; i++) {
    const bar = document.createElement("div");
    bar.className = BAR_CLASS.idle;
    bars.push(bar);
    fragment.appendChild(bar);
  }
  container.replaceChildren(fragment);
  container.classList.toggle("is-dense", length > CFG.display.denseThreshold);
  state.bars = bars;
  updateLabelFit();
}

// 柱宽不足 compactBarWidth 时隐藏数字：文本仍写进 DOM，仅通过 is-compact 隐藏显示
function updateLabelFit() {
  const container = el.arrayContainer;
  if (!container) return;
  const count = state.bars.length;
  if (count === 0) return;
  const width = container.getBoundingClientRect().width;
  container.classList.toggle("is-compact", width / count < CFG.display.compactBarWidth);
}

function ensureBars(length) {
  const container = el.arrayContainer;
  if (!container) return;
  if (state.bars.length === length && container.childElementCount === length) return;
  rebuildBars(length);
}

// values：当前数组；highlight：{ indices, kind } 或 null
function paintBars(values, highlight) {
  if (!el.arrayContainer || !Array.isArray(values)) return;
  ensureBars(values.length);
  if (state.bars.length !== values.length) return;

  const dense = values.length > CFG.display.denseThreshold;
  const active = new Set(
    highlight && Array.isArray(highlight.indices) ? highlight.indices : []
  );
  const activeClass = BAR_CLASS[highlight && highlight.kind] || BAR_CLASS.idle;

  for (let i = 0; i < values.length; i++) {
    const bar = state.bars[i];
    const value = Number(values[i]);
    const ratio = Number.isFinite(value) ? Math.min(1, Math.max(0, value / CFG.array.maxValue)) : 0;
    const height = (ratio * 100).toFixed(2) + "%";
    if (bar.style.height !== height) bar.style.height = height;

    const label = dense ? "" : String(values[i]);
    if (bar.textContent !== label) bar.textContent = label;
    const title = String(values[i]);
    if (bar.title !== title) bar.title = title;

    // 每根柱子只挂一个状态类：先写新类名即等于清掉上一帧的高亮类
    const className = active.has(i) ? activeClass : BAR_CLASS.idle;
    if (bar.className !== className) bar.className = className;
  }
}

function paintAllMark(values) {
  if (!el.arrayContainer || !Array.isArray(values)) return;
  ensureBars(values.length);
  if (state.bars.length !== values.length) return;
  const dense = values.length > CFG.display.denseThreshold;
  for (let i = 0; i < values.length; i++) {
    const bar = state.bars[i];
    const value = Number(values[i]);
    const ratio = Number.isFinite(value) ? Math.min(1, Math.max(0, value / CFG.array.maxValue)) : 0;
    const height = (ratio * 100).toFixed(2) + "%";
    if (bar.style.height !== height) bar.style.height = height;
    const label = dense ? "" : String(values[i]);
    if (bar.textContent !== label) bar.textContent = label;
    if (bar.className !== BAR_CLASS.mark) bar.className = BAR_CLASS.mark;
  }
}

// ---------- 下拉框 / 图例 / 面板 ----------

function fillAlgorithmSelect() {
  const select = el.algorithmSelect;
  if (!select) return;
  const fragment = document.createDocumentFragment();
  for (const algorithm of ALGORITHMS) {
    const meta = algorithm && algorithm.meta ? algorithm.meta : null;
    if (!meta || !meta.id) continue;
    const option = document.createElement("option");
    option.value = meta.id;
    option.textContent = meta.en ? meta.zh + "（" + meta.en + "）" : String(meta.zh || meta.id);
    fragment.appendChild(option);
  }
  select.replaceChildren(fragment);

  const preferred = byId(state.algorithmId) || ALGORITHMS[0];
  if (preferred && preferred.meta) state.algorithmId = preferred.meta.id;
  if (state.algorithmId) select.value = state.algorithmId;
  if (select.value) state.algorithmId = select.value;
}

function fillArrayTypeSelect() {
  const select = el.arrayType;
  if (!select) return;
  const fragment = document.createDocumentFragment();
  for (const item of ARRAY_TYPES) {
    if (!item || !item.id) continue;
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.zh || item.id;
    fragment.appendChild(option);
  }
  select.replaceChildren(fragment);
  select.value = "random";
  state.type = select.value || "random";
}

function renderLegend() {
  const legend = el.legend;
  if (!legend) return;
  const fragment = document.createDocumentFragment();
  for (const item of LEGEND_ITEMS) {
    const row = document.createElement("span");
    row.className = "legend-item";
    const swatch = document.createElement("i");
    swatch.className = "legend-swatch legend-swatch--" + item.kind;
    swatch.setAttribute("aria-hidden", "true");
    row.appendChild(swatch);
    row.appendChild(document.createTextNode(item.label));
    fragment.appendChild(row);
  }
  legend.replaceChildren(fragment);
}

function syncAlgorithmPanels() {
  const algorithm = byId(state.algorithmId);
  const meta = algorithm && algorithm.meta ? algorithm.meta : null;
  if (!meta) return;
  renderPseudocode(el.pseudocodeList, meta.pseudocode, -1);
  renderComplexity(el.complexityBody, meta);
  if (el.pseudocodeTitle && meta.zh) {
    setText(el.pseudocodeTitle, "伪代码 · " + meta.zh);
  }
}

// ---------- 数组生成 ----------

function regenerate() {
  if (state.running) return;
  const size = clampSize(el.sizeRange ? el.sizeRange.value : state.size);
  state.size = size;
  if (el.sizeRange) el.sizeRange.value = String(size);
  setText(el.sizeValue, String(size));

  state.array = generateArray(size, state.type, CFG.array);
  state.lastArray = state.array.slice();
  state.prefix = null;
  paintBars(state.array, null);
  setActiveLine(el.pseudocodeList, -1);
  resetStats();
  setStatus("就绪");
}

// ---------- 排序播放 ----------

function buildPrefix(steps) {
  const comparisons = new Int32Array(steps.length + 1);
  const swaps = new Int32Array(steps.length + 1);
  for (let i = 0; i < steps.length; i++) {
    const op = steps[i] && steps[i].op;
    comparisons[i + 1] = comparisons[i] + (op === "compare" ? 1 : 0);
    swaps[i + 1] = swaps[i] + (op === "swap" ? 1 : 0);
  }
  return { comparisons, swaps };
}

function updateLiveStats(stepIndex) {
  const prefix = state.prefix;
  if (!prefix) return;
  const total = prefix.comparisons.length - 1;
  const index = Math.min(total, Math.max(0, Number(stepIndex) + 1));
  setStats(prefix.comparisons[index], prefix.swaps[index]);
}

function handleFrame(frame) {
  if (!frame) return;
  if (Array.isArray(frame.array)) {
    state.lastArray = frame.array.slice();
    paintBars(frame.array, frame.highlight);
  }
  if (Number.isInteger(frame.line)) setActiveLine(el.pseudocodeList, frame.line);
  updateLiveStats(frame.stepIndex);
}

function handleFinish(result) {
  const values = result && Array.isArray(result.array) ? result.array : state.lastArray;
  state.lastArray = values.slice();
  paintAllMark(values);
  if (result) setStats(result.comparisons || 0, result.swaps || 0);
  state.prefix = null;
  setStatus("排序完成", "done");
  setRunning(false);
}

function destroyPlayer() {
  if (!state.player) return;
  try {
    state.player.destroy();
  } catch (error) {
    console.error("播放器销毁失败：", error);
  }
  state.player = null;
}

function showError(error) {
  console.error("排序出错：", error);
  if (state.player) {
    try {
      state.player.stop();
    } catch (stopError) {
      console.error("停止播放器失败：", stopError);
    }
  }
  state.prefix = null;
  setStatus("出错：" + messageOf(error), "error");
  setRunning(false);
}

function startSort() {
  if (state.running) return;
  const algorithm = byId(state.algorithmId) || ALGORITHMS[0];
  if (!algorithm || typeof algorithm.sort !== "function") {
    showError(new Error("当前算法不可用"));
    return;
  }

  destroyPlayer();
  const initial = state.array.slice();
  let steps;
  try {
    steps = algorithm.sort(initial.slice());
  } catch (error) {
    showError(error);
    return;
  }
  if (!Array.isArray(steps)) {
    showError(new TypeError("算法未返回步骤数组"));
    return;
  }

  state.lastArray = initial.slice();
  state.prefix = buildPrefix(steps);
  resetStats();
  setStatus("正在排序（" + (algorithm.meta && algorithm.meta.zh ? algorithm.meta.zh : "排序") + "）", "running");

  const player = createPlayer({
    onFrame: handleFrame,
    onFinish: handleFinish,
    onError: showError,
    config: CFG.playback,
  });
  state.player = player;
  player.load(steps, initial);
  player.setSpeed(currentInterval());
  setRunning(true);
  player.play();
}

function stopSort() {
  const player = state.player;
  if (player) {
    try {
      player.stop();
    } catch (error) {
      console.error("停止播放器失败：", error);
    }
  }
  state.prefix = null;
  setRunning(false);
  if (state.lastArray.length > 0) paintBars(state.lastArray, null);
  setActiveLine(el.pseudocodeList, -1);
  setStatus("已停止");
}

// ---------- 事件处理 ----------

function onSizeInput() {
  const size = clampSize(el.sizeRange ? el.sizeRange.value : state.size);
  setText(el.sizeValue, String(size));
  if (state.running) return;
  if (state.sizeRaf) return;
  state.sizeRaf = requestAnimationFrame(() => {
    state.sizeRaf = 0;
    regenerate();
  });
}

function onArrayTypeChange() {
  if (!el.arrayType) return;
  state.type = el.arrayType.value || "random";
}

function onGenerate() {
  if (state.running) return;
  setStatus("生成中");
  regenerate();
}

function onAlgorithmChange() {
  if (!el.algorithmSelect) return;
  const next = byId(el.algorithmSelect.value);
  if (next && next.meta) state.algorithmId = next.meta.id;
  syncAlgorithmPanels();
  setActiveLine(el.pseudocodeList, -1);
  if (!state.running) {
    resetStats();
    setStatus("就绪");
  }
}

function onSpeedInput() {
  if (!el.speedRange) return;
  const raw = Number(el.speedRange.value);
  const s = CFG.playback.speedSlider;
  state.speed = Number.isFinite(raw) ? Math.min(s.max, Math.max(s.min, Math.round(raw))) : s.default;
  setText(el.speedValue, String(state.speed));
  if (state.player) state.player.setSpeed(currentInterval());
}

// ---------- 引导弹窗 ----------

function hasSeenGuide() {
  try {
    return window.localStorage.getItem(CFG.ui.guideStorageKey) === "1";
  } catch (error) {
    console.warn("读取引导状态失败，按未看过处理：", error);
    return false;
  }
}

function markGuideSeen() {
  try {
    window.localStorage.setItem(CFG.ui.guideStorageKey, "1");
  } catch (error) {
    console.warn("记录引导状态失败：", error);
  }
}

function initGuide() {
  try {
    state.guide = createGuide({
      modal: el.guideModal,
      body: el.guideBody,
      dots: el.guideDots,
      prevBtn: el.guidePrev,
      nextBtn: el.guideNext,
      skipBtn: el.guideSkip,
      closeBtn: el.guideClose,
      onClose: markGuideSeen,
    });
    if (CFG.ui.guideAutoOpen && !hasSeenGuide()) state.guide.open(0);
  } catch (error) {
    console.error("引导弹窗初始化失败：", error);
  }
}

function onGuideClick() {
  try {
    if (!state.guide) initGuide();
    if (state.guide) state.guide.open(0);
  } catch (error) {
    console.error("打开引导失败：", error);
  }
}

// ---------- 启动 ----------

function bindEvents() {
  addListener(el.sizeRange, "input", onSizeInput);
  addListener(el.arrayType, "change", onArrayTypeChange);
  addListener(el.btnGenerate, "click", onGenerate);
  addListener(el.algorithmSelect, "change", onAlgorithmChange);
  addListener(el.btnSort, "click", startSort);
  addListener(el.btnStop, "click", stopSort);
  addListener(el.speedRange, "input", onSpeedInput);
  addListener(el.btnGuide, "click", onGuideClick);
  addListener(globalThis, "resize", updateLabelFit);
}

// 把配置写进控件属性与初始状态（HTML 里的值只作为 JS 未运行时的兜底）
function applyConfig() {
  const a = CFG.array;
  const s = CFG.playback.speedSlider;
  if (el.sizeRange) {
    el.sizeRange.min = String(a.minLength);
    el.sizeRange.max = String(a.maxLength);
    el.sizeRange.value = String(a.defaultLength);
  }
  if (el.speedRange) {
    el.speedRange.min = String(s.min);
    el.speedRange.max = String(s.max);
    el.speedRange.value = String(s.default);
  }
  state.size = clampSize(a.defaultLength);
  state.type = a.defaultType;
  state.speed = s.default;
  state.algorithmId = CFG.ui.defaultAlgorithm;
}

function init() {
  fillAlgorithmSelect();
  fillArrayTypeSelect();
  onSpeedInput();
  regenerate();
  syncAlgorithmPanels();
  renderLegend();
  resetStats();
  setStatus("就绪");
  setRunning(false);
  bindEvents();
  initGuide();
}

async function bootstrap() {
  CFG = await loadConfig();
  applyConfig();
  init();
}

bootstrap().catch((error) => {
  try {
    showError(error);
  } catch {
    console.error(error);
  }
});
