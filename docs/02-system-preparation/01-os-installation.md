---
id: os-installation
title: Ubuntu 24.04 LTS Server Installation
sidebar_label: OS Installation
sidebar_position: 1
description: Install and configure Ubuntu 24.04 LTS Server as the base operating system for your Aether SD-Core and srsRAN 5G deployment, including partitioning, essential packages, and service hardening.
keywords:
  - ubuntu 24.04
  - server installation
  - 5G base OS
  - system preparation
  - essential packages
  - BIOS settings
  - VT-d
  - IOMMU
---

# Ubuntu 24.04 LTS Server Installation

This guide walks through installing and configuring Ubuntu 24.04 LTS Server as the foundation for your private 5G network. The choices made here — partitioning, package selection, and service configuration — directly impact the stability and performance of the real-time workloads that follow.

## Prerequisites

Before beginning, ensure you have:

- A bootable USB drive with the [Ubuntu 24.04 LTS Server ISO](https://releases.ubuntu.com/24.04/)
- Physical or IPMI/iDRAC/iLO console access to your Intel Xeon server
- Network connectivity (at least one management interface)

:::tip
Use `dd` or [Balena Etcher](https://etcher.balena.io/) to create the bootable USB. Avoid tools that modify the ISO structure.
:::

## BIOS/UEFI Configuration

Before installing the OS, enter the BIOS/UEFI setup (typically by pressing F2, Del, or F12 during POST) and verify the following settings. These are critical for DPDK, SR-IOV, and real-time performance.

| Setting | Required Value | Why |
|---------|---------------|-----|
| **Intel VT-x** (Virtualization Technology) | Enabled | Required for KVM and container isolation |
| **Intel VT-d** (Directed I/O) | Enabled | Required for IOMMU, SR-IOV, and DPDK device passthrough |
| **Hyper-Threading** | Enabled | Doubles available logical cores; HT siblings are used for related workloads |
| **CPU C-States** | Disabled (C1 only or fully disabled) | Deep C-states add wake-up latency that violates real-time deadlines |
| **Intel Turbo Boost** | See note below | Optional; tradeoffs discussed below |
| **Power Profile** | Maximum Performance | Prevents the platform from throttling CPU or memory |
| **SR-IOV** | Enabled (if available in BIOS) | Required for Intel E810 virtual function creation |
| **Boot Mode** | UEFI | Required for modern kernel features and secure boot compatibility |

<!-- IMAGE PLACEHOLDER: [Screenshot of a typical Intel Xeon BIOS showing VT-d, VT-x, C-States, and Hyper-Threading settings highlighted] -->

### Turbo Boost: Tradeoffs

Turbo Boost allows individual cores to exceed their base frequency when thermal and power headroom permits. The tradeoff:

- **Enabled**: Higher peak single-thread performance, but frequency transitions introduce micro-jitter (typically 1-5 us). Some workloads benefit from the higher clock speed.
- **Disabled**: Cores run at a fixed base frequency. Eliminates frequency-transition jitter entirely. Preferred for the most latency-sensitive real-time workloads.

:::note
For initial deployment, **leave Turbo Boost enabled**. If you observe intermittent latency spikes during `cyclictest` validation (covered in [CPU Isolation](./04-cpu-isolation.md)), disable it and retest.
:::

## Installation Walkthrough

Boot from the USB drive and select **Install Ubuntu Server**.

### Language and Keyboard

Select your preferred language and keyboard layout. The defaults (English / US) are fine for most deployments.

### Network Configuration

During installation, configure at least one management network interface with a static IP or DHCP. Detailed network configuration (including the Intel E810 data-plane interfaces) is covered in [Section 03 - Network Configuration](../03-network-configuration/01-network-topology.md).

### Storage / Partitioning

Select **Custom storage layout** for optimal partitioning. The recommended layout for a system with a single 480 GB+ SSD:

| Mount Point | Size | Filesystem | Purpose |
|-------------|------|------------|---------|
| `/boot/efi` | 512 MB | FAT32 | EFI System Partition |
| `/boot` | 1 GB | ext4 | Kernel images and initramfs |
| `/` | 100 GB | ext4 | Root filesystem |
| `/var` | 200 GB | ext4 | Logs, container images, persistent volumes |
| `/tmp` | 10 GB | ext4 | Temporary files (optional, can use tmpfs) |
| `swap` | 8 GB | swap | Swap space (will be disabled for RT, but useful during installation) |
| `/home` | Remainder | ext4 | User data and source builds |

:::warning
A separate `/var` partition is strongly recommended. Container runtimes (Docker, containerd), log files, and Kubernetes persistent volumes all write heavily to `/var`. Isolating it prevents a full `/var` from rendering the root filesystem unusable.
:::

### User Account

Create a non-root administrative user (e.g., `aether`). This account will be used for all subsequent configuration. Enable the option to require a password for `sudo`.

### SSH Server

Select **Install OpenSSH server** when prompted. This allows remote management after installation.

### Package Selection

Skip the featured snaps selection. We will install everything we need manually.

## Post-Installation Configuration

After the first boot, log in (locally or via SSH) and perform the following steps.

### Update All Packages

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

:::tip
Always reboot after a kernel upgrade to ensure you are running the latest kernel before making further changes.
:::

### Set the Hostname

Choose a descriptive hostname that reflects the node's role:

```bash
sudo hostnamectl set-hostname gnb-du-01
```

Update `/etc/hosts` to include the new hostname:

```bash
echo "127.0.1.1 gnb-du-01" | sudo tee -a /etc/hosts
```

### Configure Static IP (Brief)

If you used DHCP during installation, switch to a static IP on the management interface using Netplan. A minimal example for `/etc/netplan/01-management.yaml`:

```yaml
network:
  version: 2
  ethernets:
    eno1:
      addresses:
        - 192.168.1.10/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
```

Apply with:

```bash
sudo netplan apply
```

:::note
Full network configuration — including Intel E810 data-plane interfaces, VLANs, and SR-IOV VFs — is covered in [Section 03 - Network Configuration](../03-network-configuration/01-network-topology.md).
:::

### Install Essential Packages

Install the base development tools and libraries required by DPDK, srsRAN, and supporting utilities:

```bash
sudo apt install -y \
  build-essential \
  git \
  cmake \
  python3-pip \
  python3-venv \
  linux-tools-common \
  linux-tools-$(uname -r) \
  hwloc \
  libhwloc-dev \
  numactl \
  libnuma-dev \
  meson \
  ninja-build \
  pkg-config \
  libfftw3-dev \
  libsctp-dev \
  libconfig-dev \
  libconfig++-dev \
  libyaml-cpp-dev \
  libgtest-dev \
  libmbedtls-dev \
  libzmq3-dev \
  net-tools \
  iproute2 \
  ethtool \
  pciutils \
  curl \
  wget \
  jq \
  htop \
  tmux \
  vim
```

**What each key package provides:**

| Package | Purpose |
|---------|---------|
| `build-essential`, `cmake`, `meson`, `ninja-build` | C/C++ compilation toolchain |
| `git` | Source code retrieval |
| `python3-pip`, `python3-venv` | Python tooling (used by some build systems) |
| `linux-tools-common`, `linux-tools-$(uname -r)` | `perf`, `cpupower`, and other kernel tools |
| `hwloc`, `libhwloc-dev` | CPU topology visualization (`lstopo`) |
| `numactl`, `libnuma-dev` | NUMA-aware memory allocation |
| `libfftw3-dev` | FFT library used by srsRAN PHY layer |
| `libsctp-dev` | SCTP protocol support (used by NGAP/F1AP) |
| `pkg-config` | Build dependency resolution |
| `ethtool`, `pciutils` | NIC and PCI device inspection |

### Disable Unnecessary Services

Several default Ubuntu services interfere with real-time performance or are simply unnecessary on a headless 5G server:

```bash
# Disable snap daemon (not needed, consumes resources)
sudo systemctl disable --now snapd.service snapd.socket snapd.seeded.service
sudo apt remove --purge -y snapd

# Disable unattended upgrades (prevents unexpected reboots and package changes)
sudo systemctl disable --now unattended-upgrades.service
sudo apt remove --purge -y unattended-upgrades

# Disable ModemManager (irrelevant on a server, can interfere with serial devices)
sudo systemctl disable --now ModemManager.service
sudo apt remove --purge -y modem-manager

# Disable power-profiles-daemon (conflicts with TuneD, covered in next sections)
sudo systemctl disable --now power-profiles-daemon.service

# Disable automatic crash reporting
sudo systemctl disable --now apport.service
```

:::danger
Disabling `unattended-upgrades` means you are responsible for applying security patches manually. Establish a maintenance window process for your lab.
:::

### Disable Swap

Swap introduces unpredictable latency when memory pages are swapped to disk. Disable it:

```bash
sudo swapoff -a
sudo sed -i '/\sswap\s/d' /etc/fstab
```

:::note
Swap will remain disabled through subsequent reboots after removing it from `/etc/fstab`. The [TuneD profile](./03-tuned-profiles.md) also sets `vm.swappiness=0` as an additional safeguard.
:::

## SSH Configuration Tips

Harden and optimize SSH for remote management of your 5G node.

Edit `/etc/ssh/sshd_config` or create a drop-in file at `/etc/ssh/sshd_config.d/99-aether.conf`:

```bash
# Disable password authentication (use SSH keys)
PasswordAuthentication no

# Disable root login
PermitRootLogin no

# Keep connections alive (useful for long build/debug sessions)
ClientAliveInterval 60
ClientAliveCountMax 120

# Limit access to the management user
AllowUsers aether
```

Apply the changes:

```bash
sudo systemctl restart ssh
```

:::tip
Before disabling password authentication, ensure you have copied your SSH public key to the server using `ssh-copy-id aether@<server-ip>`.
:::

## Verification Checklist

Before proceeding to the [Real-Time Kernel](./02-realtime-kernel.md) section, confirm:

```bash
# Verify OS version
lsb_release -a
# Expected: Ubuntu 24.04.x LTS

# Verify hostname
hostnamectl
# Expected: Static hostname matches what you set

# Verify essential tools are available
gcc --version && cmake --version && meson --version
numactl --hardware
lstopo --version

# Verify swap is disabled
free -h
# Expected: Swap total = 0

# Verify unnecessary services are stopped
systemctl is-active snapd.service unattended-upgrades.service ModemManager.service power-profiles-daemon.service
# Expected: all inactive
```

## Next Steps

With the base OS installed and configured, proceed to [Installing the Real-Time Kernel](./02-realtime-kernel.md) to meet the strict latency requirements of O-RAN Split 7.2 processing.
