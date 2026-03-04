---
id: software-prerequisites
title: Software Prerequisites
sidebar_label: Software Prerequisites
sidebar_position: 4
description: >
  Complete list of software versions, repositories, and tools required for the
  Aether SD-Core + srsRAN private 5G lab tutorial, including tested version
  combinations and download links.
keywords:
  - Ubuntu 24.04
  - DPDK 24.11
  - srsRAN Project
  - LinuxPTP
  - Kubernetes
  - SD-Core Helm charts
  - 5G software stack
---

# Software Prerequisites

This page lists every piece of software used in the tutorial, the specific versions that have been tested together, and where to obtain them. **Version compatibility matters** — the tested combinations below are known to work together. Mixing versions may introduce subtle issues.

## Tested Software Stack

The following table is the authoritative version reference for this tutorial. Each section will walk you through installation, but this page serves as the single source of truth for which versions to use.

| Software | Version | Purpose | Source |
|---|---|---|---|
| **Ubuntu Server** | 24.04 LTS (Noble Numbat) | Base operating system | [ubuntu.com/download/server](https://ubuntu.com/download/server) |
| **Linux Kernel (RT)** | 6.8.x-realtime (Ubuntu HWE) | Real-time kernel for deterministic scheduling | Ubuntu `linux-image-realtime` package |
| **DPDK** | 24.11.2 (LTS) | Data Plane Development Kit for high-speed packet I/O | [core.dpdk.org/download](https://core.dpdk.org/download/) |
| **srsRAN Project** | Latest stable (24.10+) | Open-source 5G gNB (DU) with ORAN Split 7.2 | [github.com/srsran/srsRAN_Project](https://github.com/srsran/srsRAN_Project) |
| **LinuxPTP** | 4.x | IEEE 1588 PTP implementation for fronthaul timing | [github.com/richardcochran/linuxptp](https://github.com/richardcochran/linuxptp) |
| **Kubernetes** | 1.29+ | Container orchestration for SD-Core | [kubernetes.io](https://kubernetes.io/) |
| **Helm** | 3.14+ | Kubernetes package manager for SD-Core charts | [helm.sh](https://helm.sh/) |
| **SD-Core Helm Charts** | Latest from ONF | Aether SD-Core deployment charts | [github.com/omec-project](https://github.com/omec-project) |
| **Docker / containerd** | Docker 27.x / containerd 1.7.x | Container runtime | [docs.docker.com](https://docs.docker.com/) |
| **pySim** | Latest from git | SIM card programming tool | [github.com/osmocom/pysim](https://github.com/osmocom/pysim) |
| **TuneD** | 2.x (Ubuntu package) | System tuning profiles (real-time, latency) | Ubuntu `tuned` package |
| **ice Driver** | Latest from Intel | Intel E810 NIC kernel driver | [github.com/intel/ethernet-linux-ice](https://github.com/intel/ethernet-linux-ice) |
| **iavf Driver** | Latest from Intel | Intel E810 VF driver (if using SR-IOV) | [github.com/intel/ethernet-linux-iavf](https://github.com/intel/ethernet-linux-iavf) |

:::warning
**Do not use Ubuntu 22.04** for this tutorial. While it can work, the kernel, DPDK, and driver versions in 22.04 require significant manual backporting. Ubuntu 24.04 LTS provides a much smoother experience with its HWE kernel and newer toolchain.
:::

## Detailed Software Notes

### Ubuntu 24.04 LTS Server

We use the **Server** installation (no desktop environment). The minimal install is preferred — a desktop environment adds unnecessary services, timers, and interrupts that interfere with real-time performance.

```bash
# Verify your Ubuntu version after installation
$ lsb_release -a
Distributor ID: Ubuntu
Description:    Ubuntu 24.04 LTS
Release:        24.04
Codename:       noble
```

:::tip
During Ubuntu installation, select **"Ubuntu Server (minimized)"** if available. Deselect all optional snaps and features. We will install exactly what we need.
:::

### Linux RT Kernel

The real-time (PREEMPT_RT) kernel is essential for deterministic scheduling of srsRAN's time-critical threads. Ubuntu 24.04 provides an RT kernel via the HWE (Hardware Enablement) stack.

```bash
# Install the real-time kernel
$ sudo apt-get install linux-image-realtime linux-headers-realtime
```

After installation and reboot, verify:

```bash
$ uname -r
6.8.0-xx-realtime

$ uname -v | grep PREEMPT_RT
#xx~24.04.1-Ubuntu SMP PREEMPT_RT ...
```

The RT kernel is covered in detail in [System Preparation](../02-system-preparation/01-os-installation.md).

### DPDK 24.11.2

DPDK provides the poll-mode drivers that srsRAN uses for high-speed, low-latency packet I/O on the fronthaul interface. We build DPDK from source to ensure the correct version and configuration.

**Repository:** https://core.dpdk.org/download/

```bash
# Download and extract
$ wget https://fast.dpdk.org/rel/dpdk-24.11.2.tar.xz
$ tar xf dpdk-24.11.2.tar.xz
```

:::note
srsRAN links against DPDK at compile time. The DPDK version must be compatible with the srsRAN version you are building. The combination of **DPDK 24.11.2 + srsRAN 24.10+** has been validated.
:::

We build and install DPDK in [Network Configuration](../03-network-configuration/01-network-topology.md).

### srsRAN Project

srsRAN Project is the 5G NR gNodeB implementation. It is built from source with DPDK and ORAN Split 7.2 fronthaul support enabled.

**Repository:** https://github.com/srsran/srsRAN_Project

```bash
$ git clone https://github.com/srsran/srsRAN_Project.git
$ cd srsRAN_Project
$ git checkout <latest_stable_tag>
```

Build dependencies (installed during the build process):

```bash
$ sudo apt-get install cmake gcc g++ libfftw3-dev libmbedtls-dev \
    libsctp-dev libyaml-cpp-dev libgtest-dev libzmq3-dev \
    pkg-config python3-pip
```

srsRAN build and configuration are covered in [RAN Deployment](../05-ran-deployment/01-srsran-overview.md).

### LinuxPTP 4.x

LinuxPTP provides the `ptp4l` and `phc2sys` daemons for IEEE 1588 Precision Time Protocol. This is required for time synchronization between the DU and RU on the fronthaul.

**Repository:** https://github.com/richardcochran/linuxptp

```bash
$ git clone https://github.com/richardcochran/linuxptp.git
$ cd linuxptp
$ git checkout v4.2   # or latest 4.x tag
$ make
$ sudo make install
```

:::note
The Ubuntu package `linuxptp` may lag behind upstream. Building from source ensures you have the latest E810-specific fixes and features.
:::

PTP configuration is covered in detail in [Timing & Synchronization](../04-timing-synchronization/01-ptp-overview.md).

### Kubernetes 1.29+

Kubernetes orchestrates the SD-Core network functions. For a single-server lab, we use either:

- **kubeadm**: Standard Kubernetes installer for a single-node cluster.
- **Aether OnRamp**: ONF's automated deployment tool that bootstraps Kubernetes and SD-Core together.

**Reference:** https://kubernetes.io/docs/setup/

```bash
# Verify Kubernetes version after installation
$ kubectl version --client
Client Version: v1.29.x
```

Kubernetes setup is covered in [Core Network](../06-core-network/01-sd-core-overview.md) and [Kubernetes Deployment](../08-kubernetes-deployment/01-k8s-cluster-setup.md).

### Helm 3.x

Helm is the package manager used to deploy SD-Core's Kubernetes manifests (Helm charts).

**Reference:** https://helm.sh/docs/intro/install/

```bash
$ curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
$ helm version
version.BuildInfo{Version:"v3.14.x", ...}
```

### SD-Core Helm Charts

The SD-Core network functions are distributed as Helm charts from ONF's repositories.

**Repository:** https://github.com/omec-project

Key chart repositories:

| Chart | Repository | Contains |
|---|---|---|
| `sdcore-helm-charts` | `omec-project/sdcore-helm-charts` | Umbrella chart for all SD-Core NFs |
| `upf-helm-charts` | `omec-project/upf` | BESS-based UPF |

```bash
$ helm repo add aether https://charts.aetherproject.org
$ helm repo update
```

SD-Core deployment is covered in [Core Network](../06-core-network/01-sd-core-overview.md).

### Docker and containerd

Docker (or containerd directly) is the container runtime for Kubernetes. Ubuntu 24.04 uses containerd as the default CRI (Container Runtime Interface).

**Reference:** https://docs.docker.com/engine/install/ubuntu/

```bash
# Install Docker (which includes containerd)
$ sudo apt-get install docker-ce docker-ce-cli containerd.io

# Or install containerd standalone for Kubernetes
$ sudo apt-get install containerd.io
```

### pySim

pySim is the open-source tool for programming SIM cards. It is used to write IMSI, Ki, OPc, and other parameters to Sysmocom SJA2 cards.

**Repository:** https://github.com/osmocom/pysim

```bash
$ git clone https://github.com/osmocom/pysim.git
$ cd pysim
$ pip3 install -r requirements.txt
```

pySim usage is covered in [Core Network](../06-core-network/01-sd-core-overview.md) when we provision subscribers.

### TuneD

TuneD applies system-level performance profiles. We use it for the `realtime` profile, which configures CPU governor, IRQ affinity, kernel parameters, and other settings for low-latency operation.

```bash
$ sudo apt-get install tuned tuned-profiles-realtime
$ sudo tuned-adm profile realtime
```

TuneD configuration is covered in [System Preparation](../02-system-preparation/01-os-installation.md).

### Intel E810 NIC Drivers

The in-tree `ice` driver included with Ubuntu 24.04's kernel is typically sufficient. However, for the latest PTP features and bug fixes, you may want the out-of-tree driver from Intel.

**Repository:** https://github.com/intel/ethernet-linux-ice

```bash
# Check current driver version
$ ethtool -i ens1f0 | grep "driver\|version"
driver: ice
version: ...
firmware-version: ...
```

:::tip
If the in-tree driver works for your setup, keep it. Only build the out-of-tree driver if you encounter PTP or DPDK issues that are fixed in a newer release. We will call this out in the relevant sections.
:::

## Additional Utilities

These tools are not core components but are used throughout the tutorial:

| Tool | Purpose | Install |
|---|---|---|
| `tcpdump` | Packet capture for debugging N2, N3, N4 interfaces | `sudo apt-get install tcpdump` |
| `tshark` | CLI Wireshark for protocol-level packet analysis | `sudo apt-get install tshark` |
| `ethtool` | NIC configuration and diagnostics | `sudo apt-get install ethtool` |
| `numactl` | NUMA topology inspection and CPU pinning | `sudo apt-get install numactl` |
| `hwloc` / `lstopo` | Hardware topology visualization | `sudo apt-get install hwloc` |
| `stress-ng` | System stress testing for validation | `sudo apt-get install stress-ng` |
| `htop` | Interactive process viewer with CPU core display | `sudo apt-get install htop` |
| `jq` | JSON parsing for API responses | `sudo apt-get install jq` |
| `pcscd` | PC/SC smart card daemon (for SIM programming) | `sudo apt-get install pcscd` |

Install all utilities at once:

```bash
$ sudo apt-get install -y tcpdump tshark ethtool numactl hwloc \
    stress-ng htop jq pcscd pcsc-tools
```

## Version Compatibility Matrix

The following combinations have been tested and confirmed working:

| Ubuntu | Kernel | DPDK | srsRAN | LinuxPTP | K8s | Status |
|---|---|---|---|---|---|---|
| 24.04 LTS | 6.8.x-realtime | 24.11.2 | 24.10+ | 4.2 | 1.29 | **Validated** |
| 24.04 LTS | 6.8.x-realtime | 23.11.x | 24.04+ | 4.0 | 1.29 | Functional, older |
| 22.04 LTS | 5.15.x-realtime | 22.11.x | 23.10+ | 3.1.1 | 1.28 | Not covered here |

:::danger
**Do not mix DPDK major versions with srsRAN builds compiled against a different DPDK version.** srsRAN links against DPDK at compile time. If you upgrade DPDK, you must rebuild srsRAN. A mismatched DPDK version will cause link errors or undefined behavior at runtime.
:::

## Disk Space Requirements

Ensure your NVMe SSD has sufficient space for all components:

| Component | Approximate Size |
|---|---|
| Ubuntu 24.04 base install | 5 GB |
| RT kernel + headers | 1 GB |
| DPDK source + build | 3 GB |
| srsRAN source + build | 5 GB |
| Container images (SD-Core) | 8-10 GB |
| Kubernetes system components | 3 GB |
| Logs and packet captures | 10-50 GB (varies) |
| **Total recommended free space** | **50 GB minimum, 100 GB+ recommended** |

## Firewall and Security Notes

During the tutorial, we assume the lab server is on a **private, isolated network** that is not exposed to the internet. Default firewall rules (UFW) are disabled to simplify configuration:

```bash
$ sudo ufw disable
```

:::warning
**Do not expose your lab server to the public internet with the firewall disabled.** The 5G core network functions, Kubernetes API server, and management interfaces have no authentication hardened for public exposure. If your lab server must be internet-accessible, keep UFW enabled and open only the specific ports you need (SSH, etc.). Firewall hardening is outside the scope of this tutorial.
:::

## Kernel Boot Parameters

Several kernel boot parameters are required throughout the tutorial. Here is a preview of the complete set — each parameter is explained in the section where it is configured:

```bash title="/etc/default/grub (GRUB_CMDLINE_LINUX_DEFAULT)"
intel_iommu=on iommu=pt hugepagesz=1G hugepages=16 default_hugepagesz=1G \
isolcpus=4-11 nohz_full=4-11 rcu_nocbs=4-11 nosoftlockup \
processor.max_cstate=0 intel_idle.max_cstate=0 idle=poll
```

| Parameter | Purpose | Configured In |
|---|---|---|
| `intel_iommu=on` | Enable Intel IOMMU for DPDK VFIO | [Network Configuration](../03-network-configuration/01-network-topology.md) |
| `iommu=pt` | IOMMU passthrough mode for performance | [Network Configuration](../03-network-configuration/01-network-topology.md) |
| `hugepagesz=1G hugepages=16` | Allocate 1G hugepages for DPDK | [System Preparation](../02-system-preparation/01-os-installation.md) |
| `default_hugepagesz=1G` | Set default hugepage size | [System Preparation](../02-system-preparation/01-os-installation.md) |
| `isolcpus=4-11` | Isolate CPU cores from kernel scheduler | [CPU Isolation](../02-system-preparation/04-cpu-isolation.md) |
| `nohz_full=4-11` | Disable timer ticks on isolated cores | [CPU Isolation](../02-system-preparation/04-cpu-isolation.md) |
| `rcu_nocbs=4-11` | Move RCU callbacks off isolated cores | [CPU Isolation](../02-system-preparation/04-cpu-isolation.md) |
| `nosoftlockup` | Suppress soft lockup warnings on isolated cores | [System Preparation](../02-system-preparation/01-os-installation.md) |
| `processor.max_cstate=0` | Disable CPU C-states for lowest latency | [System Preparation](../02-system-preparation/01-os-installation.md) |
| `intel_idle.max_cstate=0` | Disable Intel idle driver C-states | [System Preparation](../02-system-preparation/01-os-installation.md) |
| `idle=poll` | Busy-poll instead of entering idle states | [System Preparation](../02-system-preparation/01-os-installation.md) |

:::note
The `isolcpus=4-11` range shown above is an example. Your actual core numbers depend on your CPU topology and NUMA layout. We determine the correct values in [CPU Isolation](../02-system-preparation/04-cpu-isolation.md).
:::

## Next Steps

With hardware in hand and software versions identified, you are ready to begin building. Proceed to [System Preparation](../02-system-preparation/01-os-installation.md) to install Ubuntu, configure the BIOS, and set up the real-time kernel.
