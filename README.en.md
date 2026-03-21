<div align="center"><a name="readme-top"></a>

<h1>Bilibili CDN Redirect for Apple TV</h1>

A Surge module and response-rewrite script for **Apple TV Cheers App**<br/>
Redirect media URLs returned by Bilibili playback APIs to a designated CDN

[简体中文](./README.md) · **English**

<!-- SHIELD GROUP -->

[![][github-stars-shield]][github-stars-link]
[![][github-forks-shield]][github-forks-link]
[![][github-license-shield]][github-license-link]
[![][github-lastcommit-shield]][github-lastcommit-link]

</div>

<details>
<summary><kbd>Table of contents</kbd></summary>

#### TOC

- [📖 Overview](#-overview)
- [✨ Capabilities](#-capabilities)
- [🧭 Deployment Requirements](#-deployment-requirements)
- [🚀 Installation and Configuration](#-installation-and-configuration)
- [🔐 HTTPS Decryption (MITM)](#-https-decryption-mitm)
- [📺 Apple TV Certificate Installation and Trust](#-apple-tv-certificate-installation-and-trust)
- [⚙️ Module Arguments](#️-module-arguments)
- [🧩 Troubleshooting](#-troubleshooting)
- [📚 Official References](#-official-references)
- [📝 Credits](#-credits)

</details>

## 📖 Overview

`Bilibili CDN Redirect` uses Surge `http-response` scripting to rewrite JSON responses returned by Bilibili playback endpoints and redirect media URLs to a designated CDN.

Primary use cases:

- Optimize the Bilibili playback path for Apple TV Cheers App
- Rewrite DASH video and audio stream URLs
- Configure independent primary and backup CDN hosts
- Restrict playback to a preferred codec when required

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ✨ Capabilities

- **📡 Media URL Rewriting** - Rewrites media URLs returned by Bilibili playback APIs
- **🎬 DASH Support** - Supports DASH response structures for video and audio streams
- **🔀 CDN Routing** - Supports separate primary and backup CDN routing
- **🎞️ Codec Filtering** - Supports codec filtering for AVC / HEVC / AV1
- **📝 Log Control** - Supports log-level control and a debug switch

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🧭 Deployment Requirements

### 1. Surge

- The latest **Surge Mac / Surge iOS** versions are recommended
- The preferred topology is **Surge Mac** handling Apple TV egress traffic
- Apple TV and the Surge host should be on the same network

Recommended topology:

- Surge runs on a Mac
- Apple TV Cheers App sends traffic through that Surge instance

> \[!IMPORTANT]
>
> If Apple TV traffic does not pass through Surge, the module will not be triggered.

### 2. Apple TV certificate deployment environment

Recommended target platforms:

- **Apple TV HD / Apple TV 4K**
- **tvOS 14 or later** is recommended

Recommended personal deployment model:

- Generate the Surge root CA locally
- Package that certificate into a certificate-only `.mobileconfig`
- Import the profile directly on Apple TV through the built-in **Add Profile** path

> \[!NOTE]
>
> - Apple Configurator and MDM remain valid management paths, but they are not the primary installation flow described in this document
> - Apple TV (3rd generation) is not a recommended target platform here

### 3. Network reachability

- Apple TV traffic must actually pass through Surge
- The hosted `.sgmodule` and `.js` URLs must be reachable by the Surge instance
- GitHub Raw may be used as the default public distribution path
- `192.168.1.100:8000` is used in this document as the default LAN self-hosting example

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🚀 Installation and Configuration

### 1. Use GitHub Raw for module distribution

The recommended installation and reference URLs are the GitHub Raw endpoints:

```text
https://raw.githubusercontent.com/babywbx/bilibili-cdn-redirect-apple-tv/main/Bilibili-CDN-Redirect.sgmodule
https://raw.githubusercontent.com/babywbx/bilibili-cdn-redirect-apple-tv/main/Bilibili-CDN-Redirect.js
```

For public distribution, this is the simplest and most stable path.

### 2. Update `script-path`

If you do not want to use the default GitHub Raw script path and instead prefer LAN self-hosting, edit [Bilibili-CDN-Redirect.sgmodule](./Bilibili-CDN-Redirect.sgmodule) and replace:

```text
script-path=https://raw.githubusercontent.com/babywbx/bilibili-cdn-redirect-apple-tv/main/Bilibili-CDN-Redirect.js
```

with your own reachable address, for example:

```text
script-path=http://192.168.1.100:8000/Bilibili-CDN-Redirect.js
```

> \[!TIP]
>
> If you do not update this value, Surge may install the module successfully but fail to fetch the script.

### 3. Install the module in Surge

The recommended approach is to install it as an **Installed Module** via URL.

Suggested procedure:

1. Add an **Installed Module** in Surge
2. Set the module URL to the GitHub Raw `.sgmodule`:

```text
https://raw.githubusercontent.com/babywbx/bilibili-cdn-redirect-apple-tv/main/Bilibili-CDN-Redirect.sgmodule
```

3. Review and adjust the following arguments as required:
   - `cdn`
   - `cdnBackup`
   - `codec`
   - `logLevel`
   - `debug`
4. Enable the module

Post-installation checklist:

- The module is enabled
- Surge can access the configured `script-path`
- `api.bilibili.com` is included in the MITM host list

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🔐 HTTPS Decryption (MITM)

This module rewrites **JSON payloads inside HTTPS responses**.
Without HTTPS decryption, Surge cannot read the response body and the script cannot take effect.

### 1. Generate the Surge CA certificate

According to Surge's official documentation:

- Surge provides a **certificate generator**
- It is available in **Surge Dashboard (Mac)** and **Surge iOS Config Editor**
- The generated CA certificate is stored in the profile and the system keychain

Suggested procedure:

1. Generate a local CA using Surge's built-in certificate generator
2. Ensure MITM is enabled in Surge

> \[!WARNING]
>
> - The Surge root CA should be generated **locally by each user**
> - Publishing a reusable shared root CA or its private key in a public GitHub repository is not recommended
> - If a lower-friction setup is needed later, prefer distributing a **profile template** or a **local generation script**, not a shared certificate authority

### 2. MITM hostname scope

Surge explicitly states that it only decrypts hosts listed in the `hostname` declaration.

This module already includes:

```ini
[MITM]
hostname = %APPEND% api.bilibili.com
```

### 3. Manual trust on iPhone / iPad / Vision Pro

Apple explicitly states that manually installed certificate profiles on iOS / iPadOS / visionOS do not automatically receive full SSL/TLS trust.

Manual trust must be enabled in:

```text
Settings > General > About > Certificate Trust Settings
```

### 4. Conditions required for MITM

All of the following must be true:

- MITM is enabled in Surge
- The target hostname is listed in the MITM host scope
- The client device has the CA certificate installed and trusted

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📺 Apple TV Certificate Installation and Trust

Certificate deployment on Apple TV is the most critical part of the setup.

### Installation path used in this guide

This document uses the currently field-validated tvOS profile import path:

```text
Settings > General > Privacy / Privacy & Security
→ highlight Share Apple TV Analytics or Send Apple TV Analytics
→ press Play/Pause on the remote
→ select Add Profile
```

> \[!NOTE]
>
> - Apple's public documentation clearly documents the general configuration-profile distribution model and manual profile installation mechanisms
> - However, Apple does not currently publish this **Add Profile** remote-trigger sequence as a step-by-step tvOS user guide
> - The hidden Add Profile path itself has been consistently documented and validated by NextDNS, UDID utility sites, and multiple long-running tvOS community references
> - For that reason, this guide uses it as the **practical tvOS installation path**, while still grounding the underlying profile mechanism in Apple's official documentation

### Step A: Export the Surge root certificate

1. Generate the certificate on the Mac running Surge
2. Open **Keychain Access**
3. Locate the Surge-generated root CA certificate
4. Select the certificate and choose:
   `File > Export Items`
5. Export a certificate file suitable for profile delivery

> \[!TIP]
>
> - Prefer a public certificate file such as `.cer`, `.crt`, or `.der`
> - Do not import the private key onto Apple TV

### Step B: Generate a certificate-only `.mobileconfig`

The Apple TV hidden import path installs a **configuration profile**, not a raw certificate file.
You therefore need a certificate-only `.mobileconfig` that contains the exported Surge root CA as a certificate payload.

This repository ships two generator entry points:

- [tools/apple-tv-profile/build_mobileconfig.py](./tools/apple-tv-profile/build_mobileconfig.py)
- [tools/apple-tv-profile/build-mobileconfig.sh](./tools/apple-tv-profile/build-mobileconfig.sh)

Recommended usage:

- The `uv` entry point is the **cross-platform primary path** for macOS / Linux / Windows
- The `sh` entry point is a convenience wrapper for **macOS / Linux**

Cross-platform usage:

```bash
uv run tools/apple-tv-profile/build_mobileconfig.py /path/to/SurgeRootCA.cer
```

Equivalent Python usage:

```bash
python3 tools/apple-tv-profile/build_mobileconfig.py /path/to/SurgeRootCA.cer
```

Unix convenience usage:

```bash
./tools/apple-tv-profile/build-mobileconfig.sh /path/to/SurgeRootCA.cer
```

To specify an output path:

```bash
uv run tools/apple-tv-profile/build_mobileconfig.py /path/to/SurgeRootCA.cer --output ./Surge-Root-CA.mobileconfig
```

Equivalent Python usage:

```bash
python3 tools/apple-tv-profile/build_mobileconfig.py /path/to/SurgeRootCA.cer --output ./Surge-Root-CA.mobileconfig
```

The script hard-codes the following branding defaults:

- Profile name: `Babywbx Surge MITM Profile`
- Organization: `Babywbx`
- Certificate name: `Babywbx Surge Root CA`

The output is a `.mobileconfig` file ready for the Apple TV **Add Profile** workflow.

### Step C: Host the `.mobileconfig`

For locally generated certificate profiles, LAN distribution is recommended.
Example:

```text
http://<your-lan-ip>:8000/Surge-Root-CA.mobileconfig
```

The simplest local file server can be started with:

```bash
uv run -- python -m http.server 8000 --bind 0.0.0.0
```

If `uv` is not being used, the equivalent command is:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

> \[!IMPORTANT]
>
> - Use a **direct file URL**
> - Do not use a share page, landing page, or authenticated cloud-drive URL
> - The Apple TV Add Profile dialog is most reliable with a short, direct file path

### Step D: Import the profile on Apple TV

1. Open **Settings** on Apple TV
2. Navigate to:
   `General > Privacy`
   or, on newer versions:
   `General > Privacy & Security`
3. Move focus to:
   `Share Apple TV Analytics`
   or:
   `Send Apple TV Analytics`
4. **Do not open that item**
5. Press **Play/Pause** on the remote
6. Select **Add Profile**
7. Enter the direct `.mobileconfig` URL prepared earlier
8. Complete the on-screen installation flow

### Step E: Verify the deployment

Suggested verification sequence:

1. Confirm that the profile installation completed on Apple TV
2. Launch Cheers App on Apple TV and start actual playback
3. In Surge, confirm:
   - The module is matched
   - The `http-response` script is executed
   - The request is not simply passed through without decryption
4. If the module matches but decrypted responses are still unavailable, verify first:
   - Whether the certificate was installed but did not obtain full trust
   - Whether Apple TV traffic actually passes through Surge
   - Whether the imported file is a certificate-only `.mobileconfig`
   - Whether the entered URL is a direct file URL rather than a share page

### Deployment recommendation

For long-term stability, the recommended combination is:

- Surge Mac
- A locally generated Surge root CA
- A certificate-only `.mobileconfig`
- Apple TV profile import via the built-in Add Profile path

> \[!WARNING]
>
> - A shared pre-generated root CA or private key should **not** be published in a public repository
> - Once a root CA is shared, the confidentiality and trust boundary of the MITM chain is effectively destroyed
> - If the project later needs a simpler onboarding flow, the preferred approach is to provide:
>   - A `.mobileconfig` template
>   - A local generation script
>   - A documented export-and-packaging workflow
> - A reusable public root CA should not be part of that design

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ⚙️ Module Arguments

Supported arguments:

| Argument | Description | Default |
| --- | --- | --- |
| `cdn` | Primary CDN hostname | `cn-hk-eq-01-09.bilivideo.com` |
| `cdnBackup` | Backup CDN hostname | `cn-hk-eq-01-13.bilivideo.com` |
| `codec` | Preferred codec, optional | empty |
| `logLevel` | Log level: `ERROR` / `WARN` / `INFO` / `DEBUG` | `WARN` |
| `debug` | Debug switch | `true` |

Argument substitution model:

- Surge module parameters use `%param%` placeholders
- This module maps:
  - `%cdn%`
  - `%cdnBackup%`
  - `%logLevel%`
  - `%codec%`
  - `%debug%`
  into the actual script rule

Suggested codec values:

- `AVC` / `H264` / `H.264`
- `HEVC` / `H265` / `H.265`
- `AV1`

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🧩 Troubleshooting

### The module is enabled, but playback URLs do not change

Verify first:

- Whether `script-path` is reachable
- Whether Apple TV traffic actually passes through Surge
- Whether MITM is enabled
- Whether the Apple TV CA certificate is installed and trusted

### Surge sees the request, but there is no script log

Check:

- Whether the `pattern` matches
- Whether `requires-body=1` is still present
- Whether `max-size` is too small and causes pass-through
- Whether `logLevel` is set too low

### The certificate is installed on Apple TV, but decryption still appears inactive

This usually indicates one of the following:

- The certificate is installed but does not have full SSL/TLS trust
- The deployment path is not one of Apple's documented automatic-trust paths
- The imported file is not a certificate-only `.mobileconfig`
- The entered URL is not a direct file URL

### Cheers App playback fails immediately

Possible causes include:

- The target endpoint changed
- Some requests no longer hit `api.bilibili.com`
- The app applies stricter certificate policies
- The selected CDN host is currently unavailable

### Why `max-size=0` is not recommended

Surge's documentation explains that `http-request` / `http-response` scripts must load the full body into memory.
For Bilibili `playurl` JSON responses, an explicit bound is generally more appropriate than an unlimited body size.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📚 Official References

### Surge

- [Surge Module documentation](https://manual.nssurge.com/others/module.html)
- [Surge HTTPS Decryption documentation](https://manual.nssurge.com/http-processing/mitm.html)
- [Surge Scripting Basic documentation](https://manual.nssurge.com/scripting/common.html)

### Apple

- [Trust manually installed certificate profiles in iOS, iPadOS, and visionOS](https://support.apple.com/102390)
- [Certificates device management payload settings for Apple devices](https://support.apple.com/guide/deployment/dep91d2eb26/web)
- [Certificates declarative configuration for Apple devices](https://support.apple.com/guide/deployment/depbdaa1115b/web)
- [Import and export keychain items using Keychain Access on Mac](https://support.apple.com/guide/keychain-access/kyca35961/mac)

### Supplementary community references

- [NextDNS community: Apple TV profile installation path using the Add Profile entry](https://help.nextdns.io/t/35hncsv/apple-tv-and-profiles-an-easy-install)
- [UDID.in: Apple TV profile installation through the hidden Add Profile path](https://www.udid.in/find-udid)

> \[!NOTE]
>
> - This README was checked against the official sources above on **2026-03-21**
> - The Apple TV certificate-installation section combines Apple's documented profile-distribution model with the currently reproducible Add Profile workflow documented by long-running community references
> - Commands in this document use `uv run` by default; if `uv` is not part of the environment, equivalent `python3` commands may be used instead

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📝 Credits

This project is maintained by **Babywbx** and released under the [MIT License][github-license-link].

If you redistribute, adapt, or quote this project, retaining the following information is recommended:

- Project name: `Bilibili CDN Redirect for Apple TV`
- Author attribution: `Babywbx`
- License notice: `MIT License`
- Relevant official documentation references

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
