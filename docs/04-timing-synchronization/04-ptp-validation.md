---
id: ptp-validation
title: "PTP Validation and Monitoring"
sidebar_label: PTP Validation
sidebar_position: 4
description: >
  Validate that PTP synchronization meets ORAN Split 7.2 requirements. Covers
  disabling conflicting time services, validation targets, monitoring commands,
  interpreting ptp4l and phc2sys output, and troubleshooting poor sync.
keywords:
  - PTP validation
  - PTP monitoring
  - ptp4l offset
  - phc2sys offset
  - ORAN timing requirements
  - pmc
  - NTP conflict
  - chrony
  - systemd-timesyncd
  - hardware timestamping
---

# PTP Validation and Monitoring

After configuring PTP using either the [LLS-C1](./02-lls-c1-configuration.md) or [LLS-C3](./03-lls-c3-configuration.md) model, you must validate that synchronization accuracy meets the strict requirements of ORAN Split 7.2 fronthaul. This page covers how to disable conflicting time services, what accuracy targets to aim for, how to monitor PTP in real time, and what to do if synchronization is poor.

## Step 1: Disable Conflicting Time Services

Linux systems typically run a network time synchronization daemon by default. These services adjust the system clock using NTP, which conflicts with `phc2sys` (which also adjusts the system clock). Running both simultaneously causes clock instability as the two services fight over `CLOCK_REALTIME`.

:::danger
You **must** disable all NTP-based time services before relying on PTP. Failing to do so is one of the most common causes of erratic PTP behavior, including periodic offset spikes, clock jumps, and frequency oscillation.
:::

