<div align="center"><a name="readme-top"></a>

<h1>Bilibili CDN Redirect for Apple TV</h1>

适用于 **Apple TV Cheers App** 的 Surge 模块与响应重写脚本<br/>
将 Bilibili 播放接口返回的媒体地址重定向至指定 CDN

**简体中文** · [English](./README.en.md)

<!-- SHIELD GROUP -->

[![][github-stars-shield]][github-stars-link]
[![][github-forks-shield]][github-forks-link]
[![][github-license-shield]][github-license-link]
[![][github-lastcommit-shield]][github-lastcommit-link]

</div>

<details>
<summary><kbd>目录</kbd></summary>

#### TOC

- [📖 概述](#-概述)
- [✨ 功能概览](#-功能概览)
- [🧭 部署要求](#-部署要求)
- [🚀 安装与配置](#-安装与配置)
- [🔐 HTTPS 解密（MITM）](#-https-解密mitm)
- [📺 Apple TV 证书安装与信任](#-apple-tv-证书安装与信任)
- [⚙️ 参数说明](#️-参数说明)
- [🧩 故障排查](#-故障排查)
- [📚 官方文档](#-官方文档)
- [📝 署名](#-署名)

</details>

## 📖 概述

`Bilibili CDN Redirect` 基于 Surge 的 `http-response` 脚本机制，对 Bilibili 播放接口返回的 JSON 响应进行改写，将 `playurl` / `wbi/v2` 返回的媒体地址重定向到指定 CDN。

该模块主要用于：

- 在 Apple TV Cheers App 场景下优化 B 站播放链路
- 对 DASH 响应中的视频流与音频流地址进行重写
- 按需指定主链路 CDN 与备用链路 CDN
- 按需限制视频编码类型（AVC / HEVC / AV1）

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ✨ 功能概览

- **📡 媒体地址改写** - 支持 Bilibili 常见播放接口响应的媒体地址改写
- **🎬 DASH 结构支持** - 支持 DASH 结构下的视频与音频流处理
- **🔀 CDN 分离配置** - 支持主链路与备用链路分离配置
- **🎞️ 编码偏好筛选** - 支持 AVC / HEVC / AV1 编码偏好
- **📝 日志控制** - 支持日志等级控制与调试开关

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🧭 部署要求

### 1. Surge

- 建议使用最新版本的 **Surge Mac / Surge iOS**
- 建议由 **Surge Mac** 负责 Apple TV 出口流量
- Apple TV 与运行 Surge 的设备应处于同一网络环境

推荐部署拓扑如下：

- Surge 运行于 Mac
- Apple TV Cheers App 通过该 Surge 实例访问外网

> \[!IMPORTANT]
>
> 若 Apple TV 流量未经过 Surge，则模块不会触发。

### 2. Apple TV 证书安装环境

推荐目标平台：

- **Apple TV HD / Apple TV 4K**
- 建议使用 **tvOS 14 或更高版本**

推荐的个人部署方式为：

- 在 Surge 所在设备上本地生成根证书
- 生成仅包含该证书的 `.mobileconfig`
- 通过 Apple TV 的 **Add Profile** 隐藏入口直接导入

> \[!NOTE]
>
> - Apple Configurator 与 MDM 仍然是有效的管理路径，但本文不将其作为个人部署的主安装流程
> - Apple TV (3rd generation) 不作为本文档的推荐目标平台

### 3. 网络可达性

- Apple TV 流量必须实际经过 Surge
- `.sgmodule` 与 `.js` 的托管地址必须可被 Surge 实例访问
- 默认公开分发路径可使用 GitHub Raw
- 本地自托管示例统一使用局域网地址 `192.168.1.100:8000`

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🚀 安装与配置

### 1. 使用 GitHub Raw 安装模块与脚本

推荐直接使用 GitHub Raw 链接进行安装与引用：

```text
https://raw.githubusercontent.com/babywbx/bilibili-cdn-redirect-apple-tv/main/Bilibili-CDN-Redirect.sgmodule
https://raw.githubusercontent.com/babywbx/bilibili-cdn-redirect-apple-tv/main/Bilibili-CDN-Redirect.js
```

对于公开发布场景，这也是最简洁、最稳定的分发方式。

### 2. 修改 `script-path`

如果不使用默认的 GitHub Raw 脚本地址，而是改为本地自托管，请先编辑 [Bilibili-CDN-Redirect.sgmodule](./Bilibili-CDN-Redirect.sgmodule)，将当前脚本地址：

```text
script-path=https://raw.githubusercontent.com/babywbx/bilibili-cdn-redirect-apple-tv/main/Bilibili-CDN-Redirect.js
```

替换为实际可访问的地址，例如：

```text
script-path=http://192.168.1.100:8000/Bilibili-CDN-Redirect.js
```

> \[!TIP]
>
> 若未更新该地址，Surge 可能能够成功安装模块，但无法获取脚本文件。

### 3. 在 Surge 中安装模块

推荐方式为通过 URL 安装 **Installed Module**。

建议步骤如下：

1. 在 Surge 中添加 **Installed Module**
2. 将模块 URL 指向 GitHub Raw 版 `.sgmodule`：

```text
https://raw.githubusercontent.com/babywbx/bilibili-cdn-redirect-apple-tv/main/Bilibili-CDN-Redirect.sgmodule
```

3. 检查并按需调整以下参数：
   - `cdn`
   - `cdnBackup`
   - `codec`
   - `logLevel`
   - `debug`
4. 启用模块

安装完成后，请确认：

- 模块状态为已启用
- Surge 可访问 `script-path`
- `api.bilibili.com` 已包含在 MITM 主机列表中

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔐 HTTPS 解密（MITM）

该模块改写的是 **HTTPS 响应体中的 JSON 数据**。
如果未启用 HTTPS 解密，则 Surge 无法读取响应体内容，脚本亦无法生效。

### 1. 生成 Surge CA 证书

根据 Surge 官方文档：

- Surge 提供 **certificate generator**
- 该功能可在 **Surge Dashboard（Mac）** 与 **Surge iOS Config Editor** 中使用
- 生成后的 CA 证书会保存到 profile 与系统 keychain 中

建议步骤：

1. 通过 Surge 内置证书生成器创建本地 CA
2. 确认 Surge 的 MITM 功能已开启

> \[!WARNING]
>
> - Surge 根证书应由 **每个用户在本地单独生成**
> - 不建议在公开 GitHub 仓库中发布可复用的共享根证书或其私钥
> - 如果后续需要提供便捷安装能力，建议提供 **profile 模板** 或 **本地生成脚本**，而不是共享证书本体

### 2. MITM 主机范围

Surge 官方文档明确说明：

- Surge 仅会解密 `hostname` 列表中声明的主机

本模块已在 [Bilibili-CDN-Redirect.sgmodule](./Bilibili-CDN-Redirect.sgmodule) 中声明：

```ini
[MITM]
hostname = %APPEND% api.bilibili.com
```

### 3. iPhone / iPad / Vision Pro 的手动信任

Apple 官方文档明确说明：

- 手动安装的证书 profile 在 iOS / iPadOS / visionOS 上不会自动获得完整 SSL/TLS 信任
- 需要前往：

```text
Settings > General > About > Certificate Trust Settings
```

手动启用根证书信任。

### 4. MITM 生效的必要条件

以下三项必须同时满足：

- Surge 已启用 MITM
- 目标域名已包含在 MITM 列表中
- 客户端设备已安装并信任对应 CA 证书

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📺 Apple TV 证书安装与信任

Apple TV 的证书部署是整个配置流程中最关键的部分。

### 安装路径说明

本文采用当前 tvOS 上广泛验证的 profile 导入路径：

```text
Settings > General > Privacy / Privacy & Security
→ 高亮 Share Apple TV Analytics 或 Send Apple TV Analytics
→ 按下遥控器 Play/Pause
→ 选择 Add Profile
```

> \[!NOTE]
>
> - Apple 当前公开文档明确说明了配置描述文件可由用户手动安装，也允许通过网站分发 `.mobileconfig`
> - 上述 **Add Profile** 隐藏入口本身并未在 Apple 公共文档中以逐步方式展开说明，但该路径已被 NextDNS、UDID 工具站点及多份 tvOS 社区文档长期验证
> - 因此，本文将其作为 **当前可执行的 tvOS 实践路径** 使用，并保留 Apple 官方文档作为配置描述文件机制的依据

### 步骤 A：导出 Surge 根证书

1. 在运行 Surge 的 Mac 上完成证书生成
2. 打开 **Keychain Access**
3. 找到 Surge 生成的根 CA 证书
4. 选中该证书并执行：
   `File > Export Items`
5. 导出为可用于配置描述文件的证书文件

> \[!TIP]
>
> - 优先导出公钥证书文件，例如 `.cer` / `.crt` / `.der`
> - 无需将私钥导入 Apple TV

### 步骤 B：生成证书型 `.mobileconfig`

Apple TV 的隐藏入口导入的是 **configuration profile**，而不是裸证书文件。
因此，需要先将导出的 Surge 根证书封装为仅包含证书 payload 的 `.mobileconfig`。

本项目已提供两个生成入口，目录位于：

- [tools/apple-tv-profile/build_mobileconfig.py](./tools/apple-tv-profile/build_mobileconfig.py)
- [tools/apple-tv-profile/build-mobileconfig.sh](./tools/apple-tv-profile/build-mobileconfig.sh)

推荐说明：

- `uv` 版是 **跨平台主入口**，适用于 macOS / Linux / Windows
- `sh` 版是 **macOS / Linux** 的便捷入口，内部仍调用同一份 Python 实现

跨平台推荐用法：

```bash
uv run tools/apple-tv-profile/build_mobileconfig.py /path/to/SurgeRootCA.cer
```

如果你不使用 `uv`，也可以直接使用 Python：

```bash
python3 tools/apple-tv-profile/build_mobileconfig.py /path/to/SurgeRootCA.cer
```

Unix 便捷用法：

```bash
./tools/apple-tv-profile/build-mobileconfig.sh /path/to/SurgeRootCA.cer
```

如需指定输出路径：

```bash
uv run tools/apple-tv-profile/build_mobileconfig.py /path/to/SurgeRootCA.cer --output ./Surge-Root-CA.mobileconfig
```

等价的 Python 用法：

```bash
python3 tools/apple-tv-profile/build_mobileconfig.py /path/to/SurgeRootCA.cer --output ./Surge-Root-CA.mobileconfig
```

脚本会自动写入以下默认 branding：

- Profile name: `Babywbx Surge MITM Profile`
- Organization: `Babywbx`
- Certificate name: `Babywbx Surge Root CA`

生成完成后，会得到一个 `.mobileconfig` 文件，可直接用于 Apple TV 的 **Add Profile** 导入流程。

### 步骤 C：托管 `.mobileconfig`

如果证书 profile 为本地生成，推荐通过局域网 HTTP 服务进行分发，例如：

```text
http://<你的局域网IP>:8000/Surge-Root-CA.mobileconfig
```

可以使用以下方式启动一个最简单的局域网文件服务：

```bash
uv run -- python -m http.server 8000 --bind 0.0.0.0
```

如果不使用 `uv`，可直接使用：

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

> \[!IMPORTANT]
>
> - 必须是 **直接文件地址**
> - 不应是带跳转页、分享页或鉴权页面的云盘链接
> - Apple TV 的 Add Profile 入口通常更适合直接访问简短、稳定的 URL

### 步骤 D：在 Apple TV 上导入 Profile

1. 打开 Apple TV 上的 **Settings**
2. 进入：
   `General > Privacy`
   或在较新系统中进入：
   `General > Privacy & Security`
3. 将焦点移动到：
   `Share Apple TV Analytics`
   或：
   `Send Apple TV Analytics`
4. **不要按确认键进入该项**
5. 直接按遥控器上的 **Play/Pause**
6. 在弹出的隐藏菜单中选择 **Add Profile**
7. 输入前一步准备好的 `.mobileconfig` 直接地址
8. 按照屏幕提示完成安装

### 步骤 E：验证部署结果

建议按以下顺序验证：

1. 在 Apple TV 上确认 profile 已完成安装
2. 打开 Cheers App 并实际发起播放
3. 在 Surge 中确认：
   - 模块已命中
   - `http-response` 脚本已执行
   - 请求未以 passthrough 方式直接透传
4. 如果模块命中但仍未看到解密后的响应，请优先检查：
   - 证书是否仅被安装而未获得 SSL/TLS 完全信任
   - Apple TV 流量是否确实经过 Surge
   - 导入的是否为证书型 `.mobileconfig`
   - 输入的是否为直接文件 URL，而非分享页 URL

### 部署建议

如需长期稳定使用，建议采用以下组合：

- Surge Mac
- 本地生成的 Surge 根证书
- 证书型 `.mobileconfig`
- Apple TV 的 Add Profile 导入路径

> \[!WARNING]
>
> - 不建议在公开仓库中提供 **共享的预生成根证书** 或其私钥
> - 该类证书一旦被多人共享，本质上会破坏 MITM 根信任链的私密性
> - 如果后续需要降低安装门槛，更合理的做法是提供：
>   - `.mobileconfig` 模板
>   - 本地生成脚本
>   - 文档化的导出与封装流程
> - 不建议提供一个可直接复用的公共根 CA

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ⚙️ 参数说明

本模块支持以下参数：

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `cdn` | 主链路 CDN 主机名 | `cn-hk-eq-01-09.bilivideo.com` |
| `cdnBackup` | 备用链路 CDN 主机名 | `cn-hk-eq-01-13.bilivideo.com` |
| `codec` | 编码偏好，可留空 | 空 |
| `logLevel` | 日志等级：`ERROR` / `WARN` / `INFO` / `DEBUG` | `WARN` |
| `debug` | 调试开关 | `true` |

参数替换说明：

- Surge 模块参数使用 `%param%` 占位符
- 本模块会将：
  - `%cdn%`
  - `%cdnBackup%`
  - `%logLevel%`
  - `%codec%`
  - `%debug%`
  替换到实际脚本规则中

编码建议：

- `AVC` / `H264` / `H.264`
- `HEVC` / `H265` / `H.265`
- `AV1`

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🧩 故障排查

### 模块已启用，但播放地址未发生变化

优先检查：

- `script-path` 是否可访问
- Apple TV 流量是否经过 Surge
- MITM 是否已启用
- Apple TV 是否已安装并信任 CA 证书

### Surge 中可以看到请求，但脚本无日志

请检查：

- `pattern` 是否命中
- `requires-body=1` 是否仍然存在
- `max-size` 是否设置过小而导致回退直通
- `logLevel` 是否过低

### Apple TV 已安装证书，但未见解密结果

通常意味着以下情况之一：

- 证书已安装，但未获得完整 SSL/TLS 信任
- 安装方式不属于 Apple 官方文档列出的自动信任路径
- 导入的并非证书型 `.mobileconfig`
- 输入的并非直接文件 URL

### Cheers App 播放直接失败

可能原因包括：

- 目标接口发生变化
- 部分请求未落在 `api.bilibili.com`
- App 使用了更严格的证书策略
- 所选 CDN 主机当前不可用

### 为什么不建议使用 `max-size=0`

Surge 官方文档说明：

- `http-request` / `http-response` 脚本需要将完整 body 读入内存
- 超大 body 可能带来额外内存开销

对于 B 站 `playurl` 这类 JSON 响应，一般没有必要使用无限制的 body 大小。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📚 官方文档

### Surge

- [Surge Module 文档](https://manual.nssurge.com/others/module.html)
- [Surge HTTPS Decryption 文档](https://manual.nssurge.com/http-processing/mitm.html)
- [Surge Scripting Basic 文档](https://manual.nssurge.com/scripting/common.html)

### Apple

- [Trust manually installed certificate profiles in iOS, iPadOS, and visionOS](https://support.apple.com/102390)
- [Certificates device management payload settings for Apple devices](https://support.apple.com/guide/deployment/dep91d2eb26/web)
- [Certificates declarative configuration for Apple devices](https://support.apple.com/guide/deployment/depbdaa1115b/web)
- [Import and export keychain items using Keychain Access on Mac](https://support.apple.com/guide/keychain-access/kyca35961/mac)

### 社区补充参考

- [NextDNS 社区：Apple TV profile 安装路径（含 Add Profile 隐藏入口）](https://help.nextdns.io/t/35hncsv/apple-tv-and-profiles-an-easy-install)
- [UDID.in：Apple TV 通过 Add Profile 导入 profile 的说明](https://www.udid.in/find-udid)

> \[!NOTE]
>
> - 本 README 于 **2026-03-21** 依据上述官方资料核对
> - Apple TV 证书安装部分，基于 Apple 官方关于配置描述文件分发的机制说明，并结合当前 tvOS 社区中长期可复现的 Add Profile 实践路径整理
> - 文中命令默认使用 `uv run`；若环境中未使用 `uv`，可替换为等价的 `python3` 命令

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📝 署名

本项目由 **Babywbx** 维护，采用 [MIT License][github-license-link] 发布。

如需分发、改写或引用本项目内容，建议保留以下信息：

- 项目名称：`Bilibili CDN Redirect for Apple TV`
- 作者署名：`Babywbx`
- 许可证声明：`MIT License`
- 相关官方文档引用

<div align="right">

[![][back-to-top]](#readme-top)

</div>

---

#### 📝 License

Copyright © 2026 [Babywbx][github-profile-link]. <br />
This project is [MIT](./LICENSE) licensed.

<!-- LINK GROUP -->

[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-black?style=flat-square
[github-forks-link]: https://github.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/network/members
[github-forks-shield]: https://img.shields.io/github/forks/babywbx/Bilibili-CDN-Redirect-Apple-TV?color=8ae8ff&labelColor=black&style=flat-square
[github-lastcommit-link]: https://github.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/commits/main
[github-lastcommit-shield]: https://img.shields.io/github/last-commit/babywbx/Bilibili-CDN-Redirect-Apple-TV?color=c4f042&labelColor=black&style=flat-square
[github-license-link]: https://github.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/blob/main/LICENSE
[github-license-shield]: https://img.shields.io/github/license/babywbx/Bilibili-CDN-Redirect-Apple-TV?color=white&labelColor=black&style=flat-square
[github-profile-link]: https://github.com/babywbx
[github-stars-link]: https://github.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/stargazers
[github-stars-shield]: https://img.shields.io/github/stars/babywbx/Bilibili-CDN-Redirect-Apple-TV?color=ffcb47&labelColor=black&style=flat-square
