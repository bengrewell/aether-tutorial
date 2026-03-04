---
id: cpu-isolation
title: CPU Isolation and Core Allocation
sidebar_label: CPU Isolation
sidebar_position: 4
description: Plan and implement CPU core isolation for DPDK and srsRAN real-time workloads, including topology analysis, kernel parameters, systemd configuration, cgroups, and latency validation with cyclictest.
keywords:
  - CPU isolation
  - isolcpus
  - nohz_full
  - rcu_nocbs
  - DPDK lcores
  - srsRAN threads
  - cyclictest
  - NUMA topology
  - CPU pinning
  - latency validation
---

# CPU Isolation and Core Allocation

CPU isolation is the single most impactful tuning for real-time 5G workloads. Without it, the Linux kernel freely schedules housekeeping tasks, kernel threads, IRQ handlers, and user-space daemons on any available core — including cores that should be exclusively running DPDK poll-mode drivers or srsRAN PHY processing. Each interruption adds microseconds to tens of microseconds of jitter, which accumulates into missed O-RAN symbol deadlines.

This section covers how to analyze your CPU topology, plan a core allocation strategy, apply isolation via kernel parameters and systemd, and validate the result with `cyclictest`.

## Understanding Your CPU Topology

Before allocating cores, you need to know exactly what you have. The examples in this guide use an **Intel Xeon Gold 6230** (20 physical cores, 40 logical threads with Hyper-Threading), but the methodology applies to any Intel Xeon (Cascade Lake or newer).

### lscpu Overview

```bash
lscpu
```

Key fields to note:

```
Architecture:             x86_64
CPU(s):                   40
On-line CPU(s) list:      0-39
Thread(s) per core:       2
Core(s) per socket:       20
Socket(s):                1
NUMA node(s):             1
Model name:               Intel(R) Xeon(R) Gold 6230 CPU @ 2.10GHz
NUMA node0 CPU(s):        0-39
```

### Detailed Core Mapping

```bash
lscpu -e
```

This shows the relationship between logical CPUs, physical cores, sockets, and NUMA nodes:

```
CPU  NODE  SOCKET  CORE  L1d:L1i:L2:L3  ONLINE
  0     0       0     0  0:0:0:0         yes
  1     0       0     1  1:1:1:0         yes
  2     0       0     2  2:2:2:0         yes
  ...
 19     0       0    19  19:19:19:0      yes
 20     0       0     0  0:0:0:0         yes
 21     0       0     1  1:1:1:0         yes
 22     0       0     2  2:2:2:0         yes
  ...
 39     0       0    19  19:19:19:0      yes
```

The critical observation: **CPU 0 and CPU 20 share physical core 0** (they are Hyper-Threading siblings). Similarly, CPU 1 and CPU 21 are siblings, CPU 2 and CPU 22, and so on.

:::warning
When isolating a core for real-time work, you **must** isolate both HT siblings. If you isolate CPU 2 but leave CPU 22 available to the scheduler, the OS can schedule tasks on CPU 22 that compete for the same physical core's execution units, caches, and memory bandwidth — destroying the determinism you are trying to achieve.
:::

### Visualize with lstopo

For a graphical view of the topology (including caches, NUMA nodes, and PCI devices):

```bash
# Text output
lstopo-no-graphics --no-io

# Generate an image (requires X11 forwarding or save to file)
lstopo topology.png
```

<!-- IMAGE PLACEHOLDER: [lstopo output showing a single-socket Intel Xeon Gold 6230 with 20 cores, L1/L2 per-core caches, shared L3, and HT siblings indicated. Housekeeping cores (0-1, 20-21) and isolated cores (2-19, 22-39) are color-coded differently] -->

### NUMA Awareness

On single-socket systems, all cores share one NUMA node. On dual-socket systems, each socket is a separate NUMA node. For optimal performance:

- **All DPDK and srsRAN cores should be on the same NUMA node as the Intel E810 NIC**
- Cross-NUMA memory access adds ~100 ns of latency per access

Check which NUMA node your E810 is on:

```bash
# Find the E810 PCI address
lspci | grep -i "e810\|ethernet.*intel"

# Check its NUMA node (replace 0000:xx:00.0 with your PCI address)
cat /sys/bus/pci/devices/0000:xx:00.0/numa_node
```

