---
id: nic-optimization
title: "NIC and Network Stack Optimization"
sidebar_label: NIC Optimization
sidebar_position: 3
description: >
  Comprehensive Intel E810 NIC optimization guide for 5G fronthaul and backhaul.
  Covers ice/iavf driver updates, firmware updates, 15 ethtool/sysctl tuning
  parameters, IRQ affinity, RSS, iperf3 validation, and TuneD integration for
  boot-time persistence.
keywords:
  - NIC optimization
  - Intel E810
  - ice driver
  - iavf driver
  - ethtool
  - sysctl tuning
  - IRQ affinity
  - RSS
  - network performance
  - iperf3
  - TuneD
  - flow control
  - interrupt coalescing
---

# NIC and Network Stack Optimization

Out-of-the-box Linux network settings are optimized for general-purpose workloads with a balance between throughput, latency, and CPU efficiency. A 5G deployment demands more: the backhaul (N2/N3) and data (N6) interfaces must sustain high throughput with low latency, and the fronthaul interface must operate with deterministic, sub-millisecond timing.

This page covers **15 specific optimizations** for the Intel E810-XXVDA4T NIC and the Linux network stack, explains why each matters, and wraps everything into a persistent TuneD script.

## Intel E810 Driver and Firmware Updates

Before tuning parameters, ensure the NIC is running up-to-date drivers and firmware. Newer versions fix bugs, improve performance, and add features that srsRAN depends on.

### Check Current Driver and Firmware Versions

```bash
$ ethtool -i enp81s0f0
driver: ice
version: 6.8.0
firmware-version: 4.40 0x8001c967 1.3534.0
bus-info: 0000:51:00.0
```

### Update the ice Driver (Physical Function)

The `ice` driver manages the E810 Physical Functions. Ubuntu 24.04 ships with a kernel-bundled version, but Intel provides newer out-of-tree versions with performance improvements.

```bash
# Download the latest ice driver from Intel
$ cd /usr/local/src
$ sudo wget https://downloadmirror.intel.com/838613/ice-1.14.9.tar.gz
$ sudo tar xf ice-1.14.9.tar.gz
$ cd ice-1.14.9/src

# Build and install
$ sudo make install
$ sudo modprobe -r ice && sudo modprobe ice
```

:::warning
Removing and reloading the `ice` driver will momentarily drop all E810 interfaces. If you are connected via SSH over an E810 port, you will lose your session. Always perform driver updates over the **management interface** (`eno1`).
:::

Verify the updated driver:

```bash
$ ethtool -i enp81s0f0 | grep version
driver: ice
version: 1.14.9
```

### Update the iavf Driver (Virtual Function)

The `iavf` driver manages Virtual Functions. Update it to match the `ice` driver version:

```bash
$ cd /usr/local/src
$ sudo wget https://downloadmirror.intel.com/838612/iavf-4.12.5.tar.gz
$ sudo tar xf iavf-4.12.5.tar.gz
$ cd iavf-4.12.5/src
$ sudo make install
$ sudo modprobe -r iavf && sudo modprobe iavf
```

### Firmware Update

Intel provides the **NVM Update Tool** to flash new firmware onto the E810. Firmware updates can fix timing accuracy issues and enable features like enhanced PTP support.

```bash
# Download the NVM Update Tool for E810
$ cd /usr/local/src
$ sudo wget https://downloadmirror.intel.com/XXXXX/E810_NVMUpdatePackage.zip
$ sudo unzip E810_NVMUpdatePackage.zip
$ cd E810/Linux_x64

# List detected adapters
$ sudo ./nvmupdate64e -i

# Update firmware (replace XXXX with the adapter index from the list)
$ sudo ./nvmupdate64e -u -l update.log
```

:::danger
Firmware updates are **irreversible** without Intel support tools. A failed firmware update can brick the NIC. Ensure you have:
- Stable power (use a UPS).
- The correct firmware package for your exact E810 SKU (XXVDA4T).
- No active traffic on the NIC during the update.

