---
id: dpdk-setup
title: "DPDK Setup for Fronthaul Acceleration"
sidebar_label: DPDK Setup
sidebar_position: 2
description: >
  Build and configure DPDK 24.11.2 for kernel-bypass packet processing on the
  Intel E810-XXVDA4T NIC. Covers IOMMU verification, hugepages, SR-IOV Virtual
  Functions, vfio-pci driver binding, testpmd validation, and boot-time
  persistence.
keywords:
  - DPDK
  - DPDK 24.11.2
  - kernel bypass
  - vfio-pci
  - SR-IOV
  - Virtual Functions
  - Intel E810
  - eCPRI fronthaul
  - dpdk-devbind
  - testpmd
  - hugepages
  - IOMMU
---

# DPDK Setup for Fronthaul Acceleration

The ORAN Split 7.2 fronthaul between the DU (srsRAN) and the RU carries time-critical IQ sample data over eCPRI. Processing this traffic through the normal Linux kernel network stack introduces too much latency and jitter. **DPDK** (Data Plane Development Kit) solves this by allowing srsRAN to access the NIC directly from userspace, bypassing the kernel entirely.

This page walks through building DPDK from source, configuring the Intel E810 for SR-IOV, binding Virtual Functions to the DPDK-compatible `vfio-pci` driver, and verifying the setup with `testpmd`.

<!-- IMAGE PLACEHOLDER: Diagram comparing kernel networking path (NIC -> driver -> kernel stack -> socket -> application) versus DPDK path (NIC -> vfio-pci -> DPDK PMD -> application), highlighting the reduced latency and CPU overhead of the DPDK path. -->

## Why DPDK Is Needed

In a Split 7.2 deployment, the DU must:

1. **Receive** eCPRI frames containing uplink IQ samples from the RU.
2. **Process** the IQ data (FFT, channel estimation, decoding) within the 5G NR slot timing budget.
3. **Transmit** downlink IQ samples back to the RU before the next slot deadline.

A 5G NR slot at subcarrier spacing 30 kHz is **500 microseconds**. The kernel network stack alone can introduce hundreds of microseconds of latency through interrupt handling, context switches, and memory copies. DPDK eliminates these overheads by:

- **Polling** the NIC directly (no interrupts).
- **Zero-copy** packet access via pre-allocated hugepage-backed memory.
- **Userspace drivers** (Poll Mode Drivers, or PMDs) that talk directly to the NIC hardware.

:::note
DPDK is used **only for the fronthaul interface** (E810 Port 0). The backhaul (N2/N3) and data (N6) interfaces remain under normal kernel networking, as their latency requirements are far less stringent.
:::

## Prerequisites Verification

Before building DPDK, verify that three critical prerequisites are in place.

### 1. IOMMU Enabled

DPDK's `vfio-pci` driver requires IOMMU to map device memory safely into userspace. Verify the kernel command line includes `intel_iommu=on` and `iommu=pt`:

```bash
$ cat /proc/cmdline | tr ' ' '\n' | grep iommu
intel_iommu=on
iommu=pt
```

If these parameters are missing, add them to your GRUB configuration:

```bash
$ sudo sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="\(.*\)"/GRUB_CMDLINE_LINUX_DEFAULT="\1 intel_iommu=on iommu=pt"/' /etc/default/grub
$ sudo update-grub
$ sudo reboot
```

:::danger
Without `intel_iommu=on`, the `vfio-pci` driver will fail to bind, and DPDK will not function. This is a hard requirement. If you followed the [System Preparation](../02-system-preparation/01-os-installation.md) section, these parameters should already be set.
:::

Verify IOMMU groups are present after boot:

```bash
$ find /sys/kernel/iommu_groups/ -maxdepth 1 -mindepth 1 -type d | wc -l
# Should return a non-zero number (typically 50-200+)
```

### 2. SR-IOV Capable NIC

