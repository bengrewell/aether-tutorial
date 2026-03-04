---
id: ptp-overview
title: "PTP Overview: Why Nanosecond Timing Matters"
sidebar_label: PTP Overview
sidebar_position: 1
description: >
  Introduction to Precision Time Protocol (IEEE 1588), why ORAN Split 7.2
  fronthaul demands nanosecond-level synchronization between DU and RU, ITU-T
  timing profiles, deployment models, and the LinuxPTP toolchain.
keywords:
  - PTP
  - IEEE 1588
  - ORAN Split 7.2
  - timing synchronization
  - LinuxPTP
  - G.8275.1
  - G.8275.2
  - ptp4l
  - phc2sys
  - ts2phc
  - Intel E810
  - GNSS
---

# PTP Overview: Why Nanosecond Timing Matters

## The Timing Problem

ORAN Split 7.2 places a hard real-time constraint on the fronthaul link between the Distributed Unit (DU) and the Radio Unit (RU). The DU sends IQ samples to the RU (and receives them back) on a precise schedule dictated by the 5G NR slot structure. If the DU and RU clocks disagree by more than a few tens of nanoseconds, the RU will either transmit at the wrong time (violating 3GPP emission masks) or discard received samples as late, causing dropped frames and failed UE connections.

In concrete terms:

- A single 5G NR slot at 30 kHz subcarrier spacing is **500 microseconds**.
- The timing advance window within which the RU must begin transmission is on the order of **tens of microseconds**.
- To stay within that window reliably, the DU and RU clocks must agree to within **tens of nanoseconds** (typically ±30 ns or better).

This is not achievable with NTP, which provides millisecond-level accuracy at best. It requires **Precision Time Protocol (PTP), IEEE 1588-2019**, operating over hardware-timestamped Ethernet.

:::danger
Without properly configured PTP synchronization, the srsRAN DU will fail to maintain fronthaul connectivity with the RU. This is the single most common cause of "everything is configured but nothing works" in ORAN Split 7.2 deployments.
:::

## What PTP Is

The Precision Time Protocol (IEEE 1588) is a network protocol that synchronizes clocks across a packet network to sub-microsecond accuracy. It works by exchanging timestamped messages between a **Grandmaster** clock (the authoritative time source) and one or more **follower** clocks (also called "slave" clocks in older terminology).

The key concepts are:

| Concept | Description |
|---|---|
| **Grandmaster (GM)** | The clock at the top of the hierarchy, typically disciplined by GNSS (GPS/Galileo/GLONASS) |
| **Boundary Clock (BC)** | An intermediate clock that acts as a follower to the GM and as a master to downstream devices |
| **Follower (Slave)** | A clock that synchronizes itself to a master higher in the hierarchy |
| **PHC** | PTP Hardware Clock — a dedicated clock on the NIC that timestamps packets in hardware, avoiding kernel jitter |
| **Hardware Timestamping** | The NIC stamps each PTP packet at the exact moment it crosses the wire, providing nanosecond accuracy |
| **Domain** | A logical grouping of PTP clocks; clocks in different domains ignore each other |
| **Profile** | A set of parameter defaults and constraints defined by standards bodies for specific use cases |

PTP achieves its accuracy through a four-step message exchange (Sync, Follow_Up, Delay_Req, Delay_Resp) that allows the follower to compute both the **clock offset** (how far ahead or behind it is) and the **path delay** (the one-way network latency) with respect to the master. The follower then adjusts its local clock to converge on the master's time.

<!-- IMAGE PLACEHOLDER: Diagram showing the PTP four-step message exchange between a Grandmaster and a Follower, with Sync, Follow_Up, Delay_Req, and Delay_Resp messages and their timestamps (t1, t2, t3, t4). Show how offset and path delay are calculated from these four timestamps. -->

## ITU-T Timing Profiles

The raw IEEE 1588 standard is flexible and general-purpose. For telecommunications, the ITU-T has defined specific **profiles** that constrain PTP parameters for telecom deployments:

### G.8275.1 — Full Timing Support (Telecom Profile)

