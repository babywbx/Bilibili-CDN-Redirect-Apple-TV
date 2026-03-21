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

  // Replace only the hostname prefix.
  const prefixRegex = /^https?:\/\/[^/]+\//;
  const primaryReplacementPrefix = `https://${targetCdn}/`;
  const backupReplacementPrefix = `https://${backupTargetCdn}/`;

  // Runtime stats.
  let stats = {
    videoStreams: 0,
    audioStreams: 0,
    replacedUrls: 0,
    backupUrls: 0,
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
    logger.debug(`终止：业务返回码 code=${payload.code}`);
    return $done({});
  }

  const dataContainer = payload.data || payload.result;
  if (!dataContainer) {
    logger.debug(`终止：未找到 data/result 容器`);
    return $done({});
  }

  // Rewrite stream URLs.
  const replaceUrlPrefix = (url, replacementPrefix) => {
    if (typeof url !== "string" || !url.startsWith("http")) return url;
    return url.replace(prefixRegex, replacementPrefix);
  };

  const replaceStreamUrls = (stream) => {
    if (!stream) return;
    const seenPrimaryUrls = new Set();
    const seenBackupUrls = new Set();

    // Rewrite primary URLs.
    ["baseUrl", "base_url"].forEach((field) => {
      if (typeof stream[field] === "string") {
        const originalUrl = stream[field];
        const newUrl = replaceUrlPrefix(originalUrl, primaryReplacementPrefix);
        if (newUrl !== originalUrl) {
          stream[field] = newUrl;
          if (!seenPrimaryUrls.has(originalUrl)) {
            seenPrimaryUrls.add(originalUrl);
            stats.replacedUrls++;
          }
        }
      }
    });

    // Rewrite backup URLs.
    ["backupUrl", "backup_url"].forEach((field) => {
      if (Array.isArray(stream[field])) {
        stream[field].forEach((url, i) => {
          const newUrl = replaceUrlPrefix(url, backupReplacementPrefix);
          if (newUrl !== url) {
            stream[field][i] = newUrl;
            if (!seenBackupUrls.has(url)) {
              seenBackupUrls.add(url);
              stats.backupUrls++;
            }
          }
        });
      }
    });
  };

  // Process DASH streams.
  let codecRegexPattern = null;

  if (dataContainer.dash) {
    const dash = dataContainer.dash;

    // Filter video streams by codec when requested.
    const codecArg = args.codec?.toString().trim().toUpperCase();
    if (codecArg) {
      const codecMap = {
        AVC: { name: "AVC", id: 7, pattern: /^avc1\./i },
        H264: { name: "AVC", id: 7, pattern: /^avc1\./i },
        "H.264": { name: "AVC", id: 7, pattern: /^avc1\./i },
        HEVC: { name: "HEVC", id: 12, pattern: /^hev1\./i },
        H265: { name: "HEVC", id: 12, pattern: /^hev1\./i },
        "H.265": { name: "HEVC", id: 12, pattern: /^hev1\./i },
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
      dash.video.forEach(replaceStreamUrls);
    }

    if (dash && Array.isArray(dash.audio)) {
      stats.audioStreams = dash.audio.length;
      dash.audio.forEach(replaceStreamUrls);
    }

    logger.debug(
      `检测到 DASH：视频 ${stats.videoStreams}，音频 ${stats.audioStreams}`,
    );
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

  // Mark modified support_formats entries.
  if (
    stats.replacedUrls + stats.backupUrls + stats.filteredRemoved > 0 &&
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
  const totalChanges =
    stats.replacedUrls + stats.backupUrls + stats.filteredRemoved;
  if (totalChanges > 0) {
    const filterMsg =
      stats.filteredRemoved > 0
        ? `，保留编码 ${selectedCodecName}，移除 ${stats.filteredRemoved} 条`
        : "";
    logger.force(
      `已完成：主链路 ${stats.replacedUrls} 条、备用链路 ${stats.backupUrls} 条${filterMsg}，已重定向至 ${targetCdn}`,
    );

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