After the update, a **cold reboot** (full power cycle, not just `reboot`) is required.
:::

## Network Optimization Settings

The following 15 optimizations are applied to the kernel-managed interfaces (`enp81s0f1` for backhaul, `enp81s0f2` for N6). Some also apply to the fronthaul PF (`enp81s0f0`).

We define a variable for convenience -- replace with each interface name as needed:

```bash
$ IFACE=enp81s0f1
```

### 1. Disable Flow Control

Flow control (IEEE 802.3x PAUSE frames) causes the NIC to pause transmission when the receiver's buffer is full. In a real-time system, pausing transmission causes latency spikes and can violate timing constraints.

```bash
$ sudo ethtool -A $IFACE rx off tx off
```

**Why:** PAUSE frames introduce unpredictable delays. It is better to drop packets and let upper-layer protocols (SCTP for N2, GTP-U retransmission for N3) handle recovery than to stall the entire link.

### 2. Increase Socket Buffer Sizes

The kernel's default socket buffer sizes (212 KB) are too small for high-throughput NIC traffic, causing drops during bursts.

```bash
$ sudo sysctl -w net.core.rmem_max=16777216
$ sudo sysctl -w net.core.wmem_max=16777216
$ sudo sysctl -w net.core.rmem_default=1048576
$ sudo sysctl -w net.core.wmem_default=1048576
```

**Why:** GTP-U encapsulated user traffic can arrive in large bursts. Larger buffers absorb these bursts without dropping packets before the application reads them.

### 3. Increase TCP Buffer Sizes

TCP auto-tuning uses these min/pressure/max values. The defaults are conservative for high-bandwidth links.

```bash
$ sudo sysctl -w net.ipv4.tcp_rmem="4096 87380 16777216"
$ sudo sysctl -w net.ipv4.tcp_wmem="4096 65536 16777216"
```

**Why:** SCTP (used by N2/NGAP) and any TCP-based management traffic benefit from larger buffers on 25 Gbps links. The kernel auto-tunes within these bounds based on available memory and connection bandwidth.

### 4. Increase Network Backlog

The `netdev_max_backlog` parameter controls how many packets can queue in the kernel's per-CPU backlog before being processed. The default (1000) is too low for 25 Gbps traffic.

```bash
$ sudo sysctl -w net.core.netdev_max_backlog=250000
```

**Why:** At 25 Gbps with small packets, the kernel can receive hundreds of thousands of packets per second. A small backlog causes silent drops during traffic bursts.

### 5. Adjust NAPI Weight

NAPI (New API) polling weight controls how many packets the kernel processes per NAPI poll cycle.

```bash
$ sudo sysctl -w net.core.dev_weight=64
```

**Why:** A higher weight allows the kernel to process more packets per poll cycle, reducing per-packet overhead and improving throughput. The default (64) is generally appropriate, but we set it explicitly for consistency.

:::note
The NAPI weight of 64 is already the default on most kernels. Setting it explicitly ensures the value is correct regardless of kernel version.
:::

### 6. Enable BBR Congestion Control

BBR (Bottleneck Bandwidth and Round-trip propagation time) is Google's congestion control algorithm. It achieves significantly higher throughput and lower latency than the default CUBIC, especially on high-bandwidth paths.

```bash
$ sudo modprobe tcp_bbr
$ sudo sysctl -w net.ipv4.tcp_congestion_control=bbr
```

Verify:

```bash
$ sysctl net.ipv4.tcp_congestion_control
net.ipv4.tcp_congestion_control = bbr
```

**Why:** BBR better utilizes 25 Gbps links by probing for available bandwidth rather than relying on packet loss as a congestion signal. This is particularly beneficial for the N6 data path.

### 7. Enable MTU Probing

Path MTU Discovery can be blocked by misconfigured firewalls. MTU probing works around this by actively probing for the correct MTU.

```bash
$ sudo sysctl -w net.ipv4.tcp_mtu_probing=1
```

