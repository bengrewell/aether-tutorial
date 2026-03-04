---
id: lls-c3-configuration
title: "LLS-C3: External Grandmaster with DU as PTP Follower"
sidebar_label: LLS-C3 Configuration
sidebar_position: 3
description: >
  Configure LinuxPTP on the DU to act as a PTP follower synchronized to an
  external Grandmaster clock (LLS-C3 model). Covers ptp4l follower mode,
  phc2sys, VLAN considerations, systemd services, and troubleshooting.
keywords:
  - LLS-C3
  - PTP follower
  - external Grandmaster
  - ptp4l
  - phc2sys
  - LinuxPTP
  - Meinberg
  - Trimble
  - ORAN fronthaul timing
  - boundary clock
---

# LLS-C3: External Grandmaster with DU as PTP Follower

In the LLS-C3 deployment model, a dedicated external Grandmaster clock provides the PTP time reference. The DU acts as a PTP **follower**, receiving time from the Grandmaster and using it to discipline its NIC's PTP Hardware Clock (PHC). The RU also acts as a PTP follower on the same network segment, receiving time either from the GM directly or from the DU acting as a boundary clock.

This is the recommended configuration for production environments, multi-DU deployments, and scenarios where an existing timing infrastructure is available.

## When to Use LLS-C3

Choose LLS-C3 over [LLS-C1](./02-lls-c1-configuration.md) when:

- You have **multiple DUs** that need synchronized timing from a single authoritative source.
- You need **holdover capability** — a dedicated GM with an OCXO or rubidium oscillator can maintain accurate time during brief GNSS outages (minutes to hours, depending on oscillator quality).
- Your facility already has a **timing distribution infrastructure** (PTP-aware switches, existing GMs).
- You want to keep the GNSS/GPS dependency separate from the DU server for **operational simplicity** — the DU just consumes time, it does not produce it.
- Your E810 NIC does not have a GNSS module, or you prefer not to use it.

## Network Topology

A typical LLS-C3 deployment looks like this:

<!-- IMAGE PLACEHOLDER: LLS-C3 network topology diagram showing: external Grandmaster (with GPS antenna) connected to a PTP-aware switch. The switch connects to the DU server (running ptp4l in follower mode) and to one or more RUs. Show the PTP message flow: GM -> switch -> DU and GM -> switch -> RU. Label the switch as a "PTP Boundary Clock" or "PTP Transparent Clock" depending on its mode. -->

Key requirements:

- The GM, DU, and RU must all be in the **same PTP domain** (typically domain 24 for ORAN).
- The network path between the GM and the DU should be as short as possible (fewest hops).
- Ideally, every switch in the path operates as a **PTP Boundary Clock** or **Transparent Clock** to maintain nanosecond accuracy.

:::warning
Standard (non-PTP-aware) Ethernet switches introduce variable queuing delays that PTP cannot compensate for. If you must traverse a non-PTP switch, expect degraded accuracy (potentially hundreds of nanoseconds to microseconds of error). For ORAN fronthaul, this may be unacceptable. Either use PTP-aware switches or connect the GM directly to the DU/RU network segment.
:::

## External Grandmaster Setup

Configuration of the external Grandmaster itself is vendor-specific and outside the scope of this tutorial. However, ensure the following settings on your GM:

| Setting | Required Value | Notes |
|---|---|---|
| **PTP Domain** | `24` | Must match the DU and RU configuration |
| **Transport** | Layer 2 (Ethernet) | G.8275.1 profile uses L2 |
| **Clock Class** | `6` | Locked to primary reference (GNSS) |
| **Announce Interval** | `1` (log base 2, i.e., 2 seconds) | Default for G.8275.1 |
| **Sync Interval** | `-4` (log base 2, i.e., 16 per second) | Typical for telecom profile |
| **Delay Mechanism** | End-to-End (E2E) | Standard for G.8275.1 |
| **GNSS Fix** | Active and stable | Verify the GM shows a valid GNSS lock before proceeding |

Consult your GM vendor's documentation for how to configure these parameters.

## ptp4l Follower Configuration

On the DU, `ptp4l` runs in **follower mode**, receiving PTP from the external GM and disciplining the E810's PHC.

Create the configuration file:

```ini title="/etc/linuxptp/ptp4l-follower.conf"
[global]
domainNumber            24
priority1               128
priority2               128
slaveOnly               1
tx_timestamp_timeout    30
network_transport       L2
logging_level           6
use_syslog              1
verbose                 0

[enp81s0f0]
```

### Configuration Parameters Explained

| Parameter | Value | Description |
|---|---|---|
| `domainNumber` | `24` | Must match the GM and RU. |
| `priority1` / `priority2` | `128` | Default BMCA priority. Since `slaveOnly` is set, these do not affect GM election but should still be set. |
| `slaveOnly` | `1` | This clock will only operate as a follower. It will never promote itself to master, regardless of BMCA. |
| `tx_timestamp_timeout` | `30` | Milliseconds to wait for hardware TX timestamps. |
| `network_transport` | `L2` | Layer 2 transport, matching the GM's G.8275.1 profile. |
| `logging_level` | `6` | Informational logging. Set to `7` for debug output during troubleshooting. |