## Core Allocation Plan

Based on the Intel Xeon Gold 6230 (20 cores / 40 threads, single socket), here is a recommended allocation:

### Allocation Table

| Cores (Logical CPUs) | Role | Isolated? | Notes |
|---|---|---|---|
| 0-1, 20-21 | OS / Management / SSH | No | Housekeeping cores for kernel threads, systemd, SSH, monitoring |
| 2-5, 22-25 | DPDK lcores | Yes | Poll-mode driver threads for Intel E810 FH interface |
| 6-15, 26-35 | srsRAN DU real-time threads | Yes | PHY processing (LDPC, FFT/IFFT, channel estimation, etc.) |
| 16-19, 36-39 | srsRAN DU non-RT / CU / control plane | Yes | Higher-layer processing, F1AP, SCTP, logging |

<!-- IMAGE PLACEHOLDER: [Horizontal bar diagram showing all 40 logical CPUs (0-39) with color-coded sections: blue for housekeeping (0-1, 20-21), green for DPDK (2-5, 22-25), orange for srsRAN RT (6-15, 26-35), and yellow for srsRAN non-RT (16-19, 36-39)] -->

:::note
This allocation is an **example**. The exact core counts for DPDK vs. srsRAN depend on your cell bandwidth, number of carriers, MIMO configuration, and traffic load. Start with this allocation and adjust based on profiling during integration testing ([Section 07](../07-integration-testing/01-sim-programming.md)).
:::

### Allocation Principles

1. **Cores 0 and its HT sibling are always housekeeping.** Core 0 handles boot-time interrupts and is difficult to fully isolate. Keep it for OS duties.

2. **DPDK cores must be on the same NUMA node as the NIC.** DPDK's poll-mode driver runs a tight loop on each assigned core — any NUMA cross-node access adds unacceptable latency.

3. **HT siblings stay together.** If core 2 is for DPDK, core 22 is also for DPDK (or at minimum, isolated and idle). Never split siblings between isolated and non-isolated sets.

4. **Leave headroom.** Do not allocate every last core. The OS needs at least 2 physical cores (4 logical CPUs with HT) for kernel threads, interrupts, SSH sessions, and monitoring agents.

## Kernel Parameters

The three kernel boot parameters that implement CPU isolation:

### isolcpus

```
isolcpus=2-19,22-39
```

Removes the listed CPUs from the kernel's general-purpose scheduling domain. The scheduler will not place any task on these CPUs unless the task is explicitly pinned using `taskset`, `pthread_setaffinity_np()`, or cgroup `cpuset`.

### nohz_full

```
nohz_full=2-19,22-39
```

Enables adaptive-ticks mode on the listed CPUs. When only one runnable task exists on a `nohz_full` CPU, the periodic timer tick (typically 250 Hz or 1000 Hz) is stopped entirely. This eliminates the jitter from tick processing (typically 1-5 us per tick).

Requirements:
- The CPU must have at most one runnable task for the tick to be stopped
- At least one CPU must remain as a timekeeping CPU (CPU 0 is always the fallback)

### rcu_nocbs

```
rcu_nocbs=2-19,22-39
```

Offloads RCU (Read-Copy-Update) callback processing from the listed CPUs. RCU is a kernel synchronization mechanism used extensively in networking and filesystem code. By default, RCU callbacks execute on the CPU that registered them, which means an isolated core can still be interrupted by RCU processing. `rcu_nocbs` moves this work to dedicated `rcuog` and `rcuop` kernel threads that run on housekeeping CPUs.

### Applying the Parameters

These parameters should already be in your GRUB configuration from the [Real-Time Kernel](./02-realtime-kernel.md) section. If not:

```bash
# Edit GRUB configuration
sudo nano /etc/default/grub

# Add to GRUB_CMDLINE_LINUX_DEFAULT (keep existing parameters):
# isolcpus=2-19,22-39 nohz_full=2-19,22-39 rcu_nocbs=2-19,22-39

sudo update-grub
sudo reboot
```

## systemd CPU Affinity

Even with `isolcpus`, some systemd-managed services may attempt to set their own CPU affinity. Configure systemd to restrict its own processes to housekeeping cores.

Edit `/etc/systemd/system.conf`:

