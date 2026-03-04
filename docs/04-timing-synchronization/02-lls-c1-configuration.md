---
id: lls-c1-configuration
title: "LLS-C1: DU as PTP Grandmaster with E810 GNSS"
sidebar_label: LLS-C1 Configuration
sidebar_position: 2
description: >
  Configure the Intel E810 NIC's built-in GNSS receiver and LinuxPTP to run
  the DU as a PTP Grandmaster (LLS-C1 model). Includes ts2phc, ptp4l, and
  phc2sys configuration, systemd service files, and verification steps.
keywords:
  - LLS-C1
  - PTP Grandmaster
  - Intel E810
  - GNSS
  - GPS
  - ts2phc
  - ptp4l
  - phc2sys
  - LinuxPTP
  - ORAN fronthaul timing
---

# LLS-C1: DU as PTP Grandmaster with E810 GNSS

In the LLS-C1 deployment model, the DU server acts as the PTP Grandmaster. The Intel E810-XXVDA4T NIC's built-in GNSS receiver provides the time reference. GPS satellites discipline the NIC's PTP Hardware Clock (PHC), and `ptp4l` distributes that time over the fronthaul network to the RU.

This is the recommended configuration for lab and small-scale deployments.

## Hardware Setup

### GPS Antenna Connection

The E810-XXVDA4T has a **u.FL GNSS connector** on the PCB, typically located near the bracket end of the card. You need:

1. **A GPS antenna** — An active GPS patch antenna or puck antenna with clear sky view. Any standard GPS antenna with an SMA connector will work.
2. **A u.FL to SMA adapter cable** — The E810's GNSS port uses a small u.FL connector. You need a pigtail cable to convert to the SMA connector on most GPS antennas.

:::warning
The u.FL connector on the E810 is fragile. When attaching the adapter cable, press straight down with gentle, even pressure. Do not twist or apply lateral force. These connectors have a limited number of mating cycles.
:::

Route the antenna cable out the back of the server chassis (many chassis have knockout holes or PCI bracket gaps for this purpose) and place the GPS antenna where it has a **clear view of the sky**. Window sills work for a lab; rooftop mounting is ideal for production.

<!-- IMAGE PLACEHOLDER: Photo or diagram showing the E810-XXVDA4T PCB with the u.FL GNSS connector location highlighted, a u.FL-to-SMA pigtail cable attached, and the SMA end connected to a GPS puck antenna. -->

### Verify GNSS Lock

Once the antenna is connected and the E810 driver (`ice`) is loaded, the GNSS module exposes NMEA sentence data through the Linux GNSS subsystem.

Check for NMEA output:

```bash
cat /sys/class/net/enp81s0f0/device/gnss/gnss0/sentences
```

You should see NMEA sentences streaming, such as:

```
$GNRMC,142356.00,A,4740.12345,N,12201.67890,W,0.01,0.00,040326,,,A*6F
$GNGGA,142356.00,4740.12345,N,12201.67890,W,1,12,0.8,100.0,M,-20.0,M,,*5A
```

Key indicators:

| Field | Good Value | Bad Value | Meaning |
|---|---|---|---|
| Second field of `$GNRMC` | `A` | `V` | `A` = valid fix, `V` = no fix |
| Number of satellites (field 7 of `$GNGGA`) | `4` or more | `0` or `1` | Need at least 4 for a position/time fix |
| Fix quality (field 6 of `$GNGGA`) | `1` or `2` | `0` | `0` = no fix |

:::tip
If you see `V` (void) in the GNRMC sentence or zero satellites, the antenna does not have a GNSS fix yet. Ensure the antenna has unobstructed sky view. A first fix can take 2-15 minutes (cold start). If the antenna is indoors without a window, it may never acquire a fix.
:::

If the GNSS device does not appear at all, verify the `ice` driver is loaded and the firmware supports GNSS:

```bash
dmesg | grep -i gnss
```

You should see messages indicating the GNSS module was detected:

```
ice 0000:51:00.0: GNSS TTY device registered
```

### Verify the 1PPS Signal

The GNSS module generates a 1PPS (one pulse per second) signal that is routed internally to the E810's PHC. Verify the PPS device exists:

```bash
ls /sys/class/ptp/ptp0/
```

You should see entries including `pps_available`. Check that PPS is available:

```bash
cat /sys/class/ptp/ptp0/pps_available
```

This should return `1`.

:::note
The PTP device number (`ptp0`, `ptp1`, etc.) corresponds to your NIC. If you have multiple NICs with PHCs, use `ethtool -T enp81s0f0` to find which PTP clock number is associated with your E810 interface.
:::

## ts2phc Configuration

`ts2phc` is the first daemon in the chain. It reads the 1PPS signal from the GNSS module and the NMEA time data from `/dev/gnss0`, and uses them to discipline the E810's PTP Hardware Clock.

Create the configuration file:

```ini title="/etc/linuxptp/ts2phc.conf"
[global]
use_syslog              1
verbose                 0
logging_level           6
ts2phc.pulsewidth       500000000
ts2phc.nmea_serialport  /dev/gnss0
leapfile                /usr/share/zoneinfo/leap-seconds.list

[enp81s0f0]
ts2phc.master           1
ts2phc.pin_index        0
ts2phc.channel          0
ts2phc.extts_polarity   rising
```

### Configuration Parameters Explained

| Parameter | Value | Description |
|---|---|---|
| `ts2phc.pulsewidth` | `500000000` | Width of the 1PPS pulse in nanoseconds (500 ms = half the 1-second period) |
| `ts2phc.nmea_serialport` | `/dev/gnss0` | Serial device for NMEA sentence data from the GNSS module |
| `leapfile` | `/usr/share/zoneinfo/leap-seconds.list` | Leap second table so ts2phc can correctly convert GPS time to UTC |
| `ts2phc.master` | `1` | This interface's GNSS is the time source (master) |
| `ts2phc.pin_index` | `0` | Hardware pin index for the 1PPS input on the E810 |
| `ts2phc.channel` | `0` | External timestamp channel to use |
| `ts2phc.extts_polarity` | `rising` | Trigger on the rising edge of the 1PPS signal |

:::warning
The `leapfile` path must point to a valid, up-to-date leap seconds file. The one shipped with `tzdata` in Ubuntu 24.04 is generally current. If this file is missing or expired, `ts2phc` will log warnings about leap second handling, and the time offset between GPS time and UTC (currently 18 seconds) may not be applied correctly.
:::

### Test ts2phc Manually

Before creating the systemd service, test that `ts2phc` works:

```bash
sudo ts2phc -f /etc/linuxptp/ts2phc.conf -s nmea -m
```

The `-m` flag prints output to the terminal. You should see lines like:

```
ts2phc[1234.567]: enp81s0f0 master offset         -3 s2 freq      +12
ts2phc[1235.567]: enp81s0f0 master offset          1 s2 freq      +14
ts2phc[1236.567]: enp81s0f0 master offset         -2 s2 freq      +13
```

The `s2` state means the clock is **locked** (servo state 2). The offset values should be single-digit nanoseconds. If you see `s0` (unlocked) or large offsets, wait a few minutes for convergence.

## ptp4l Grandmaster Configuration

Once `ts2phc` has disciplined the PHC to GPS time, `ptp4l` runs in Grandmaster mode to distribute that time over the network.

Create the configuration file:

```ini title="/etc/linuxptp/ptp4l-gm.conf"
[global]
domainNumber            24
priority1               128
priority2               128
clockClass              6
clockAccuracy           0x21
offsetScaledLogVariance 0x4E5D
timeSource              0x20
tx_timestamp_timeout    30
masterOnly              1
network_transport       L2
logging_level           6
use_syslog              1
verbose                 0

[enp81s0f0]
```

### Configuration Parameters Explained

| Parameter | Value | Description |
|---|---|---|
| `domainNumber` | `24` | PTP domain number. The RU must be configured with the same domain. Domain 24 is commonly used for ORAN. |
| `priority1` / `priority2` | `128` | BMCA priority values. Lower values win the Grandmaster election. 128 is the default. |
| `clockClass` | `6` | Indicates a clock locked to a primary reference (GNSS). Class 6 = "locked to primary reference time source." |
| `clockAccuracy` | `0x21` | Accuracy within 100 ns. This advertises the clock's accuracy to followers. |
| `offsetScaledLogVariance` | `0x4E5D` | Stability metric. `0x4E5D` is appropriate for a GNSS-locked clock. |
| `timeSource` | `0x20` | Indicates GPS as the time source (hex code for GPS per IEEE 1588). |
| `tx_timestamp_timeout` | `30` | Milliseconds to wait for a hardware TX timestamp before giving up. |
| `masterOnly` | `1` | This clock will only operate as a master, never transition to follower. |
| `network_transport` | `L2` | Use Layer 2 (Ethernet) transport for PTP messages, matching G.8275.1. |

:::note
The `domainNumber` must match between the DU and the RU. Many ORAN RUs default to domain 24, but check your RU's documentation. If the domain numbers do not match, the RU will never lock to the DU's PTP.
:::

### Test ptp4l Manually

```bash
sudo ptp4l -f /etc/linuxptp/ptp4l-gm.conf -m
```

You should see the port transition to `MASTER` state:

```
ptp4l[1234.567]: port 1 (enp81s0f0): INITIALIZING to LISTENING on INIT_COMPLETE
ptp4l[1234.567]: port 0 (/var/run/ptp4l): INITIALIZING to LISTENING on INIT_COMPLETE
ptp4l[1240.567]: port 1 (enp81s0f0): LISTENING to MASTER on ANNOUNCE_RECEIPT_TIMEOUT_EXPIRES
ptp4l[1240.567]: selected local clock 001122.fffe.334455 as best master
```

