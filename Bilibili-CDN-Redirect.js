/*
 * Bilibili CDN Redirect for Apple TV
 * Optimized for Apple TV Cheers App.
 */

// Parse key-value arguments from proxy tools.
function parseArgumentKeyValues() {
  try {
    const raw = $argument || $arguments || "";
    if (!raw) return {};
    if (typeof raw === "object") return raw;

    const dict = {};
    String(raw)
      .split("&")
      .forEach((pair) => {
        if (!pair) return;
        const separatorIndex = pair.indexOf("=");
        const k = separatorIndex >= 0 ? pair.slice(0, separatorIndex) : pair;
        const v = separatorIndex >= 0 ? pair.slice(separatorIndex + 1) : "";
        if (!k) return;
        dict[decodeURIComponent(k.trim())] = decodeURIComponent(
          (v || "").trim(),
        );
      });
    return dict;
  } catch {
    return {};
  }
}

// Simple logger with level filtering.
function createLogger(name, level) {
  const sev = { error: 0, warn: 1, info: 2, debug: 3 };
  const effectiveLevel = String(level || "INFO")
    .trim()
    .toLowerCase();
  const shouldLog = (lvl) => sev[lvl] <= (sev[effectiveLevel] ?? sev.info);

  // Format a single log line.
  const formatMessage = (level, msg) => {
    return `${level} ${name} ${msg}`;
  };

  return {
    error: (msg) => {
      if (shouldLog("error")) console.log(formatMessage("❌", msg));
    },
    warn: (msg) => {
      if (shouldLog("warn")) console.log(formatMessage("⚠️", msg));
    },
    info: (msg) => {
      if (shouldLog("info")) console.log(formatMessage("ℹ️", msg));
    },
    success: (msg) => {
      if (shouldLog("info")) console.log(formatMessage("✅", msg));
    },
    debug: (msg) => {
      if (shouldLog("debug")) console.log(formatMessage("🐞", msg));
    },
    // Always log critical messages.
    force: (msg) => {
      console.log(formatMessage("🔔", msg));
    },
  };
}

function normalizeHost(host, fallbackHost) {
  const candidate = String(host || fallbackHost || "").trim();
  if (!candidate) return fallbackHost;
  return candidate.replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
}

