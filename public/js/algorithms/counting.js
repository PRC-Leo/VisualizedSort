// 计数排序：统计每个值出现次数，累加得到位置后从后向前稳定回填。
export const meta = {
  id: "counting",
  zh: "计数排序",
  en: "Counting Sort",
  pseudocode: [
    "扫描数组，找出最小值 min 与最大值 max",
    "创建计数数组 count，长度为 max - min + 1",
    "遍历原数组，统计每个值出现的次数",
    "累加计数，得到每个值在输出数组中的结束位置",
    "从后向前遍历原数组，按计数稳定放入临时输出数组",
    "把输出数组逐位写回原数组",
    "标记全部元素已就位",
    "计数排序结束",
  ],
  complexity: {
    time: { worst: "O(n+k)", average: "O(n+k)", best: "O(n+k)" },
    space: "O(k)",
    inPlace: "否",
    stable: "是",
  },
};

const L_SCAN = 0;
const L_WRITE_BACK = 5;
const L_MARK = 6;
const L_DONE = 7;

export function sort(array) {
  const a = Array.isArray(array) ? array.slice() : [];
  const n = a.length;
  const steps = [];

  if (n === 0) {
    steps.push({ op: "done", line: L_DONE });
    return steps;
  }

  // 找最小值与最大值：两次真实的两两比较，可比高亮
  let minIdx = 0;
  let maxIdx = 0;
  for (let i = 1; i < n; i++) {
    steps.push({ op: "compare", a: i, b: minIdx, line: L_SCAN });
    if (a[i] < a[minIdx]) minIdx = i;
    steps.push({ op: "compare", a: i, b: maxIdx, line: L_SCAN });
    if (a[i] > a[maxIdx]) maxIdx = i;
  }
  const min = Math.floor(a[minIdx]);
  const max = Math.floor(a[maxIdx]);

  // 计数与前缀和都在辅助数组上完成：主数组此时真实未变，故不产生任何步骤
  const count = new Array(max - min + 1).fill(0);
  for (let i = 0; i < n; i++) count[Math.floor(a[i]) - min] += 1;
  for (let i = 1; i < count.length; i++) count[i] += count[i - 1];

  // 逆序回填到临时输出数组，保证相同值的相对顺序不变（稳定）
  const out = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    const slot = Math.floor(a[i]) - min;
    out[--count[slot]] = a[i];
  }

  // 只有这一步真正覆写主数组：下标就是真实写入位置，值就是真实写入值
  for (let i = 0; i < n; i++) {
    a[i] = out[i];
    steps.push({ op: "write", index: i, value: out[i], line: L_WRITE_BACK });
  }

  for (let i = 0; i < n; i++) steps.push({ op: "mark", index: i, line: L_MARK });
  steps.push({ op: "done", line: L_DONE });
  return steps;
}

export default { meta, sort };