```bash
sudo mkdir -p /etc/systemd/system.conf.d/
sudo tee /etc/systemd/system.conf.d/cpuaffinity.conf > /dev/null << 'EOF'
[Manager]
CPUAffinity=0 1 20 21
EOF
```

This tells the systemd init process (PID 1) and all services it spawns to default to running on CPUs 0, 1, 20, and 21 only. Individual services can still override this if needed.

Apply without rebooting:

```bash
sudo systemctl daemon-reexec
```

## Disable Interfering Services

### irqbalance

If not already disabled via the [TuneD profile](./03-tuned-profiles.md):

```bash
sudo systemctl disable --now irqbalance.service
```

If you prefer to keep irqbalance for housekeeping cores only, configure `/etc/default/irqbalance`:

```bash
# Ban isolated cores from irqbalance
IRQBALANCE_BANNED_CPULIST=2-19,22-39
```

Then restart: `sudo systemctl restart irqbalance`.

### thermald

Intel's thermal management daemon can throttle CPUs, introducing unexpected frequency changes:

```bash
sudo systemctl disable --now thermald.service
```

:::warning
Disabling `thermald` means the OS will not actively manage CPU temperature. Ensure your server has adequate cooling (a well-ventilated rack with properly functioning fans). Monitor temperatures via IPMI/BMC or `sensors` during load testing.
:::

## cgroups CPU Set Configuration

For additional containment, use cgroups v2 `cpuset` to enforce CPU affinity boundaries. This is particularly useful when running workloads inside containers or systemd scopes.

### Create a cpuset for Real-Time Workloads

```bash
# Create a systemd slice for RT workloads
sudo mkdir -p /sys/fs/cgroup/rt-workloads

# Assign isolated CPUs to this cgroup
echo "2-19,22-39" | sudo tee /sys/fs/cgroup/rt-workloads/cpuset.cpus
echo "0" | sudo tee /sys/fs/cgroup/rt-workloads/cpuset.mems

# Make the cpuset exclusive (optional — prevents other cgroups from using these CPUs)
# Note: cpuset.cpus.exclusive is available in cgroups v2
echo "2-19,22-39" | sudo tee /sys/fs/cgroup/rt-workloads/cpuset.cpus.exclusive 2>/dev/null || true
```

To run a process inside this cgroup:

```bash
sudo cgexec -g cpuset:rt-workloads <command>
```

Or configure it in a systemd service unit:

```ini
[Service]
Slice=rt-workloads.slice
CPUAffinity=2-19 22-39
```

:::tip
For Kubernetes deployments (covered in [Section 08](../08-kubernetes-deployment/01-k8s-cluster-setup.md)), the CPU Manager with `static` policy handles cpuset assignment for Guaranteed QoS pods automatically.
:::

## Validation with cyclictest

`cyclictest` is the standard tool for measuring worst-case scheduling latency on Linux. It creates high-priority RT threads that sleep for a fixed interval and measure how late they wake up. The difference between the requested and actual wake-up time is the scheduling latency.

### Install rt-tests

```bash
sudo apt install -y rt-tests
```

### Run cyclictest

Run a comprehensive test on the isolated cores:

```bash
sudo cyclictest \
  -m \
  -p 99 \
  -d 0 \
  -a 2-19 \
  -t 18 \
  -D 5m \
  --histogram=200 \
  --histfile=cyclictest_histogram.txt
```

**Parameter explanation:**

| Flag | Meaning |
|------|---------|
| `-m` | Lock memory (prevent page faults) |
| `-p 99` | Use RT priority 99 (highest SCHED_FIFO priority) |
| `-d 0` | No distance between thread intervals (all threads use same interval) |
| `-a 2-19` | Pin threads to CPUs 2 through 19 |
| `-t 18` | Create 18 threads (one per isolated physical core in this range) |
| `-D 5m` | Run for 5 minutes |
| `--histogram=200` | Record latency histogram up to 200 us |
| `--histfile=...` | Save histogram data to file for analysis |

:::note
Run cyclictest for at **least** 5 minutes. For production validation, run it for 24 hours under simulated load (e.g., while running `stress-ng` on housekeeping cores and generating network traffic). Brief tests may miss rare latency spikes.
:::

### Interpreting Results

#### Good Results (Properly Isolated System)

