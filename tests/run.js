const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "..", "Bilibili-CDN-Redirect.js"), "utf8");

function run(body, argument) {
  let output;
  const context = {
    console: { log() {} },
    $argument: argument,
    $response: { body: JSON.stringify(body) },
    $done: (result) => {
      output = result;
    },
  };
  vm.runInNewContext(source, context);
  return output && output.body ? JSON.parse(output.body) : null;
}

const SEG = "/upgcxcode/1/2/3/3-1-30112.m4s?e=1&upsig=x";
const MCDN_SEG = "/v1/resource/upgcxcode/1/2/3/3-1-30112.m4s?e=1&mcdnid=9&upsig=y";
const url = (host, p = SEG) => `https://${host}${p}`;
const stream = (base, backups, codecid = 7, id = 80) => ({
  id,
  codecid,
  baseUrl: base,
  base_url: base,
  backupUrl: [...backups],
  backup_url: [...backups],
});
const ARGS = "cdn=cdn-a.example.com&cdn_backup=cdn-b.example.com&log_level=ERROR&codec=AUTO&debug=false";

const normal = {
  code: 0,
  data: {
    dash: {
      video: [
        stream(url("xy1x2x3x4xy.mcdn.bilivideo.cn:8082", MCDN_SEG), [url("b-x.edge.mountaintoys.cn:4483"), url("upos-sz-mirrorcos.bilivideo.com")], 7, 112),
        stream(url("upos-sz-estgoss.bilivideo.com"), [url("upos-sz-mirrorhw.bilivideo.com")], 12, 112),
      ],
      audio: [stream(url("xy5x6x7x8xy.mcdn.bilivideo.cn:8082", MCDN_SEG), [url("upos-sz-mirrorcoso1.bilivideo.com")], 0, 30280)],
      dolby: { type: 1, audio: [stream(url("upos-sz-mirrorcos.bilivideo.com"), [url("upos-sz-mirrorhw.bilivideo.com")], 0, 30250)] },
      flac: { display: true, audio: stream(url("upos-sz-mirrorcos.bilivideo.com"), [url("upos-sz-mirrorhw.bilivideo.com")], 0, 30251) },
    },
    support_formats: [{ quality: 112, new_description: "1080P 高码率", codecs: ["avc1.640032", "hvc1.1.6.L120.90"] }],
    video_codecid: 7,
  },
};

const out1 = run(normal, ARGS);
assert.strictEqual(out1.data.dash.video[0].baseUrl, url("cdn-a.example.com"), "mcdn primary rebuilt from first non-mcdn backup");
assert.strictEqual(out1.data.dash.video[0].backupUrl[0], url("cdn-b.example.com"));
assert.strictEqual(out1.data.dash.video[0].backup_url[1], url("cdn-b.example.com"));
assert.strictEqual(out1.data.dash.audio[0].base_url, url("cdn-a.example.com"));
assert.strictEqual(out1.data.dash.dolby.audio[0].baseUrl, url("cdn-a.example.com"));
assert.strictEqual(out1.data.dash.flac.audio.baseUrl, url("cdn-a.example.com"));
assert.strictEqual(out1.data.dash.flac.audio.backupUrl[0], url("cdn-b.example.com"));
assert.strictEqual(out1.data.dash.video.length, 2, "AUTO keeps every codec");
assert.strictEqual(out1.data.support_formats[0].new_description, "1080P 高码率 - 已修改");

const out2 = run(normal, ARGS.replace("codec=AUTO", "codec=HEVC"));
assert.deepStrictEqual(out2.data.dash.video.map((s) => s.codecid), [12]);
assert.deepStrictEqual(out2.data.support_formats[0].codecs, ["hvc1.1.6.L120.90"]);
assert.strictEqual(out2.data.video_codecid, 12);

const pgcLegacy = { code: 0, result: { dash: { video: [stream(url("cn-jxjj-ct-01-02.bilivideo.com"), [url("upos-sz-mirror14b.bilivideo.com")])], audio: [] } } };
assert.strictEqual(run(pgcLegacy, ARGS).result.dash.video[0].baseUrl, url("cdn-a.example.com"), "pgc result.dash");

const pgcV2 = { code: 0, result: { video_info: { dash: { video: [stream(url("upos-sz-mirrorcos.bilivideo.com"), [])], audio: [] } } } };
assert.strictEqual(run(pgcV2, ARGS).result.video_info.dash.video[0].baseUrl, url("cdn-a.example.com"), "pgc v2 video_info.dash");

assert.strictEqual(run({ code: -404, message: "x" }, ARGS), null, "non-zero code untouched");

const mcdnOnly = { code: 0, data: { dash: { video: [stream(url("xy9x9x9x9xy.mcdn.bilivideo.cn:8082", MCDN_SEG), [], 7, 80)], audio: [] } } };
assert.strictEqual(run(mcdnOnly, ARGS).data.dash.video[0].baseUrl, url("xy9x9x9x9xy.mcdn.bilivideo.cn:8082", MCDN_SEG), "mcdn without a standard sibling is left untouched");

const loonArgs = { cdn: "cdn-a.example.com", cdn_backup: "cdn-b.example.com", codec: "AUTO", log_level: "ERROR", debug: false };
assert.strictEqual(run(pgcLegacy, loonArgs).result.dash.video[0].backupUrl[0], url("cdn-b.example.com"), "object-form arguments");

console.log("all checks passed");