The Intel E810-XXVDA4T supports SR-IOV (Single Root I/O Virtualization), which allows creating lightweight **Virtual Functions (VFs)** from the physical NIC. srsRAN uses a VF (rather than the Physical Function directly) so the PF remains available for management tasks.

Verify SR-IOV support:

```bash
$ lspci -vvv -s $(lspci | grep E810 | head -1 | awk '{print $1}') | grep -i "sr-iov"
#   Capabilities: [1a0] Single Root I/O Virtualization (SR-IOV)
```

Check the maximum number of VFs supported:

```bash
$ cat /sys/class/net/enp81s0f0/device/sriov_totalvfs
# Typically 128 or 256 for E810
```

### 3. Hugepages Allocated

DPDK uses hugepages for its memory pools. Verify that hugepages are allocated (this should have been configured in the [System Preparation](../02-system-preparation/01-os-installation.md) section):

```bash
$ grep -i huge /proc/meminfo
AnonHugePages:         0 kB
ShmemHugePages:        0 kB
FileHugePages:         0 kB
HugePages_Total:      16
HugePages_Free:       16
HugePages_Rsvd:        0
HugePages_Surp:        0
Hugepagesize:    1048576 kB
```

You need at least **8 GB** of hugepages (8 x 1 GB pages, or equivalent in 2 MB pages). For a production deployment, **16 GB** (16 x 1 GB pages) is recommended.

If hugepages are not allocated, set them up now:

```bash
# For 1 GB hugepages (requires kernel cmdline: hugepagesz=1G hugepages=16)
$ cat /proc/cmdline | tr ' ' '\n' | grep huge
hugepagesz=1G
hugepages=16

# For 2 MB hugepages (can be allocated at runtime):
$ echo 8192 | sudo tee /sys/kernel/mm/hugepages/hugepages-2048kB/nr_hugepages

# Mount the hugetlbfs if not already mounted:
$ mount | grep hugetlbfs || sudo mount -t hugetlbfs nodev /dev/hugepages
```

:::tip
1 GB hugepages provide better TLB efficiency than 2 MB hugepages and are strongly recommended for DPDK workloads. However, 1 GB hugepages **must** be reserved at boot time via kernel command line parameters -- they cannot be allocated at runtime.
:::

## Building DPDK 24.11.2 from Source

srsRAN requires a specific DPDK version. We build from source to ensure compatibility and to include the E810 PMD (Poll Mode Driver).

### Install Build Dependencies

```bash
$ sudo apt-get update
$ sudo apt-get install -y \
    build-essential \
    meson \
    ninja-build \
    python3-pyelftools \
    libnuma-dev \
    pkg-config \
    python3-pip
```

### Download and Build

```bash
$ cd /usr/local/src
$ sudo wget https://fast.dpdk.org/rel/dpdk-24.11.2.tar.xz
$ sudo tar xf dpdk-24.11.2.tar.xz
$ cd dpdk-stable-24.11.2
```

Configure the build with Meson:

```bash
$ sudo meson setup build
```

:::note
The default Meson configuration builds all drivers including the `net_ice` PMD for the Intel E810. If you want a minimal build to reduce compile time, you can disable unused drivers with `-Ddisable_drivers=net/af_packet,net/...`. For simplicity, we build everything.
:::

Build and install:

```bash
$ cd build
$ sudo ninja
$ sudo ninja install
$ sudo ldconfig
```

Verify the installation:

```bash
$ pkg-config --modversion libdpdk
24.11.2

$ dpdk-devbind.py --version
# Should print version information without errors
```

## Driver Comparison: vfio-pci vs igb_uio

DPDK supports multiple kernel drivers to expose NIC hardware to userspace. The two most common are:

| Feature | vfio-pci (Recommended) | igb_uio (Legacy) |
|---------|----------------------|-------------------|
| **IOMMU support** | Yes -- full IOMMU isolation | No -- requires `iommu=off` or passthrough hacks |
| **Security** | Device memory access is IOMMU-protected | Direct physical memory access (security risk) |
| **Upstream status** | In mainline kernel | Not in mainline; ships with DPDK source as a kmod |
| **Permissions** | Can work with non-root via VFIO group permissions | Requires root |
| **Recommendation** | Use this | Avoid unless vfio-pci does not work |

