// 算法注册表：数组顺序即下拉框展示顺序。
import bubble from "./bubble.js";
import selection from "./selection.js";
import insertion from "./insertion.js";
import merge from "./merge.js";
import quick from "./quick.js";
import cocktail from "./cocktail.js";
import oddEven from "./oddEven.js";
import counting from "./counting.js";

export const ALGORITHMS = [bubble, selection, insertion, merge, quick, cocktail, oddEven, counting];

export const byId = (id) => ALGORITHMS.find((x) => x.meta.id === id) ?? null;