:::note
`slaveOnly` is the legacy parameter name. In newer LinuxPTP versions, `clientOnly` is the preferred alias, but `slaveOnly` remains supported for backward compatibility.
:::

### Test ptp4l Manually

```bash
sudo ptp4l -f /etc/linuxptp/ptp4l-follower.conf -m
```

You should see the port transition from `LISTENING` to `UNCALIBRATED` to `SLAVE`:

```
ptp4l[1234.567]: port 1 (enp81s0f0): INITIALIZING to LISTENING on INIT_COMPLETE
ptp4l[1237.890]: port 1 (enp81s0f0): new foreign master aabbcc.fffe.ddeeff-1
ptp4l[1241.234]: port 1 (enp81s0f0): LISTENING to UNCALIBRATED on RS_SLAVE
ptp4l[1242.345]: port 1 (enp81s0f0): UNCALIBRATED to SLAVE on MASTER_CLOCK_SELECTED
ptp4l[1242.345]: rms    8 max   15 freq  -1234 +/-   5 delay    89 +/-   2
```

The `SLAVE` state and low RMS offset values confirm the follower is tracking the GM successfully.

## phc2sys Configuration

Just as in the LLS-C1 model, `phc2sys` synchronizes the Linux system clock to the NIC's PHC:

```bash
phc2sys -s enp81s0f0 -c CLOCK_REALTIME -O 0 -R 256
```

| Flag | Value | Description |
|---|---|---|
| `-s` | `enp81s0f0` | Source: the PHC (now disciplined by ptp4l to match the external GM) |
| `-c` | `CLOCK_REALTIME` | Destination: the Linux system clock |
| `-O` | `0` | UTC offset. Set to 0 when the GM is distributing UTC time. |
| `-R` | `256` | Update rate in Hz |

:::tip
If the GM distributes TAI time instead of UTC (some GMs do this), you need to set `-O -37` (the current TAI-UTC offset as of 2026, which is 37 seconds). Check your GM's documentation. Most ORAN-focused GMs distribute UTC.
:::

## VLAN Considerations

In many deployments, the fronthaul network uses VLANs to separate different traffic types (e.g., C-Plane, U-Plane, S-Plane/Management). PTP traffic (S-Plane) may need to be on a specific VLAN.

### PTP on the Native VLAN

If PTP runs on the native (untagged) VLAN, no special configuration is needed. Configure `ptp4l` with the physical interface name (`enp81s0f0`), and PTP frames will be sent and received untagged.

### PTP on a Tagged VLAN

If your network requires PTP on a specific VLAN, create the VLAN interface first and then point `ptp4l` at it:

```bash
# Create VLAN interface (example: VLAN 100 for PTP)
sudo ip link add link enp81s0f0 name enp81s0f0.100 type vlan id 100
sudo ip link set enp81s0f0.100 up
```

Then update the `ptp4l` configuration to use the VLAN interface:

```ini title="/etc/linuxptp/ptp4l-follower.conf"
[global]
domainNumber            24
priority1               128
priority2               128
slaveOnly               1
tx_timestamp_timeout    30
network_transport       L2
logging_level           6
use_syslog              1
verbose                 0

[enp81s0f0.100]
```

:::warning
When running PTP over a VLAN interface, hardware timestamping must still be supported. The E810 driver (`ice`) supports hardware timestamping on VLAN sub-interfaces, but not all NIC drivers do. Verify with `ethtool -T enp81s0f0.100`.
:::

### Separate PTP and Fronthaul VLANs

Some RUs expect PTP on a separate VLAN from the ORAN C-Plane and U-Plane traffic. Consult your RU's documentation for the expected VLAN layout. A common configuration:

| Traffic Type | VLAN ID (Example) | Description |
|---|---|---|
| PTP / S-Plane | 100 | Timing synchronization |
| C-Plane | 200 | ORAN control messages |
| U-Plane | 300 | ORAN user-plane IQ data |
| Management | Untagged | Device management, SSH |

## Systemd Service Files

### ptp4l Service

```ini title="/etc/systemd/system/ptp4l.service"
[Unit]
Description=ptp4l - PTP follower daemon
Documentation=man:ptp4l(8)
After=network.target

[Service]
Type=simple
ExecStart=/usr/sbin/ptp4l -f /etc/linuxptp/ptp4l-follower.conf
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### phc2sys Service

```ini title="/etc/systemd/system/phc2sys.service"
[Unit]
Description=phc2sys - PHC to system clock synchronization
Documentation=man:phc2sys(8)
After=ptp4l.service
Requires=ptp4l.service

[Service]
Type=simple
ExecStart=/usr/sbin/phc2sys -s enp81s0f0 -c CLOCK_REALTIME -O 0 -R 256
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