:::warning
The `igb_uio` driver is considered legacy and is not recommended for new deployments. It requires disabling IOMMU, which weakens system security and can conflict with other IOMMU-dependent features. Use `vfio-pci` unless you have a specific reason not to.
:::

## Load the vfio-pci Module

```bash
$ sudo modprobe vfio-pci
```

Verify it loaded:

```bash
$ lsmod | grep vfio
vfio_pci               16384  0
vfio_pci_core          86016  1 vfio_pci
vfio_iommu_type1       45056  0
vfio                   65536  3 vfio_pci,vfio_pci_core,vfio_iommu_type1
```

To load `vfio-pci` automatically at boot:

```bash
$ echo "vfio-pci" | sudo tee /etc/modules-load.d/vfio-pci.conf
```

## Creating Virtual Functions (SR-IOV)

srsRAN uses a **Virtual Function** on the E810 fronthaul port. This leaves the Physical Function (PF) under kernel control for management, while the VF is bound to DPDK.

### Create VFs on the Fronthaul Port

```bash
# First, ensure the interface is up
$ sudo ip link set enp81s0f0 up

# Create 4 VFs (you only need 1-2, but having spares is convenient)
$ echo 4 | sudo tee /sys/class/net/enp81s0f0/device/sriov_numvfs
```

Verify the VFs were created:

```bash
$ lspci | grep "Virtual Function"
51:01.0 Ethernet controller: Intel Corporation Ethernet Adaptive Virtual Function (rev 02)
51:01.1 Ethernet controller: Intel Corporation Ethernet Adaptive Virtual Function (rev 02)
51:01.2 Ethernet controller: Intel Corporation Ethernet Adaptive Virtual Function (rev 02)
51:01.3 Ethernet controller: Intel Corporation Ethernet Adaptive Virtual Function (rev 02)
```

:::note
The PCI addresses of the VFs (e.g., `51:01.0`) depend on your system's PCI topology. Use `lspci` output to determine the actual addresses. These addresses are needed in the next step for binding to `vfio-pci`.
:::

### Set VF MAC Address and VLAN (Optional)

You can pre-configure the VF's MAC address and VLAN from the PF. This is useful for ensuring consistent addressing:

```bash
# Set MAC address for VF 0
$ sudo ip link set enp81s0f0 vf 0 mac 00:11:22:33:44:55

# Set VLAN tag for VF 0 (fronthaul VLAN)
$ sudo ip link set enp81s0f0 vf 0 vlan 2

# Enable trust mode (required for some DPDK operations)
$ sudo ip link set enp81s0f0 vf 0 trust on

# Allow the VF to change its MAC (spoofcheck off -- needed for DPDK)
$ sudo ip link set enp81s0f0 vf 0 spoofchk off
```

Verify VF configuration:

```bash
$ ip link show enp81s0f0
# Look for the "vf 0" line showing the assigned MAC and VLAN
```

## Binding VFs to vfio-pci

With VFs created, bind the one(s) you will use to the `vfio-pci` driver so DPDK can access them.

### Identify the VF PCI Address

```bash
$ dpdk-devbind.py --status

Network devices using kernel driver
====================================
0000:00:1f.6 'Ethernet Connection (7) I219-LM' if=eno1 drv=e1000e ...
0000:51:00.0 'Ethernet Controller E810-XXVDA4T' if=enp81s0f0 drv=ice ...
0000:51:00.1 'Ethernet Controller E810-XXVDA4T' if=enp81s0f1 drv=ice ...
0000:51:00.2 'Ethernet Controller E810-XXVDA4T' if=enp81s0f2 drv=ice ...
0000:51:00.3 'Ethernet Controller E810-XXVDA4T' if=enp81s0f3 drv=ice ...
0000:51:01.0 'Ethernet Adaptive Virtual Function' if=enp81s0f0v0 drv=iavf ...
0000:51:01.1 'Ethernet Adaptive Virtual Function' if=enp81s0f0v1 drv=iavf ...
0000:51:01.2 'Ethernet Adaptive Virtual Function' if=enp81s0f0v2 drv=iavf ...
0000:51:01.3 'Ethernet Adaptive Virtual Function' if=enp81s0f0v3 drv=iavf ...
```