// Precompiled once; the script runs per response.
const URL_RE =
  /^https?:\/\/(\[[^\]]+\]|[^/?#:]+)(?::(\d+))?(\/[^?#]*)?(\?[^#]*)?/i;
const PREFIX_RE = /^https?:\/\/[^/]+\//i;
const SIGNED_RE = /[?&]upsig=/;
const AKAM_QUERY_RE = /[?&](?:os=akam(?:&|$)|hdnts=)/;
const PCDN_QUERY_RE = /[?&](?:os=mcdn(?:&|$)|mcdnid=|xy_usource=)/;
const TF_HOST_RE = /^(?:upos|proxy)-tf-all-/;
const MCDN_HOST_RE = /\.mcdn\.bilivideo\.(?:cn|com)$/;
const PCDN_HOST_RE =
  /\.(?:edge\.mountaintoys\.cn|szbdyd\.com|nexusedgeio\.com|ahdohpiechei\.com)$|^upos-[a-z0-9-]*302|^\d+\.\d+\.\d+\.\d+$|^\[/;
const HK_HOST_RE = /^cn-hk-[a-z0-9-]+\.bilivideo\.com$/;
const BCACHE_HOST_RE = /^cn-[a-z0-9]+-[a-z0-9]+-[a-z0-9-]+\.bilivideo\.com$/;
const UPOS_OV_HOST_RE = /^upos-[a-z0-9]+-mirror[a-z0-9]*ov\.bilivideo\.com$/;
const UPOS_HOST_RE =
  /^upos-[a-z0-9]+-(?:mirror|estg)[a-z0-9]*\.bilivideo\.com$/;

const OVERSEAS_KINDS = new Set(["upos-ov", "akamai", "bcache-hk", "bstar"]);
const MAINLAND_KINDS = new Set([
  "upos",
  "bcache",
  "mcdn",
  "mcdn-resource",
  "pcdn",
]);
const PCDN_KINDS = new Set(["mcdn", "mcdn-resource", "pcdn"]);
const REGULAR_KINDS = new Set(["upos", "upos-ov", "bcache", "bcache-hk"]);
const SKIP_KINDS = new Set(["tf", "live"]);
// Lower rank wins when a stream needs a host-swappable template.
const TEMPLATE_RANK = {
  upos: 0,
  "upos-ov": 2,
  "bcache-hk": 3,
  bcache: 4,
  pcdn: 5,
  mcdn: 6,
  bstar: 7,
  akamai: 8,
  unknown: 9,
};
const MODES = new Map([
  ["all", "all"],
  ["0", "all"],
  ["overseas", "overseas"],
  ["1", "overseas"],
  ["pcdn", "pcdn"],
  ["2", "pcdn"],
]);
const PRIMARY_FIELDS = ["baseUrl", "base_url", "url"];
const BACKUP_FIELDS = ["backupUrl", "backup_url"];

// Order matters: narrow classes before broad host patterns.
function classifyHost(host, port, path, query) {
  if (path.startsWith("/live-bvc/") || host.includes("gotcha")) return "live";
  if (TF_HOST_RE.test(host)) return "tf";
  if (host.includes("bstar")) return "bstar";
  if (host.endsWith(".akamaized.net") || AKAM_QUERY_RE.test(query))
    return "akamai";
  if (path.startsWith("/v1/resource/")) return "mcdn-resource";
  if (MCDN_HOST_RE.test(host))
    return port === "8082" || port === "8000" ? "mcdn-resource" : "mcdn";
  if (
    PCDN_HOST_RE.test(host) ||
    PCDN_QUERY_RE.test(query) ||
    (port && port !== "80" && port !== "443")
  ) {
    return "pcdn";
  }
  if (HK_HOST_RE.test(host)) return "bcache-hk";
  if (BCACHE_HOST_RE.test(host)) return "bcache";
  if (UPOS_OV_HOST_RE.test(host)) return "upos-ov";
  if (UPOS_HOST_RE.test(host)) return "upos";
  return "unknown";
}

function urlsOf(stream) {
  const urls = [];
  for (const field of PRIMARY_FIELDS) {
    if (typeof stream[field] === "string") urls.push(stream[field]);
  }
  for (const field of BACKUP_FIELDS) {
    const list = stream[field];
    if (!Array.isArray(list)) continue;
    for (const url of list) if (typeof url === "string") urls.push(url);
  }
  return urls;
}

function streamsOf(container) {
  const dash = container.dash;
  const streams = Array.isArray(container.durl) ? container.durl.slice() : [];
  if (dash) {
    if (Array.isArray(dash.video)) streams.push(...dash.video);
    if (Array.isArray(dash.audio)) streams.push(...dash.audio);
    if (Array.isArray(dash.dolby?.audio)) streams.push(...dash.dolby.audio);
    if (dash.flac?.audio) streams.push(dash.flac.audio);
  }
  return streams.filter((s) => s && typeof s === "object");
}

function main() {
  const scriptName = "[Bilibili CDN Redirect for Apple TV]";
  const args = parseArgumentKeyValues();
  // Resolve log level.
  let resolvedLevel = (args.log_level || "WARN")
    .toString()
    .trim()
    .toUpperCase();

  // Validate log level.
  if (!["ERROR", "WARN", "INFO", "DEBUG"].includes(resolvedLevel)) {
    resolvedLevel = "WARN";
  }

  // Promote to DEBUG when requested.
  if (args.debug === true || args.debug === "true" || args.debug === "1") {
    resolvedLevel = "DEBUG";
  }
  const logger = createLogger(scriptName, resolvedLevel);

  logger.info(`已启动，日志级别: ${resolvedLevel}`);
  const targetCdn = normalizeHost(args.cdn, "cn-hk-eq-01-09.bilivideo.com");
  const backupTargetCdn = normalizeHost(
    args.cdn_backup,
    "cn-hk-eq-01-13.bilivideo.com",
  );

  const mode =
    MODES.get(
      String(args.mode ?? "all")
        .trim()
        .toLowerCase(),
    ) || "all";
  const primaryPrefix = `https://${targetCdn}/`;
  const backupPrefix = `https://${backupTargetCdn}/`;
  const targetHosts = new Set([
    targetCdn.toLowerCase(),
    backupTargetCdn.toLowerCase(),
  ]);

  // Classify each url once; fields repeat the same urls.
  const inspected = new Map();
  const inspect = (url) => {
    let info = inspected.get(url);
    if (info) return info;
    const m = URL_RE.exec(url);
    if (!m) {
      info = { kind: "unknown", signed: false };
    } else {
      const host = m[1].toLowerCase();
      const query = m[4] || "";
      info = {
        kind: classifyHost(host, m[2] || "", m[3] || "/", query),
        target: targetHosts.has(host),
        signed: SIGNED_RE.test(query),
      };
    }
    inspected.set(url, info);
    return info;
  };

  // Runtime stats.
  const stats = {
    videoStreams: 0,
    audioStreams: 0,
    durlStreams: 0,
    replacedUrls: 0,
    backupUrls: 0,
    promotedUrls: 0,
    filteredRemoved: 0,
  };
  // Selected codec preference.
  let selectedCodecName = null;
  let selectedCodecId = null;

  // Parse response body.
  if (!$response?.body) {
    logger.debug(`终止：响应体无效`);
    return $done({});
  }

  let payload;
  try {
    payload = JSON.parse($response.body);
  } catch (error) {
    logger.error(`JSON 解析失败: ${error}`);
    return $done({ body: $response.body });
  }

  // Validate payload.
  if (payload?.code !== 0) {
    logger.debug(`终止：业务返回码 code=${payload?.code}`);
    return $done({});
  }

  const payloadContainer = payload.data || payload.result;
  if (!payloadContainer) {
    logger.debug(`终止：未找到 data/result 容器`);
    return $done({});
  }
  // pgc v2 nests media under video_info.
  const videoInfo = payloadContainer.video_info;
  const dataContainer =
    videoInfo && (videoInfo.dash || videoInfo.durl)
      ? videoInfo
      : payloadContainer;

  // Decide once per response whether to redirect.
  let overseas = false;
  let mainland = false;
  for (const stream of streamsOf(dataContainer)) {
    for (const url of urlsOf(stream)) {
      const { kind } = inspect(url);
      if (OVERSEAS_KINDS.has(kind)) overseas = true;
      else if (MAINLAND_KINDS.has(kind)) mainland = true;
    }
  }
  const assignment = overseas ? "overseas" : mainland ? "mainland" : "unknown";
  const redirect =
    mode === "all" || (mode === "overseas" && assignment === "overseas");
  logger.info(
    `模式 ${mode}，分配 ${assignment}，${redirect ? "改写到指定节点" : "仅替换 PCDN 主链路"}`,
  );

  // Best signed url whose host can be swapped.
  const templateOf = (urls) => {
    let best = null;
    let bestRank = Infinity;
    for (const url of urls) {
      const { kind, signed } = inspect(url);
      const rank = TEMPLATE_RANK[kind];
      if (!signed || rank === undefined || rank >= bestRank) continue;
      best = url;
      bestRank = rank;
    }
    return best;
  };

  const retarget = (url, prefix, template) => {
    const { kind, signed, target } = inspect(url);
    if (SKIP_KINDS.has(kind)) return url;
    if (kind === "mcdn-resource")
      return template ? template.replace(PREFIX_RE, prefix) : url;
    if (kind === "unknown" && !signed && !target) return url;
    return url.replace(PREFIX_RE, prefix);
  };

  const rewriteStream = (stream) => {
    if (!stream || typeof stream !== "object") return;
    const urls = urlsOf(stream);
    if (urls.length === 0) return;
    const template = templateOf(urls);
    const regularUrls = urls.filter((url) => {
      const { kind, target } = inspect(url);
      return (
        REGULAR_KINDS.has(kind) || (redirect && kind === "unknown" && target)
      );
    });
    const regular =
      (redirect && regularUrls.find((url) => !inspect(url).target)) ||
      regularUrls[0] ||
      null;
    const seen = new Set();

    if (!redirect) {
      // Swap a PCDN primary with its first regular sibling.
      if (!regular) return;
      for (const field of PRIMARY_FIELDS) {
        const original = stream[field];
        if (
          typeof original !== "string" ||
          !PCDN_KINDS.has(inspect(original).kind)
        )
          continue;
        stream[field] = regular;
        for (const list of BACKUP_FIELDS) {
          const i = Array.isArray(stream[list])
            ? stream[list].indexOf(regular)
            : -1;
          if (i >= 0) stream[list][i] = original;
        }
        if (!seen.has(original)) {
          seen.add(original);
          stats.promotedUrls++;
        }
      }
      return;
    }

    for (const field of PRIMARY_FIELDS) {
      const original = stream[field];
      if (typeof original !== "string") continue;
      const next = retarget(original, primaryPrefix, template);
      if (next === original) continue;
      stream[field] = next;
      if (!seen.has(original)) {
        seen.add(original);
        stats.replacedUrls++;
      }
    }
    const primaryChanged = seen.size > 0;
    seen.clear();
    for (const field of BACKUP_FIELDS) {
      const list = stream[field];
      if (!Array.isArray(list)) continue;
      for (let i = 0; i < list.length; i++) {
        const original = list[i];
        if (typeof original !== "string") continue;
        const next = retarget(original, backupPrefix, template);
        if (next === original) continue;
        list[i] = next;
        if (!seen.has(original)) {
          seen.add(original);
          stats.backupUrls++;
        }
      }
    }
    if (!regular || (!primaryChanged && seen.size === 0)) return;
    for (const field of BACKUP_FIELDS) {
      const list = stream[field];
      if (Array.isArray(list) && !list.includes(regular)) list.push(regular);
    }
    for (const field of PRIMARY_FIELDS) {
      if (typeof stream[field] !== "string") continue;
      const backupField = field === "baseUrl" ? "backupUrl" : "backup_url";
      if (!Array.isArray(stream[backupField])) stream[backupField] = [regular];
    }
  };

  // Process DASH streams.
  let codecRegexPattern = null;

  if (dataContainer.dash) {
    const dash = dataContainer.dash;

    // Filter video streams by codec when requested.
    const rawCodecArg = args.codec
      ?.toString()
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim()
      .toUpperCase();
    // AUTO / empty both mean "no codec filtering".
    const codecArg = rawCodecArg === "AUTO" ? "" : rawCodecArg;
    if (codecArg) {
      const codecMap = {
        AVC: { name: "AVC", id: 7, pattern: /^avc1\./i },
        H264: { name: "AVC", id: 7, pattern: /^avc1\./i },
        "H.264": { name: "AVC", id: 7, pattern: /^avc1\./i },
        HEVC: { name: "HEVC", id: 12, pattern: /^(?:hev1|hvc1)\./i },
        H265: { name: "HEVC", id: 12, pattern: /^(?:hev1|hvc1)\./i },
        "H.265": { name: "HEVC", id: 12, pattern: /^(?:hev1|hvc1)\./i },
        AV1: { name: "AV1", id: 13, pattern: /^av01\./i },
      };

      const codec = codecMap[codecArg];
      if (codec) {
        selectedCodecName = codec.name;
        selectedCodecId = codec.id;
        codecRegexPattern = codec.pattern;
      } else {
        logger.warn(
          `未识别的编码参数: '${codecArg}'，可选: AVC/H264、HEVC/H265、AV1`,
        );
      }
    }

    if (dash && Array.isArray(dash.video)) {
      if (selectedCodecId !== null) {
        const kept = [];
        const removed = [];

        // Split matching and non-matching streams.
        dash.video.forEach((stream) => {
          // Keep only streams with a numeric codec ID.
          if (
            stream &&
            typeof stream === "object" &&
            typeof stream.codecid === "number"
          ) {
            if (stream.codecid === selectedCodecId) {
              kept.push(stream);
            } else {
              removed.push(stream);
            }
          } else {
            // Treat malformed streams as removed.
            logger.warn(`检测到无效视频流对象，缺少 codecid`);
            removed.push(stream);
          }
        });

        if (kept.length > 0 && removed.length > 0) {
          // Keep only the selected codec.
          dash.video = kept;
          stats.filteredRemoved = removed.length;
          logger.debug(
            `按编码 ${selectedCodecName} 过滤：保留 ${kept.length}，移除 ${removed.length}`,
          );
          const removedCodecIds = [
            ...new Set(
              removed
                .map((stream) =>
                  stream && typeof stream === "object" ? stream.codecid : null,
                )
                .filter((codecid) => typeof codecid === "number"),
            ),
          ];
          if (removedCodecIds.length > 0) {
            logger.debug(`已移除的 codecid: ${removedCodecIds.join(", ")}`);
          }

          // Sync the selected codec ID.
          if (
            typeof dataContainer.video_codecid === "number" &&
            dataContainer.video_codecid !== selectedCodecId
          ) {
            const oldCodecId = dataContainer.video_codecid;
            dataContainer.video_codecid = selectedCodecId;
            logger.debug(
              `已将 video_codecid: ${oldCodecId} -> ${selectedCodecId} (${selectedCodecName})`,
            );
          }
        } else if (kept.length === 0) {
          logger.debug(`目标编码 ${selectedCodecName} 不可用，跳过筛选`);
        } else if (removed.length === 0) {
          logger.debug(`所有视频流均为 ${selectedCodecName}，无需过滤`);
        }
      }

      stats.videoStreams = dash.video.length;
      dash.video.forEach(rewriteStream);
    }

    if (dash && Array.isArray(dash.audio)) {
      stats.audioStreams = dash.audio.length;
      dash.audio.forEach(rewriteStream);
    }

    const dolbyAudio = dash?.dolby?.audio;
    if (Array.isArray(dolbyAudio)) {
      stats.audioStreams += dolbyAudio.length;
      dolbyAudio.forEach(rewriteStream);
    }

    const flacAudio = dash?.flac?.audio;
    if (flacAudio && typeof flacAudio === "object") {
      stats.audioStreams += 1;
      rewriteStream(flacAudio);
    }

    logger.debug(
      `检测到 DASH：视频 ${stats.videoStreams}，音频 ${stats.audioStreams}`,
    );
  }

  if (Array.isArray(dataContainer.durl)) {
    stats.durlStreams = dataContainer.durl.length;
    dataContainer.durl.forEach(rewriteStream);
    logger.debug(`检测到 durl：${stats.durlStreams} 段`);
  }

  // Update support_formats after codec filtering.
  if (
    codecRegexPattern &&
    stats.filteredRemoved > 0 &&
    dataContainer.support_formats &&
    Array.isArray(dataContainer.support_formats)
  ) {
    let supportFormatsFiltered = 0;
    dataContainer.support_formats.forEach((format) => {
      if (format && Array.isArray(format.codecs)) {
        const originalCount = format.codecs.length;
        // Keep only matching codec labels.
        const filteredCodecs = format.codecs.filter((codec) => {
          if (typeof codec === "string") {
            return codecRegexPattern.test(codec);
          }
          return false;
        });

        // Apply only when at least one codec remains.
        if (filteredCodecs.length > 0) {
          const filteredCount = originalCount - filteredCodecs.length;
          if (filteredCount > 0) {
            format.codecs = filteredCodecs;
            supportFormatsFiltered += filteredCount;
            logger.debug(
              `格式 ${format.display_desc || format.quality}：codecs 保留 ${filteredCodecs.length}，移除 ${filteredCount}`,
            );
          }
        } else {
          // Leave the original list untouched if nothing matches.
          logger.debug(
            `格式 ${format.display_desc || format.quality}：无匹配 codec，保持不变`,
          );
        }
      }
    });

    if (supportFormatsFiltered > 0) {
      stats.filteredRemoved += supportFormatsFiltered;
      logger.debug(
        `support_formats 合计移除 ${supportFormatsFiltered} 个不匹配的 codec`,
      );
    }
  }

  const totalChanges =
    stats.replacedUrls +
    stats.backupUrls +
    stats.promotedUrls +
    stats.filteredRemoved;

  // Mark modified support_formats entries.
  if (
    totalChanges > 0 &&
    dataContainer.support_formats &&
    Array.isArray(dataContainer.support_formats)
  ) {
    let modifiedDescriptions = 0;
    dataContainer.support_formats.forEach((format) => {
      if (format && typeof format.new_description === "string") {
        // Avoid adding the marker twice.
        if (!format.new_description.includes("- 已修改")) {
          format.new_description = format.new_description + " - 已修改";
          modifiedDescriptions++;
        }
      }
    });

    if (modifiedDescriptions > 0) {
      logger.debug(
        `为 ${modifiedDescriptions} 个 support_formats 描述追加 '- 已修改' 标记`,
      );
    }
  }

  // Finalize the response.
  if (totalChanges > 0) {
    const filterMsg =
      stats.filteredRemoved > 0
        ? `，保留编码 ${selectedCodecName}，移除 ${stats.filteredRemoved} 条`
        : "";
    if (redirect) {
      logger.force(
        `已完成：主链路 ${stats.replacedUrls} 条、备用链路 ${stats.backupUrls} 条${filterMsg}，已重定向至 ${targetCdn}`,
      );
    } else {
      logger.force(
        `已完成：模式 ${mode}，保留原节点，${stats.promotedUrls} 条 PCDN 主链路已换成正规节点${filterMsg}`,
      );
    }

    try {
      $done({ body: JSON.stringify(payload) });
    } catch (error) {
      logger.error(`JSON 序列化失败: ${error}`);
      logger.warn(`已回退到原始响应`);
      $done({ body: $response.body });
    }
  } else {
    logger.debug(`无改动：未发现可替换链接`);
    $done({ body: $response.body });
  }
}

try {
  main();
} catch (e) {
  // Fallback error logging.
  console.log(`🚨 致命错误: ${e}`);
  console.log(`📋 堆栈: ${e.stack || "No stack trace"}`);
  console.log(`🔄 脚本因错误终止`);
  if (typeof $done !== "undefined") $done({});
}
