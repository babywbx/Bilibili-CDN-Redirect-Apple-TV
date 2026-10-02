const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SCRIPT_PATH = path.join(__dirname, "..", "Bilibili-CDN-Redirect.js");
const script = new vm.Script(fs.readFileSync(SCRIPT_PATH, "utf8"), {
  filename: "Bilibili-CDN-Redirect.js",
});

function invoke(body, argument) {
  const logs = [];
  let result;
  script.runInNewContext({
    console: { log: (line) => logs.push(String(line)) },
    $argument: argument,
    $response: { body: typeof body === "string" ? body : JSON.stringify(body) },
    $done: (value) => {
      result = value;
    },
  });
  return { result, logs };
}

function run(body, argument) {
  const { result } = invoke(body, argument);
  return result && result.body ? JSON.parse(result.body) : null;
}

const A = "cdn-a.example.com";
const B = "cdn-b.example.com";
const ARGS = `cdn=${A}&cdn_backup=${B}&log_level=ERROR&codec=AUTO&debug=false`;
const withMode = (mode) => `${ARGS}&mode=${mode}`;

const SEG = "/upgcxcode/1/2/3/3-1-30112.m4s?e=1&upsig=x";
const MCDN_SEG =
  "/v1/resource/upgcxcode/1/2/3/3-1-30112.m4s?e=1&mcdnid=9&upsig=y";
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

const MCDN = url("xy1x2x3x4xy.mcdn.bilivideo.cn:8082", MCDN_SEG);
const PCDN = url("b-x.edge.mountaintoys.cn:4483");
const COS = url("upos-sz-mirrorcos.bilivideo.com");
const HW = url("upos-sz-mirrorhw.bilivideo.com");
const ESTG = url("upos-sz-estgoss.bilivideo.com");
const ALIOV = url("upos-sz-mirroraliov.bilivideo.com");
const AKAM = url("upos-hz-mirrorakam.akamaized.net", AKAM_SEG);

const mainland = () => ({
  code: 0,
  data: {
    dash: {
      video: [stream(MCDN, [PCDN, COS], 7, 112), stream(ESTG, [HW], 12, 112)],
      audio: [
        stream(
          url("xy5x6x7x8xy.mcdn.bilivideo.cn:8082", MCDN_SEG),
          [url("upos-sz-mirrorcoso1.bilivideo.com")],
          0,
          30280,
        ),
      ],
      dolby: { type: 1, audio: [stream(COS, [HW], 0, 30250)] },
      flac: { display: true, audio: stream(COS, [HW], 0, 30251) },
    },
    support_formats: [
      {
        quality: 112,
        new_description: "1080P 高码率",
        codecs: ["avc1.640032", "hvc1.1.6.L120.90"],
      },
    ],
    video_codecid: 7,
  },
});

const overseas = () => ({
  code: 0,
  data: { dash: { video: [stream(ALIOV, [AKAM])], audio: [] } },
});

describe("mode all", () => {
  const out = run(mainland(), ARGS);

  it("rebuilds an mcdn primary from the upos sibling rather than the pcdn one", () => {
    assert.equal(out.data.dash.video[0].baseUrl, url(A));
    assert.equal(out.data.dash.video[0].base_url, url(A));
  });

  it("retargets backups and keeps the original regular url last", () => {
    assert.deepEqual(out.data.dash.video[0].backupUrl, [url(B), url(B), COS]);
    assert.deepEqual(out.data.dash.video[0].backup_url, [url(B), url(B), COS]);
    assert.deepEqual(out.data.dash.video[1].backupUrl, [url(B), ESTG]);
  });

  it("covers audio, dolby and flac streams", () => {
    assert.equal(out.data.dash.audio[0].base_url, url(A));
    assert.equal(out.data.dash.dolby.audio[0].baseUrl, url(A));
    assert.equal(out.data.dash.flac.audio.baseUrl, url(A));
    assert.equal(out.data.dash.flac.audio.backupUrl[0], url(B));
  });

  it("keeps every codec and marks the quality descriptions", () => {
    assert.equal(out.data.dash.video.length, 2);
    assert.equal(
      out.data.support_formats[0].new_description,
      "1080P 高码率 - 已修改",
    );
  });

  it("is the default and accepts 0 or unknown values", () => {
    assert.deepEqual(run(mainland(), withMode(0)), out);
    assert.deepEqual(run(mainland(), withMode("whatever")), out);
    assert.deepEqual(run(mainland(), withMode("constructor")), out);
    assert.deepEqual(run(mainland(), withMode("__proto__")), out);
  });

  it("logs the target node", () => {
    const { logs } = invoke(mainland(), ARGS);
    assert.ok(
      logs.some(
        (line) => line.includes("🔔") && line.includes(`已重定向至 ${A}`),
      ),
    );
  });
});

