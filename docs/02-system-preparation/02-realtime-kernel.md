---
id: realtime-kernel
title: Real-Time Kernel Installation and Configuration
sidebar_label: Real-Time Kernel
sidebar_position: 2
description: Install the Ubuntu real-time (PREEMPT_RT) kernel and configure GRUB boot parameters for deterministic, low-latency 5G RAN processing with O-RAN Split 7.2.
keywords:
  - PREEMPT_RT
  - real-time kernel
  - GRUB parameters
  - hugepages
  - isolcpus
  - DPDK
  - O-RAN latency
  - 5G NR timing
---

# Real-Time Kernel Installation and Configuration

The Linux real-time (PREEMPT_RT) kernel is essential for meeting the strict timing requirements of O-RAN Split 7.2 processing. This section explains why it is needed, how to install it, and how to configure the GRUB boot parameters that control kernel behavior for low-latency workloads.

## Why a Real-Time Kernel?

In O-RAN Split 7.2, the Distributed Unit (DU) must process uplink IQ samples and prepare downlink symbols within tight deadlines dictated by the 5G NR slot structure.

### Timing Budget

The timing constraints depend on the subcarrier spacing (SCS):

| Subcarrier Spacing | Slot Duration | Symbol Duration | Approximate Processing Budget |
|---|---|---|---|
| 15 kHz (n78 FR1) | 1 ms | ~71.4 us | ~500 us |
| 30 kHz (n78 FR1) | 0.5 ms | ~35.7 us | ~250 us |
| 120 kHz (n257 FR2) | 0.125 ms | ~8.9 us | ~60 us |

With a standard Linux kernel (`PREEMPT_DYNAMIC` or `PREEMPT_VOLUNTARY`), the scheduler may delay a real-time thread by hundreds of microseconds or more when a kernel code path holds a non-preemptible lock. This is acceptable for general-purpose workloads but catastrophic for a DU — a single missed symbol deadline causes radio frame errors, UE disconnections, or complete link failure.

<!-- IMAGE PLACEHOLDER: [Diagram showing O-RAN Split 7.2 timing: FH arrival -> DU PHY processing -> DL symbol transmission, with the processing window highlighted and labeled with the ~250us budget for 30kHz SCS] -->

The `PREEMPT_RT` patch set transforms nearly all kernel spinlocks into preemptible mutexes, making the kernel fully preemptible. This bounds worst-case scheduling latency to single-digit microseconds on properly configured hardware, well within the timing budget.

:::note
The RT kernel alone is not sufficient. It must be combined with CPU isolation, TuneD tuning, and proper DPDK configuration to achieve the required determinism. Each of these is covered in subsequent sections.
:::

## Install the Real-Time Kernel

Ubuntu 24.04 provides real-time kernel packages in the official repositories.

### Option 1: Ubuntu Pro Real-Time Kernel (Recommended)

Ubuntu Pro (free for personal use on up to 5 machines) provides a supported `linux-image-realtime` package:

```bash
# Attach Ubuntu Pro (if not already attached)
sudo pro attach <your-token>

# Enable the real-time kernel
sudo pro enable realtime-kernel
```

Follow the prompts. This installs the latest `PREEMPT_RT` kernel that matches your Ubuntu release.

### Option 2: Manual Installation from Ubuntu Repositories

If a real-time kernel meta-package is available in your repository:

```bash
# Search for available RT kernel packages
apt search linux-image.*realtime

# Install the RT kernel
sudo apt install -y linux-image-$(uname -r | sed 's/-generic/-realtime/')
```

:::tip
If the version-matched package is not found, search for any available RT kernel:
```bash
apt search linux-image | grep realtime
```
Install the most recent version available for your architecture.
:::

### Option 3: Build from Source

For maximum control (e.g., a specific kernel version with specific config options), you can apply the `PREEMPT_RT` patch to a mainline kernel and compile it yourself. This is an advanced procedure documented in the [Reference section](../10-reference/01-configuration-reference.md).

### Verify Installation

After installation, verify the kernel is present in the boot list:

```bash
# List installed kernels
dpkg --list | grep linux-image
```

Do **not** reboot yet — we need to configure the GRUB boot parameters first.

## GRUB Boot Parameters

The kernel boot parameters (passed via GRUB) control critical behaviors for real-time performance, DPDK, and hardware access. Each parameter below is explained in detail.

### Complete Parameter Line

Add the following to `GRUB_CMDLINE_LINUX_DEFAULT` in `/etc/default/grub`:

```bash
GRUB_CMDLINE_LINUX_DEFAULT="nosoftlockup nmi_watchdog=0 tsc=nowatchdog skew_tick=1 mitigations=off iommu=pt intel_iommu=on default_hugepagesz=1G hugepagesz=1G hugepages=16 isolcpus=2-19,22-39 nohz_full=2-19,22-39 rcu_nocbs=2-19,22-39"
```

:::warning
The `isolcpus`, `nohz_full`, and `rcu_nocbs` values above are **examples** based on a 20-core/40-thread Intel Xeon Gold 6230. You **must** adjust these for your CPU topology. See [CPU Isolation](./04-cpu-isolation.md) for detailed guidance on determining the correct core ranges.
:::

### Parameter-by-Parameter Explanation

#### `nosoftlockup`

```
nosoftlockup
```

**What it does:** Disables the kernel soft lockup detector.

**Why it matters:** The soft lockup detector triggers a warning (and potentially a panic) if a CPU appears stuck in kernel mode for more than a threshold period (default: 22 seconds on RT kernels, but the watchdog thread itself runs periodically). On isolated cores running tight real-time loops, the detector may fire false positives because the CPU legitimately never returns to the scheduler. Disabling it prevents spurious warnings and the associated interrupt overhead from the watchdog thread.

---

#### `nmi_watchdog=0`

```
nmi_watchdog=0
```

**What it does:** Disables the NMI (Non-Maskable Interrupt) watchdog, also known as the hardware lockup detector.

**Why it matters:** The NMI watchdog uses performance monitoring counters to generate periodic NMIs that check whether the CPU is stuck in a hard lockup. Each NMI introduces jitter (typically 1-3 us) that is invisible to normal profiling tools because NMIs cannot be masked. On a system where every microsecond matters, this jitter is unacceptable. Disabling the NMI watchdog also frees a performance counter for use by profiling tools like `perf`.

---

#### `tsc=nowatchdog`

```
tsc=nowatchdog
```

**What it does:** Disables the TSC (Time Stamp Counter) watchdog that periodically cross-checks the TSC against other clock sources.

**Why it matters:** The TSC is the fastest and most precise clock source available on modern Intel CPUs. The kernel normally runs a watchdog to verify that the TSC has not drifted relative to HPET or ACPI PM timer. This watchdog involves cross-CPU IPIs (Inter-Processor Interrupts) that cause latency spikes on the cores involved. On Cascade Lake and newer processors, the TSC is invariant and reliable — the watchdog check is unnecessary.

---

#### `skew_tick=1`

```
skew_tick=1
```

**What it does:** Offsets the periodic timer tick on each CPU by a small random amount so that ticks do not fire simultaneously across all cores.

**Why it matters:** When all CPUs fire their timer ticks at the same instant, they contend for shared resources (cache lines for global kernel data structures, memory bus bandwidth). By skewing the ticks, the load is spread out over time, reducing worst-case latency spikes caused by this contention. The effect is modest (a few microseconds) but contributes to overall jitter reduction.

---

#### `mitigations=off`

```
mitigations=off
```

**What it does:** Disables all CPU speculative execution vulnerability mitigations (Spectre, Meltdown, MDS, L1TF, TAA, MMIO Stale Data, etc.).

**Why it matters:** CPU vulnerability mitigations add overhead to system calls, context switches, and memory access patterns. The performance impact varies by workload but can reach 5-30% for syscall-heavy or context-switch-heavy workloads. For a latency-sensitive DU, the mitigations also increase worst-case latency by adding instruction sequences to every kernel entry/exit path.

