---
id: tuned-profiles
title: TuneD Real-Time Profile Configuration
sidebar_label: TuneD Profiles
sidebar_position: 3
description: Create and activate a custom TuneD profile for deterministic real-time performance on your 5G DU server, including sysctl tuning, NIC configuration, CPU frequency pinning, and IRQ affinity.
keywords:
  - TuneD
  - tuned-adm
  - realtime profile
  - sysctl tuning
  - CPU governor
  - IRQ affinity
  - NIC tuning
  - 5G performance
---

# TuneD Real-Time Profile Configuration

TuneD is a system tuning daemon that applies and maintains performance profiles across reboots. Rather than scattering `sysctl` commands, CPU governor settings, and NIC tuning scripts across multiple configuration files, TuneD centralizes everything into a single, auditable profile.

This section creates a custom `realtime-telco` profile tailored for 5G DU workloads running DPDK and srsRAN.

## Why TuneD?

Without TuneD, system tuning typically involves:

- Manual `sysctl` settings in `/etc/sysctl.d/` files
- CPU frequency governor scripts in `rc.local` or systemd units
- IRQ affinity scripts run at boot
- NIC tuning commands scattered across startup scripts

These approaches are fragile — a package update can reset settings, and there is no unified way to verify that all tuning is active. TuneD solves this by:

1. **Applying all tuning atomically** when a profile is activated
2. **Persisting across reboots** via a systemd service
3. **Providing verification** via `tuned-adm verify`
4. **Supporting inheritance** — our custom profile extends the built-in `realtime` profile

## Prerequisites

### Disable power-profiles-daemon

Ubuntu 24.04 ships with `power-profiles-daemon`, which conflicts with TuneD. Both attempt to manage CPU frequency scaling and power states, and running them simultaneously leads to unpredictable behavior.

If you followed the [OS Installation](./01-os-installation.md) guide, this service is already disabled. Verify:

```bash
systemctl is-active power-profiles-daemon.service
```

Expected output: `inactive`. If it is still active:

```bash
sudo systemctl disable --now power-profiles-daemon.service
```

### Disable irqbalance (Optional)

The `irqbalance` daemon redistributes hardware interrupts across CPUs for general-purpose load balancing. On an RT system with isolated cores, this is counterproductive — it may route interrupts to isolated cores, causing latency spikes.

```bash
sudo systemctl disable --now irqbalance.service
```

:::note
If you prefer to keep `irqbalance` running for non-isolated cores, you can configure it to exclude isolated cores via the `IRQBALANCE_BANNED_CPULIST` environment variable in `/etc/default/irqbalance`. However, for simplicity and determinism, disabling it entirely and managing IRQ affinity in the TuneD script is recommended.
:::

## Install TuneD

```bash
sudo apt install -y tuned tuned-utils
```

Verify the `realtime` base profile is available:

```bash
tuned-adm list | grep realtime
```

Expected output:

```
- realtime                    - Optimize for deterministic performance at the cost of increased power consumption
```

If the `realtime` profile is not listed, install the additional profiles package:

```bash
sudo apt install -y tuned-profiles-realtime
```

## Create the Custom Profile

### Directory Structure

```bash
sudo mkdir -p /etc/tuned/realtime-telco
```

The profile consists of two files:

```
/etc/tuned/realtime-telco/
├── tuned.conf      # Profile configuration
└── script.sh       # Startup tuning script
```

### tuned.conf

Create the main profile configuration file:

```bash
sudo tee /etc/tuned/realtime-telco/tuned.conf > /dev/null << 'CONF'
#
# TuneD profile: realtime-telco
# Purpose: Real-time tuning for 5G DU / O-RAN Split 7.2 workloads
# Base: inherits from the built-in 'realtime' profile
#

[main]
summary=Real-time profile for 5G telco workloads
include=realtime

[variables]
# CPU cores to isolate for DPDK and srsRAN real-time threads.
# IMPORTANT: Adjust these values to match YOUR CPU topology.
# Use 'lscpu -e' and 'lstopo' to determine correct core ranges.
# See: docs/02-system-preparation/04-cpu-isolation.md
isolated_cores=2-19,22-39

[bootloader]
# Additional kernel command-line parameters applied by TuneD.
# These complement the parameters set directly in GRUB.
# TuneD merges these with existing GRUB_CMDLINE_LINUX_DEFAULT.
cmdline_telco=intel_iommu=on iommu=pt hugepages=16 nosoftlockup nmi_watchdog=0 tsc=nowatchdog skew_tick=1 mitigations=off

[sysctl]
# Disable swap aggressiveness (swap should already be off, this is a safeguard)
vm.swappiness=0

# Reduce vmstat timer frequency — the default (1 second) wakes all CPUs
# periodically to update VM statistics. Setting to 10 reduces these wakeups.
vm.stat_interval=10

# Disable timer migration — prevents the kernel from moving timers between
# CPUs for "efficiency", which causes unexpected wakeups on isolated cores.
kernel.timer_migration=0

# Allow RT tasks to use 100% of CPU time without throttling.
# Default is 950000/1000000 (95%), which causes RT tasks to be
# preempted for 50ms every second — catastrophic for DU processing.
kernel.sched_rt_runtime_us=-1

# Enable busy-polling on network sockets. When a thread calls poll()/select(),
# the kernel will spin-poll the NIC for up to N microseconds before sleeping.
# Reduces latency for control-plane SCTP/UDP sockets.
net.core.busy_poll=50
net.core.busy_read=50

# Increase socket buffer sizes for control-plane traffic
net.core.rmem_max=16777216
net.core.wmem_max=16777216
net.core.rmem_default=1048576
net.core.wmem_default=1048576

# Increase the network device backlog for burst absorption
net.core.netdev_max_backlog=10000

# Disable TCP slow start after idle (improves control-plane reconnection)
net.ipv4.tcp_slow_start_after_idle=0

[script]
script=script.sh
CONF
```

### Detailed sysctl Explanations

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `vm.swappiness` | `0` | Never swap unless absolutely necessary (OOM imminent) |
| `vm.stat_interval` | `10` | Reduce VM statistics update frequency from 1s to 10s, cutting per-CPU timer wakeups |
| `kernel.timer_migration` | `0` | Prevent kernel from migrating timers to idle CPUs (which wakes them) |
| `kernel.sched_rt_runtime_us` | `-1` | Remove the RT throttling safety net; RT tasks can consume 100% of CPU. Required for continuous DU processing |
| `net.core.busy_poll` | `50` | Busy-poll sockets for 50 us before sleeping; reduces control-plane latency |
| `net.core.busy_read` | `50` | Same as busy_poll but for `read()` and `recvmsg()` calls |

:::warning
Setting `kernel.sched_rt_runtime_us=-1` removes the kernel's protection against runaway RT tasks starving the system. If an RT task enters an infinite loop, it will consume the core indefinitely. This is intentional for DU workloads but means that bugs in RT-priority code can make the system unresponsive on affected cores. Always keep housekeeping cores (cores 0-1) un-isolated so you can SSH in and recover.
:::

### script.sh

Create the startup script that runs each time the profile is activated or the system boots:

```bash
sudo tee /etc/tuned/realtime-telco/script.sh > /dev/null << 'SCRIPT'
#!/bin/bash
#
# TuneD startup script for realtime-telco profile
# Runs at profile activation and system boot
#

. /usr/lib/tuned/functions

start() {
    echo "realtime-telco: Applying startup tuning..."

    # =========================================================================
    # 1. CPU Frequency Governor — lock all CPUs to maximum performance
    # =========================================================================
    # The 'performance' governor sets all CPUs to their maximum P-state,
    # eliminating frequency scaling latency (P-state transitions take ~10us).
    for gov in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
        [ -f "$gov" ] && echo performance > "$gov"
    done

    # Disable frequency boost (Turbo Boost) at the OS level if desired.
    # Uncomment the following line to disable Turbo Boost:
    # echo 0 > /sys/devices/system/cpu/cpufreq/boost 2>/dev/null || true

    # =========================================================================
    # 2. Disable CPU idle states beyond C1 (belt-and-suspenders with BIOS)
    # =========================================================================
    # Even if C-states are disabled in BIOS, the OS may still attempt to use
    # them. Force max CPU frequency and minimum latency via PM QoS.
    if [ -f /dev/cpu_dma_latency ]; then
        # Write a 0 (zero latency tolerance) to prevent any C-state deeper
        # than C0. This file must remain open for the setting to persist,
        # so we use a background process.
        exec 3>/dev/cpu_dma_latency
        echo -n -e '\x00\x00\x00\x00' >&3
        # Note: fd 3 is intentionally left open
    fi

    # =========================================================================
    # 3. NIC Tuning — Intel E810 specific optimizations
    # =========================================================================
    # Identify Intel E810 interfaces (device ID 1593 for E810-C,
    # 159b for E810-XXV)
    for iface in $(ls /sys/class/net/); do
        driver=$(readlink /sys/class/net/$iface/device/driver 2>/dev/null | xargs basename 2>/dev/null)
        if [ "$driver" = "ice" ]; then
            echo "realtime-telco: Tuning E810 interface $iface..."

            # Disable adaptive interrupt coalescing — use fixed coalesce
            # settings for deterministic latency
            ethtool -C "$iface" adaptive-rx off adaptive-tx off 2>/dev/null || true

            # Set interrupt coalescing to minimum for lowest latency
            # rx-usecs: max time to wait before generating an RX interrupt
            # tx-usecs: max time to wait before generating a TX interrupt
            ethtool -C "$iface" rx-usecs 0 tx-usecs 0 2>/dev/null || true

            # Disable generic receive offload (GRO) — can add latency
            # by batching packets
            ethtool -K "$iface" gro off 2>/dev/null || true

            # Enable receive flow steering if needed
            # (configured per-queue in network setup)
        fi
    done

    # =========================================================================
    # 4. IRQ Affinity — pin interrupts to housekeeping cores
    # =========================================================================
    # Move all IRQs to housekeeping cores (0-1 and their HT siblings 20-21).
    # This prevents hardware interrupts from hitting isolated cores.
    HOUSEKEEPING_MASK="00300003"  # Cores 0,1,20,21 in hex bitmask

    for irq in $(ls /proc/irq/ | grep -E '^[0-9]+$'); do
        # Skip IRQ 0 (timer) and IRQ 2 (cascade) — managed by kernel
        if [ "$irq" -gt 2 ]; then
            echo "$HOUSEKEEPING_MASK" > /proc/irq/$irq/smp_affinity 2>/dev/null || true
        fi
    done

    # =========================================================================
    # 5. Kernel Transparent Hugepages — disable
    # =========================================================================
    # Transparent Hugepages (THP) cause latency spikes when the kernel
    # promotes/demotes pages in the background. DPDK manages its own
    # hugepages explicitly.
    echo never > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true
    echo never > /sys/kernel/mm/transparent_hugepage/defrag 2>/dev/null || true

    # =========================================================================
    # 6. Kernel writeback tuning
    # =========================================================================
    # Reduce dirty page writeback aggressiveness to prevent I/O storms
    # from interfering with real-time processing
    echo 10 > /proc/sys/vm/dirty_ratio 2>/dev/null || true
    echo 5 > /proc/sys/vm/dirty_background_ratio 2>/dev/null || true

    echo "realtime-telco: Startup tuning complete."
    return 0
}

stop() {
    echo "realtime-telco: Reverting startup tuning..."

    # Close the cpu_dma_latency file descriptor
    exec 3>&- 2>/dev/null || true

    # Restore THP defaults
    echo madvise > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true

    return 0
}

process $@
SCRIPT

sudo chmod +x /etc/tuned/realtime-telco/script.sh
```

### script.sh Section Explanations