describe("mode overseas and pcdn on a mainland assignment", () => {
  for (const mode of ["overseas", "1", "pcdn", "2"]) {
    it(`mode=${mode} swaps pcdn primaries with a regular sibling and nothing else`, () => {
      const out = run(mainland(), withMode(mode));
      const text = JSON.stringify(out);
      assert.ok(
        !text.includes(A) && !text.includes(B),
        "no target host introduced",
      );
      assert.equal(out.data.dash.video[0].baseUrl, COS);
      assert.deepEqual(out.data.dash.video[0].backupUrl, [PCDN, MCDN]);
      assert.deepEqual(out.data.dash.video[1], mainland().data.dash.video[1]);
      assert.equal(
        out.data.support_formats[0].new_description,
        "1080P 高码率 - 已修改",
      );
    });
  }

  it("logs the mode instead of a target node", () => {
    const { logs } = invoke(mainland(), withMode("pcdn"));
    assert.ok(
      logs.some((line) => line.includes("🔔") && line.includes("模式 pcdn")),
    );
  });
});

describe("overseas assignment", () => {
  for (const mode of ["all", "overseas", "1"]) {
    it(`mode=${mode} redirects and keeps aliov as the fallback`, () => {
      const out = run(overseas(), withMode(mode));
      assert.equal(out.data.dash.video[0].baseUrl, url(A));
      assert.deepEqual(out.data.dash.video[0].backupUrl, [
        url(B, AKAM_SEG),
        ALIOV,
      ]);
    });
  }

  for (const mode of ["pcdn", "2"]) {
    it(`mode=${mode} leaves the response untouched`, () => {
      assert.deepEqual(run(overseas(), withMode(mode)), overseas());
    });
  }
});

describe("codec filter", () => {
  it("keeps only the requested codec and syncs video_codecid and support_formats", () => {
    const out = run(mainland(), ARGS.replace("codec=AUTO", "codec=HEVC"));
    assert.deepEqual(
      out.data.dash.video.map((s) => s.codecid),
      [12],
    );
    assert.deepEqual(out.data.support_formats[0].codecs, ["hvc1.1.6.L120.90"]);
    assert.equal(out.data.video_codecid, 12);
  });
});

describe("containers", () => {
  const MP4 = "/upgcxcode/1/2/3/3-1-80.mp4?e=1&upsig=z";

  it("handles durl responses", () => {
    const body = {
      code: 0,
      data: {
        durl: [
          {
            order: 1,
            url: url("cn-jxjj-ct-01-02.bilivideo.com", MP4),
            backup_url: [url("upos-sz-mirror14b.bilivideo.com", MP4)],
          },
        ],
      },
    };
    const out = run(body, ARGS);
    assert.equal(out.data.durl[0].url, url(A, MP4));
    assert.deepEqual(out.data.durl[0].backup_url, [
      url(B, MP4),
      body.data.durl[0].url,
    ]);
  });

  it("handles pgc result.dash", () => {
    const body = {
      code: 0,
      result: {
        dash: {
          video: [
            stream(url("cn-jxjj-ct-01-02.bilivideo.com"), [
              url("upos-sz-mirror14b.bilivideo.com"),
            ]),
          ],
          audio: [],
        },
      },
    };
    assert.equal(run(body, ARGS).result.dash.video[0].baseUrl, url(A));
  });

  it("handles pgc v2 result.video_info.dash and durl", () => {
    const dash = {
      code: 0,
      result: { video_info: { dash: { video: [stream(COS, [])], audio: [] } } },
    };
    assert.equal(
      run(dash, ARGS).result.video_info.dash.video[0].baseUrl,
      url(A),
    );
    const durl = {
      code: 0,
      result: {
        video_info: {
          durl: [
            {
              order: 1,
              url: url("cn-jxjj-ct-01-02.bilivideo.com"),
              backup_url: null,
            },
          ],
        },
      },
    };
    const out = run(durl, ARGS);
    assert.equal(out.result.video_info.durl[0].url, url(A));
    assert.deepEqual(out.result.video_info.durl[0].backup_url, [
      url("cn-jxjj-ct-01-02.bilivideo.com"),
    ]);
  });

  it("leaves error responses alone", () => {
    assert.equal(run({ code: -404, message: "x" }, ARGS), null);
  });
});