### Bind VF 0 to vfio-pci

```bash
$ sudo dpdk-devbind.py --bind=vfio-pci 0000:51:01.0
```

Verify the binding:

```bash
$ dpdk-devbind.py --status

Network devices using DPDK-compatible driver
=============================================
0000:51:01.0 'Ethernet Adaptive Virtual Function' drv=vfio-pci unused=iavf

Network devices using kernel driver
====================================
0000:51:00.0 'Ethernet Controller E810-XXVDA4T' if=enp81s0f0 drv=ice ...
...
```

:::tip
Only bind the VF(s) you actually need for DPDK. Leave the PFs and unused VFs under kernel control. This allows you to still manage the PF (e.g., configure VF parameters, monitor link status) while DPDK uses the VF.
:::

## Verification with testpmd

`testpmd` is a DPDK test application that verifies the NIC is accessible and can send/receive packets. Use it to confirm your setup before attempting to run srsRAN.

```bash
$ sudo dpdk-testpmd -l 2-3 -n 4 --socket-mem=1024 -- -i
```

Parameter breakdown:

| Parameter | Meaning |
|-----------|---------|
| `-l 2-3` | Use CPU cores 2 and 3 (pick cores not reserved for srsRAN) |
| `-n 4` | Number of memory channels |
| `--socket-mem=1024` | Allocate 1024 MB of hugepage memory on NUMA socket 0 |
| `-- -i` | Start in interactive mode |

You should see output confirming the port was detected:

```
EAL: Detected 32 lcore(s)
EAL: Detected 2 NUMA nodes
EAL: Probe PCI driver: net_iavf (8086:1889) device: 0000:51:01.0 (socket 0)
Interactive-mode selected
testpmd>
```

Run a basic forwarding test:

```
testpmd> show port info 0
testpmd> start
testpmd> show port stats 0
testpmd> stop
testpmd> quit
```

:::warning
If `testpmd` fails to start with `EAL: Cannot init memory`, you do not have enough hugepages available. Check `/proc/meminfo` for `HugePages_Free` and ensure sufficient hugepages are allocated.
:::

## Persistence Across Reboots

SR-IOV VF creation and DPDK binding do not survive a reboot by default. You need to configure persistence through a combination of udev rules, module loading, and a startup script.

### 1. Ensure vfio-pci Loads at Boot

This was already configured above:

```bash title="/etc/modules-load.d/vfio-pci.conf"
vfio-pci
```

### 2. Create VFs at Boot via udev Rule

Create a udev rule that triggers VF creation when the E810 PF comes up:

```bash title="/etc/udev/rules.d/90-e810-sriov.rules"
ACTION=="add", SUBSYSTEM=="net", KERNEL=="enp81s0f0", ATTR{device/sriov_numvfs}="4"
```

Reload udev rules:

```bash
$ sudo udevadm control --reload-rules
```

### 3. Bind VFs to vfio-pci at Boot

Create a systemd service that runs after the network is up and binds the VF:

```ini title="/etc/systemd/system/dpdk-bind.service"
[Unit]
Description=Bind DPDK VFs to vfio-pci
After=network-pre.target systemd-udev-settle.service
Wants=systemd-udev-settle.service

[Service]
Type=oneshot
RemainAfterExit=yes
# Wait for VFs to appear
ExecStartPre=/bin/bash -c 'for i in $(seq 1 30); do [ -e /sys/bus/pci/devices/0000:51:01.0 ] && exit 0; sleep 1; done; exit 1'
# Set VF parameters on PF
ExecStartPre=/sbin/ip link set enp81s0f0 vf 0 trust on
ExecStartPre=/sbin/ip link set enp81s0f0 vf 0 spoofchk off
# Bind VF 0 to vfio-pci
ExecStart=/usr/local/bin/dpdk-devbind.py --bind=vfio-pci 0000:51:01.0

[Install]
WantedBy=multi-user.target
```

