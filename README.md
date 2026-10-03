<div align="center"><a name="readme-top"></a>

# Bilibili CDN Redirect for Apple TV

让 Apple TV 上的 Cheers 播放 B 站视频时，自动改走你指定的 CDN 节点。<br/>
以 Surge 模块和 Loon 插件两种形式提供，在 Apple TV 本机的 Surge 或 Loon 里运行，不需要其他设备常开。

[English](./README.en.md) · [报告问题][github-issues-link]

<!-- SHIELD GROUP -->

[![][github-stars-shield]][github-stars-link]
[![][github-forks-shield]][github-forks-link]
[![][github-issues-shield]][github-issues-link]
[![][github-license-shield]][github-license-link]<br/>
[![][github-contributors-shield]][github-contributors-link]
[![][github-lastcommit-shield]][github-lastcommit-link]
[![][github-ci-shield]][github-ci-link]

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

- **📡 媒体地址改写**：覆盖普通视频、番剧、课程的播放接口（`playurl` 系列），改写 DASH 视频流与音频流的地址，杜比、无损音轨和非 DASH 的 `durl` 地址一并处理
- **🔀 主备链路分离**：B 站为每条流同时返回主地址和备用地址，两条链路可以指定不同的 CDN 节点
- **🧭 三种改写模式**：始终改写到指定节点、仅在分配到海外节点时改写、只把 MCDN 与 PCDN 主链路换成正规节点，按自己的网络环境选择
- **🛟 保留退路**：改写到指定节点时，如果同一条流里有原始的正规地址，会把它追加到备用链路，指定节点不可用时客户端可以回退到它；不需要时可用 `fallback` 关闭
- **🎞️ 编码偏好**：按需只保留 AVC、HEVC 或 AV1 其中一种编码
- **🏷️ 改写标记**：响应有任何改动时，清晰度描述末尾会追加「- 已修改」。如果 Cheers 显示清晰度描述，可以借此确认是否生效
- **📺 Apple TV 本机运行**：在 iPhone 或 iPad 上配置好，部署到 Apple TV 上的 Surge tvOS 或 Loon tvOS 里运行，不依赖 Mac 常开
- **🧩 两种客户端**：Surge 模块与 Loon 插件共用同一份脚本，改写逻辑一致
- **🔒 全程本地**：改写发生在你自己的设备上，不经过任何第三方服务器

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔍 工作原理

Cheers 播放视频时会请求 `api.bilibili.com` 的播放接口，接口返回的 JSON 里带着媒体文件的完整地址。本项目以代理客户端的 `http-response` 脚本运行，在响应交还给 Cheers 之前完成三件事：

1. 代理客户端对 `api.bilibili.com` 做 HTTPS 解密（MITM），拿到明文响应
2. 脚本先判断这份响应分配的是海外节点还是大陆节点，再按改写模式处理视频流与音频流的主链路和备用链路。改写到指定节点时，如果有原始的正规地址，会追加到备用链路作为退路；部分 MCDN 地址需要借用同一条流里其他带签名的地址才能重建，借不到时保留原样
3. 改写后的 JSON 交还给 Cheers，之后的媒体请求自然就落到新节点上

文中的「正规节点」指 `upos-` 开头的镜像和 `cn-` 开头的 B 站 CDN 节点；MCDN 指 `*.mcdn.bilivideo.cn` 这类节点，PCDN 指通过 IP 地址、非标准端口或第三方域名等方式提供的节点。

B 站接口使用 HTTPS 加密，客户端要读出并修改响应，必须先解密。Apple TV 只有信任客户端自己生成的 CA 证书，才会接受解密后的连接，所以后面需要把这张证书装进 Apple TV。

因此，改写要生效，下面四个条件缺一不可：