Disable `systemd-timesyncd` (Ubuntu's default NTP client):

```bash
sudo systemctl stop systemd-timesyncd
sudo systemctl disable systemd-timesyncd
```

Disable `chrony` (if installed):

```bash
sudo systemctl stop chrony
sudo systemctl disable chrony
```

Disable `ntpd` (if installed, uncommon on Ubuntu 24.04):

```bash
sudo systemctl stop ntp
sudo systemctl disable ntp
```

Verify no NTP service is running:

```bash
timedatectl show --property=NTP
```

This should return:

```
NTP=no
```

Also confirm with:

```bash
timedatectl show --property=NTPSynchronized
```

Which should show:

```
NTPSynchronized=no
```

:::tip
If you need NTP for other services on the same machine (unlikely in a dedicated DU server), you can configure `chrony` to use the PHC as its reference clock instead of NTP servers. However, for simplicity, this tutorial assumes PTP is the sole time source and all NTP services are disabled.
:::

## Step 2: Verify Hardware Timestamping

Confirm that the E810 NIC supports and is using hardware timestamping:

```bash
ethtool -T enp81s0f0
```

Required capabilities in the output:

```
Capabilities:
        hardware-transmit
        software-transmit
        hardware-receive
        software-receive
        hardware-raw-clock
PTP Hardware Clock: 0
Hardware Transmit Timestamp Modes:
        off
        on
Hardware Receive Filter Modes:
        none
        all
```

The critical entries are `hardware-transmit` and `hardware-receive`. If only `software-transmit` and `software-receive` appear, the NIC driver does not support hardware timestamping, and PTP accuracy will be insufficient for ORAN.

:::warning
If `ethtool -T` shows "No PTP support" or only software capabilities, check that:
1. The `ice` driver is loaded (`lsmod | grep ice`).
2. The NIC firmware supports PTP (update firmware with `devlink` if needed).
3. You are querying the correct interface name.
:::

## Step 3: Validation Targets

ORAN Split 7.2 requires that the DU and RU are synchronized to within tight bounds. The following targets apply to the PTP chain on the DU side:

| Metric | Target | Where to Measure | Significance |
|---|---|---|---|
| **ptp4l RMS offset** | **8 ns or less** | `journalctl -u ptp4l -f` | RMS (root mean square) of the offset from master. This is the primary accuracy indicator. |
| **ptp4l peak offset** | **5 ns or less** | `journalctl -u ptp4l -f` (max field) | Maximum instantaneous offset. Occasional peaks up to ~20 ns are acceptable during convergence. |
| **phc2sys offset** | **100 ns or less** | `journalctl -u phc2sys -f` | Offset between the PHC and the system clock. Less critical than ptp4l offset for fronthaul, but important for system-level time accuracy. |
| **ts2phc offset** (LLS-C1 only) | **10 ns or less** | `journalctl -u ts2phc -f` | Offset between the GNSS 1PPS and the PHC. |

:::note
These targets assume a clean network path (direct connection or PTP-aware switches). If you have non-PTP-aware switches in the path, achieving sub-10 ns ptp4l offsets may not be possible. In that case, aim for the best accuracy your network can deliver, and consult your RU's documentation for its maximum tolerable offset.
:::

## Step 4: Allow Stabilization Time

After starting the PTP services, the system needs time to converge:

- **GNSS fix** (LLS-C1): 2-15 minutes for a cold start.
- **ts2phc convergence** (LLS-C1): 1-3 minutes after GNSS fix.
- **ptp4l convergence**: 2-5 minutes after ts2phc (LLS-C1) or after detecting the GM (LLS-C3).
- **phc2sys convergence**: 30-60 seconds after ptp4l.

**Total: allow at least 10-15 minutes** from cold start before evaluating synchronization quality. During this period, you will see large offsets that gradually decrease. Do not troubleshoot until the system has had adequate time to stabilize.

## Step 5: Monitor ptp4l

### Real-Time Log Monitoring

```bash
journalctl -u ptp4l -f
```

### Understanding ptp4l Output

A typical `ptp4l` log line in follower mode looks like:

```
ptp4l[1856.123]: rms    5 max   12 freq  -1234 +/-   3 delay    89 +/-   1
```

Each field:

| Field | Example Value | Description |
|---|---|---|
| `rms` | `5` | Root mean square of the offset from master, in nanoseconds. This is your primary accuracy metric. |
| `max` | `12` | Maximum absolute offset observed in the current reporting window, in nanoseconds. |
| `freq` | `-1234` | Frequency correction being applied to the local clock, in parts per billion (ppb). A stable value means the servo has converged. |
| `+/-` (after freq) | `3` | Standard deviation of the frequency correction. Should be small and stable when converged. |
| `delay` | `89` | Estimated one-way network delay (path delay) in nanoseconds. |
| `+/-` (after delay) | `1` | Standard deviation of the path delay estimate. Should be small for a clean network. |

**What good output looks like:**

```
ptp4l[1860.123]: rms    3 max    8 freq  -1234 +/-   2 delay    89 +/-   1
ptp4l[1861.123]: rms    4 max    9 freq  -1232 +/-   2 delay    89 +/-   1
ptp4l[1862.123]: rms    2 max    6 freq  -1235 +/-   1 delay    89 +/-   1
ptp4l[1863.123]: rms    5 max   11 freq  -1233 +/-   3 delay    90 +/-   1
```

Key indicators of healthy synchronization:

- `rms` consistently in the **single digits** (under 8 ns).
- `freq` value is **stable** (not swinging wildly).
- `delay` value is **stable** (not jumping around).
- No state transitions (the port stays in `SLAVE`).

**What bad output looks like:**

```
ptp4l[1860.123]: rms  450 max  890 freq -56789 +/- 234 delay   123 +/-  45
ptp4l[1861.123]: rms  380 max  720 freq -56234 +/- 198 delay   145 +/-  38
ptp4l[1862.123]: port 1 (enp81s0f0): SLAVE to UNCALIBRATED on SYNCHRONIZATION_FAULT
```

This shows large offsets, unstable frequency corrections, variable path delays, and state transitions — all signs of a problem.

### In Grandmaster Mode (LLS-C1)

When `ptp4l` runs in Grandmaster mode, it does not track an upstream master, so there are no offset lines. Instead, look for:

```
ptp4l[...]: port 1 (enp81s0f0): LISTENING to MASTER on ANNOUNCE_RECEIPT_TIMEOUT_EXPIRES
ptp4l[...]: selected local clock 001122.fffe.334455 as best master
```

The port should remain in `MASTER` state. If it transitions away from `MASTER`, another PTP clock on the network may be winning the BMCA election.

## Step 6: Monitor phc2sys

```bash
journalctl -u phc2sys -f
```

### Understanding phc2sys Output

```
phc2sys[1860.123]: CLOCK_REALTIME phc offset        -8 s2 freq   -1234 delay    456
```

| Field | Example Value | Description |
|---|---|---|
| `CLOCK_REALTIME` | — | The destination clock being disciplined (the system clock) |
| `phc offset` | `-8` | Offset between the PHC and the system clock, in nanoseconds |
| `s2` | — | Servo state: `s0` = unlocked, `s1` = clock step applied, `s2` = locked and tracking |
| `freq` | `-1234` | Frequency adjustment being applied, in ppb |
| `delay` | `456` | Estimated delay of the clock read operation, in nanoseconds |

**What good output looks like:**

```
phc2sys[1860.123]: CLOCK_REALTIME phc offset        -8 s2 freq   -1234 delay    456
phc2sys[1861.123]: CLOCK_REALTIME phc offset        12 s2 freq   -1230 delay    460
phc2sys[1862.123]: CLOCK_REALTIME phc offset        -3 s2 freq   -1232 delay    455
```

- Servo state is `s2` (locked).
- Offset values are **under 100 ns**.
- Frequency is stable.

## Step 7: Monitor ts2phc (LLS-C1 Only)

If you are using the LLS-C1 model:

```bash
journalctl -u ts2phc -f
```

**Good output:**

```
ts2phc[1860.123]: enp81s0f0 master offset          2 s2 freq      +8
ts2phc[1861.123]: enp81s0f0 master offset         -1 s2 freq      +9
ts2phc[1862.123]: enp81s0f0 master offset          3 s2 freq      +7
```

- `s2` state (locked).
- Offset in the **single-digit nanoseconds**.

## Step 8: Query PTP State with pmc

The `pmc` (PTP Management Client) tool sends PTP management messages to the local `ptp4l` instance and displays the responses.

### Query Current Offset and Path Delay

```bash
pmc -u -b 0 'GET CURRENT_DATA_SET'
```

Example output:

```
RESPONSE MANAGEMENT MESSAGE
        stepsRemoved     1
        offsetFromMaster 3.0
        meanPathDelay    89.0
```

- `stepsRemoved` — Number of PTP hops between this clock and the GM. `1` = directly following the GM.
- `offsetFromMaster` — Current offset in nanoseconds.
- `meanPathDelay` — Estimated one-way network delay in nanoseconds.

### Query Grandmaster Information

```bash
pmc -u -b 0 'GET TIME_STATUS_NP'
```

Example output:

```
RESPONSE MANAGEMENT MESSAGE
        master_offset              3
        ingress_time               1741100000000000000
        cumulativeScaledRateOffset +0.000000000
        scaledLastGmPhaseChange    0
        gmTimeBaseIndicator        0
        lastGmPhaseChange          0x0000'0000000000000000.0000
        gmPresent                  true
        gmIdentity                 aabbcc.fffe.ddeeff
```

- `gmPresent: true` — A Grandmaster is detected and being tracked.
- `gmIdentity` — The clock identity of the active GM.
- `master_offset` — Current offset from the GM.

### Query Port State

```bash
pmc -u -b 0 'GET PORT_DATA_SET'
```

Look for `portState` which should be either `MASTER` (LLS-C1) or `SLAVE` (LLS-C3).

## Step 9: Validation Checklist

Use this checklist to confirm your PTP setup is ready for ORAN fronthaul:

```
[ ] All NTP services disabled (systemd-timesyncd, chrony, ntpd)
[ ] Hardware timestamping confirmed via ethtool -T
[ ] ts2phc offset ≤ 10 ns and in s2 state (LLS-C1 only)
[ ] ptp4l port in correct state (MASTER for LLS-C1, SLAVE for LLS-C3)
[ ] ptp4l RMS offset ≤ 8 ns (LLS-C3; not applicable for GM mode)
[ ] phc2sys offset ≤ 100 ns and in s2 state
[ ] pmc shows gmPresent: true (LLS-C3)
[ ] All values stable for at least 10 minutes
[ ] No state transitions or clock jumps observed
```

## Troubleshooting Poor Synchronization

If PTP does not meet the validation targets after adequate stabilization time, work through these checks systematically.

### Check 1: Cable Quality

Poor cable quality introduces jitter (variable delay) that degrades PTP accuracy.

- **Use DAC (Direct Attach Copper) cables** for short runs (under 5 meters). These provide the most consistent delay.
- **Use quality optical fiber with SFP+ transceivers** for longer runs. Avoid mixing fiber types or using damaged fiber.
- **Avoid USB or Thunderbolt Ethernet adapters** — they do not support hardware timestamping.

### Check 2: Switch Configuration

If there is a switch between the GM (or DU) and the RU:

- **PTP Boundary Clock mode** is preferred — the switch participates in PTP and compensates for its own internal delay.
- **PTP Transparent Clock mode** is acceptable — the switch adds a correction field to PTP messages indicating how long the message spent inside the switch.
- **No PTP support** is problematic — the switch introduces uncompensated, variable queuing delay.

Check your switch documentation for PTP configuration. Common enterprise/data center switches with PTP support include Arista 7000 series, Cisco Nexus, and Juniper QFX.

### Check 3: Verify No NTP Conflict

Double-check that no NTP service is running:

```bash
systemctl list-units --type=service | grep -E 'ntp|chrony|timesyncd'
```

Nothing should be in `active` state. If anything is still running, stop and disable it.

### Check 4: GNSS Antenna Placement (LLS-C1)

The GPS antenna needs a **clear view of the sky**. Obstructions cause:

- Multipath errors (signals bouncing off buildings).
- Reduced satellite count (fewer satellites visible means less accurate time).
- Complete loss of GNSS fix (the antenna cannot track any satellites).

Best practices:

- **Rooftop** mounting is ideal.
- A **window sill** with southern exposure (in the Northern Hemisphere) works for a lab.
- **Indoors away from windows** will not work — GPS signals are too weak to penetrate most building materials.

Verify the GNSS fix quality:

```bash
cat /sys/class/net/enp81s0f0/device/gnss/gnss0/sentences
```

Look for at least 4 satellites in the `$GNGGA` sentence and `A` (valid) status in the `$GNRMC` sentence.

### Check 5: Asymmetric Path Delays

PTP assumes the one-way network delay is symmetric (same in both directions). If the forward and reverse paths have different delays, PTP computes an incorrect offset. Asymmetry can be caused by:

- Different cable lengths in each direction (unlikely with a single link, but possible in complex topologies).
- Switch ASIC processing asymmetry.
- Different optical fiber paths for TX and RX.

If you suspect asymmetry, some `ptp4l` configurations support `delayAsymmetry` correction. Measure the asymmetry using specialized tools or known-offset tests, and add:

```ini
[enp81s0f0]
delayAsymmetry    0
```

Set the value to the measured asymmetry in nanoseconds (positive if the master-to-slave path is longer).

### Check 6: CPU Load and Scheduling

While `ptp4l` and `phc2sys` are not extremely latency-sensitive (they use hardware timestamps, not software timing), extreme CPU load can cause the daemons to miss message processing deadlines. On a properly configured DU server with [CPU isolation](../02-system-preparation/04-cpu-isolation.md) and a [real-time kernel](../02-system-preparation/02-realtime-kernel.md), this should not be an issue. But verify:

- The PTP daemons are running on housekeeping cores, not isolated cores.
- The system is not under extreme memory pressure (swapping).

### Summary of Common Issues

| Issue | Symptom | Solution |
|---|---|---|
| NTP conflict | Periodic offset spikes, clock jumps | Disable all NTP services |
| No GNSS fix | ts2phc stuck at `s0`, large offsets | Fix antenna placement, check cable |
| Non-PTP switch | High and variable ptp4l offset | Use PTP-aware switch or direct connection |
| Domain mismatch | ptp4l stays in `LISTENING` | Ensure GM, DU, and RU use the same domain number |
| Wrong transport | ptp4l stays in `LISTENING` | Ensure GM and DU both use L2 or both use UDP |
| Bad cable | Variable path delay, high offset jitter | Replace cable, use DAC or quality fiber |
| GM not running | ptp4l stays in `LISTENING`, gmPresent: false | Verify GM is powered on and has GNSS lock |
| Asymmetric path | Stable but systematically high offset | Measure and configure `delayAsymmetry` |

## Next Steps

With PTP validated and stable, your timing infrastructure is ready for the ORAN Split 7.2 fronthaul. Proceed to [Section 05 — RAN Deployment](../05-ran-deployment/01-srsran-overview.md) to build and configure the srsRAN gNodeB.