```
# /dev/cpu_dma_latency set to 0us
policy: fifo: loadavg: 0.08 0.03 0.01 1/215 12345

T: 0 (12345) P:99 I:1000 C: 300000 Min:      1 Act:    1 Avg:    1 Max:       5
T: 1 (12346) P:99 I:1000 C: 300000 Min:      1 Act:    2 Avg:    1 Max:       4
T: 2 (12347) P:99 I:1000 C: 300000 Min:      1 Act:    1 Avg:    1 Max:       6
T: 3 (12348) P:99 I:1000 C: 300000 Min:      1 Act:    1 Avg:    1 Max:       5
...
T:17 (12362) P:99 I:1000 C: 300000 Min:      1 Act:    2 Avg:    1 Max:       7
```

Key metrics:
- **Avg: 1-2 us** — typical for a well-tuned RT system
- **Max: < 10 us** — excellent; well within the timing budget
- All threads show consistent results

:::tip
**Target: Max latency ≤ 25 µs on all isolated cores.** Anything above 25 us warrants investigation. Values above 50 us will likely cause issues with 30 kHz SCS processing. Values above 100 us are a hard failure.
:::

#### Bad Results (Isolation Problems)

```
T: 0 (12345) P:99 I:1000 C: 300000 Min:      1 Act:    3 Avg:    2 Max:     187
T: 1 (12346) P:99 I:1000 C: 300000 Min:      1 Act:    1 Avg:    1 Max:      95
T: 2 (12347) P:99 I:1000 C: 300000 Min:      1 Act:    2 Avg:    1 Max:       4
T: 3 (12348) P:99 I:1000 C: 300000 Min:      1 Act:    1 Avg:    1 Max:       3
...
```

Problems indicated:
- **Thread 0 Max: 187 us** — a severe spike on one core. Likely an interrupt routed to that core, or an un-offloaded RCU callback.
- **Thread 1 Max: 95 us** — similar issue, less severe.
- Threads 2+ are fine, suggesting the problem is specific to those cores.

## Debugging High Latency

When cyclictest reveals unacceptable latency, use these techniques to identify the source.

### Check /proc/interrupts

```bash
# Take two snapshots 10 seconds apart and diff them
cat /proc/interrupts > /tmp/irq1.txt
sleep 10
cat /proc/interrupts > /tmp/irq2.txt
diff /tmp/irq1.txt /tmp/irq2.txt
```

Look for interrupt counts increasing on isolated cores. Common culprits:
- **LOC (Local timer):** `nohz_full` may not be active (check that only one task is on the core)
- **RES (Rescheduling):** Another CPU is sending an IPI to the isolated core (often from scheduler migration)
- **NMI:** `nmi_watchdog` may still be enabled
- **Device-specific IRQs:** A device interrupt is routed to an isolated core (fix IRQ affinity)

### Use ftrace for Detailed Tracing

ftrace can identify exactly which kernel function caused the latency:

```bash
# Enable the function tracer on a specific CPU
echo 0 > /sys/kernel/debug/tracing/tracing_on
echo function > /sys/kernel/debug/tracing/current_tracer

# Set the CPU mask to only trace isolated cores
echo 4 > /sys/kernel/debug/tracing/tracing_cpumask  # CPU 2 only (bitmask)

# Set a latency threshold — only record traces longer than 10us
echo 10 > /sys/kernel/debug/tracing/tracing_thresh

# Enable and run workload
echo 1 > /sys/kernel/debug/tracing/tracing_on
# ... run cyclictest ...
echo 0 > /sys/kernel/debug/tracing/tracing_on

# Read the trace
cat /sys/kernel/debug/tracing/trace | head -100
```

### Common Causes and Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Spikes on all isolated cores | Missing `isolcpus` or wrong core range | Verify `/proc/cmdline` and `/sys/devices/system/cpu/isolated` |
| Spikes on specific cores | IRQ routed to those cores | Check `/proc/irq/*/smp_affinity`; rerun TuneD script |
| Periodic ~4ms spikes | RT throttling active | Verify `kernel.sched_rt_runtime_us = -1` |
| Periodic ~1ms spikes | Timer tick not disabled | Verify `nohz_full` is active: check `/sys/devices/system/cpu/nohz_full` |
| Rare large spikes (>100 us) | SMI (System Management Interrupt) | BIOS setting — disable SMI if possible; check with `perf stat -e msr/smi/` |
| Spikes correlate with disk I/O | Writeback or journaling | Ensure `/var/log` is not on the same disk, or reduce log verbosity |
| Spikes on HT sibling core | Sibling not isolated | Isolate both HT siblings; verify with `lscpu -e` |