| 条件 | 说明 |
| --- | --- |
| 代理客户端正在运行，并接管了 Apple TV 的流量 | 可以是 Apple TV 本机的 Surge tvOS 或 Loon tvOS，也可以是作为网关的 Surge Mac |
| 模块或插件已启用 | 脚本和需要解密的主机名都由模块或插件声明 |
| 客户端已打开 HTTPS 解密总开关（Surge 为「HTTPS 解密」，Loon 为「MitM」） | 模块或插件无法替你打开这个开关 |
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
- Apple TV 上已安装 [Cheers][cheers-appstore-link]，并关闭 Cheers 设置里的「优化播放链接」。实测开启后，Cheers 会在主备地址里优先选用 B 站的 upos 镜像，忽略本模块指定的节点
- 方式一、方式二需要一台 iPhone 或 iPad，方式三需要一台 Mac
- 一台电脑（Mac、Windows、Linux 都可以），用来把证书转换成描述文件，只在安装证书时用一次。tvOS 26 及更早版本还用它临时提供下载；tvOS 27 需要一个 HTTPS 地址存放描述文件，或者一台 Mac 和用网线联网的 Apple TV（使用 Apple Configurator）
- Surge 和 Loon 都没有在中国大陆区 App Store 上架，需要使用其他国家或地区的 Apple 账户

> \[!NOTE]
>
> 模块、插件和脚本都托管在 GitHub Raw，客户端需要能访问它。如果你的网络访问 GitHub 不稳定，可以把仓库里的三个文件放到自己的服务器上，并把模块或插件里的 `script-path` 改成你的脚本地址。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🚀 方式一：在 Apple TV 上运行 Surge tvOS

Surge tvOS 不能在本机修改配置或安装模块。配置、模块和证书都在 iPhone 或 iPad 上的 Surge 里准备好，再「部署」到 Apple TV。两台设备需要登录同一个 Apple 账户。

### 第 1 步：安装 Surge

1. 在 iPhone 或 iPad 上安装 [Surge][surge-appstore-link]，并确认授权已激活
2. 用同一个 Apple 账户在 Apple TV 的 App Store 里安装 Surge，不需要再次购买
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