:::danger
**Security implication:** Disabling mitigations exposes the system to speculative execution attacks. This is acceptable in isolated lab environments or dedicated single-tenant servers with no untrusted code execution. **Do not disable mitigations on multi-tenant systems or systems exposed to the public internet.** Evaluate your threat model before applying this parameter in production.
:::

---

#### `iommu=pt`

```
iommu=pt
```

**What it does:** Sets the IOMMU to passthrough mode for devices that do not require translation (i.e., devices not assigned to a VM or userspace driver).

**Why it matters:** Without passthrough mode, all DMA transactions go through the IOMMU translation tables, adding latency to every I/O operation — even for devices used directly by the host kernel. With `iommu=pt`, only devices explicitly assigned to userspace (via VFIO for DPDK) go through the IOMMU. Host kernel devices bypass it entirely, reducing I/O latency.

---

#### `intel_iommu=on`

```
intel_iommu=on
```

**What it does:** Enables the Intel VT-d IOMMU hardware.

**Why it matters:** The IOMMU is required for:
1. **DPDK with VFIO:** DPDK binds NICs to the `vfio-pci` driver, which uses the IOMMU for safe userspace DMA.
2. **SR-IOV:** Creating and assigning Intel E810 Virtual Functions (VFs) requires IOMMU support.
3. **Memory isolation:** The IOMMU prevents DMA devices from accessing memory outside their assigned regions.

Combined with `iommu=pt`, this gives us IOMMU protection where needed (DPDK/SR-IOV) without penalizing host kernel I/O.

---

#### Hugepages

```
default_hugepagesz=1G hugepagesz=1G hugepages=16
```

**What it does:** Preallocates 16 x 1 GB hugepages at boot time and sets 1 GB as the default hugepage size.

**Why it matters:** DPDK and srsRAN's PHY layer allocate large memory buffers for packet processing and signal processing. Standard 4 KB pages mean:
- More TLB (Translation Lookaside Buffer) entries consumed, leading to TLB misses and page table walks
- Each TLB miss costs 10-100 ns, which adds up in tight processing loops

With 1 GB hugepages:
- A single TLB entry covers 1 GB of contiguous memory
- TLB misses are virtually eliminated for DPDK memory pools
- Pages are preallocated at boot before memory fragmentation occurs

:::note
16 GB of hugepages is a reasonable starting point. Adjust based on your total RAM and workload. DPDK typically needs 2-4 GB; srsRAN's buffers require additional memory. The system will have `total_ram - 16G` available for the OS and other processes.

If you prefer 2 MB hugepages (e.g., for finer-grained allocation), use:
```
default_hugepagesz=2M hugepagesz=2M hugepages=8192
```
This allocates the same 16 GB but with 2 MB granularity. However, 1 GB pages are preferred for DPDK workloads due to fewer TLB entries needed.
:::

---

#### `isolcpus`, `nohz_full`, `rcu_nocbs`

```
isolcpus=2-19,22-39 nohz_full=2-19,22-39 rcu_nocbs=2-19,22-39
```

These three parameters work together to isolate CPUs from the general-purpose scheduler, disable periodic timer ticks, and offload RCU callbacks. They are introduced here because they are boot parameters, but the rationale, planning methodology, and verification are covered in full detail in [CPU Isolation](./04-cpu-isolation.md).

Brief summary:

| Parameter | Effect |
|-----------|--------|
| `isolcpus` | Removes listed CPUs from the kernel's general scheduler; only explicitly pinned tasks run on them |
| `nohz_full` | Disables the periodic timer tick on listed CPUs when only one task is running (adaptive-ticks mode) |
| `rcu_nocbs` | Offloads RCU (Read-Copy-Update) callback processing from listed CPUs to dedicated kernel threads on housekeeping CPUs |

## Applying the Configuration

### Step 1: Edit GRUB

```bash
sudo nano /etc/default/grub
```

Replace the existing `GRUB_CMDLINE_LINUX_DEFAULT` line with the full parameter string from above. Ensure it is a single line (no line breaks inside the quotes).

### Step 2: Update GRUB