describe("url classes", () => {
  const P302 = url("upos-sz-302ppio.bilivideo.com");
  const V6 = url("[240e:abcd::1]:4483");
  const V6_MCDN = url("[2409:8c54::1]:8082", MCDN_SEG);
  const UNKNOWN_SIGNED = url("edge-x.example.net");
  const tricky = () => ({
    code: 0,
    data: {
      dash: {
        video: [
          stream(P302, [COS]),
          stream(V6, [COS]),
          stream(V6_MCDN, [AKAM, UNKNOWN_SIGNED, COS]),
          { id: 16, codecid: 7, baseUrl: COS, base_url: COS },
          stream(`HTTPS://UPOS-SZ-MIRRORCOS.BILIVIDEO.COM${SEG}`, []),
        ],
        audio: [],
      },
    },
  });

  it("treats 302 hosts, ipv6 hosts and uppercase urls correctly in mode all", () => {
    const out = run(tricky(), ARGS);
    assert.equal(out.data.dash.video[0].baseUrl, url(A));
    assert.equal(out.data.dash.video[1].baseUrl, url(A));
    assert.equal(
      out.data.dash.video[2].baseUrl,
      url(A),
      "ipv6 mcdn resource rebuilt from the upos template",
    );
    assert.equal(out.data.dash.video[4].baseUrl, url(A));
  });

  it("creates a fallback list when the stream has no backup field", () => {
    const out = run(tricky(), ARGS);
    assert.equal(out.data.dash.video[3].base_url, url(A));
    assert.deepEqual(out.data.dash.video[3].backupUrl, [COS]);
  });

  it("promotes only regular siblings in mode pcdn", () => {
    const out = run(tricky(), withMode("pcdn"));
    assert.equal(out.data.dash.video[0].baseUrl, COS);
    assert.deepEqual(out.data.dash.video[0].backupUrl, [P302]);
    assert.equal(out.data.dash.video[1].baseUrl, COS);
    assert.equal(
      out.data.dash.video[2].baseUrl,
      COS,
      "akamai and unknown siblings are skipped",
    );
    assert.deepEqual(out.data.dash.video[2].backupUrl, [
      AKAM,
      UNKNOWN_SIGNED,
      V6_MCDN,
    ]);
    assert.deepEqual(out.data.dash.video[3], tricky().data.dash.video[3]);
  });

  it("skips target, live, tf and unsigned unknown urls", () => {
    const body = {
      code: 0,
      data: {
        dash: {
          video: [
            stream(url(A), [url(B)]),
            stream(
              "https://cn-gotcha01.bilivideo.com/live-bvc/1/x.m4s?upsig=1",
              [],
            ),
            stream("https://example.com/x.m4s", []),
            stream(url("upos-tf-all-js.bilivideo.com"), []),
          ],
          audio: [],
        },
      },
    };
    assert.deepEqual(run(body, ARGS), body);
  });

  it("leaves an mcdn stream without a regular sibling untouched", () => {
    const body = {
      code: 0,
      data: {
        dash: {
          video: [
            stream(
              url("xy9x9x9x9xy.mcdn.bilivideo.cn:8082", MCDN_SEG),
              [],
              7,
              80,
            ),
          ],
          audio: [],
        },
      },
    };
    assert.deepEqual(run(body, ARGS), body);
  });
});

describe("arguments and robustness", () => {
  it("accepts object-form arguments as passed by Loon", () => {
    const args = {
      cdn: A,
      cdn_backup: B,
      mode: "overseas",
      codec: "AUTO",
      log_level: "ERROR",
      debug: false,
    };
    assert.equal(
      run(overseas(), args).data.dash.video[0].backupUrl[0],
      url(B, AKAM_SEG),
    );
  });

  it("ends quietly on a null body", () => {
    const { result, logs } = invoke("null", ARGS);
    assert.deepEqual(Object.keys(result), []);
    assert.ok(!logs.some((line) => line.includes("致命错误")));
  });

  it("returns the original body when it is not json", () => {
    const { result } = invoke("<html>", ARGS);
    assert.equal(result.body, "<html>");
  });
});