Enable the service:

```bash
$ sudo systemctl daemon-reload
$ sudo systemctl enable dpdk-bind.service
```

### 4. Verify After Reboot

After rebooting, confirm everything came up correctly:

```bash
$ lsmod | grep vfio                      # vfio-pci loaded
$ cat /sys/class/net/enp81s0f0/device/sriov_numvfs  # Should show 4
$ dpdk-devbind.py --status               # VF bound to vfio-pci
```

## Common Issues

### Permission Denied When Binding

**Symptom:** `dpdk-devbind.py` or `testpmd` fails with permission errors.

**Cause:** DPDK operations require root, or the user must be in the `vfio` group.

**Fix:**

```bash
# Option 1: Run as root (simplest for lab environments)
$ sudo dpdk-devbind.py --bind=vfio-pci 0000:51:01.0

# Option 2: Add user to vfio group
$ sudo groupadd vfio
$ sudo chown root:vfio /dev/vfio/*
$ sudo chmod 660 /dev/vfio/*
$ sudo usermod -aG vfio $USER
# Log out and back in
```

### No Hugepages Available

**Symptom:** `testpmd` fails with `EAL: Cannot init memory` or `Cannot allocate memory`.

**Cause:** Hugepages are not allocated or are already consumed by another process.

**Fix:**

```bash
$ grep Huge /proc/meminfo
# If HugePages_Free is 0, allocate more:
$ echo 8192 | sudo tee /sys/kernel/mm/hugepages/hugepages-2048kB/nr_hugepages
# Or reboot if using 1 GB hugepages (they must be reserved at boot)
```

### IOMMU Not Enabled

**Symptom:** `modprobe vfio-pci` succeeds, but binding fails with `Cannot find IOMMU group`.

**Cause:** `intel_iommu=on` is missing from the kernel command line.

**Fix:**

```bash
$ cat /proc/cmdline | grep intel_iommu
# If empty, add the parameter and reboot:
$ sudo sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="\(.*\)"/GRUB_CMDLINE_LINUX_DEFAULT="\1 intel_iommu=on iommu=pt"/' /etc/default/grub
$ sudo update-grub
$ sudo reboot
```

### VFs Not Created

**Symptom:** `echo 4 > /sys/class/net/enp81s0f0/device/sriov_numvfs` returns an error.

**Cause:** The interface is down, or the `ice` driver does not support the requested number of VFs.

**Fix:**

```bash
# Ensure the interface is up
$ sudo ip link set enp81s0f0 up

# Check maximum VFs supported
$ cat /sys/class/net/enp81s0f0/device/sriov_totalvfs

# Try creating fewer VFs
$ echo 1 | sudo tee /sys/class/net/enp81s0f0/device/sriov_numvfs
```

### Wrong DPDK Version

**Symptom:** srsRAN fails to compile or link against DPDK.

**Cause:** srsRAN expects a specific DPDK version (24.11.x).

**Fix:** Ensure you built and installed DPDK 24.11.2 as described above. Verify with:

```bash
$ pkg-config --modversion libdpdk
24.11.2
```

If a different version is installed system-wide, remove it first:

```bash
$ sudo apt-get remove --purge dpdk dpdk-dev libdpdk-dev
$ sudo ldconfig
```

Then rebuild and reinstall DPDK 24.11.2.

## Next Steps

With DPDK configured and the fronthaul VF bound, proceed to [NIC Optimization](./03-nic-optimization.md) to tune the E810 and kernel parameters for maximum throughput and minimum latency.
