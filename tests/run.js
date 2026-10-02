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
const AKAM_SEG = `${SEG}&os=akam&hdnts=exp`;
const url = (host, p = SEG) => `https://${host}${p}`;
const stream = (base, backups, codecid = 7, id = 80) => ({
  id,
  codecid,
  baseUrl: base,
  base_url: base,
  backupUrl: [...backups],
  backup_url: [...backups],
});
const A = "cdn-a.example.com";
const B = "cdn-b.example.com";
const ARGS = `cdn=${A}&cdn_backup=${B}&log_level=ERROR&codec=AUTO&debug=false`;
const withMode = (mode) => `${ARGS}&mode=${mode}`;
const clone = (o) => JSON.parse(JSON.stringify(o));

const MCDN = url("xy1x2x3x4xy.mcdn.bilivideo.cn:8082", MCDN_SEG);
const PCDN = url("b-x.edge.mountaintoys.cn:4483");
const COS = url("upos-sz-mirrorcos.bilivideo.com");
const HW = url("upos-sz-mirrorhw.bilivideo.com");
const ESTG = url("upos-sz-estgoss.bilivideo.com");

const mainland = {
  code: 0,
  data: {
    dash: {
      video: [stream(MCDN, [PCDN, COS], 7, 112), stream(ESTG, [HW], 12, 112)],
      audio: [stream(url("xy5x6x7x8xy.mcdn.bilivideo.cn:8082", MCDN_SEG), [url("upos-sz-mirrorcoso1.bilivideo.com")], 0, 30280)],
      dolby: { type: 1, audio: [stream(COS, [HW], 0, 30250)] },
      flac: { display: true, audio: stream(COS, [HW], 0, 30251) },
    },
    support_formats: [{ quality: 112, new_description: "1080P 高码率", codecs: ["avc1.640032", "hvc1.1.6.L120.90"] }],
    video_codecid: 7,
  },
};

// mode=all (default): everything moves to the chosen nodes.
const out1 = run(mainland, ARGS);
assert.strictEqual(out1.data.dash.video[0].baseUrl, url(A), "mcdn primary rebuilt from the upos sibling, not the pcdn one");
assert.deepStrictEqual(out1.data.dash.video[0].backupUrl, [url(B), url(B), COS], "backups retargeted, original regular url kept last");
assert.deepStrictEqual(out1.data.dash.video[0].backup_url, [url(B), url(B), COS]);
assert.deepStrictEqual(out1.data.dash.video[1].backupUrl, [url(B), ESTG], "fallback is the first regular url of the stream");
assert.strictEqual(out1.data.dash.audio[0].base_url, url(A));
assert.strictEqual(out1.data.dash.dolby.audio[0].baseUrl, url(A));
assert.strictEqual(out1.data.dash.flac.audio.baseUrl, url(A));
assert.strictEqual(out1.data.dash.flac.audio.backupUrl[0], url(B));
assert.strictEqual(out1.data.dash.video.length, 2, "AUTO keeps every codec");
assert.strictEqual(out1.data.support_formats[0].new_description, "1080P 高码率 - 已修改");
assert.deepStrictEqual(run(mainland, withMode(0)), out1, "mode 0 equals all");

// Codec filter.
const out2 = run(mainland, ARGS.replace("codec=AUTO", "codec=HEVC"));
assert.deepStrictEqual(out2.data.dash.video.map((s) => s.codecid), [12]);
assert.deepStrictEqual(out2.data.support_formats[0].codecs, ["hvc1.1.6.L120.90"]);
assert.strictEqual(out2.data.video_codecid, 12);

