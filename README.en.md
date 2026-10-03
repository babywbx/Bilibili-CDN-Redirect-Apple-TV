<div align="center"><a name="readme-top"></a>

# Bilibili CDN Redirect for Apple TV

Make Cheers on Apple TV play Bilibili videos from the CDN node you choose.<br/>
Ships as a Surge module and a Loon plugin that run in Surge or Loon on the Apple TV itself, with no other device needing to stay on.

[简体中文](./README.md) · [Report an issue][github-issues-link]

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
<summary><kbd>Table of contents</kbd></summary>

#### TOC

- [✨ Features](#-features)
- [🔍 How It Works](#-how-it-works)
- [🧭 Choose a Deployment Method](#-choose-a-deployment-method)
- [📦 Before You Start](#-before-you-start)
- [🚀 Method 1: Run Surge tvOS on Apple TV](#-method-1-run-surge-tvos-on-apple-tv)
- [🚀 Method 2: Run Loon tvOS on Apple TV](#-method-2-run-loon-tvos-on-apple-tv)
- [🖥️ Method 3: Use Surge on a Mac as the Gateway](#️-method-3-use-surge-on-a-mac-as-the-gateway)
- [🔐 Install and Trust the CA Certificate on Apple TV](#-install-and-trust-the-ca-certificate-on-apple-tv)
- [✅ Verify](#-verify)
- [⚙️ Arguments](#️-arguments)
- [🛠 Troubleshooting](#-troubleshooting)
- [❓ FAQ](#-faq)
- [📚 Official Documentation](#-official-documentation)
- [📝 License](#-license)

####

<br/>

</details>

## ✨ Features

This project solves one problem: **the CDN node that Bilibili's playback API assigns based on your network is not always the fastest one for Apple TV.** It changes the playback URLs to the node you choose.

- **📡 Media URL Rewriting**: covers the playback endpoints (the `playurl` family) for regular videos, bangumi, and courses, and rewrites the URLs of DASH video and audio streams, including Dolby and lossless audio tracks and non-DASH `durl` URLs
- **🔀 Separate Primary and Backup URLs**: Bilibili returns both a primary and a backup URL for each stream, and the two can point to different CDN nodes
- **🧭 Three Rewrite Modes**: always redirect to your nodes, redirect only when overseas nodes are assigned, or only swap MCDN and PCDN primary URLs for regular ones. Pick the one that matches your network
- **🛟 Fallback Kept**: when redirecting to your nodes, the stream's original regular URL, if there is one, is appended to the backup list so the client can fall back to it if your node fails. Turn it off with `fallback` if you do not want it
- **🎞️ Codec Preference**: optionally keep only one codec: AVC, HEVC, or AV1
- **🏷️ Rewrite Marker**: whenever a response is changed, " - 已修改" (modified) is appended to the quality descriptions. If Cheers shows quality descriptions, you can use it to confirm that the rewrite is working
- **📺 Runs on Apple TV**: configure it on an iPhone or iPad and deploy it to Surge tvOS or Loon tvOS on Apple TV, with no dependency on an always-on Mac
- **🧩 Two Clients**: the Surge module and the Loon plugin share the same script, so the rewrite logic is identical
- **🔒 Fully Local**: the rewrite happens on your own devices and never passes through any third-party server

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔍 How It Works

When Cheers plays a video, it calls the playback API on `api.bilibili.com`, and the returned JSON contains the full URLs of the media files. This project runs as an `http-response` script in the proxy client and does three things before the response is handed back to Cheers:

1. The proxy client performs HTTPS decryption (MITM) on `api.bilibili.com` to get the plaintext response
2. The script first checks whether the response was assigned overseas or mainland China nodes, then processes the primary and backup URLs of video and audio streams according to the rewrite mode. When redirecting to your nodes, the original regular URL, if there is one, is appended to the backup list as a fallback. Some MCDN URLs can only be rebuilt from another signed URL in the same stream and are kept unchanged when none exists
3. The rewritten JSON is handed back to Cheers, and subsequent media requests go to the new node

"Regular nodes" in this guide means Bilibili CDN hosts starting with `upos-` (mirrors) or `cn-`. MCDN means hosts such as `*.mcdn.bilivideo.cn`, and PCDN means nodes served through an IP address, a non-standard port, a third-party domain, and so on.

Bilibili's API uses HTTPS, so the client must decrypt the response before it can read and modify it. Apple TV only accepts the decrypted connection if it trusts the CA certificate that the client generated, which is why you need to install that certificate on Apple TV later.

For the rewrite to work, all four of the following conditions must be met:

| Condition | Notes |
| --- | --- |
| The proxy client is running and has taken over Apple TV's traffic | This can be Surge tvOS or Loon tvOS on the Apple TV itself, or Surge Mac acting as a gateway |
| The module or plugin is enabled | The module or plugin declares both the script and the hostnames to decrypt |
| The client's HTTPS decryption master switch is on ("HTTPS Decryption" in Surge, "MitM" in Loon) | The module or plugin cannot turn this switch on for you |
| Apple TV has installed and trusted that client's CA certificate | Apple TV only accepts the client's decrypted connections if it trusts this certificate. The certificate itself does not rewrite anything |

> \[!NOTE]
>
> "Taking over traffic" does not mean "you need a proxy server". You do not need to add any proxy servers to the client. With everything going `DIRECT`, the rewrite still works.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🧭 Choose a Deployment Method

| Method | Where the client runs | What you need | Best for |
| --- | --- | --- | --- |
| **1: Surge tvOS** | On the Apple TV | Surge on an iPhone or iPad, used to deploy the configuration | You already have a Surge iOS license |
| **2: Loon tvOS** | On the Apple TV | Loon on an iPhone or iPad, used to sync the configuration | You already have a Loon license, or you have neither and want the lower-priced option |
| **3: Surge Mac gateway** (alternative) | A Mac on the LAN | An always-on Mac with a wired connection, plus a Surge Mac license | Your Mac is always on anyway, or you just want to try it first |

A few more notes:

- Surge tvOS and Loon tvOS are the same apps as their iOS versions, so if you have bought the iOS version, you can use it on Apple TV for free
- The Surge Mac license is separate from the Surge iOS license. Surge Mac offers a 7-day free trial
- Whichever method you use, Apple TV must install and trust the CA certificate of **the client that is actually running**. Switching clients means switching certificates

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📦 Before You Start

- Apple TV HD or Apple TV 4K. Methods 1 and 2 require tvOS 17 or later. Method 3 only requires a version that can run Cheers (tvOS 16 or later)
- [Cheers][cheers-appstore-link] installed on Apple TV, with the "优化播放链接" (optimize playback links) option in Cheers settings turned off. In testing, with it on, Cheers picks Bilibili's upos mirrors from the primary and backup URLs and ignores the node this module chose
- An iPhone or iPad for Methods 1 and 2, or a Mac for Method 3
- A computer (Mac, Windows, or Linux) to convert the certificate into a profile, needed only once when installing the certificate. On tvOS 26 and earlier, it also serves the profile to Apple TV. On tvOS 27, you need an HTTPS URL to host the profile, or a Mac plus an Apple TV connected by Ethernet (using Apple Configurator)
- Neither Surge nor Loon is available on the mainland China App Store, so you need an Apple Account from another country or region

> \[!NOTE]
>
> The module, plugin, and script are all hosted on GitHub Raw, and the client must be able to reach it. If your network has trouble reaching GitHub, host the three files from this repository on your own server and change `script-path` in the module or plugin to your script URL.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🚀 Method 1: Run Surge tvOS on Apple TV

Surge tvOS cannot edit its configuration or install modules on the device itself. You prepare the configuration, module, and certificate in Surge on an iPhone or iPad, then "deploy" them to Apple TV. Both devices must be signed in to the same Apple Account.

### Step 1: Install Surge

1. Install [Surge][surge-appstore-link] on your iPhone or iPad and make sure the license is activated
2. Install Surge from the App Store on Apple TV with the same Apple Account. You do not need to buy it again
3. Open Surge on Apple TV once to complete initialization. Only then does it appear in the deployment list on the iPhone

### Step 2: Install the module on iPhone

1. Open Surge, go to "Modules", and choose "Install New Module"
2. Paste the module URL:

   ```text
   https://raw.githubusercontent.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/main/Bilibili-CDN-Redirect.sgmodule
   ```

3. After installation, turn the module on. The default arguments are fine. To change them, long-press the module and choose "Edit Arguments". See [⚙️ Arguments](#️-arguments) for what each argument means

### Step 3: Generate a CA certificate and enable HTTPS Decryption

1. In Surge's "HTTPS Decryption" settings, choose "Generate New CA Certificate"
2. Turn on the HTTPS Decryption master switch. The module already adds `api.bilibili.com` to the decryption hostname list, so you do not need to add it manually
3. Use the option to export the certificate as a `.crt` file, then send it to your computer via AirDrop or email. You will need it when installing the certificate

> \[!TIP]
>
> The certificate only needs to be installed on Apple TV. Surge on the iPhone is only used to prepare and deploy the configuration and does not need to be running day to day. If you also start this configuration on the iPhone and use the Bilibili app there, the iPhone must install and trust this certificate too.

### Step 4: Deploy to Apple TV

1. On Surge's "More" page, find "Surge tvOS"
2. Select your Apple TV and the current configuration, then tap "Deploy"
3. It is recommended to also turn on automatic deployment in the background, so later changes to the configuration or modules are deployed to Apple TV automatically

After deployment, follow [🔐 Install and Trust the CA Certificate on Apple TV](#-install-and-trust-the-ca-certificate-on-apple-tv), then return to Surge on Apple TV and **start the connection and confirm that it is running**. Surge tvOS downloads the script and other external resources when the connection first starts. If you are not sure they downloaded, update external resources on Apple TV once through the remote control in Surge on the iPhone, then verify playback.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🚀 Method 2: Run Loon tvOS on Apple TV

Loon tvOS receives its configuration from Loon on your iPhone or iPad through iCloud. The plugin and certificate are recorded in the configuration file, so they sync along with it. Both devices must be signed in to the same Apple Account.

### Step 1: Install Loon

1. Install [Loon][loon-appstore-link] on your iPhone or iPad
2. Install Loon from the App Store on Apple TV with the same Apple Account. If you have bought the iOS version, the download is free
3. In Loon on the iPhone, turn on iCloud sync for configuration files

> \[!NOTE]
>
> Loon on Apple TV can only get its configuration through iCloud. tvOS also clears apps' local files from time to time, and with sync on, Loon restores them automatically.

### Step 2: Install the plugin on iPhone

Open this page on your iPhone and tap the link below to launch Loon and import the plugin:

👉 **[Tap here to import the plugin][loon-import-link]** 👈

You can also add it manually: open Loon's "Configuration (配置)" tab, tap "+" in the top-right corner of the "Plugins (插件)" section, and paste the plugin URL:

```text
https://raw.githubusercontent.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/main/Bilibili-CDN-Redirect.plugin
```

The plugin's arguments appear as dropdown menus and switches. Open the plugin to adjust them, and see [⚙️ Arguments](#️-arguments) for what they mean.

### Step 3: Generate a CA certificate and enable MitM

Loon's CA certificate is generated with an official web tool:

```text
https://nsloon.app/certificate-tool/
```

1. Open the URL above in Safari on your iPhone and choose "Generate MitM CA Certificate (生成 MitM CA 证书)"
2. Tap "Import to Loon (一键导入 Loon)". The certificate is written to the `[MitM]` section of the current configuration
3. Back in Loon, turn on the MitM switch. The plugin already declares `api.bilibili.com`, so you do not need to add the hostname manually

> \[!WARNING]
>
> `ca-p12` in the configuration contains the private key. Do not share the configuration file, the P12 file, or the import link with anyone.

### Step 4: Sync to Apple TV

1. In the Files app on your iPhone, open "iCloud Drive > Loon > Configs". If the configuration is there, it has been uploaded to iCloud
2. Open Loon on Apple TV, select this configuration, and make sure scripts and MitM are both enabled
3. Start the connection in Loon

### Step 5: Export the certificate file

Apple TV needs the public certificate file of this CA. Get it on your computer as follows:

1. Open the certificate tool in a browser on your computer and switch to "Install Certificate from Existing Configuration (安装现有配置中的证书)"
2. Paste the `ca-passphrase` and `ca-p12` lines from the `[MitM]` section of your configuration file. On a Mac, open the configuration file in Finder under "iCloud Drive > Loon > Configs". On Windows or Linux, open the configuration in Loon on your iPhone and copy these two lines to your computer
3. Click "Install on iOS Device (安装到 iOS 设备)". Clicking it on a computer only downloads `loon-ca.crt` and does not install anything on any device

Next, follow [🔐 Install and Trust the CA Certificate on Apple TV](#-install-and-trust-the-ca-certificate-on-apple-tv) to install the certificate on Apple TV.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🖥️ Method 3: Use Surge on a Mac as the Gateway

This method makes Apple TV use the Mac as its IPv4 gateway, routing traffic through Surge on the Mac. If the Mac sleeps, shuts down, or changes its IP, Apple TV's network connection is affected, so this method only suits setups where the Mac is always on anyway.

### Step 1: Install the module and generate a certificate on the Mac

1. Install [Surge Mac][surge-mac-link]
2. Go to "Modules", choose to install a module from URL, and paste the module URL:

   ```text
   https://raw.githubusercontent.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/main/Bilibili-CDN-Redirect.sgmodule
   ```

3. Go to "HTTPS Decryption", generate a new certificate, then install the certificate to the system. You will export it from the keychain in Step 4
4. Turn on the HTTPS Decryption master switch

### Step 2: Enable Gateway Mode

1. Connect the Mac to the router with an Ethernet cable, and reserve a fixed IP for the Mac on the router
2. On Surge's Overview page, turn on "Gateway Mode" in the LAN device takeover section. It depends on "Enhanced Mode", so enable that when prompted
3. In "System Settings", under the energy or battery options, turn on the option that prevents automatic sleeping when the display is off. Its exact name varies slightly between macOS versions

### Step 3: Route Apple TV through the Mac

In "Settings > Network" on Apple TV, select the current Wi-Fi or Ethernet connection and change two settings:

1. Change "Configure IP" to "Manual" and fill in the fields as shown in the table below
2. Change "Configure DNS" to "Manual" and enter `198.18.0.2`

| Field | Value |
| --- | --- |
| IP Address | An unused address on your LAN, preferably outside the router's DHCP range, such as `192.168.1.250` |
| Subnet Mask | Same as the Mac, usually `255.255.255.0` |
| Router | The Mac's LAN IP |

> \[!IMPORTANT]
>
> DNS must be `198.18.0.2`, the dedicated address for Surge Gateway Mode. Do not enter the Mac's IP or a public DNS server.

These steps only change IPv4 settings. If your LAN has IPv6 enabled, Apple TV may bypass Surge over IPv6. If you do not need IPv6, the simplest fix is to disable it on the router. To keep IPv6, follow the [official Surge gateway guide][surge-kb-gateway-link] to configure IPv6 RA override and check the router's RA DNS settings.

### Step 4: Export the certificate file

Open "Keychain Access", search for Surge, find the CA certificate generated by Surge, choose "File > Export Items", and export it as a `.cer` file.

Next, follow [🔐 Install and Trust the CA Certificate on Apple TV](#-install-and-trust-the-ca-certificate-on-apple-tv) to install the certificate on Apple TV.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔐 Install and Trust the CA Certificate on Apple TV

tvOS has no browser, so you cannot install a certificate by opening the file as you can on an iPhone. First convert the certificate into a configuration profile (`.mobileconfig`), then install it on Apple TV from a URL or with Apple Configurator.

Each method exports a different file: Method 1 uses the `.crt` exported from Surge, Method 2 uses `loon-ca.crt`, and Method 3 uses the `.cer` exported from Keychain Access. The examples below use `$HOME/Downloads/SurgeRootCA.cer`. Replace the path and `SurgeRootCA` in the commands and the download URL with your own file.

Check the tvOS version in "Settings > General > About" on Apple TV first. On tvOS 26 and earlier, follow Steps 1 to 4. On tvOS 27, complete Step 1, switch to an HTTPS URL or Apple Configurator as described in the two alerts below, then finish with Step 4.

> \[!WARNING]
>
> Starting with tvOS 27, Apple TV installs configuration profiles only over HTTPS with TLS 1.2 or later, and HTTP URLs are blocked (see "Network security requirements" under [📚 Official Documentation](#-official-documentation)). The LAN HTTP server in Step 2 only works on tvOS 26 and earlier. On tvOS 27, upload the profile from Step 1 to an HTTPS URL that uses a publicly trusted certificate and downloads the file directly (for example, your own website), then enter that URL in Step 3. Alternatively, use Apple Configurator as described below.

> \[!NOTE]
>
> If you have a Mac and your Apple TV is connected by Ethernet to the same network as the Mac, you can also install the profile from Step 1 with Apple Configurator, which is not affected by the HTTPS requirement above:
>
> 1. On Apple TV, open "Settings > Remotes and Devices > Remote App and Devices" and stay on that screen
> 2. On the Mac, open the Paired Devices window in Apple Configurator, select the Apple TV, click "Pair", and enter the code shown on the Apple TV
> 3. Select the Apple TV in the device window, choose "Add > Profiles", and pick the file from Step 1
>
> Then skip Steps 2 and 3 and go to Step 4 to confirm that the certificate is fully trusted. See "Pairing an Apple TV that is already set up" and "Apple Configurator: add profiles" under [📚 Official Documentation](#-official-documentation) for details.

### Step 1: Convert it to a profile

First create a separate directory for profiles only. Do not put private keys, P12 files, or other downloads in it. The paths below work in macOS and Linux terminals and Windows PowerShell:

```bash
mkdir "$HOME/Downloads/apple-tv-profile"
```

The repository includes a conversion script that [uv][uv-link] can run directly from GitHub, without downloading the repository. If uv is not installed, install it first by following the [uv installation guide][uv-install-link]:

```bash
uv run https://raw.githubusercontent.com/babywbx/Bilibili-CDN-Redirect-Apple-TV/main/tools/build_mobileconfig.py "$HOME/Downloads/SurgeRootCA.cer" --output "$HOME/Downloads/apple-tv-profile/SurgeRootCA.mobileconfig"
```

If you prefer not to install uv, download this repository first and run the script with Python 3 from the repository root (on Windows, replace `python3` with `python`):

```bash
python3 tools/build_mobileconfig.py "$HOME/Downloads/SurgeRootCA.cer" --output "$HOME/Downloads/apple-tv-profile/SurgeRootCA.mobileconfig"
```

The command writes `SurgeRootCA.mobileconfig` into the separate directory, and the profile contains only the public certificate. The tool accepts a single self-signed root certificate and rejects private keys, P12 files, files with multiple PEM blocks, and non-root certificates. Without `--output`, the profile is written next to the certificate with the same name.

### Step 2: Serve it on your LAN

On tvOS 26 and earlier, start a temporary HTTP server on your computer that serves only the separate directory you just created. On tvOS 27, skip this step and use an HTTPS URL or Apple Configurator as described at the start of this section:

```bash
uv run python -m http.server 8000 --directory "$HOME/Downloads/apple-tv-profile"
```

Or:

```bash
python3 -m http.server 8000 --directory "$HOME/Downloads/apple-tv-profile"
```

Then find your computer's LAN IP (on a Mac, in "System Settings > Network"; on Windows, run `ipconfig`; on Linux, run `ip addr`) and build the direct link to the profile, for example:

```text
http://192.168.1.100:8000/SurgeRootCA.mobileconfig
```

> \[!IMPORTANT]
>
> When using the LAN HTTP server, the computer and Apple TV must be on the same LAN. Keep the server running until installation finishes, then stop it with `Ctrl+C`.

### Step 3: Import the profile on Apple TV

This entry is not in Apple's current user guide. It is documented only in an archived Technical Q&A (see [📚 Official Documentation](#-official-documentation)):

1. Open "Settings > General > Privacy & Security" (called "Privacy" on tvOS 17)
2. Move the focus to "Share Apple TV Analytics", **but do not press Select to open it**
3. Press the **Play/Pause button** on the remote
4. Choose "Add Profile" at the top of the profile list that appears
5. Enter the direct link from Step 2 (the HTTPS URL on tvOS 27) and follow the on-screen prompts to complete the installation. Typing is easier with the Apple TV Remote on your iPhone

> \[!NOTE]
>
> This entry can only be opened with the steps above. It is different from the identically labeled "Add Profile" under "Settings > Profiles and Accounts", which adds a user profile for switching between users. Do not go in from there.

### Step 4: Enable full trust

After the profile is installed, the certificate is still untrusted and must be trusted manually:

1. Open "Settings > General > About > Certificate Trust Settings"
2. Select the certificate you just installed (the list shows the certificate's own name, not the profile name Babywbx Root CA), confirm the on-screen prompt, and turn on full trust

For Method 1, now return to Surge on Apple TV and start the connection. For Methods 2 and 3, the client is already running, so go straight to [✅ Verify](#-verify).

> \[!TIP]
>
> To remove the certificate later, look for the profiles entry at the bottom of "Settings > General". Its exact name varies slightly between tvOS versions.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ✅ Verify

Open Cheers and play any video, then check in the client that the script has run:

- **Surge tvOS**: on the main screen of Surge on Apple TV, press the Play/Pause button on the remote three times to open the debug menu and view the logs
- **Loon tvOS**: check the request records or script logs in Loon on Apple TV. The exact entry depends on the actual interface
- **Surge Mac**: check the script logs, or turn on `debug`, find the `api.bilibili.com` request from Apple TV in the request list, and check its notes

If you see a log line starting with 🔔, such as "已完成：主链路 N 条、备用链路 M 条，已重定向至 cn-hk-eq-01-09.bilivideo.com" (completed: N primary and M backup URLs, redirected to cn-hk-eq-01-09.bilivideo.com), the rewrite is working. The media requests that follow go to the node you specified. If Cheers shows quality descriptions, they also end with "已修改" (modified).

In `overseas` or `pcdn` mode, when a response is not redirected to your node, the log reads "已完成：模式 pcdn，保留原节点，N 条 PCDN 主链路已换成正规节点" (completed: mode pcdn, original nodes kept, N PCDN primary URLs replaced with regular nodes) instead, with `overseas` in place of `pcdn` in `overseas` mode. When nothing changes, no 🔔 line appears.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ⚙️ Arguments

The Surge module and the Loon plugin have matching arguments, with different naming styles:

| Argument (Surge / Loon) | Description | Default |
| --- | --- | --- |
| `cdn` / `cdn` | CDN hostname for primary URLs | `cn-hk-eq-01-09.bilivideo.com` |
| `cdnBackup` / `cdn_backup` | CDN hostname for backup URLs | `cn-hk-eq-01-13.bilivideo.com` |
| `mode` / `mode` | Rewrite mode: `all`, `overseas`, `pcdn`. Surge also accepts `0`, `1`, `2` | `all` |
| `fallback` / `fallback` | Whether to keep one original regular URL at the end of the backup list when redirecting to your nodes | `true` |
| `codec` / `codec` | Codec preference. `AUTO` means no filtering | `AUTO` |
| `logLevel` / `log_level` | Log level: `ERROR`, `WARN`, `INFO`, `DEBUG` | `WARN` |
| `debug` / `debug` | Debug switch. When on, the log level is ignored and everything is logged at `DEBUG` | `false` |

`debug` is off by default. Turn it on when troubleshooting your first deployment: Surge then also writes the logs into the notes of the corresponding request. Turn it off again once the rewrite is confirmed to work.

The 🔔 completion summary ignores the log level and is logged whenever a response is changed.

`mode` values:

| Value | Behaviour | Best for |
| --- | --- | --- |
| `all` (or `0`) | Redirects media URLs to your nodes, whatever Bilibili assigned (exceptions below the table) | Users outside mainland China. Default |
| `overseas` (or `1`) | Redirects to your nodes when Bilibili assigned overseas nodes (`*ov` mirrors, Akamai, `cn-hk`, and so on). Otherwise behaves like `pcdn` | Users who switch between overseas and mainland routes |
| `pcdn` (or `2`) | Never redirects to your nodes. Only swaps MCDN and PCDN primary URLs for a regular URL of the same stream | Users in mainland China who just want to avoid MCDN and PCDN |

The original URL is kept in two cases:

- In `pcdn` handling, when the stream has no regular URL. When it has one, the regular URL and the MCDN or PCDN primary URL swap places, and other MCDN and PCDN URLs in the backup list stay as they are
- When redirecting to your nodes, some MCDN URLs can only be rebuilt from another signed URL in the same stream and are kept unchanged when none exists

`codec` values:

| Value | Codec | `codecid` |
| --- | --- | --- |
| `AUTO` | No filtering | Keep all |
| `AVC` (Surge also accepts `H264` and `H.264`) | H.264 | 7 |
| `HEVC` (Surge also accepts `H265` and `H.265`) | H.265 | 12 |
| `AV1` | AOMedia Video 1 | 13 |

Nodes you can use for `cdn` and `cdnBackup` (`cdn_backup` in Loon):

| Group | Hostnames | Notes |
| --- | --- | --- |
| Hong Kong | `cn-hk-eq-01-01` through `cn-hk-eq-01-14` (there is no `07`), with `.bilivideo.com` appended | First choice for users outside mainland China. The defaults come from this group |
| Overseas mirrors | `upos-sz-mirrorcosov.bilivideo.com`, `upos-sz-mirroraliov.bilivideo.com` | The regular mirrors Bilibili serves to overseas users |
| Mainland mirrors | `upos-sz-mirrorcos.bilivideo.com`, `upos-sz-mirrorhw.bilivideo.com`, `upos-sz-mirrorali.bilivideo.com` | An option for mainland users running `all` mode |

Additional notes:

- Surge arguments accept any hostname. You can also use [BiliCDN][bilicdn-link] to find the Bilibili CDN hostnames currently available
- Loon arguments are dropdown menus preset with seven Hong Kong nodes and two overseas mirrors. To use other nodes, edit the plugin file and host it yourself
- Akamai (`*.akamaized.net`) and hostnames containing `bstar` are only recognized as sources and cannot be used as rewrite targets
- When filtering by codec, if a video does not have the target codec, the script skips filtering and leaves the streams unchanged

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🛠 Troubleshooting

Start by checking each of the four conditions in [🔍 How It Works](#-how-it-works). Most problems come down to one of them.

**No "已完成" (completed) line in the logs**

- In `overseas` or `pcdn` mode, no summary is logged when the response has nothing to replace
- Is the client actually running and taking over Apple TV's traffic? For Method 3, make sure Apple TV's router and DNS point to the right addresses
- Is the HTTPS decryption master switch on ("HTTPS Decryption" in Surge, "MitM" in Loon)?
- Is the certificate on Apple TV fully trusted, not just installed? Is it the certificate of the client that is currently running?
- Did the script download successfully? Surge tvOS downloads and caches the script by itself and refreshes it once a day by default. You can also update external resources manually through the Apple TV remote control in Surge on the iPhone. In Loon, long-press the item in "External Resources (外部资源)" to update it individually
- Does the response body exceed Surge's script body limit (1 MB by default on iOS, 10 MB on macOS)? If so, Surge does not run the script, returns the response unchanged, and says so in the request notes (also check the request notes on Surge tvOS). If this happens, please [report an issue][github-issues-link]
- Loon runs only one response script per response, and does not run the script when a response body rewrite rule matches. If you have other plugins installed that rewrite Bilibili's playback API, disable them first

**The log shows "已完成" but media requests do not go to your node**

- Is the "优化播放链接" (optimize playback links) option in Cheers settings turned off? With it on, Cheers picks upos mirrors from the primary and backup URLs, which is the original URL the script keeps at the end of the backup list

**Cheers cannot play or shows a network error**

- Has Apple TV trusted the certificate? Without trust, Cheers rejects the decrypted connection
- A course opened from "最近观看" (Recently Watched) in Cheers showing a 404 error is an issue in Cheers itself and unrelated to this module. Open it from "我的课程" (My Courses) instead
- Change `codec` back to `AUTO` to rule out codec filtering
- Try a different CDN node to rule out a problem with the current one
- Temporarily disable the module or plugin to check whether the problem is related to the rewrite

**Apple TV cannot download or install the profile**

- Did you enter a URL that downloads the file directly? Cloud drive share pages and links that require a login or redirect usually do not work
- On tvOS 27, did you enter an HTTPS URL (HTTP is blocked) or use Apple Configurator? See [🔐 Install and Trust the CA Certificate on Apple TV](#-install-and-trust-the-ca-certificate-on-apple-tv)
- When using the LAN HTTP server, are the computer and Apple TV on the same LAN, and is the server still running?

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ❓ FAQ

<details>
<summary><kbd>Q: Surge or Loon, which should I choose?</kbd></summary>

The rewrite logic is the same, since both share the same script. The difference is that the Loon plugin only lets you pick from the nine preset nodes, while Surge accepts any hostname. Use whichever client you already have a license for. If you have neither, Loon costs less.

</details>

<details>
<summary><kbd>Q: Do I need an iPhone or iPad?</kbd></summary>

For Methods 1 and 2, yes. Surge tvOS cannot edit its configuration on the device, so the configuration and module must be deployed from Surge iOS. Loon tvOS syncs its configuration from iOS through iCloud, which is the only approach this guide covers. If you have a Mac but no iPhone, use Method 3.

</details>

<details>
<summary><kbd>Q: Can I do this without a computer at all?</kbd></summary>

Installing the certificate requires a computer (Mac, Windows, or Linux) to convert the certificate into a profile. On tvOS 26 and earlier, the same computer serves the profile for Apple TV to download. On tvOS 27, you need an HTTPS URL or Apple Configurator on a Mac. All of this is needed only once; day-to-day use does not require a computer.

</details>

<details>
<summary><kbd>Q: Does it work on a mainland China network or a VPN with a mainland China route?</kbd></summary>

Yes. On mainland China networks, Bilibili usually assigns MCDN or PCDN nodes, and the default `all` mode redirects them to your nodes (see [⚙️ Arguments](#️-arguments) for a few exceptions). If you are in mainland China and just want to avoid MCDN and PCDN, set `mode` to `pcdn`: when the stream has a regular URL, it becomes the primary URL and the original URL moves to the backup list.

</details>

<details>
<summary><kbd>Q: Do I need to buy a proxy server or subscription?</kbd></summary>

No. This project only uses the client's HTTPS decryption and scripting features. It works with no proxy servers in the configuration and everything going `DIRECT`.

</details>

<details>
<summary><kbd>Q: Does Apple TV's traffic have to go through a device running Surge or Loon?</kbd></summary>

Yes. The script only runs while a proxy client is processing the request. Without a client taking over the traffic, nothing rewrites the response. That device can be the Apple TV itself, though: run Surge tvOS or Loon tvOS directly on Apple TV, with no extra Mac or router needed.

</details>

<details>
<summary><kbd>Q: The certificate is installed and trusted. If I switch Apple TV's network back to automatic, does the rewrite still work?</kbd></summary>

No. The certificate only makes Apple TV accept the client's decrypted connections. It does not run the script or change any URL by itself. Once the network is back on automatic, traffic no longer passes through Surge on the Mac, and the rewriting stops. To stop depending on the Mac, switch to Method 1 or Method 2 and run the client on the Apple TV itself.

</details>

<details>
<summary><kbd>Q: The Surge Mac 7-day trial has ended and I do not want to buy it. What now?</kbd></summary>

Switch to Method 1 or Method 2. Surge tvOS comes free with a Surge iOS license and is unrelated to the Surge Mac license. Loon is a one-time purchase shared by iOS and tvOS. Neither method needs an always-on Mac.

</details>

<details>
<summary><kbd>Q: Do I need to reinstall the certificate when switching from Method 3 to Method 1 or 2?</kbd></summary>

Yes. Each client generates its own CA certificate, and Apple TV only trusts the one you installed. First switch Apple TV's IP and DNS configuration back to automatic, then go through all the steps of the new method and install the new client's certificate. You can delete the old certificate.

</details>

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📚 Official Documentation

- Surge: [Module][surge-manual-module-link] · [HTTPS Decryption][surge-manual-mitm-link] · [HTTP Response Script][surge-manual-script-link] · [Surge tvOS][surge-kb-tvos-link] · [Gateway Mode][surge-kb-gateway-link]
- Loon: [Docs home][loon-docs-link] · [Plugin][loon-docs-plugin-link] · [MitM][loon-docs-mitm-link] · [Certificate tool][loon-cert-tool-link]
- Apple: [Trust manually installed certificate profiles][apple-cert-trust-link] · [Certificates payload settings][apple-deploy-cert-link] · [Network security requirements (tvOS 27 and later)][apple-tls-requirements-link] · [Technical Q&A on installing profiles on Apple TV][apple-qa1948-link] · [Apple Configurator: connect devices][apple-configurator-connect-link] · [Apple Configurator: add profiles][apple-configurator-profiles-link] · [Pairing an Apple TV that is already set up][apple-install-beta-link]

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📝 License

Copyright © 2026-present [Babywbx][profile-link].<br/>
This project is [MIT](./LICENSE) licensed.

<!-- LINK GROUP -->

[apple-cert-trust-link]: https://support.apple.com/102390
[apple-configurator-connect-link]: https://support.apple.com/guide/apple-configurator-mac/connect-devices-to-your-mac-cad9d4b2211e/mac
[apple-configurator-profiles-link]: https://support.apple.com/guide/apple-configurator-mac/add-or-remove-configuration-profiles-cadb67fcd4f/mac
[apple-deploy-cert-link]: https://support.apple.com/guide/deployment/dep91d2eb26/web
[apple-install-beta-link]: https://developer.apple.com/support/install-beta/
[apple-qa1948-link]: https://developer.apple.com/library/archive/qa/qa1948/_index.html
[apple-tls-requirements-link]: https://support.apple.com/en-us/126655
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
[loon-docs-link]: https://nsloon.app/en/docs/intro
[loon-docs-mitm-link]: https://nsloon.app/docs/MitM/
[loon-docs-plugin-link]: https://nsloon.app/docs/Plugin/
[loon-import-link]: https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fbabywbx%2FBilibili-CDN-Redirect-Apple-TV%2Fmain%2FBilibili-CDN-Redirect.plugin
[profile-link]: https://github.com/babywbx
[surge-appstore-link]: https://apps.apple.com/us/app/surge-5/id1442620678
[surge-kb-gateway-link]: https://kb.nssurge.com/surge-knowledge-base/guidelines/gateway
[surge-kb-tvos-link]: https://kb.nssurge.com/surge-knowledge-base/guidelines/tvos
[surge-mac-link]: https://nssurge.com/
[surge-manual-mitm-link]: https://manual.nssurge.com/http/mitm.html
[surge-manual-module-link]: https://manual.nssurge.com/profile/module.html
[surge-manual-script-link]: https://manual.nssurge.com/scripting/http-response.html
[uv-install-link]: https://docs.astral.sh/uv/getting-started/installation/
[uv-link]: https://docs.astral.sh/uv/