## phc2sys Configuration

`phc2sys` synchronizes the Linux system clock to the PHC. This ensures that system-level timestamps (used by logging, the 5G core, and other services) are also GPS-accurate.

The command to run:

```bash
phc2sys -s enp81s0f0 -c CLOCK_REALTIME -O 0 -R 256
```

| Flag | Value | Description |
|---|---|---|
| `-s` | `enp81s0f0` | Source clock: the NIC's PHC (which ts2phc has disciplined to GPS) |
| `-c` | `CLOCK_REALTIME` | Destination clock: the Linux system clock |
| `-O` | `0` | UTC offset. Set to 0 because ts2phc already applies the GPS-to-UTC leap second correction. |
| `-R` | `256` | Update rate in Hz. 256 updates per second provides tight tracking. |

## Systemd Service Files

For production operation, all three daemons should be managed by systemd with correct startup ordering.

### ts2phc Service

```ini title="/etc/systemd/system/ts2phc.service"
[Unit]
Description=ts2phc - GNSS to PHC synchronization
Documentation=man:ts2phc(8)
After=network.target

[Service]
Type=simple
ExecStart=/usr/sbin/ts2phc -f /etc/linuxptp/ts2phc.conf -s nmea
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### ptp4l Service

```ini title="/etc/systemd/system/ptp4l.service"
[Unit]
Description=ptp4l - PTP Grandmaster daemon
Documentation=man:ptp4l(8)
After=ts2phc.service
Requires=ts2phc.service

[Service]
Type=simple
ExecStart=/usr/sbin/ptp4l -f /etc/linuxptp/ptp4l-gm.conf
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

### Enable and Start Services

The startup order is critical: `ts2phc` must discipline the PHC to GNSS first, then `ptp4l` distributes that time, then `phc2sys` synchronizes the system clock.

The systemd `After=` and `Requires=` directives enforce this ordering automatically:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ts2phc ptp4l phc2sys
sudo systemctl start ts2phc
sudo systemctl start ptp4l
sudo systemctl start phc2sys
```

Verify all three are running:

```bash
sudo systemctl status ts2phc ptp4l phc2sys
```

:::tip
After starting the services, allow **10-15 minutes** for the full chain to stabilize. The GNSS module needs time to achieve a solid fix, `ts2phc` needs to converge the PHC, and `ptp4l` needs several announce intervals before the RU will lock. Do not be alarmed by large initial offsets.
:::

## Verification

### Check ts2phc Status

```bash
journalctl -u ts2phc -f
```

Look for `s2` (locked) state and single-digit nanosecond offsets:

```
ts2phc[...]: enp81s0f0 master offset          2 s2 freq      +8
```

### Check ptp4l Status

```bash
journalctl -u ptp4l -f
```

Confirm the port is in `MASTER` state. You should not see offset values in GM mode (there is no upstream master to track):

```
ptp4l[...]: port 1 (enp81s0f0): LISTENING to MASTER on ANNOUNCE_RECEIPT_TIMEOUT_EXPIRES
ptp4l[...]: selected local clock 001122.fffe.334455 as best master
```

### Check phc2sys Status

```bash
journalctl -u phc2sys -f
```

Look for sub-100 ns offsets:

```
phc2sys[...]: CLOCK_REALTIME phc offset        -12 s2 freq   -1234 delay    456
```

### Query PTP State with pmc

```bash
pmc -u -b 0 'GET CURRENT_DATA_SET'
```

This returns the current offset and mean path delay as seen by `ptp4l`.

For the full validation procedure and acceptable thresholds, proceed to **[PTP Validation](./04-ptp-validation.md)**.

## Troubleshooting

| Symptom | Likely Cause | Solution |
|---|---|---|
| No `/dev/gnss0` device | `ice` driver not loaded or firmware too old | Run `dmesg \| grep gnss` and check driver version. Update `ice` driver if needed. |
| NMEA shows `V` (void) | No GNSS fix — antenna has no sky view | Relocate antenna. Check u.FL cable connection. Wait 15 minutes for cold start. |
| ts2phc stuck at `s0` | 1PPS signal not reaching PHC | Verify `ts2phc.pin_index` and `ts2phc.channel` match your NIC. Check `dmesg` for PPS errors. |
| ptp4l stays in `LISTENING` | Normal — it waits for the announce timeout before promoting to MASTER | Wait 3-5 announce intervals (default ~10 seconds each). |
| phc2sys shows large offsets | PHC not yet disciplined by ts2phc | Ensure ts2phc is running and locked (`s2`) before starting phc2sys. |

## Next Steps

- If you have an external Grandmaster instead, see [LLS-C3 Configuration](./03-lls-c3-configuration.md).
- Once your PTP chain is running, validate it meets ORAN requirements: [PTP Validation](./04-ptp-validation.md).