// mode=overseas on a mainland assignment: no redirect, only pcdn primaries swapped.
for (const mode of ["overseas", "1", "pcdn", "2"]) {
  const out = run(mainland, withMode(mode));
  assert.ok(!JSON.stringify(out).includes(A) && !JSON.stringify(out).includes(B), `${mode}: no target host introduced`);
  assert.strictEqual(out.data.dash.video[0].baseUrl, COS, `${mode}: mcdn primary swapped with the upos sibling`);
  assert.deepStrictEqual(out.data.dash.video[0].backupUrl, [PCDN, MCDN], `${mode}: original primary takes the sibling's slot`);
  assert.deepStrictEqual(out.data.dash.video[1], mainland.data.dash.video[1], `${mode}: regular stream untouched`);
  assert.strictEqual(out.data.support_formats[0].new_description, "1080P 高码率 - 已修改");
}

// Overseas assignment.
const ALIOV = url("upos-sz-mirroraliov.bilivideo.com");
const AKAM = url("upos-hz-mirrorakam.akamaized.net", AKAM_SEG);
const overseas = { code: 0, data: { dash: { video: [stream(ALIOV, [AKAM])], audio: [] } } };
for (const mode of ["all", "overseas", "1"]) {
  const out = run(overseas, withMode(mode));
  assert.strictEqual(out.data.dash.video[0].baseUrl, url(A), `${mode}: overseas primary redirected`);
  assert.deepStrictEqual(out.data.dash.video[0].backupUrl, [url(B, AKAM_SEG), ALIOV], `${mode}: akamai retargeted, aliov kept last`);
}
for (const mode of ["pcdn", "2"]) {
  assert.deepStrictEqual(run(overseas, withMode(mode)), overseas, `${mode}: overseas assignment untouched`);
}

// Unknown mode values fall back to all.
assert.deepStrictEqual(run(mainland, withMode("whatever")), out1);

// durl (non-DASH) responses.
const durl = { code: 0, data: { durl: [{ order: 1, url: url("cn-jxjj-ct-01-02.bilivideo.com", "/upgcxcode/1/2/3/3-1-80.mp4?e=1&upsig=z"), backup_url: [url("upos-sz-mirror14b.bilivideo.com", "/upgcxcode/1/2/3/3-1-80.mp4?e=1&upsig=z")] }] } };
const outDurl = run(durl, ARGS);
assert.strictEqual(outDurl.data.durl[0].url, url(A, "/upgcxcode/1/2/3/3-1-80.mp4?e=1&upsig=z"));
assert.deepStrictEqual(outDurl.data.durl[0].backup_url, [url(B, "/upgcxcode/1/2/3/3-1-80.mp4?e=1&upsig=z"), durl.data.durl[0].url]);

// Skipped classes.
const skipped = {
  code: 0,
  data: {
    dash: {
      video: [
        stream(url(A), [url(B)]),
        stream("https://cn-gotcha01.bilivideo.com/live-bvc/1/x.m4s?upsig=1", []),
        stream("https://example.com/x.m4s", []),
        stream(url("upos-tf-all-js.bilivideo.com"), []),
      ],
      audio: [],
    },
  },
};
assert.deepStrictEqual(run(skipped, ARGS), skipped, "target, live, unsigned unknown and tf urls stay as they are");

// pgc / pugv containers.
const pgcLegacy = { code: 0, result: { dash: { video: [stream(url("cn-jxjj-ct-01-02.bilivideo.com"), [url("upos-sz-mirror14b.bilivideo.com")])], audio: [] } } };
assert.strictEqual(run(pgcLegacy, ARGS).result.dash.video[0].baseUrl, url(A), "pgc result.dash");

const pgcV2 = { code: 0, result: { video_info: { dash: { video: [stream(COS, [])], audio: [] } } } };
assert.strictEqual(run(pgcV2, ARGS).result.video_info.dash.video[0].baseUrl, url(A), "pgc v2 video_info.dash");

assert.strictEqual(run({ code: -404, message: "x" }, ARGS), null, "non-zero code untouched");

const mcdnOnly = { code: 0, data: { dash: { video: [stream(url("xy9x9x9x9xy.mcdn.bilivideo.cn:8082", MCDN_SEG), [], 7, 80)], audio: [] } } };
assert.deepStrictEqual(run(mcdnOnly, ARGS), mcdnOnly, "mcdn without a regular sibling is left untouched");