**Why:** With 9000-byte jumbo frames configured on the E810 interfaces, there is a risk of MTU black holes if an intermediate device does not support jumbo frames. MTU probing detects and adapts to these situations.

### 8. Maximize Ring Buffer Sizes

NIC ring buffers hold packets between the hardware and the driver. Larger rings absorb traffic bursts without drops.

```bash
# Check current and maximum ring sizes
$ ethtool -g $IFACE

# Set to maximum
$ sudo ethtool -G $IFACE rx 4096 tx 4096
```

**Why:** The default ring size is often 512 or 1024. On a 25 Gbps interface, this can fill in microseconds during a burst. Increasing to 4096 provides more buffer time for the kernel to drain the ring.

:::tip
The maximum ring size varies by driver and NIC model. Use `ethtool -g $IFACE` to check the maximum before setting. The E810 with the `ice` driver typically supports up to 4096.
:::

### 9. Optimize Queueing Discipline

The default queueing discipline (`fq_codel`) introduces latency to manage bufferbloat. For dedicated 5G infrastructure links, we want minimal queueing delay.

For **low-latency paths** (backhaul):

```bash
$ sudo tc qdisc replace dev $IFACE root noqueue
```

For **data paths** (N6) where fairness matters:

```bash
$ sudo tc qdisc replace dev $IFACE root fq
```

**Why:** `noqueue` eliminates all kernel-level queuing, giving the lowest possible latency for the backhaul. `fq` (fair queueing) provides per-flow pacing on the data path, which works well with BBR.

### 10. Increase TX Queue Length

The transmit queue length limits how many packets can be queued in the kernel's software transmit queue per interface.

```bash
$ sudo ip link set dev $IFACE txqueuelen 10000
```

**Why:** The default (1000) can cause drops during transmit bursts on high-speed interfaces. Increasing this provides a larger software buffer to absorb transient bursts before the NIC's hardware queue drains.

### 11. Enable Hardware Offloading

The E810 supports various offloading features that move work from the CPU to the NIC hardware.

```bash
$ sudo ethtool -K $IFACE gro on gso on tso on
$ sudo ethtool -K $IFACE rx-checksumming on tx-checksumming on
```

**Why:** TSO (TCP Segmentation Offload), GSO (Generic Segmentation Offload), and GRO (Generic Receive Offload) reduce CPU overhead by letting the NIC handle segmentation and reassembly. Checksum offloading frees the CPU from computing checksums on every packet.

:::note
These offloads apply to **kernel-managed interfaces only**. DPDK bypasses the kernel and handles offloading internally through its PMD.
:::

### 12. Tune Interrupt Coalescing

Interrupt coalescing batches multiple packet arrivals into a single interrupt. Disabling coalescing (setting usecs to 0) delivers interrupts as fast as possible, minimizing latency at the cost of higher CPU usage.

```bash
$ sudo ethtool -C $IFACE rx-usecs 0 tx-usecs 0 adaptive-rx off adaptive-tx off
```

**Why:** For the backhaul interface carrying N2/N3 traffic, latency is more important than CPU efficiency. Disabling coalescing ensures packets are delivered to the kernel immediately. Adaptive coalescing is disabled to prevent the driver from overriding our settings.

:::tip
If CPU usage on the backhaul interface is a concern (e.g., in a single-server deployment where cores are scarce), you can set `rx-usecs` to a small value like 10-50 instead of 0. This reduces interrupt rate while keeping latency under 50 microseconds.
:::

### 13. Disable Energy Efficient Ethernet (EEE)

Energy Efficient Ethernet puts the link into a low-power state during idle periods. Transitioning out of low-power state adds microseconds of latency.

```bash
# Check if EEE is supported/enabled
$ ethtool --show-eee $IFACE

# Disable if supported
$ sudo ethtool --set-eee $IFACE eee off
```