- Every network hop between the GM and the end device is **PTP-aware** (boundary clock or transparent clock).
- Uses **Layer 2 (Ethernet) transport** — PTP messages use EtherType 0x88F7, not IP/UDP.
- Provides the highest accuracy (sub-nanosecond achievable with good hardware).
- This is the profile typically used in ORAN fronthaul networks.

### G.8275.2 — Partial Timing Support

- Allows PTP to traverse network segments that are **not** PTP-aware (standard Ethernet switches).
- Uses **Layer 3 (IP/UDP) transport** — PTP messages are encapsulated in UDP.
- Accuracy is lower (tens to hundreds of nanoseconds) due to uncompensated queuing delay in non-PTP switches.
- Useful when you cannot guarantee PTP-aware switching end-to-end.

:::tip
For a lab environment with a direct connection (or a single PTP-aware switch) between the DU and RU, **G.8275.1 with L2 transport** is the simplest and most accurate option. This is what we configure throughout this tutorial section.
:::

## Deployment Models

There are two primary ways to provide PTP timing to your DU and RU. The ORAN Alliance refers to these as **LLS-C1** and **LLS-C3** configurations.

### LLS-C1: DU as PTP Grandmaster

In this model, the DU server itself acts as the PTP Grandmaster. A GNSS receiver provides an absolute time reference, and the DU distributes that time to the RU over the fronthaul Ethernet link.

<!-- IMAGE PLACEHOLDER: LLS-C1 architecture diagram showing: GPS satellites at top, GPS antenna connected to E810 NIC's GNSS port, E810 NIC with PHC inside the DU server, PTP flowing over fronthaul Ethernet to the RU. Label the ts2phc, ptp4l, and phc2sys daemons on the DU side. -->

**How it works with the Intel E810:**

The Intel E810-XXVDA4T NIC has a **built-in GNSS receiver module**. A GPS antenna connects directly to a u.FL connector on the NIC. The GNSS module outputs:

- **NMEA sentences** — textual time/position data exposed at `/dev/gnss0`
- **1PPS (one pulse per second)** — a hardware signal used to discipline the NIC's PTP Hardware Clock

The `ts2phc` daemon reads the GNSS 1PPS signal and NMEA data, and continuously disciplines the E810's PHC to GPS time. Then `ptp4l` runs in Grandmaster mode and distributes that time over the network to the RU (and any other PTP followers). Finally, `phc2sys` synchronizes the Linux system clock to the PHC.

**When to use LLS-C1:**

- Small lab deployments with a single DU.
- You have a GPS antenna with clear sky view.
- You do not have (or do not want to buy) a dedicated Grandmaster appliance.
- You are using an Intel E810 NIC (which includes the GNSS receiver at no additional cost).

:::note
The E810's GNSS receiver is a functional but basic module. It works well for lab and small-scale deployments. For production environments requiring holdover stability or multi-constellation tracking with high-end oscillators, a dedicated Grandmaster is recommended.
:::

### LLS-C3: External Grandmaster Clock

In this model, a dedicated PTP Grandmaster appliance (such as a Meinberg, Trimble, or Oscilloquartz unit) provides the timing reference. The DU acts as a PTP **follower** (or boundary clock), receiving time from the external GM and passing it through to the RU.

<!-- IMAGE PLACEHOLDER: LLS-C3 architecture diagram showing: GPS satellites at top, GPS antenna connected to an external Grandmaster appliance (e.g., Meinberg), Grandmaster connected via Ethernet to a PTP-aware switch, switch connected to the DU server and one or more RUs. Label ptp4l (follower mode) and phc2sys on the DU side. -->

**When to use LLS-C3:**

- Production deployments with multiple DUs.
- Existing timing infrastructure in the facility.
- You need high holdover stability (the GM continues providing accurate time during brief GNSS outages using an internal oscillator).
- The DU NIC does not have a built-in GNSS receiver.

**Common external Grandmaster options:**