const loonArgs = { cdn: A, cdn_backup: B, mode: "overseas", codec: "AUTO", log_level: "ERROR", debug: false };
assert.strictEqual(run(clone(overseas), loonArgs).data.dash.video[0].backupUrl[0], url(B, AKAM_SEG), "object-form arguments");

// Review regressions.
const P302 = url("upos-sz-302ppio.bilivideo.com");
const V6 = url("[240e:abcd::1]:4483");
const V6_MCDN = url("[2409:8c54::1]:8082", MCDN_SEG);
const UNKNOWN_SIGNED = url("edge-x.example.net");
const AKAM_BACKUP = AKAM;
const tricky = {
  code: 0,
  data: {
    dash: {
      video: [
        stream(P302, [COS]),
        stream(V6, [COS]),
        stream(V6_MCDN, [AKAM_BACKUP, UNKNOWN_SIGNED, COS]),
        { id: 16, codecid: 7, baseUrl: COS, base_url: COS },
        stream("HTTPS://UPOS-SZ-MIRRORCOS.BILIVIDEO.COM" + SEG, []),
      ],
      audio: [],
    },
  },
};
const outTricky = run(tricky, ARGS);
assert.strictEqual(outTricky.data.dash.video[0].baseUrl, url(A), "302 host is swappable");
assert.strictEqual(outTricky.data.dash.video[1].baseUrl, url(A), "ipv6 pcdn host is swappable");
assert.strictEqual(outTricky.data.dash.video[2].baseUrl, url(A), "ipv6 mcdn resource rebuilt from the upos template");
assert.deepStrictEqual(outTricky.data.dash.video[3].backupUrl, [COS], "fallback list created when no backup field exists");
assert.strictEqual(outTricky.data.dash.video[3].base_url, url(A));
assert.strictEqual(outTricky.data.dash.video[4].baseUrl, url(A), "uppercase scheme and host are rewritten");
const outTrickyPcdn = run(tricky, withMode("pcdn"));
assert.strictEqual(outTrickyPcdn.data.dash.video[0].baseUrl, COS, "302 host counts as pcdn and gets swapped");
assert.deepStrictEqual(outTrickyPcdn.data.dash.video[0].backupUrl, [P302]);
assert.strictEqual(outTrickyPcdn.data.dash.video[1].baseUrl, COS, "ipv6 pcdn swapped");
assert.strictEqual(outTrickyPcdn.data.dash.video[2].baseUrl, COS, "promotion skips akamai and unknown siblings");
assert.deepStrictEqual(outTrickyPcdn.data.dash.video[2].backupUrl, [AKAM_BACKUP, UNKNOWN_SIGNED, V6_MCDN]);
assert.deepStrictEqual(outTrickyPcdn.data.dash.video[3], tricky.data.dash.video[3], "regular primary untouched in pcdn mode");

const durlNoBackup = { code: 0, result: { video_info: { durl: [{ order: 1, url: url("cn-jxjj-ct-01-02.bilivideo.com"), backup_url: null }] } } };
const outDurlNoBackup = run(durlNoBackup, ARGS);
assert.strictEqual(outDurlNoBackup.result.video_info.durl[0].url, url(A), "pgc v2 durl container");
assert.deepStrictEqual(outDurlNoBackup.result.video_info.durl[0].backup_url, [url("cn-jxjj-ct-01-02.bilivideo.com")], "fallback list replaces null backup_url");

assert.deepStrictEqual(run(mainland, withMode("constructor")), out1, "prototype keys are not modes");
assert.deepStrictEqual(run(mainland, withMode("__proto__")), out1);

{
  let output;
  vm.runInNewContext(source, { console: { log() {} }, $argument: ARGS, $response: { body: "null" }, $done: (r) => (output = r) });
  assert.deepStrictEqual(Object.keys(output), [], "null body ends quietly");
}

console.log("all checks passed");