**Why:** The E810 25G interfaces typically do not support EEE (it is primarily a feature of 1G/10G copper interfaces). However, checking and disabling it ensures consistent behavior if the NIC firmware adds support in the future.

### 14. Configure RSS (Receive Side Scaling)

RSS distributes incoming packets across multiple receive queues, which are then processed by different CPU cores. Proper RSS configuration ensures packet processing is parallelized effectively.

```bash
# Check current RSS configuration
$ ethtool -l $IFACE

# Set the number of combined queues (match to available cores)
$ sudo ethtool -L $IFACE combined 8
```

Configure the RSS hash to distribute based on IP and port for even spreading:

```bash
$ sudo ethtool -N $IFACE rx-flow-hash udp4 sdfn
$ sudo ethtool -N $IFACE rx-flow-hash tcp4 sdfn
```

The hash key flags mean:
- `s` = source address
- `d` = destination address
- `f` = fragment (for IP)
- `n` = destination port

**Why:** Without proper RSS, all packets may land on a single CPU core, creating a bottleneck. Distributing across 8 queues (and therefore up to 8 cores) ensures the 25 Gbps link can be fully utilized.

### 15. Pin IRQ Affinity

NIC interrupts should be pinned to **housekeeping cores** -- cores that are not isolated for real-time srsRAN processing. If NIC interrupts fire on an isolated core running the DU, they cause latency spikes in fronthaul processing.

First, identify the NIC's IRQ numbers:

```bash
$ grep enp81s0f1 /proc/interrupts | awk '{print $1}' | tr -d ':'
```

Then pin each IRQ to housekeeping cores. Assuming cores 0-3 are housekeeping and cores 4-31 are isolated for srsRAN:

```bash
# Pin all E810 backhaul IRQs to cores 0-3
$ for irq in $(grep enp81s0f1 /proc/interrupts | awk '{print $1}' | tr -d ':'); do
    echo 0f | sudo tee /proc/irq/$irq/smp_affinity   # 0x0f = cores 0-3
  done
```

:::warning
The CPU core numbering here is an example. Your actual isolated core list depends on the `isolcpus` and `rcu_nocbs` kernel parameters configured in [CPU Isolation](../02-system-preparation/04-cpu-isolation.md). Ensure NIC IRQs are pinned to cores that are **not** in your isolated set.
:::

**Why:** When a NIC interrupt fires on an isolated core, it preempts the real-time srsRAN thread, causing jitter in fronthaul timing. By pinning IRQs to housekeeping cores, the isolated cores remain undisturbed.

<!-- IMAGE PLACEHOLDER: Diagram showing CPU core layout -- cores 0-3 labeled "Housekeeping (NIC IRQs, OS tasks)" and cores 4-31 labeled "Isolated (srsRAN DU threads)". Arrows show NIC interrupts routed only to cores 0-3. -->

## Verification with iperf3

After applying all optimizations, verify network throughput with `iperf3`.

### Install iperf3

```bash
$ sudo apt-get install -y iperf3
```

### Run the Test

You need a second machine connected to the same network segment, or you can test in loopback if both interfaces are on the same server.

On the **server** (the machine you just optimized):

```bash
$ iperf3 -s -B 10.20.0.10
```

On the **client** (another machine on the backhaul network):

```bash
$ iperf3 -c 10.20.0.10 -t 30 -P 4
```

Parameter breakdown:

| Parameter | Meaning |
|-----------|---------|
| `-t 30` | Run for 30 seconds |
| `-P 4` | Use 4 parallel streams |

### Expected Results

| Link Speed | Expected Throughput | Notes |
|-----------|-------------------|-------|
| 10 Gbps | ~9.4 Gbps | ~94% of line rate |
| 25 Gbps | ~23.5 Gbps | ~94% of line rate |

If throughput is significantly below these values, check:

1. **Flow control** -- is it actually disabled? (`ethtool -a $IFACE`)
2. **Ring buffers** -- are they at maximum? (`ethtool -g $IFACE`)
3. **IRQ affinity** -- are interrupts spread across multiple cores?
4. **MTU** -- is jumbo frame (MTU 9000) configured on both ends?
5. **Cable/optic** -- is the physical link negotiated at 25 Gbps? (`ethtool $IFACE | grep Speed`)

:::tip
For a more thorough test, try UDP mode to eliminate TCP overhead:

```bash
$ iperf3 -c 10.20.0.10 -t 30 -P 4 -u -b 25G
```

This sends at 25 Gbps using UDP and reports packet loss. Even a small amount of packet loss (> 0.01%) indicates a tuning or hardware issue.
:::

## Persistence with TuneD

All the `ethtool` and `sysctl` settings above are lost on reboot. To make them persistent, wrap them into the TuneD profile's startup script. If you configured a TuneD profile during [System Preparation](../02-system-preparation/01-os-installation.md), add the network optimizations to its `script.sh`.

### TuneD Script for Network Optimizations

Add the following to your TuneD profile's script:

```bash title="/etc/tuned/srsran-realtime/script.sh (append to existing)"
#!/bin/bash

# ═══════════════════════════════════════════════════════════
# Network Optimization Settings for 5G Deployment
# Applied at boot by TuneD
# ═══════════════════════════════════════════════════════════

BACKHAUL_IFACE="enp81s0f1"
DATA_IFACE="enp81s0f2"
FRONTHAUL_PF="enp81s0f0"

# Housekeeping core mask (cores 0-3 = 0x0f)
HOUSEKEEPING_MASK="0f"

apply_nic_optimizations() {
    local iface=$1

    # 1. Disable flow control
    ethtool -A $iface rx off tx off 2>/dev/null

    # 8. Maximize ring buffers
    ethtool -G $iface rx 4096 tx 4096 2>/dev/null

    # 11. Enable hardware offloading
    ethtool -K $iface gro on gso on tso on 2>/dev/null
    ethtool -K $iface rx-checksumming on tx-checksumming on 2>/dev/null

    # 12. Tune interrupt coalescing
    ethtool -C $iface rx-usecs 0 tx-usecs 0 adaptive-rx off adaptive-tx off 2>/dev/null

    # 13. Disable EEE
    ethtool --set-eee $iface eee off 2>/dev/null

    # 14. Configure RSS queues
    ethtool -L $iface combined 8 2>/dev/null
    ethtool -N $iface rx-flow-hash udp4 sdfn 2>/dev/null
    ethtool -N $iface rx-flow-hash tcp4 sdfn 2>/dev/null

    # 10. Increase TX queue length
    ip link set dev $iface txqueuelen 10000 2>/dev/null
}

apply_irq_affinity() {
    local iface=$1
    local mask=$2

    # 15. Pin IRQs to housekeeping cores
    for irq in $(grep $iface /proc/interrupts | awk '{print $1}' | tr -d ':'); do
        echo $mask > /proc/irq/$irq/smp_affinity 2>/dev/null
    done
}

start() {
    # ── sysctl settings ──────────────────────────────────
    # 2. Socket buffer sizes
    sysctl -w net.core.rmem_max=16777216
    sysctl -w net.core.wmem_max=16777216
    sysctl -w net.core.rmem_default=1048576
    sysctl -w net.core.wmem_default=1048576

    # 3. TCP buffer sizes
    sysctl -w net.ipv4.tcp_rmem="4096 87380 16777216"
    sysctl -w net.ipv4.tcp_wmem="4096 65536 16777216"

    # 4. Network backlog
    sysctl -w net.core.netdev_max_backlog=250000

    # 5. NAPI weight
    sysctl -w net.core.dev_weight=64

    # 6. BBR congestion control
    modprobe tcp_bbr
    sysctl -w net.ipv4.tcp_congestion_control=bbr

    # 7. MTU probing
    sysctl -w net.ipv4.tcp_mtu_probing=1

    # ── Per-interface NIC settings ───────────────────────
    apply_nic_optimizations $BACKHAUL_IFACE
    apply_nic_optimizations $DATA_IFACE
    apply_nic_optimizations $FRONTHAUL_PF

    # ── Queueing discipline ──────────────────────────────
    # 9. noqueue for low-latency backhaul, fq for data path
    tc qdisc replace dev $BACKHAUL_IFACE root noqueue 2>/dev/null
    tc qdisc replace dev $DATA_IFACE root fq 2>/dev/null

    # ── IRQ affinity ─────────────────────────────────────
    apply_irq_affinity $BACKHAUL_IFACE $HOUSEKEEPING_MASK
    apply_irq_affinity $DATA_IFACE $HOUSEKEEPING_MASK
    apply_irq_affinity $FRONTHAUL_PF $HOUSEKEEPING_MASK
}

stop() {
    # Reset to defaults (optional -- reboot achieves the same)
    sysctl -w net.core.rmem_max=212992
    sysctl -w net.core.wmem_max=212992
    sysctl -w net.ipv4.tcp_congestion_control=cubic
}

case "$1" in
    start)  start ;;
    stop)   stop ;;
    *)      start ;;
esac
```