| Vendor | Model | Notes |
|---|---|---|
| Meinberg | microSync HR | Popular in telecom, excellent holdover |
| Trimble | TimeProvider 4100 | Carrier-grade, modular |
| Oscilloquartz | OSA 5401 | Widely deployed in mobile networks |
| Qulsar | Qg 2 | Compact, cost-effective for labs |

## The LinuxPTP Toolchain

All PTP configuration in this tutorial uses the open-source **LinuxPTP** suite, which is the standard PTP implementation for Linux. It consists of several cooperating daemons:

### ptp4l — PTP Protocol Daemon

`ptp4l` implements the full IEEE 1588 protocol. It handles:

- Sending and receiving PTP messages (Sync, Follow_Up, Delay_Req, Delay_Resp, Announce).
- Best Master Clock Algorithm (BMCA) to elect the Grandmaster in a multi-clock domain.
- Disciplining the NIC's PHC to match the upstream master (in follower mode).
- Serving as the time source for downstream followers (in Grandmaster mode).

`ptp4l` operates on the **NIC's PHC**, not the system clock. It brings the PHC into sync with the network time.

### phc2sys — PHC-to-System Clock Synchronization

`phc2sys` synchronizes the Linux system clock (`CLOCK_REALTIME`) to the NIC's PHC (or vice versa). This is necessary because:

- `ptp4l` only disciplines the PHC.
- User-space applications (logging, databases, monitoring) read the system clock.
- Some network functions in the 5G core rely on the system clock for timestamps.

### ts2phc — External Time Source to PHC

`ts2phc` reads an external 1PPS signal (from GNSS, a GM appliance, or another source) and uses it to discipline the PHC. This is used in the **LLS-C1 model** where the E810's GNSS module provides the 1PPS reference.

`ts2phc` also reads NMEA data from the GNSS serial port to obtain the absolute time-of-day (the 1PPS signal only provides the "top of the second" edge; NMEA provides which second it is).

### pmc — PTP Management Client

`pmc` is a command-line tool for querying and configuring a running `ptp4l` instance. It sends PTP management messages and displays the responses. Common uses include:

- Checking the current clock offset and Grandmaster identity.
- Querying the port state (MASTER, SLAVE, LISTENING, etc.).
- Verifying the clock class, accuracy, and time source of the active GM.

## Installation

LinuxPTP is available in the Ubuntu 24.04 repositories:

```bash
sudo apt update
sudo apt install linuxptp
```

This installs `ptp4l`, `phc2sys`, `ts2phc`, `pmc`, and `hwstamp_ctl`.

Verify the installation:

```bash
ptp4l -v
```

:::note
The version in the Ubuntu 24.04 repository (typically 4.x) is sufficient for our purposes. If you need newer features, you can build from the [LinuxPTP source](https://github.com/richardcochran/linuxptp), but the packaged version works well with the E810.
:::

## Verifying Hardware Timestamping Support

Before proceeding with PTP configuration, confirm that your E810 NIC supports hardware timestamping:

```bash
ethtool -T enp81s0f0
```

You should see output including:

```
Capabilities:
        hardware-transmit
        software-transmit
        hardware-receive
        software-receive
        hardware-raw-clock
PTP Hardware Clock: 0
```

The critical lines are `hardware-transmit` and `hardware-receive`. If these are missing, PTP will fall back to software timestamping, which cannot achieve the nanosecond accuracy required for ORAN fronthaul.

:::warning
Replace `enp81s0f0` with your actual E810 interface name throughout this tutorial section. The interface name depends on the PCIe slot and port number. Use `ip link show` to find your E810 interfaces.
:::

## Next Steps

Choose the deployment model that matches your setup:

- **[LLS-C1 Configuration](./02-lls-c1-configuration.md)** — If you are using the E810's built-in GNSS receiver and want the DU to act as the PTP Grandmaster. This is the recommended path for lab builds.
- **[LLS-C3 Configuration](./03-lls-c3-configuration.md)** — If you have an external Grandmaster clock and want the DU to act as a PTP follower.

After configuring either model, proceed to **[PTP Validation](./04-ptp-validation.md)** to verify that synchronization meets ORAN requirements.