:::note
In LLS-C3, there is no `ts2phc` service because the DU does not have its own GNSS source. The chain is simpler: `ptp4l` (follower) disciplines the PHC from the network, then `phc2sys` syncs the system clock.
:::

### Enable and Start Services

```bash
sudo systemctl daemon-reload
sudo systemctl enable ptp4l phc2sys
sudo systemctl start ptp4l
sudo systemctl start phc2sys
```

Verify both are running:

```bash
sudo systemctl status ptp4l phc2sys
```

## Verifying GM Tracking

### Confirm ptp4l Is in SLAVE State

```bash
journalctl -u ptp4l -f
```

Look for:

```
ptp4l[...]: port 1 (enp81s0f0): UNCALIBRATED to SLAVE on MASTER_CLOCK_SELECTED
ptp4l[...]: rms    5 max   12 freq  -1234 +/-   3 delay    89 +/-   1
```

### Query the Current Data Set

Use `pmc` to inspect the current PTP state:

```bash
pmc -u -b 0 'GET CURRENT_DATA_SET'
```

Example output:

```
   stepsRemoved     1
   offsetFromMaster 3.0
   meanPathDelay    89.0
```

- `stepsRemoved` should be `1` if the DU is directly following the GM (one hop).
- `offsetFromMaster` should be in the single-digit nanoseconds.
- `meanPathDelay` is the one-way network delay in nanoseconds.

### Query the Grandmaster Identity

```bash
pmc -u -b 0 'GET TIME_STATUS_NP'
```

Example output:

```
   master_offset              3
   ingress_time               1741100000000000000
   cumulativeScaledRateOffset +0.000000000
   scaledLastGmPhaseChange    0
   gmTimeBaseIndicator        0
   lastGmPhaseChange          0x0000'0000000000000000.0000
   gmPresent                  true
   gmIdentity                 aabbcc.fffe.ddeeff
```

The key fields:

- `gmPresent: true` — confirms a Grandmaster has been detected.
- `gmIdentity` — should match your external GM's clock identity.
- `master_offset` — current offset from the GM in nanoseconds.

:::danger
If `gmPresent` shows `false`, the DU has lost contact with the Grandmaster. The RU will also lose synchronization, and fronthaul will stop working. Investigate immediately: check cables, switch configuration, and GM status.
:::

## Troubleshooting

### No Grandmaster Found

**Symptoms:** `ptp4l` stays in `LISTENING` state. `pmc` shows `gmPresent: false`.

**Causes and solutions:**

| Check | Command | What to Look For |
|---|---|---|
| GM is powered on and has GNSS lock | Check GM front panel or web UI | Active GNSS fix, PTP master state |
| GM and DU are on the same VLAN | `tcpdump -i enp81s0f0 -n ether proto 0x88f7` | You should see PTP Announce and Sync frames from the GM's MAC address |
| Domain numbers match | Compare GM config and `ptp4l-follower.conf` | Both must be `domainNumber 24` (or whichever value you chose) |
| Transport matches | Compare GM config and `ptp4l-follower.conf` | Both must use the same transport (L2 or UDP) |
| Switch is not blocking PTP | Check switch configuration | Ensure multicast MAC `01:1B:19:00:00:00` is not filtered |

### High Offset Values

**Symptoms:** `ptp4l` is in `SLAVE` state but RMS offset is consistently above 100 ns.

**Possible causes:**

- **Non-PTP-aware switch in the path.** Uncompensated queuing delays cause variable offset. Use a PTP boundary clock or transparent clock switch.
- **Asymmetric path delay.** If the forward and reverse paths have different delays (e.g., different cable lengths through a switch), PTP will show a systematic offset. Some switches support asymmetry correction.
- **Competing PTP masters.** If multiple GMs are on the network with similar priority values, `ptp4l` may oscillate between them. Set clear priority values to ensure one GM wins the BMCA election.
- **Poor cable quality.** Damaged or very long cables introduce jitter. Use quality DAC cables or optical fiber.

### Frequent Clock Jumps

**Symptoms:** `ptp4l` alternates between `SLAVE` and `UNCALIBRATED` states, or the offset periodically spikes by microseconds or more.

**Possible causes:**

- **NTP conflict.** If `chrony`, `systemd-timesyncd`, or `ntpd` is running, it will fight with `phc2sys` over the system clock, causing instability. See [PTP Validation](./04-ptp-validation.md) for how to disable conflicting time services.
- **GM instability.** The external GM itself may be experiencing GNSS dropouts. Check the GM's status and holdover indicators.
- **Network congestion.** Heavy traffic on the PTP path can cause PTP packet delay variation. Consider using QoS / traffic prioritization for PTP frames (DSCP or VLAN priority).

## Next Steps

Regardless of whether you used LLS-C1 or LLS-C3, you must validate that PTP synchronization meets ORAN requirements. Proceed to **[PTP Validation](./04-ptp-validation.md)**.