```bash
sudo update-grub
```

Verify the output shows the configuration was written:

```
Sourcing file `/etc/default/grub'
...
done
```

### Step 3: Set Default Boot Kernel

If you have multiple kernels installed, ensure the RT kernel is the default:

```bash
# List available boot entries
grep -E "menuentry|submenu" /boot/grub/grub.cfg | head -20

# Set the RT kernel as default (adjust the menu entry string as needed)
sudo grub-set-default "Advanced options for Ubuntu>Ubuntu, with Linux <version>-realtime"
```

Alternatively, set `GRUB_DEFAULT=0` in `/etc/default/grub` if the RT kernel is the first entry, then run `sudo update-grub` again.

### Step 4: Reboot

```bash
sudo reboot
```

## Post-Reboot Verification

After rebooting, verify everything is correctly applied.

### Verify the RT Kernel is Running

```bash
uname -r
```

Expected output should contain `-realtime`:

```
6.8.0-xx-realtime
```

Also verify the preemption model:

```bash
uname -a
```

Look for `PREEMPT_RT` in the output:

```
Linux gnb-du-01 6.8.0-xx-realtime #xx-Ubuntu SMP PREEMPT_RT ...
```

### Verify Boot Parameters

```bash
cat /proc/cmdline
```

Confirm all parameters are present:

```
BOOT_IMAGE=/vmlinuz-6.8.0-xx-realtime root=UUID=... ro nosoftlockup nmi_watchdog=0 tsc=nowatchdog skew_tick=1 mitigations=off iommu=pt intel_iommu=on default_hugepagesz=1G hugepagesz=1G hugepages=16 isolcpus=2-19,22-39 nohz_full=2-19,22-39 rcu_nocbs=2-19,22-39
```

### Verify Hugepages

```bash
grep -i hugepages /proc/meminfo
```

Expected:

```
AnonHugePages:         0 kB
ShmemHugePages:        0 kB
FileHugePages:         0 kB
HugePages_Total:      16
HugePages_Free:       16
HugePages_Rsvd:        0
HugePages_Surp:        0
Hugepagesize:    1048576 kB
```

Mount the hugepages filesystem if it is not already mounted:

```bash
# Check if already mounted
mount | grep hugetlbfs

# If not mounted, add to /etc/fstab and mount
echo "nodev /dev/hugepages hugetlbfs pagesize=1G 0 0" | sudo tee -a /etc/fstab
sudo mount -a
```

### Verify IOMMU

```bash
# Check IOMMU is enabled
dmesg | grep -i iommu
```

Look for lines like:

```
DMAR: IOMMU enabled
DMAR: Intel(R) Virtualization Technology for Directed I/O
```

```bash
# List IOMMU groups (should show your Intel E810 NICs)
find /sys/kernel/iommu_groups/ -type l | sort -V | head -20
```

### Verify Isolated CPUs

```bash
cat /sys/devices/system/cpu/isolated
```

Expected:

```
2-19,22-39
```

## Troubleshooting

### System Fails to Boot After Changes

If the system does not boot with the new parameters:

1. At the GRUB menu, press `e` to edit the boot entry
2. Remove the problematic parameters from the `linux` line
3. Press `Ctrl+X` to boot with the modified parameters
4. Fix `/etc/default/grub` and run `sudo update-grub`

### Hugepages Not Allocated

If `HugePages_Total` shows fewer than expected, the system may not have had enough contiguous memory at boot:

- Check `dmesg | grep -i huge` for allocation failure messages
- Ensure you are requesting hugepages via boot parameters (not runtime allocation for 1 GB pages)
- Reduce the number of hugepages if the system does not have enough RAM

### RT Kernel Not Showing PREEMPT_RT

If `uname -a` does not show `PREEMPT_RT`, you may have booted the wrong kernel. Use `grub-set-default` to select the correct entry and reboot.

## Next Steps

With the RT kernel installed and boot parameters configured, proceed to [TuneD Profiles](./03-tuned-profiles.md) to apply persistent system tuning that complements the kernel configuration.
