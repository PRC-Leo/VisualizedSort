// 插入排序：把当前元素插入到前面已有序区间的正确位置。
export const meta = {
  id: "insertion",
  zh: "插入排序",
  en: "Insertion Sort",
  pseudocode: [
    "i 从 1 到 n-1，取出待插入值 key = array[i]",
    "j 从 i-1 开始向前扫描已有序区间",
    "比较 array[j] 与待插入值 key",
    "若 array[j] > key，把 array[j] 后移一位",
    "j 左移，直到 j < 0 或 array[j] <= key",
    "把 key 写入 j+1 位置",
    "标记前 i+1 个元素已就位",
    "全部元素就位，排序完成",
  ],
  complexity: {
    time: { worst: "O(n²)", average: "O(n²)", best: "O(n)" },
    space: "O(1)",
    inPlace: "是",
    stable: "是",
  },
};

const L_COMPARE = 2;
const L_WRITE = 3;
const L_INSERT = 5;
const L_MARK = 6;
const L_DONE = 7;

export function sort(array) {
  const a = Array.isArray(array) ? array.slice() : [];
  const n = a.length;
  const steps = [];

  for (let i = 1; i < n; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0) {
      // 相邻对 (j, j+1)：j+1 是待填的空位
      steps.push({ op: "compare", a: j, b: j + 1, line: L_COMPARE });
      if (a[j] <= key) break;
      steps.push({ op: "write", index: j + 1, value: a[j], line: L_WRITE });
      a[j + 1] = a[j];
      j--;
    }
    steps.push({ op: "write", index: j + 1, value: key, line: L_INSERT });
    a[j + 1] = key;
    steps.push({ op: "mark", index: i, line: L_MARK });
  }

  steps.push({ op: "done", line: L_DONE });
  return steps;
}

export default { meta, sort };
