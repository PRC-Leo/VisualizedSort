// config.json 是唯一的配置来源，这里锁住它的结构与内部一致性。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALGORITHMS } from "../public/js/algorithms/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = readFileSync(path.join(ROOT, "config.json"), "utf8");
const config = JSON.parse(raw);

const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

test("config.json 可以解析且四段齐全", () => {
  for (const key of ["server", "array", "playback", "display", "ui"]) {
    assert.ok(config[key] && typeof config[key] === "object", "缺少 " + key + " 段");
  }
});

test("server 段合法", () => {
  const s = config.server;
  assert.ok(isInt(s.port) && s.port >= 1 && s.port <= 65535, "port 必须是 1..65535 的整数");
  assert.equal(typeof s.staticRoot, "string");
  assert.ok(s.staticRoot.length > 0, "staticRoot 不能为空");
  assert.ok(s.configUrl.startsWith("/"), "configUrl 必须以 / 开头");
});

test("array 段合法且自洽", () => {
  const a = config.array;
  assert.ok(isInt(a.minLength) && isInt(a.maxLength) && a.minLength < a.maxLength);
  assert.ok(a.defaultLength >= a.minLength && a.defaultLength <= a.maxLength);
  assert.ok(isInt(a.minValue) && isInt(a.maxValue) && a.minValue < a.maxValue);
  assert.ok(["random", "almost", "asc", "desc"].includes(a.defaultType), "defaultType 必须是已知分布");
  assert.ok(isNum(a.almostSortedRatio) && a.almostSortedRatio >= 0 && a.almostSortedRatio <= 1);
});

test("playback 段合法且自洽", () => {
  const p = config.playback;
  assert.ok(isNum(p.frameMs) && p.frameMs > 0);
  assert.ok(p.minIntervalMs > 0 && p.minIntervalMs < p.defaultIntervalMs && p.defaultIntervalMs < p.maxIntervalMs);
  assert.ok(isInt(p.backlogSteps) && p.backlogSteps >= 1);
  const s = p.speedSlider;
  assert.ok(isInt(s.min) && isInt(s.max) && s.min < s.max);
  assert.ok(s.default >= s.min && s.default <= s.max);
  assert.ok(isNum(s.slowestMs) && isNum(s.fastestMs) && s.fastestMs < s.slowestMs);
  assert.ok(isNum(s.curve) && s.curve > 0);
  // 滑杆两端必须落在播放器允许的区间内，否则 setSpeed 会被夹取
  assert.ok(s.fastestMs >= p.minIntervalMs, "滑杆最快档不能小于 minIntervalMs");
  assert.ok(s.slowestMs <= p.maxIntervalMs, "滑杆最慢档不能大于 maxIntervalMs");
});

test("display 段合法", () => {
  const d = config.display;
  assert.ok(isInt(d.denseThreshold) && d.denseThreshold > 0);
  assert.ok(isNum(d.compactBarWidth) && d.compactBarWidth > 0);
});

test("ui 段引用的算法必须真实存在", () => {
  const u = config.ui;
  assert.ok(ALGORITHMS.some((a) => a.meta.id === u.defaultAlgorithm), "defaultAlgorithm 不在算法注册表里：" + u.defaultAlgorithm);
  assert.equal(typeof u.guideAutoOpen, "boolean");
  assert.ok(typeof u.guideStorageKey === "string" && u.guideStorageKey.length > 0);
});