| Section | What It Does |
|---------|-------------|
| CPU Frequency Governor | Pins all cores to `performance` governor, preventing frequency scaling transitions |
| CPU DMA Latency | Writes `0` to `/dev/cpu_dma_latency`, preventing the kernel from entering deep C-states |
| NIC Tuning | Disables adaptive coalescing on Intel E810 (ice driver) interfaces for deterministic interrupt behavior |
| IRQ Affinity | Moves all hardware interrupts to housekeeping cores, keeping isolated cores free of interrupt jitter |
| Transparent Hugepages | Disables THP to prevent background page promotion/demotion latency spikes |
| Writeback Tuning | Reduces dirty page writeback aggressiveness |

:::note
The IRQ affinity housekeeping mask (`00300003`) corresponds to cores 0, 1, 20, and 21 on a 40-thread system. You must recalculate this mask for your topology. The mask is a hexadecimal representation of a bitmask where each bit represents a CPU. Use `printf '%x\n' $(( (1<<0) | (1<<1) | (1<<20) | (1<<21) ))` to compute it for your housekeeping cores.
:::

## Activate the Profile

```bash
# Enable and start TuneD if not already running
sudo systemctl enable --now tuned

# Activate the custom profile
sudo tuned-adm profile realtime-telco
```

TuneD will:
1. Apply all `[sysctl]` settings
2. Execute `script.sh start`
3. If the `[bootloader]` section changed kernel parameters, TuneD will update GRUB (may require a reboot for boot parameters to take effect)

## Verification

### Check Active Profile

```bash
tuned-adm active
```

Expected:

```
Current active profile: realtime-telco
```

### Verify Profile Settings

```bash
sudo tuned-adm verify
```

Expected:

```
Verification succeeded, current system settings match the preset profile.
See TuneD log file ('/var/log/tuned/tuned.log') for details.
```

If verification fails, check the log for which settings did not apply:

```bash
sudo tail -50 /var/log/tuned/tuned.log
```

### Verify Individual Settings

```bash
# CPU governor
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
# Expected: performance

# RT throttling disabled
cat /proc/sys/kernel/sched_rt_runtime_us
# Expected: -1

# Swap disabled
cat /proc/sys/vm/swappiness
# Expected: 0

# Transparent hugepages disabled
cat /sys/kernel/mm/transparent_hugepage/enabled
# Expected: always madvise [never]

# Timer migration disabled
cat /proc/sys/kernel/timer_migration
# Expected: 0
```

<!-- IMAGE PLACEHOLDER: [Terminal output showing successful tuned-adm verify output with all checks passing] -->

## Interaction with GRUB Parameters

You will notice that some parameters appear in both the GRUB configuration ([Real-Time Kernel](./02-realtime-kernel.md)) and the TuneD `[bootloader]` section. This is intentional:

- **GRUB parameters** are the authoritative source and are applied at boot
- **TuneD `[bootloader]`** ensures consistency — if someone resets GRUB defaults, `tuned-adm verify` will flag the discrepancy
- TuneD can also add boot parameters via `grub2-mkconfig` on systems that support it

The two mechanisms are complementary, not conflicting. If a parameter appears in both, the value is the same, and the kernel sees it only once.

## Customizing for Your System

The profile above is a template. You **must** customize:

1. **`isolated_cores`** in `[variables]`: Set this to match the CPU ranges determined in [CPU Isolation](./04-cpu-isolation.md)
2. **`HOUSEKEEPING_MASK`** in `script.sh`: Recalculate for your housekeeping core set
3. **Hugepages count**: Adjust `hugepages=16` based on your total RAM (leave at least 8 GB for the OS)
4. **NIC interface detection**: The script detects `ice` driver interfaces. If you have additional NICs, adjust accordingly

:::tip
After making changes to the profile, reload it with:
```bash
sudo tuned-adm profile realtime-telco
```
For changes in the `[bootloader]` section, you must also reboot.
:::

## Next Steps

With TuneD configured, proceed to [CPU Isolation](./04-cpu-isolation.md) for detailed guidance on planning your core allocation, verifying isolation, and validating real-time latency with `cyclictest`.
