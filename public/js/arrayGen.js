// 待排序数组生成器。默认值与 config.json 的 array 段一致，调用方可整体覆盖。
export const ARRAY_TYPES = [
  { id: "random", zh: "随机" },
  { id: "almost", zh: "基本有序" },
  { id: "asc", zh: "升序" },
  { id: "desc", zh: "降序" },
];

export const DEFAULT_OPTIONS = {
  minLength: 10,
  maxLength: 100,
  defaultLength: 25,
  minValue: 30,
  maxValue: 500,
  almostSortedRatio: 0.15,
};

function resolveOptions(options) {
  const merged = { ...DEFAULT_OPTIONS, ...(options || {}) };
  const minLength = Math.round(Number(merged.minLength)) || DEFAULT_OPTIONS.minLength;
  const maxLength = Math.round(Number(merged.maxLength)) || DEFAULT_OPTIONS.maxLength;
  const minValue = Math.round(Number(merged.minValue));
  const maxValue = Math.round(Number(merged.maxValue));
  const ratio = Number(merged.almostSortedRatio);
  return {
    minLength: Math.min(minLength, maxLength),
    maxLength: Math.max(minLength, maxLength),
    defaultLength: Math.round(Number(merged.defaultLength)) || DEFAULT_OPTIONS.defaultLength,
    minValue: Number.isFinite(minValue) ? minValue : DEFAULT_OPTIONS.minValue,
    maxValue: Number.isFinite(maxValue) ? maxValue : DEFAULT_OPTIONS.maxValue,
    almostSortedRatio: Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : DEFAULT_OPTIONS.almostSortedRatio,
  };
}

export function clampLength(length, options) {
  const o = resolveOptions(options);
  const v = Math.round(Number(length));
  if (!Number.isFinite(v)) return Math.min(o.maxLength, Math.max(o.minLength, o.defaultLength));
  return Math.min(o.maxLength, Math.max(o.minLength, v));
}

// 独立随机抽样，允许出现重复值（与原站 randomNumber(min, max) 一致）
function randomValues(n, o) {
  const span = o.maxValue - o.minValue + 1;
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = o.minValue + Math.floor(Math.random() * span);
  return out;
}

const ascending = (x, y) => x - y;

export function generateArray(length, type = "random", options) {
  const o = resolveOptions(options);
  const n = clampLength(length, o);
  const values = randomValues(n, o);

  switch (type) {
    case "asc":
      return values.sort(ascending);
    case "desc":
      return values.sort((x, y) => y - x);
    case "almost": {
      const arr = values.sort(ascending);
      const rounds = Math.max(1, Math.round(n * o.almostSortedRatio));
      for (let k = 0; k < rounds; k++) {
        const i = Math.floor(Math.random() * (n - 1));
        const t = arr[i];
        arr[i] = arr[i + 1];
        arr[i + 1] = t;
      }
      return arr;
    }
    default:
      return values;
  }
}
