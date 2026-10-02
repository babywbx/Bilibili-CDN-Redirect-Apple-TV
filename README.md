<div align="center"><a name="readme-top"></a>

# Bilibili CDN Redirect for Apple TV

让 Apple TV 上的 Cheers 播放 B 站视频时，自动改走你指定的 CDN 节点。<br/>
以 Surge 模块和 Loon 插件两种形式提供，在 Apple TV 本机的 Surge 或 Loon 里运行，不需要其他设备常开。

**简体中文** · [English](./README.en.md) · [报告问题][github-issues-link]

<!-- SHIELD GROUP -->

[![][github-stars-shield]][github-stars-link]
[![][github-forks-shield]][github-forks-link]
[![][github-issues-shield]][github-issues-link]
[![][github-license-shield]][github-license-link]<br/>
[![][github-contributors-shield]][github-contributors-link]
[![][github-lastcommit-shield]][github-lastcommit-link]

</div>

<details>
<summary><kbd>目录</kbd></summary>

#### TOC

- [✨ 特性](#-特性)
- [🔍 工作原理](#-工作原理)
- [🧭 选择部署方式](#-选择部署方式)
- [📦 准备工作](#-准备工作)
- [🚀 方式一：在 Apple TV 上运行 Surge tvOS](#-方式一在-apple-tv-上运行-surge-tvos)
- [🚀 方式二：在 Apple TV 上运行 Loon tvOS](#-方式二在-apple-tv-上运行-loon-tvos)
- [🖥️ 方式三：用 Mac 上的 Surge 作为网关](#️-方式三用-mac-上的-surge-作为网关)
- [🔐 在 Apple TV 上安装并信任 CA 证书](#-在-apple-tv-上安装并信任-ca-证书)
- [✅ 验证](#-验证)
- [⚙️ 参数说明](#️-参数说明)
- [🛠 故障排查](#-故障排查)
- [❓ FAQ](#-faq)
- [📚 官方文档](#-官方文档)
- [📝 许可证](#-许可证)

####

<br/>

</details>

## ✨ 特性

这个项目解决一个问题：**B 站播放接口按网络环境分配的 CDN 节点，对 Apple TV 来说不一定是最快的。** 它把播放地址改到你指定的节点。

- **📡 媒体地址改写**：覆盖普通视频、番剧、课程的播放接口（`playurl` 系列），改写 DASH 视频流与音频流的地址，杜比和无损音轨一并处理
- **🔀 主备链路分离**：B 站为每条流同时返回主地址和备用地址，两条链路可以指定不同的 CDN 节点
- **🎞️ 编码偏好**：按需只保留 AVC、HEVC 或 AV1 其中一种编码
- **🏷️ 改写标记**：改写成功后，清晰度描述末尾会追加「已修改」字样，如果 Cheers 显示清晰度描述，一眼就能确认是否生效
- **📺 Apple TV 本机运行**：在 iPhone 上配置好，部署到 Apple TV 上的 Surge tvOS 或 Loon tvOS 里运行，不依赖 Mac 常开
- **🧩 两种客户端**：Surge 模块与 Loon 插件共用同一份脚本，改写逻辑一致
- **🔒 全程本地**：改写发生在你自己的设备上，不经过任何第三方服务器

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔍 工作原理

Cheers 播放视频时会请求 `api.bilibili.com` 的播放接口，接口返回的 JSON 里带着媒体文件的完整地址。本项目以代理客户端的 `http-response` 脚本运行，在响应交还给 Cheers 之前完成三件事：

1. 代理客户端对 `api.bilibili.com` 做 HTTPS 解密（MITM），拿到明文响应
2. 脚本把响应里 DASH 视频流、音频流的主链路与备用链路地址的主机名换成你指定的 CDN 节点
3. 改写后的 JSON 交还给 Cheers，之后的媒体请求自然就落到新节点上

B 站接口使用 HTTPS 加密，客户端要读出并修改响应，必须先解密。Apple TV 只有信任客户端自己生成的 CA 证书，才会接受解密后的连接，所以后面需要把这张证书装进 Apple TV。

因此，重定向要生效，下面四个条件缺一不可：

| 条件 | 说明 |
| --- | --- |
| 代理客户端正在运行，并接管了 Apple TV 的流量 | 可以是 Apple TV 本机的 Surge tvOS 或 Loon tvOS，也可以是作为网关的 Surge Mac |
| 模块或插件已启用 | 脚本和需要解密的主机名都由模块或插件声明 |
| 客户端已打开 HTTPS 解密（MITM）总开关 | 模块或插件无法替你打开这个开关 |
| Apple TV 已安装并信任该客户端的 CA 证书 | Apple TV 信任这张证书，才会接受客户端解密后的连接。证书本身不改写任何内容 |

> \[!NOTE]
>
> 「接管流量」不等于「必须有代理节点」。客户端里不需要添加任何代理节点，全部 `DIRECT` 直连也能正常改写。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🧭 选择部署方式

| 方式 | 客户端运行在哪 | 需要准备 | 适合谁 |
| --- | --- | --- | --- |
| **一：Surge tvOS** | Apple TV 本机 | iPhone 或 iPad 上的 Surge，用来部署配置 | 已有 Surge iOS 授权 |
| **二：Loon tvOS** | Apple TV 本机 | iPhone 或 iPad 上的 Loon，用来同步配置 | 已有 Loon 授权，或两个都没有、想选价格更低的 |
| **三：Surge Mac 网关**（备选） | 局域网里的 Mac | 一台常开、有线接入的 Mac，以及 Surge Mac 授权 | Mac 本来就常开，或只想先试一试 |

几点补充：

- Surge tvOS 与 Loon tvOS 和各自的 iOS 版是同一个 App，购买过 iOS 版即可在 Apple TV 上免费使用
- Surge Mac 的授权与 Surge iOS 相互独立，Surge Mac 提供 7 天免费试用
- 无论哪种方式，Apple TV 上都要安装并信任**实际运行的那个客户端**的 CA 证书，换客户端就要换证书

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📦 准备工作

- Apple TV HD 或 Apple TV 4K。方式一、方式二需要 tvOS 17 或更高版本，方式三只要能运行 Cheers（tvOS 16 或更高版本）
- Apple TV 上已安装 [Cheers][cheers-appstore-link]，并关闭 Cheers 设置里的「优化播放链接」。实测开启后课程无法播放，它也可能改掉本模块已经选好的节点
- 方式一、方式二需要一台 iPhone 或 iPad，方式三需要一台 Mac
- 一台电脑（Mac、Windows、Linux 都可以），用来生成证书安装文件并临时提供给 Apple TV 下载，只在安装证书时用一次
- Surge 和 Loon 都没有在中国大陆区 App Store 上架，需要使用其他地区的 Apple ID

> \[!NOTE]
>
> 模块、插件和脚本都托管在 GitHub Raw，客户端需要能访问它。如果你的网络访问 GitHub 不稳定，可以把仓库里的三个文件放到自己的服务器上，并把模块或插件里的 `script-path` 改成你的脚本地址。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🚀 方式一：在 Apple TV 上运行 Surge tvOS

Surge tvOS 不能在本机修改配置或安装模块。配置、模块和证书都在 iPhone 或 iPad 上的 Surge 里准备好，再「部署」到 Apple TV。两台设备需要登录同一个 iCloud 账号。

### 第 1 步：安装 Surge

1. 在 iPhone 或 iPad 上安装 [Surge][surge-appstore-link]，并确认授权已激活
2. 用同一个 Apple ID 在 Apple TV 的 App Store 里安装 Surge，不需要再次购买
3. 在 Apple TV 上打开一次 Surge，完成初始化，之后它才会出现在 iPhone 的部署列表里

### 第 2 步：在 iPhone 上安装模块

1. 打开 Surge，进入「模块」，选择「安装新模块」
2. 粘贴模块地址：

   ```text
   https://raw.githubusercontent.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/main/Bilibili-CDN-Redirect.sgmodule
   ```

3. 安装完成后把模块打开。参数保持默认即可。如需调整，长按模块选择「编辑参数」，各参数的含义见 [⚙️ 参数说明](#️-参数说明)

### 第 3 步：生成 CA 证书并开启 HTTPS 解密

1. 在 Surge 的「HTTPS 解密」设置里选择「生成新的 CA 证书」
2. 打开 HTTPS 解密的总开关。模块已经把 `api.bilibili.com` 加入了解密主机名列表，不需要手动添加
3. 用「将证书导出至 .crt 文件」把证书导出，通过隔空投送或邮件发到电脑上，安装证书时会用到

> \[!TIP]
>
> 证书只需要装进 Apple TV。iPhone 上的 Surge 只用来准备和部署配置，平时不需要启动。如果你也会在 iPhone 上启动这份配置并使用 B 站 App，iPhone 也要安装并信任这张证书。

### 第 4 步：部署到 Apple TV

1. 在 Surge 的「更多」页面找到「Surge tvOS」
2. 选择你的 Apple TV 和当前配置，点「部署」
3. 建议同时打开「在后台自动部署」，之后配置或模块有变化会自动部署到 Apple TV

部署完成后，Apple TV 上的 Surge 会自己下载脚本等外部资源。接下来按 [🔐 在 Apple TV 上安装并信任 CA 证书](#-在-apple-tv-上安装并信任-ca-证书) 把证书装进 Apple TV。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🚀 方式二：在 Apple TV 上运行 Loon tvOS

Loon tvOS 的配置通过 iCloud 从 iPhone 或 iPad 上的 Loon 同步过去，插件和证书都记录在配置文件里，会随配置一起同步。两台设备需要登录同一个 iCloud 账号。

### 第 1 步：安装 Loon

1. 在 iPhone 或 iPad 上安装 [Loon][loon-appstore-link]
2. 用同一个 Apple ID 在 Apple TV 的 App Store 里安装 Loon，购买过 iOS 版即可免费下载
3. 在 iPhone 的 Loon 里打开配置文件的 iCloud 同步

> \[!NOTE]
>
> Apple TV 上的 Loon 只能通过 iCloud 拿到配置。tvOS 还会不定期清理 App 的本地文件，开启同步后 Loon 能自动恢复。

### 第 2 步：在 iPhone 上安装插件

在 iPhone 上打开本页，点下面的链接，会直接唤起 Loon 导入插件：

👉 **[点此一键导入插件][loon-import-link]** 👈

也可以手动添加：进入 Loon 的「配置」页，在「插件」区域点右上角的「+」，粘贴插件地址：

```text
https://raw.githubusercontent.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/main/Bilibili-CDN-Redirect.plugin
```

插件的参数以下拉菜单和开关呈现，点进插件即可调整，含义见 [⚙️ 参数说明](#️-参数说明)。

### 第 3 步：生成 CA 证书并开启 MitM

Loon 的 CA 证书通过官方网页工具生成：

```text
https://nsloon.app/certificate-tool/
```

1. 在 iPhone 的 Safari 里打开上面的地址，选择「生成 MitM CA 证书」
2. 点「一键导入 Loon」，证书会写入当前配置的 `[MitM]` 段
3. 回到 Loon，打开 MitM 开关。插件已经声明了 `api.bilibili.com`，不需要手动添加主机名

> \[!WARNING]
>
> 配置里的 `ca-p12` 包含私钥。不要把配置文件、P12 文件或导入链接分享给别人。

### 第 4 步：同步到 Apple TV

1. 在 iPhone 的「文件」App 里打开 iCloud Drive › Loon › Configs，能看到这份配置，就说明已经上传到 iCloud
2. 在 Apple TV 上打开 Loon，选择这份配置，确认脚本和 MitM 都处于开启状态
3. 启动 Loon

### 第 5 步：导出证书文件

Apple TV 需要的是这个 CA 的公钥证书文件，在电脑上这样取得：

1. 在电脑的浏览器里打开证书工具，切换到「安装现有配置中的证书」
2. 把配置文件 `[MitM]` 段里的 `ca-passphrase` 和 `ca-p12` 两行粘贴进去。Mac 可以在访达的 iCloud Drive › Loon › Configs 里打开配置文件；Windows 或 Linux 在 iPhone 的 Loon 里打开配置，复制这两行发到电脑
3. 点「安装到 iOS 设备」。在电脑上点它只会下载 `loon-ca.crt`，不会安装到任何设备

接下来按 [🔐 在 Apple TV 上安装并信任 CA 证书](#-在-apple-tv-上安装并信任-ca-证书) 把证书装进 Apple TV。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🖥️ 方式三：用 Mac 上的 Surge 作为网关

这种方式让 Apple TV 把 Mac 当作路由器，所有流量先经过 Mac 上的 Surge 再出去。Mac 休眠、关机或 IP 变化都会让 Apple TV 断网，所以只适合 Mac 本来就常开的场景。

### 第 1 步：在 Mac 上安装模块并生成证书

1. 安装 [Surge Mac][surge-mac-link]
2. 进入「模块」，选择「从 URL 安装模块」，粘贴模块地址：

   ```text
   https://raw.githubusercontent.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/main/Bilibili-CDN-Redirect.sgmodule
   ```

3. 进入「HTTPS 解密」，选择「生成新证书」，再点「将证书安装到系统」，第 4 步要从钥匙串里导出它
4. 打开 HTTPS 解密的总开关

### 第 2 步：开启网关模式

1. Mac 用网线接入路由器，并在路由器上为 Mac 固定 IP
2. 在 Surge 概览页的「局域网设备接管」里打开「网关模式」。它依赖「增强模式」，按提示开启即可
3. 在「系统设置」的节能或电池选项里，打开显示器关闭时防止自动进入睡眠的选项，具体名称随 macOS 版本略有不同

### 第 3 步：让 Apple TV 走 Mac

在 Apple TV 的「设置 › 网络」里选中当前的 Wi-Fi 或以太网连接，分两处修改：

1. 把 IP 配置（Configure IP）改为手动（Manual），按下表填写
2. 把 DNS 配置（Configure DNS）改为手动（Manual），填 `198.18.0.2`

| 项目 | 填什么 |
| --- | --- |
| IP 地址（IP Address） | 局域网里一个未被占用的地址，最好在路由器 DHCP 分配范围之外，例如 `192.168.1.250` |
| 子网掩码（Subnet Mask） | 与 Mac 相同，通常是 `255.255.255.0` |
| 路由器（Router） | Mac 的局域网 IP |

> \[!IMPORTANT]
>
> DNS 必须填 `198.18.0.2`，这是 Surge 网关模式专用的地址。不要填 Mac 的 IP 或公共 DNS。

### 第 4 步：导出证书文件

打开「钥匙串访问」，搜索 Surge，找到 Surge 生成的 CA 证书，选择「文件 › 导出项目」，导出为 `.cer` 文件。

接下来按 [🔐 在 Apple TV 上安装并信任 CA 证书](#-在-apple-tv-上安装并信任-ca-证书) 把证书装进 Apple TV。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔐 在 Apple TV 上安装并信任 CA 证书

tvOS 没有浏览器，没法像 iPhone 那样点一下证书文件就安装。需要先把证书转换成描述文件（`.mobileconfig`），在电脑上临时提供下载，再从 Apple TV 的设置里输入地址安装。

三种方式导出的文件分别是：方式一为 Surge 导出的 `.crt`，方式二为 `loon-ca.crt`，方式三为钥匙串导出的 `.cer`。下面的命令以 `~/Downloads/SurgeRootCA.cer` 为例，请换成你自己的文件路径。

> \[!NOTE]
>
> 有 Mac 并且 Apple TV 用网线接入的话，也可以用 Apple Configurator 直接安装描述文件，这是 Apple 官方支持的方式，本文不展开。

### 第 1 步：转换成描述文件

仓库提供了转换脚本，用 [uv][uv-link] 可以直接从 GitHub 运行，不需要下载仓库。没有安装 uv 的话，先按 [uv 安装说明][uv-install-link] 安装：

```bash
uv run https://raw.githubusercontent.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/main/tools/apple-tv-profile/build_mobileconfig.py ~/Downloads/SurgeRootCA.cer
```

不想装 uv 的话，先下载本仓库，在仓库根目录用 Python 3 运行（Windows 把 `python3` 换成 `python`）：

```bash
python3 tools/apple-tv-profile/build_mobileconfig.py ~/Downloads/SurgeRootCA.cer
```

输出文件与证书同名、同目录，例如 `SurgeRootCA.mobileconfig`。描述文件里只有公钥证书，不包含私钥。

### 第 2 步：在局域网里提供下载

先进入描述文件所在的目录（默认与证书同目录）：

```bash
cd ~/Downloads
```

再启动一个临时 HTTP 服务：

```bash
uv run python -m http.server 8000
```

或者：

```bash
python3 -m http.server 8000
```

然后查看电脑的局域网 IP（Mac 在「系统设置 › 网络」里，Windows 运行 `ipconfig`，Linux 运行 `ip addr`），拼出描述文件的直链，例如：

```text
http://192.168.1.100:8000/SurgeRootCA.mobileconfig
```

> \[!IMPORTANT]
>
> 电脑和 Apple TV 必须在同一个局域网里，安装完成前不要关闭这个服务。

### 第 3 步：在 Apple TV 上导入描述文件

这是一个 Apple 没有写进用户手册的隐藏入口：

1. 打开「设置 › 通用 › 隐私与安全性」（tvOS 17 上叫「隐私」）
2. 把焦点移到「共享 Apple TV 分析」上，**不要按确认键进入**
3. 按遥控器上的**播放/暂停键**
4. 在弹出的菜单里选择 Add Profile（中文界面的文案以实际显示为准）
5. 输入第 2 步的直链地址，按屏幕提示完成安装。用 iPhone 上的「Apple TV 遥控器」输入会更方便

> \[!NOTE]
>
> 这个入口只能通过上面的操作打开。它和「设置 › 个人资料和账户」里用于切换用户的「添加个人资料」（英文同为 Add Profile）不是一回事，不要从那里进入。

### 第 4 步：开启完全信任

描述文件装好后证书还处于未信任状态，需要手动开启：

1. 打开「设置 › 通用 › 关于本机 › 证书信任设置」
2. 选中刚安装的证书，按屏幕提示确认，开启完全信任

> \[!TIP]
>
> 之后要删除证书，在「设置 › 通用」页面底部找到描述文件相关的条目即可，具体名称随 tvOS 版本略有不同。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ✅ 验证

打开 Cheers 播放任意视频，然后到客户端里确认脚本已经运行：

- **Surge tvOS**：在 Apple TV 的 Surge 主界面连按三次遥控器的播放键，打开调试菜单查看日志
- **Loon tvOS**：在 Apple TV 的 Loon 里查看请求记录或脚本日志，入口以实际界面为准
- **Surge Mac**：在脚本日志里查看，或打开 `debug` 后在请求列表里找到来自 Apple TV 的 `api.bilibili.com` 请求，查看它的备注

看到一行以 🔔 开头、内容形如「已完成：主链路 N 条、备用链路 M 条，已重定向至 cn-hk-eq-01-09.bilivideo.com」的日志，就说明改写已经生效。随后出现的媒体请求会指向你指定的节点。如果 Cheers 显示清晰度描述，末尾也会带上「已修改」字样。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ⚙️ 参数说明

Surge 模块与 Loon 插件的参数一一对应，只是命名风格不同：

| 参数（Surge / Loon） | 说明 | 默认值 |
| --- | --- | --- |
| `cdn` / `cdn` | 主链路 CDN 主机名 | `cn-hk-eq-01-09.bilivideo.com` |
| `cdnBackup` / `cdn_backup` | 备用链路 CDN 主机名 | `cn-hk-eq-01-13.bilivideo.com` |
| `codec` / `codec` | 编码偏好，`AUTO` 表示不筛选 | `AUTO` |
| `logLevel` / `log_level` | 日志等级：`ERROR`、`WARN`、`INFO`、`DEBUG` | `WARN` |
| `debug` / `debug` | 调试开关，开启后忽略日志等级，一律按 `DEBUG` 输出 | `false` |

`debug` 默认关闭。首次部署排查问题时可以打开，Surge 会把日志写进对应请求的备注里，确认生效后再关掉。

`codec` 可选值：

| 值 | 编码 | 对应 `codecid` |
| --- | --- | --- |
| `AUTO` | 不筛选 | 保留全部 |
| `AVC`（Surge 也接受 `H264`、`H.264`） | H.264 | 7 |
| `HEVC`（Surge 也接受 `H265`、`H.265`） | H.265 | 12 |
| `AV1` | AOMedia Video 1 | 13 |

补充说明：

- Surge 的参数可以填写任意主机名。想换节点，可以用 [BiliCDN][bilicdn-link] 查找当前可用的 B 站 CDN 主机名
- Loon 的参数是下拉菜单，只预置了 `cn-hk-eq-01-09`、`cn-hk-eq-01-12`、`cn-hk-eq-01-13` 三个香港节点，想用其他节点需要修改插件文件后自行托管
- 筛选编码时，如果该视频没有目标编码，脚本会跳过筛选，保持原样

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🛠 故障排查

先对照 [🔍 工作原理](#-工作原理) 里的四个条件逐项检查，绝大多数问题都出在其中一项。

**日志里看不到「已完成」**

- 客户端是否真的在运行并接管了 Apple TV 的流量。方式三要确认 Apple TV 的路由器和 DNS 指向正确
- HTTPS 解密（MITM）总开关是否打开
- Apple TV 上的证书是否已经开启完全信任，而不只是安装；装进去的是不是当前运行的那个客户端的证书
- 脚本是否下载成功。Surge tvOS 会自行下载并缓存脚本，默认一天刷新一次，可以在 iPhone 的 Surge 里通过远程控制对 Apple TV 执行更新外部资源；Loon 在「外部资源」里长按可以单独更新
- 响应体是否超过 Surge 的脚本体积上限（默认 1 MB）。超过时 Surge 不运行脚本，原样返回，并在请求备注里注明。遇到这种情况请[报告问题][github-issues-link]
- Loon 对同一个响应只运行一个响应脚本，命中响应体复写规则时也不运行脚本。如果还装了其他改写 B 站播放接口的插件，先停用它们

**Cheers 无法播放或提示网络错误**

- Apple TV 是否已经信任证书。证书没有信任时，Cheers 会拒绝解密后的连接
- Cheers 设置里的「优化播放链接」是否已关闭
- 把 `codec` 改回 `AUTO`，排除编码筛选的影响
- 换一个 CDN 节点，排除当前节点故障
- 临时停用模块或插件，确认问题是否与改写有关

**Apple TV 无法下载或安装描述文件**

- 输入的是不是能直接下载到文件的地址。网盘的分享页、带登录或跳转的链接通常不行
- 电脑和 Apple TV 是否在同一个局域网里
- 电脑上的 HTTP 服务是否还在运行

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ❓ FAQ

<details>
<summary><kbd>Q: Surge 和 Loon 选哪个？</kbd></summary>

改写逻辑没有区别，两者共用同一份脚本。差别是 Loon 插件的节点只能从预置的三个里选，Surge 可以填任意主机名。已经有哪个客户端的授权就用哪个；两个都没有的话，Loon 的价格更低。

</details>

<details>
<summary><kbd>Q: 一定要有 iPhone 或 iPad 吗？</kbd></summary>

方式一和方式二需要。Surge tvOS 不能在本机修改配置，配置和模块必须由 Surge iOS 部署；Loon tvOS 的配置通过 iCloud 从 iOS 同步，本文只介绍这种做法。只有 Mac 没有 iPhone 的话，用方式三。

</details>

<details>
<summary><kbd>Q: 能不能完全不用电脑？</kbd></summary>

安装证书这一步需要一台电脑把证书转换成描述文件并提供给 Apple TV 下载，Mac、Windows、Linux 都可以，只用一次。之后的日常使用不需要电脑。

</details>

<details>
<summary><kbd>Q: 在中国大陆网络或大陆线路的 VPN 下也能用吗？</kbd></summary>

可以。B 站在大陆网络环境下会分配 MCDN 或 PCDN 节点。PCDN 地址可以直接换到你指定的节点；MCDN 地址带有专用签名，不能直接换，脚本会改用同一条流里的普通地址作为模板来改写。

</details>

<details>
<summary><kbd>Q: 需要购买代理节点或订阅吗？</kbd></summary>

不需要。本项目只用到客户端的 HTTPS 解密和脚本功能，配置里不添加任何代理节点、全部 `DIRECT` 直连也可以正常工作。

</details>

<details>
<summary><kbd>Q: Apple TV 的流量必须经过一台运行 Surge 或 Loon 的设备吗？</kbd></summary>

是的。脚本只能在代理客户端处理请求时运行，没有客户端接管流量，就没有任何东西会改写响应。但这台设备可以就是 Apple TV 本身，直接在 Apple TV 上运行 Surge tvOS 或 Loon tvOS 即可，不需要额外的 Mac 或路由器。

</details>

<details>
<summary><kbd>Q: 证书已经装好并信任了，把 Apple TV 的网络改回自动，还能重定向吗？</kbd></summary>

不能。证书只让 Apple TV 接受客户端解密后的连接，它本身不执行脚本，也不修改任何地址。网络改回自动后，流量不再经过 Mac 上的 Surge，改写就停止了。想摆脱 Mac，换成方式一或方式二，在 Apple TV 本机运行客户端。

</details>

<details>
<summary><kbd>Q: Surge Mac 的 7 天试用结束了，不想买怎么办？</kbd></summary>

换到方式一或方式二。Surge tvOS 随 Surge iOS 授权免费附带，与 Surge Mac 的授权无关；Loon 是一次性买断，iOS 与 tvOS 共用一次购买。两种方式都不需要 Mac 常开。

</details>

<details>
<summary><kbd>Q: 从方式三换到方式一或方式二，需要重装证书吗？</kbd></summary>

需要。每个客户端的 CA 证书都是各自生成的，Apple TV 只信任装进去的那一张。先把 Apple TV 的 IP 和 DNS 配置改回自动，再完整走一遍对应方式的步骤，用新客户端的证书重新安装一次，旧证书可以删掉。

</details>

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📚 官方文档

- Surge：[模块][surge-manual-module-link] · [HTTPS 解密][surge-manual-mitm-link] · [HTTP Response 脚本][surge-manual-script-link] · [Surge tvOS][surge-kb-tvos-link] · [网关模式][surge-kb-gateway-link]
- Loon：[文档首页][loon-docs-link] · [插件][loon-docs-plugin-link] · [MitM][loon-docs-mitm-link] · [证书工具][loon-cert-tool-link]
- Apple：[手动安装的证书描述文件的信任设置][apple-cert-trust-link] · [证书描述文件载荷][apple-deploy-cert-link]

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📝 许可证

Copyright © 2026-present [Babywbx][profile-link].<br/>
本项目基于 [MIT](./LICENSE) 许可证发布。

<!-- LINK GROUP -->

[apple-cert-trust-link]: https://support.apple.com/zh-cn/102390
[apple-deploy-cert-link]: https://support.apple.com/zh-cn/guide/deployment/dep91d2eb26/web
[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square
[bilicdn-link]: https://github.com/babywbx/BiliCDN
[cheers-appstore-link]: https://apps.apple.com/app/id1643375332
[github-contributors-link]: https://github.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/graphs/contributors
[github-contributors-shield]: https://img.shields.io/github/contributors/babywbx/Bilibili-CDN-Redirect-Apple-TV?color=c4f042&labelColor=black&style=flat-square
[github-forks-link]: https://github.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/network/members
[github-forks-shield]: https://img.shields.io/github/forks/babywbx/Bilibili-CDN-Redirect-Apple-TV?color=8ae8ff&labelColor=black&style=flat-square
[github-issues-link]: https://github.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/issues
[github-issues-shield]: https://img.shields.io/github/issues/babywbx/Bilibili-CDN-Redirect-Apple-TV?color=ff80eb&labelColor=black&style=flat-square
[github-lastcommit-link]: https://github.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/commits/main
[github-lastcommit-shield]: https://img.shields.io/github/last-commit/babywbx/Bilibili-CDN-Redirect-Apple-TV?labelColor=black&style=flat-square
[github-license-link]: https://github.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/blob/main/LICENSE
[github-license-shield]: https://img.shields.io/github/license/babywbx/Bilibili-CDN-Redirect-Apple-TV?color=white&labelColor=black&style=flat-square
[github-stars-link]: https://github.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/stargazers
[github-stars-shield]: https://img.shields.io/github/stars/babywbx/Bilibili-CDN-Redirect-Apple-TV?color=ffcb47&labelColor=black&style=flat-square
[loon-appstore-link]: https://apps.apple.com/us/app/loon/id1373567447
[loon-cert-tool-link]: https://nsloon.app/certificate-tool/
[loon-docs-link]: https://nsloon.app/docs/intro
[loon-docs-mitm-link]: https://nsloon.app/docs/MitM/
[loon-docs-plugin-link]: https://nsloon.app/docs/Plugin/
[loon-import-link]: https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fbabywbx%2FBilibili-CDN-Redirect-Apple-TV%2Fmain%2FBilibili-CDN-Redirect.plugin
[profile-link]: https://github.com/babywbx
[surge-appstore-link]: https://apps.apple.com/us/app/surge-5/id1442620678
[surge-kb-gateway-link]: https://kb.nssurge.com/surge-knowledge-base/zh/guidelines/gateway
[surge-kb-tvos-link]: https://kb.nssurge.com/surge-knowledge-base/zh/guidelines/tvos
[surge-mac-link]: https://nssurge.com/
[surge-manual-mitm-link]: https://manual.nssurge.com/http/mitm.html
[surge-manual-module-link]: https://manual.nssurge.com/profile/module.html
[surge-manual-script-link]: https://manual.nssurge.com/scripting/http-response.html
[uv-install-link]: https://docs.astral.sh/uv/getting-started/installation/
[uv-link]: https://docs.astral.sh/uv/