部署完成后，先按 [🔐 在 Apple TV 上安装并信任 CA 证书](#-在-apple-tv-上安装并信任-ca-证书) 完成证书安装与信任，再回到 Apple TV 上的 Surge **启动连接，确认处于运行状态**。Surge tvOS 在首次启动连接时下载脚本等外部资源；不确定是否下载成功的话，在 iPhone 的 Surge 里通过远程控制对 Apple TV 执行一次更新外部资源，再验证播放。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🚀 方式二：在 Apple TV 上运行 Loon tvOS

Loon tvOS 的配置通过 iCloud 从 iPhone 或 iPad 上的 Loon 同步过去，插件和证书都记录在配置文件里，会随配置一起同步。两台设备需要登录同一个 Apple 账户。

### 第 1 步：安装 Loon

1. 在 iPhone 或 iPad 上安装 [Loon][loon-appstore-link]
2. 用同一个 Apple 账户在 Apple TV 的 App Store 里安装 Loon，购买过 iOS 版即可免费下载
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

1. 在 iPhone 的「文件」App 里打开「iCloud Drive › Loon › Configs」，能看到这份配置，就说明已经上传到 iCloud
2. 在 Apple TV 上打开 Loon，选择这份配置，确认脚本和 MitM 都处于开启状态
3. 在 Loon 里启动连接

### 第 5 步：导出证书文件

Apple TV 需要的是这个 CA 的公钥证书文件，在电脑上这样取得：

1. 在电脑的浏览器里打开证书工具，切换到「安装现有配置中的证书」
2. 把配置文件 `[MitM]` 段里的 `ca-passphrase` 和 `ca-p12` 两行粘贴进去。Mac 可以在访达的「iCloud Drive › Loon › Configs」里打开配置文件；Windows 或 Linux 在 iPhone 的 Loon 里打开配置，复制这两行发到电脑
3. 点「安装到 iOS 设备」。在电脑上点它只会下载 `loon-ca.crt`，不会安装到任何设备

接下来按 [🔐 在 Apple TV 上安装并信任 CA 证书](#-在-apple-tv-上安装并信任-ca-证书) 把证书装进 Apple TV。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🖥️ 方式三：用 Mac 上的 Surge 作为网关

这种方式让 Apple TV 把 Mac 当作 IPv4 网关，流量先经过 Mac 上的 Surge 再出去。Mac 休眠、关机或 IP 变化都会影响 Apple TV 联网，所以只适合 Mac 本来就常开的场景。

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

以上步骤只修改 IPv4。如果局域网启用了 IPv6，Apple TV 可能通过 IPv6 绕过 Surge。不使用 IPv6 的话，最简单的做法是在路由器上关闭它；需要保留 IPv6 时，按 [Surge 官方网关指南][surge-kb-gateway-link] 配置 IPv6 RA 接管，并检查路由器的 RA DNS 设置。

### 第 4 步：导出证书文件

打开「钥匙串访问」，搜索 Surge，找到 Surge 生成的 CA 证书，选择「文件 › 导出项目」，导出为 `.cer` 文件。

接下来按 [🔐 在 Apple TV 上安装并信任 CA 证书](#-在-apple-tv-上安装并信任-ca-证书) 把证书装进 Apple TV。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔐 在 Apple TV 上安装并信任 CA 证书

tvOS 没有浏览器，无法像 iPhone 那样打开证书文件直接安装。需要先把证书转换成描述文件（`.mobileconfig`），再让 Apple TV 通过网络地址或 Apple Configurator 安装。

三种方式导出的文件分别是：方式一为 Surge 导出的 `.crt`，方式二为 `loon-ca.crt`，方式三为钥匙串导出的 `.cer`。下面以 `$HOME/Downloads/SurgeRootCA.cer` 为例，命令和下载地址里的路径与 `SurgeRootCA` 都要换成你自己的文件。

先在 Apple TV 的「设置 › 通用 › 关于本机」里查看 tvOS 版本：tvOS 26 及更早版本按第 1 至 4 步操作；tvOS 27 完成第 1 步后，按下面两条提示改用 HTTPS 地址或 Apple Configurator，最后完成第 4 步。

> \[!WARNING]
>
> 从 tvOS 27 起，Apple TV 只能通过 TLS 1.2 或更高版本的 HTTPS 连接安装描述文件，HTTP 地址会被拦截（见 [📚 官方文档](#-官方文档) 里的「网络环境安全要求」）。第 2 步的局域网 HTTP 服务只适用于 tvOS 26 及更早版本。tvOS 27 请把第 1 步生成的描述文件上传到使用公共信任证书、能直接下载文件的 HTTPS 地址（例如自建网站），在第 3 步填写这个地址；或者改用下面的 Apple Configurator。

> \[!NOTE]
>
> 如果你有 Mac，并且 Apple TV 用网线接入与 Mac 相同的局域网，也可以用 Apple Configurator 安装第 1 步生成的描述文件，不受上述 HTTPS 限制：
>
> 1. 在 Apple TV 上打开「设置 › 遥控器与设备 › 遥控器 App 与设备」，停留在这个页面
> 2. 在 Mac 上打开 Apple Configurator 的「已配对设备」窗口，选中这台 Apple TV 并点「配对」，输入 Apple TV 屏幕上显示的验证码
> 3. 在设备窗口里选中这台 Apple TV，选择「添加 › 描述文件」，选中第 1 步生成的文件
>
> 完成后跳过第 2、3 步，直接到第 4 步确认证书已开启完全信任。详细步骤见 [📚 官方文档](#-官方文档) 里的「已设置好的 Apple TV 如何配对」与「Apple Configurator：添加描述文件」。

### 第 1 步：转换成描述文件

先创建一个只存放描述文件的独立目录，不要放入私钥、P12 或其他下载文件。下面的路径写法适用于 macOS、Linux 终端及 Windows PowerShell：

```bash
mkdir "$HOME/Downloads/apple-tv-profile"
```

仓库提供了转换脚本，用 [uv][uv-link] 可以直接从 GitHub 运行，不需要下载仓库。没有安装 uv 的话，先按 [uv 安装说明][uv-install-link] 安装：

```bash
uv run https://raw.githubusercontent.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/main/tools/build_mobileconfig.py "$HOME/Downloads/SurgeRootCA.cer" --output "$HOME/Downloads/apple-tv-profile/SurgeRootCA.mobileconfig"
```

不想装 uv 的话，先下载本仓库，在仓库根目录用 Python 3 运行（Windows 把 `python3` 换成 `python`）：

```bash
python3 tools/build_mobileconfig.py "$HOME/Downloads/SurgeRootCA.cer" --output "$HOME/Downloads/apple-tv-profile/SurgeRootCA.mobileconfig"
```

命令会在独立目录里生成 `SurgeRootCA.mobileconfig`，其中只包含公钥证书。工具只接受单个自签名根证书，传入私钥、P12、含多个 PEM 块的文件或非根证书都会报错。未指定 `--output` 时，输出文件与证书同名、同目录。

### 第 2 步：在局域网里提供下载

tvOS 26 及更早版本：在电脑上启动一个临时 HTTP 服务，只对外提供刚才创建的独立目录。tvOS 27 跳过这一步，改用本节开头的 HTTPS 地址或 Apple Configurator：

```bash
uv run python -m http.server 8000 --directory "$HOME/Downloads/apple-tv-profile"
```

或者：

```bash
python3 -m http.server 8000 --directory "$HOME/Downloads/apple-tv-profile"
```

然后查看电脑的局域网 IP（Mac 在「系统设置 › 网络」里，Windows 运行 `ipconfig`，Linux 运行 `ip addr`），拼出描述文件的直链，例如：

```text
http://192.168.1.100:8000/SurgeRootCA.mobileconfig
```

> \[!IMPORTANT]
>
> 使用局域网 HTTP 服务时，电脑和 Apple TV 必须在同一个局域网里。安装完成前不要关闭服务，完成后按 `Ctrl+C` 停止。

### 第 3 步：在 Apple TV 上导入描述文件

这是一个 Apple 没有写进当前用户手册的入口，只在一篇已归档的技术问答里记载过（见 [📚 官方文档](#-官方文档)）：

1. 打开「设置 › 通用 › 隐私与安全性」（tvOS 17 上叫「隐私」）
2. 把焦点移到「共享 Apple TV 分析」上，**不要按确认键进入**
3. 按遥控器上的**播放/暂停键**
4. 在出现的描述文件列表顶部选择「Add Profile」（中文界面以实际文案为准）
5. 输入第 2 步的直链地址（tvOS 27 填 HTTPS 地址），按屏幕提示完成安装。用 iPhone 上的「Apple TV 遥控器」输入会更方便

> \[!NOTE]
>
> 这个入口只能通过上面的操作打开。它和「设置 › 个人资料和账户」里用于切换用户的「添加个人资料」（英文同为 Add Profile）不是一回事，不要从那里进入。

### 第 4 步：开启完全信任

描述文件装好后证书还处于未信任状态，需要手动开启：

1. 打开「设置 › 通用 › 关于本机 › 证书信任设置」
2. 选中刚安装的证书（列表里显示的是证书本身的名称，不是描述文件名称 Babywbx Root CA），按屏幕提示确认，开启完全信任

方式一现在回到 Apple TV 上的 Surge 启动连接；方式二、方式三的客户端此前已经运行，直接进入 [✅ 验证](#-验证)。

> \[!TIP]
>
> 之后要删除证书，在「设置 › 通用」页面底部找到描述文件相关的条目即可，具体名称随 tvOS 版本略有不同。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ✅ 验证

打开 Cheers 播放任意视频，然后到客户端里确认脚本已经运行：

- **Surge tvOS**：在 Apple TV 的 Surge 主界面连按三次遥控器的播放/暂停键，打开调试菜单查看日志
- **Loon tvOS**：在 Apple TV 的 Loon 里查看请求记录或脚本日志，入口以实际界面为准
- **Surge Mac**：在脚本日志里查看，或打开 `debug` 后在请求列表里找到来自 Apple TV 的 `api.bilibili.com` 请求，查看它的备注

看到一行以 🔔 开头、内容形如「已完成：主链路 N 条、备用链路 M 条，已重定向至 cn-hk-eq-01-09.bilivideo.com」的日志，就说明改写已经生效。随后出现的媒体请求会指向你指定的节点。如果 Cheers 显示清晰度描述，末尾也会带上「已修改」字样。

使用 `overseas` 或 `pcdn` 模式时，如果这次响应没有改写到指定节点，日志会改为「已完成：模式 pcdn，保留原节点，N 条 PCDN 主链路已换成正规节点」（`overseas` 模式下显示为「模式 overseas」）；完全没有改动时不会出现 🔔 行。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ⚙️ 参数说明

Surge 模块与 Loon 插件的参数一一对应，只是命名风格不同：

| 参数（Surge / Loon） | 说明 | 默认值 |
| --- | --- | --- |
| `cdn` / `cdn` | 主链路 CDN 主机名 | `cn-hk-eq-01-09.bilivideo.com` |
| `cdnBackup` / `cdn_backup` | 备用链路 CDN 主机名 | `cn-hk-eq-01-13.bilivideo.com` |
| `mode` / `mode` | 改写模式：`all`、`overseas`、`pcdn`，Surge 也接受 `0`、`1`、`2` | `all` |
| `fallback` / `fallback` | 改写到指定节点时，是否把一条原始正规地址留在备用链路末尾 | `true` |
| `codec` / `codec` | 编码偏好，`AUTO` 表示不筛选 | `AUTO` |
| `logLevel` / `log_level` | 日志等级：`ERROR`、`WARN`、`INFO`、`DEBUG` | `WARN` |
| `debug` / `debug` | 调试开关，开启后忽略日志等级，一律按 `DEBUG` 输出 | `false` |

`debug` 默认关闭。首次部署排查问题时可以打开，Surge 会把日志写进对应请求的备注里，确认生效后再关掉。

以 🔔 开头的完成摘要不受日志等级限制，只要响应有改动就会输出。

`mode` 可选值：

| 值 | 行为 | 适合谁 |
| --- | --- | --- |
| `all`（或 `0`） | 不论 B 站分配了什么节点，都改写到指定节点（例外见表格下方） | 海外用户，默认 |
| `overseas`（或 `1`） | B 站分配了海外节点（`*ov` 镜像、Akamai、`cn-hk` 等）时改写到指定节点，否则按 `pcdn` 处理 | 常在海外与大陆线路之间切换 |
| `pcdn`（或 `2`） | 不改写到指定节点，只把 MCDN 与 PCDN 主链路换成同一条流里的正规地址 | 大陆用户，只想避开 MCDN 与 PCDN |

有两种情况会保留原地址：

- 按 `pcdn` 处理时，同一条流里没有正规地址。有正规地址时，它与原来的 MCDN 或 PCDN 主链路互换位置，备用链路里其他 MCDN 与 PCDN 地址保持不变
- 改写到指定节点时，部分 MCDN 地址需要借用同一条流里其他带签名的地址才能重建，借不到时保留原样

`codec` 可选值：

| 值 | 编码 | 对应 `codecid` |
| --- | --- | --- |
| `AUTO` | 不筛选 | 保留全部 |
| `AVC`（Surge 也接受 `H264`、`H.264`） | H.264 | 7 |
| `HEVC`（Surge 也接受 `H265`、`H.265`） | H.265 | 12 |
| `AV1` | AOMedia Video 1 | 13 |

`cdn` 与 `cdnBackup`（Loon 为 `cdn_backup`）可填的节点：

| 分组 | 主机名 | 说明 |
| --- | --- | --- |
| 香港 | `cn-hk-eq-01-01` 到 `cn-hk-eq-01-14`（没有 `07`），补全 `.bilivideo.com` | 海外用户的首选，默认值即来自这一组 |
| 海外镜像 | `upos-sz-mirrorcosov.bilivideo.com`、`upos-sz-mirroraliov.bilivideo.com` | B 站提供给海外用户的常规镜像 |
| 大陆镜像 | `upos-sz-mirrorcos.bilivideo.com`、`upos-sz-mirrorhw.bilivideo.com`、`upos-sz-mirrorali.bilivideo.com` | 大陆用户使用 `all` 模式时可选 |

补充说明：

- Surge 的参数可以填写任意主机名，也可以用 [BiliCDN][bilicdn-link] 查找当前可用的 B 站 CDN 主机名
- Loon 的参数是下拉菜单，预置了 7 个香港节点与 2 个海外镜像，想用其他节点需要修改插件文件后自行托管
- Akamai（`*.akamaized.net`）与主机名含 `bstar` 的节点只会被识别为来源，不能填作改写目标
- 筛选编码时，如果该视频没有目标编码，脚本会跳过筛选，保持原样

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🛠 故障排查

先对照 [🔍 工作原理](#-工作原理) 里的四个条件逐项检查，绝大多数问题都出在其中一项。

**日志里看不到「已完成」**

- 使用 `overseas` 或 `pcdn` 模式时，如果响应里没有需要替换的地址，本来就不会输出摘要
- 客户端是否真的在运行并接管了 Apple TV 的流量。方式三要确认 Apple TV 的路由器和 DNS 指向正确
- HTTPS 解密总开关是否打开（Surge 为「HTTPS 解密」，Loon 为「MitM」）
- Apple TV 上的证书是否已经开启完全信任，而不只是安装；装进去的是不是当前运行的那个客户端的证书
- 脚本是否下载成功。Surge tvOS 会自行下载并缓存脚本，默认一天刷新一次，也可以在 iPhone 的 Surge 里通过 Apple TV 的远程控制手动更新外部资源；Loon 在「外部资源」里长按可以单独更新
- 响应体是否超过 Surge 的脚本处理上限（iOS 默认 1 MB，macOS 默认 10 MB）。超过时 Surge 不运行脚本、原样返回，并在请求备注里注明（Surge tvOS 也在请求备注里查看）。遇到这种情况请[报告问题][github-issues-link]
- Loon 对同一个响应只运行一个响应脚本，命中响应体复写规则时也不运行脚本。如果还装了其他改写 B 站播放接口的插件，先停用它们

**日志有「已完成」，但媒体请求没有走指定节点**

- Cheers 设置里的「优化播放链接」是否已关闭。开启时 Cheers 会在主备地址里优先选用 upos 镜像，也就是脚本留在备用链路末尾的那条原始地址

**Cheers 无法播放或提示网络错误**

- Apple TV 是否已经信任证书。证书没有信任时，Cheers 会拒绝解密后的连接
- 从 Cheers 的「最近观看」打开课程提示 404 是 Cheers 自身的问题，与本模块无关，从「我的课程」进入即可正常播放
- 把 `codec` 改回 `AUTO`，排除编码筛选的影响
- 换一个 CDN 节点，排除当前节点故障
- 临时停用模块或插件，确认问题是否与改写有关

**Apple TV 无法下载或安装描述文件**

- 输入的是不是能直接下载到文件的地址。网盘的分享页、带登录或跳转的链接通常不行
- tvOS 27 上填写的是否为 HTTPS 地址（HTTP 会被拦截），或者改用 Apple Configurator，见 [🔐 在 Apple TV 上安装并信任 CA 证书](#-在-apple-tv-上安装并信任-ca-证书)
- 使用局域网 HTTP 服务时，电脑和 Apple TV 是否在同一个局域网里，HTTP 服务是否仍在运行

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ❓ FAQ

<details>
<summary><kbd>Q: Surge 和 Loon 选哪个？</kbd></summary>

改写逻辑没有区别，两者共用同一份脚本。差别是 Loon 插件的节点只能从预置的 9 个里选，Surge 可以填任意主机名。已经有哪个客户端的授权就用哪个；两个都没有的话，Loon 的价格更低。

</details>

<details>
<summary><kbd>Q: 一定要有 iPhone 或 iPad 吗？</kbd></summary>

方式一和方式二需要。Surge tvOS 不能在本机修改配置，配置和模块必须由 Surge iOS 部署；Loon tvOS 的配置通过 iCloud 从 iOS 同步，本文只介绍这种做法。只有 Mac 没有 iPhone 的话，用方式三。

</details>

<details>
<summary><kbd>Q: 能不能完全不用电脑？</kbd></summary>

安装证书时需要一台电脑把证书转换成描述文件，Mac、Windows、Linux 都可以。tvOS 26 及更早版本还用这台电脑临时提供下载；tvOS 27 需要 HTTPS 地址或 Mac 上的 Apple Configurator。这些都只在安装证书时用一次，日常使用不需要电脑。

</details>

<details>
<summary><kbd>Q: 在中国大陆网络或大陆线路的 VPN 下也能用吗？</kbd></summary>

可以。B 站在大陆网络下通常分配 MCDN 或 PCDN 节点，默认的 `all` 模式会把它们改写到你指定的节点（少数例外见 [⚙️ 参数说明](#️-参数说明)）。如果你在大陆、只想避开 MCDN 与 PCDN，把 `mode` 设为 `pcdn`：同一条流里有正规地址时，它会换到主链路，原来的地址换到备用链路。

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
<summary><kbd>Q: 证书已经装好并信任了，把 Apple TV 的网络改回自动，还能改写吗？</kbd></summary>

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
- Apple：[手动安装的证书描述文件的信任设置][apple-cert-trust-link] · [证书描述文件载荷][apple-deploy-cert-link] · [网络环境安全要求（tvOS 27 起）][apple-tls-requirements-link] · [Apple TV 安装描述文件的技术问答][apple-qa1948-link] · [Apple Configurator：连接设备][apple-configurator-connect-link] · [Apple Configurator：添加描述文件][apple-configurator-profiles-link] · [已设置好的 Apple TV 如何配对][apple-install-beta-link]

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📝 许可证

Copyright © 2026-present [Babywbx][profile-link].<br/>
本项目基于 [MIT](./LICENSE) 许可证发布。

<!-- LINK GROUP -->

[apple-cert-trust-link]: https://support.apple.com/zh-cn/102390
[apple-configurator-connect-link]: https://support.apple.com/zh-cn/guide/apple-configurator-mac/cad9d4b2211e/mac
[apple-configurator-profiles-link]: https://support.apple.com/zh-cn/guide/apple-configurator-mac/cadb67fcd4f/mac
[apple-deploy-cert-link]: https://support.apple.com/zh-cn/guide/deployment/dep91d2eb26/web
[apple-install-beta-link]: https://developer.apple.com/support/install-beta/
[apple-qa1948-link]: https://developer.apple.com/library/archive/qa/qa1948/_index.html
[apple-tls-requirements-link]: https://support.apple.com/zh-cn/126655
[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square
[bilicdn-link]: https://github.com/babywbx/BiliCDN
[cheers-appstore-link]: https://apps.apple.com/app/id1643375332
[github-ci-link]: https://github.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/actions/workflows/ci.yml
[github-ci-shield]: https://img.shields.io/github/actions/workflow/status/babywbx/Bilibili-CDN-Redirect-Apple-TV/ci.yml?label=CI&labelColor=black&logo=githubactions&logoColor=white&style=flat-square
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