:::danger
**SMIs (System Management Interrupts)** are the hardest latency source to eliminate. They are triggered by the BIOS/BMC firmware and cannot be masked by the OS. SMIs can cause latency spikes of 50-500 us. Check your BIOS for options to reduce SMI frequency (disable USB legacy emulation, memory scrubbing frequency, etc.). Some server vendors provide a "low latency" BIOS mode that minimizes SMIs.
:::

### hwlatdetect

The `hwlatdetect` tool (included in `rt-tests`) measures hardware-induced latency independently of the OS scheduler. It helps distinguish OS issues from hardware/firmware issues:

```bash
sudo hwlatdetect --duration=60 --threshold=10
```

If `hwlatdetect` reports spikes, the problem is below the OS level (SMIs, BIOS, platform firmware). If `hwlatdetect` is clean but `cyclictest` shows spikes, the problem is OS-level configuration.

## Complete Verification Checklist

Run through this checklist after completing all CPU isolation configuration:

```bash
echo "=== CPU Isolation Verification ==="

# 1. Verify isolated CPUs
echo "Isolated CPUs:"
cat /sys/devices/system/cpu/isolated
echo ""

# 2. Verify nohz_full
echo "nohz_full CPUs:"
cat /sys/devices/system/cpu/nohz_full
echo ""

# 3. Verify rcu_nocbs (check /proc/cmdline)
echo "Boot parameters:"
cat /proc/cmdline
echo ""

# 4. Verify no tasks on isolated cores (should show very few)
echo "Tasks on CPU 2 (should be near zero):"
ps -eo pid,comm,psr | awk '$3 == 2 { print }' | wc -l
echo ""

# 5. Verify IRQ affinity (spot-check a few)
echo "IRQ affinity for first 5 IRQs > 2:"
for irq in $(ls /proc/irq/ | grep -E '^[0-9]+$' | sort -n | head -8 | tail -5); do
    echo "IRQ $irq: $(cat /proc/irq/$irq/smp_affinity 2>/dev/null)"
done
echo ""

# 6. Verify CPU governor
echo "CPU 0 governor: $(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor)"
echo "CPU 2 governor: $(cat /sys/devices/system/cpu/cpu2/cpufreq/scaling_governor)"
echo ""

# 7. Verify RT throttling disabled
echo "RT runtime: $(cat /proc/sys/kernel/sched_rt_runtime_us)"
echo ""

# 8. Verify THP disabled
echo "THP: $(cat /sys/kernel/mm/transparent_hugepage/enabled)"
echo ""

echo "=== Verification Complete ==="
```

## Summary of All Changes

At this point, your system should have the following configuration in place:

| Component | Configuration | Source |
|-----------|--------------|--------|
| OS | Ubuntu 24.04 LTS Server, essential packages installed | [OS Installation](./01-os-installation.md) |
| Kernel | PREEMPT_RT real-time kernel | [Real-Time Kernel](./02-realtime-kernel.md) |
| GRUB | Full parameter set including isolation, hugepages, IOMMU | [Real-Time Kernel](./02-realtime-kernel.md) |
| TuneD | `realtime-telco` profile active with sysctl + script | [TuneD Profiles](./03-tuned-profiles.md) |
| CPU Isolation | Cores 2-19,22-39 isolated; 0-1,20-21 housekeeping | This page |
| systemd | CPUAffinity restricted to housekeeping cores | This page |
| IRQ Affinity | All IRQs pinned to housekeeping cores | [TuneD Profiles](./03-tuned-profiles.md) |
| cyclictest | Max latency ≤ 25 µs on all isolated cores | This page |

## Next Steps

With the system fully prepared and validated for real-time performance, proceed to [Section 03 - Network Configuration](../03-network-configuration/01-network-topology.md) to configure the Intel E810 NIC, SR-IOV virtual functions, and data-plane networking for the O-RAN fronthaul interface.
