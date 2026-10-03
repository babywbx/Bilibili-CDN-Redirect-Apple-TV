const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (name) =>
  fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const surge = read("Bilibili-CDN-Redirect.sgmodule");
const loon = read("Bilibili-CDN-Redirect.plugin");
const scriptUrl =
  "https://raw.githubusercontent.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/main/Bilibili-CDN-Redirect.js";
const endpoints = [
  "/x/player/playurl",
  "/x/player/wbi/playurl",
  "/pgc/player/web/playurl",
  "/pgc/player/web/v2/playurl",
  "/pugv/player/web/playurl",
];

for (const [name, config, pattern] of [
  ["Surge", surge, surge.match(/pattern=([^,\n]+)/)[1]],
  ["Loon", loon, loon.match(/^http-response (\S+)/m)[1]],
]) {
  describe(`${name} response script configuration`, () => {
    it("intercepts every supported playback endpoint and excludes unrelated requests", () => {
      const regex = new RegExp(pattern);
      for (const endpoint of endpoints) {
        for (const protocol of ["http", "https"]) {
          assert.ok(
            regex.test(`${protocol}://api.bilibili.com${endpoint}?cid=123`),
            endpoint,
          );
        }
      }
      for (const url of [
        "https://api.bilibili.com/x/player/wbi/v2?cid=123",
        "https://api.bilibili.com/x/web-interface/view?bvid=123",
        "https://example.com/x/player/playurl",
        "https://api.bilibili.com.example.com/x/player/playurl",
      ]) {
        assert.ok(!regex.test(url), url);
      }
    });

    it("loads the shared script with response body access and API decryption", () => {
      const line = config
        .split("\n")
        .find((item) => item.includes("script-path="));
      assert.equal(line.match(/script-path=([^,\s]+)/)[1], scriptUrl);
      assert.match(line, /requires-body=(?:1|true)(?:,|$)/);
      assert.match(
        config,
        /\[MITM\]\s+hostname\s*=\s*(?:%APPEND%\s+)?api\.bilibili\.com\s*$/,
      );
    });
  });
}

it("passes all client arguments to the script using matching names and defaults", () => {
  const surgeDefaults = Object.fromEntries(
    surge
      .match(/^#!arguments=(.+)$/m)[1]
      .split(",")
      .map((pair) => pair.split(":")),
  );
  const surgeArgument = surge
    .match(/,argument=([^,\n]+)/)[1]
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, name) => {
      assert.ok(Object.hasOwn(surgeDefaults, name), name);
      return surgeDefaults[name];
    });
  const expected = {
    cdn: "cn-hk-eq-01-09.bilivideo.com",
    cdn_backup: "cn-hk-eq-01-13.bilivideo.com",
    mode: "all",
    codec: "AUTO",
    log_level: "WARN",
    debug: "false",
  };
  assert.deepEqual(
    Object.fromEntries(new URLSearchParams(surgeArgument)),
    expected,
  );
  const loonDefaults = Object.fromEntries(
    [...loon.matchAll(/^(\w+) = (?:select|switch),"?([^",\n]+)/gm)].map(
      ([, name, value]) => [name, value],
    ),
  );
  const loonArgument = loon.match(/argument=\[([^\]]+)\]/)[1];
  const names = [...loonArgument.matchAll(/\{(\w+)\}/g)].map(
    ([, name]) => name,
  );
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(
    Object.fromEntries(names.map((name) => [name, loonDefaults[name]])),
    expected,
  );
  assert.match(surge, /,debug=\{\{\{debug\}\}\}/);
});