### TuneD Profile Configuration

Ensure the TuneD profile references the script. Add or verify the `[script]` section in the profile's `tuned.conf`:

```ini title="/etc/tuned/srsran-realtime/tuned.conf (excerpt)"
[script]
script=script.sh
```

### Activate and Verify

```bash
# Activate the TuneD profile
$ sudo tuned-adm profile srsran-realtime

# Verify the profile is active
$ sudo tuned-adm active
Current active profile: srsran-realtime

# Verify settings were applied
$ sysctl net.core.rmem_max
net.core.rmem_max = 16777216

$ ethtool -A enp81s0f1
Pause parameters for enp81s0f1:
RX:     off
TX:     off

$ ethtool -g enp81s0f1 | grep -A2 "Current"
Current hardware settings:
RX:     4096
TX:     4096
```

## Optimization Summary

The following table summarizes all 15 optimizations for quick reference:

| # | Optimization | Command | Scope |
|---|-------------|---------|-------|
| 1 | Disable flow control | `ethtool -A $IFACE rx off tx off` | Per-interface |
| 2 | Socket buffer sizes | `sysctl net.core.rmem_max=16777216` | System-wide |
| 3 | TCP buffer sizes | `sysctl net.ipv4.tcp_rmem=...` | System-wide |
| 4 | Network backlog | `sysctl net.core.netdev_max_backlog=250000` | System-wide |
| 5 | NAPI weight | `sysctl net.core.dev_weight=64` | System-wide |
| 6 | BBR congestion control | `sysctl net.ipv4.tcp_congestion_control=bbr` | System-wide |
| 7 | MTU probing | `sysctl net.ipv4.tcp_mtu_probing=1` | System-wide |
| 8 | Ring buffer sizes | `ethtool -G $IFACE rx 4096 tx 4096` | Per-interface |
| 9 | Queueing discipline | `tc qdisc replace dev $IFACE root noqueue` | Per-interface |
| 10 | TX queue length | `ip link set dev $IFACE txqueuelen 10000` | Per-interface |
| 11 | Hardware offloading | `ethtool -K $IFACE gro on gso on tso on` | Per-interface |
| 12 | Interrupt coalescing | `ethtool -C $IFACE rx-usecs 0 adaptive-rx off` | Per-interface |
| 13 | Disable EEE | `ethtool --set-eee $IFACE eee off` | Per-interface |
| 14 | RSS queues | `ethtool -L $IFACE combined 8` | Per-interface |
| 15 | IRQ affinity | `echo $MASK > /proc/irq/$IRQ/smp_affinity` | Per-IRQ |

## Next Steps

With the network fully optimized, proceed to [Timing and Synchronization](../04-timing-synchronization/01-ptp-overview.md) to configure PTP (IEEE 1588) for the precise clock synchronization required by ORAN Split 7.2 fronthaul.
