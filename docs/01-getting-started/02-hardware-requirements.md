---
id: hardware-requirements
title: Hardware Requirements
sidebar_label: Hardware Requirements
sidebar_position: 2
description: >
  Complete hardware requirements for the Aether SD-Core + srsRAN private 5G lab,
  including server specifications, NIC, Radio Unit, SIM cards, UE, timing, and
  switching equipment with a bill of materials.
keywords:
  - 5G hardware requirements
  - Intel Xeon 5G
  - Intel E810 NIC
  - ORAN Radio Unit
  - Sysmocom SIM
  - 5G lab hardware
  - private 5G BOM
---

# Hardware Requirements

This page details every piece of hardware you need to build the private 5G lab. We provide both minimum and recommended specifications, followed by a complete bill of materials with approximate costs.

:::tip
You can start working through the early sections of this tutorial (system preparation, DPDK configuration, and even srsRAN in **testmode**) without a Radio Unit or UE. Testmode replaces the fronthaul with software-generated IQ samples, letting you validate the full stack before investing in RF hardware. See [RAN Deployment](../05-ran-deployment/01-srsran-overview.md) for details.
:::

## Server

The server runs both the srsRAN DU (real-time, DPDK-accelerated) and the Aether SD-Core network functions. A single physical server is sufficient for a lab deployment.

### Minimum Specifications

| Component | Minimum | Notes |
|---|---|---|
| **CPU** | Intel Xeon Cascade Lake (2nd Gen Scalable) or newer | Must support SSE4.2 and AVX-512. Examples: Xeon Gold 5218, Xeon Silver 4214 |
| **Cores** | 8 physical cores (16 threads) | At least 4 isolated cores for srsRAN real-time threads |
| **RAM** | 32 GB DDR4 ECC | Hugepages will consume a significant portion |
| **Storage** | 256 GB NVMe SSD | For OS, logs, and container images |
| **NIC** | Intel E810-XXVDA2 (2x25G) | Must be E810-based for PTP hardware timestamping and DPDK support |
| **BIOS** | UEFI with VT-d (Intel IOMMU) support | Required for DPDK VFIO passthrough |

### Recommended Specifications

| Component | Recommended | Notes |
|---|---|---|
| **CPU** | Intel Xeon Gold 6230 (Cascade Lake) or Xeon Gold 5315Y (Ice Lake) | Higher core count allows more headroom for core isolation |
| **Cores** | 16+ physical cores (32+ threads) | 6-8 isolated for srsRAN, remainder for OS + SD-Core |
| **RAM** | 64 GB DDR4 ECC (or DDR5 on Sapphire Rapids) | Allows generous hugepage allocation plus Kubernetes workloads |
| **Storage** | 512 GB+ NVMe SSD | Room for packet captures, logs, and multiple container images |
| **NIC** | Intel E810-XXVDA4T (4x25G with built-in GNSS) | The "T" variant includes a GNSS receiver for timing without external PTP grandmaster |
| **BIOS** | UEFI with VT-d, Hyper-Threading enabled | HT disabled can simplify isolation but reduces total thread count |

:::warning
**The NIC must be Intel E810-series.** This is non-negotiable for this tutorial. The E810 provides:
- Hardware PTP timestamping (IEEE 1588) required for ORAN Split 7.2 fronthaul timing
- DPDK PMD (Poll Mode Driver) support for high-performance packet I/O
- Optional built-in GNSS receiver (E810-XXVDA4**T** variant) for standalone timing
- SyncE support for frequency synchronization

Other NICs (Mellanox/NVIDIA ConnectX, Broadcom) have different DPDK drivers, different PTP implementations, and different kernel module requirements. They are not covered in this tutorial.
:::

### CPU Considerations

The srsRAN DU has strict real-time requirements. The threads that process fronthaul data and run the L1/L2 stack must execute without interruption. This means:

- **NUMA awareness matters.** The NIC and the CPU cores used by srsRAN should be on the same NUMA node. Cross-NUMA memory access adds latency that can cause fronthaul timing violations.
- **AVX-512 is heavily used.** srsRAN uses AVX-512 for PHY-layer signal processing (FFT, LDPC encoding/decoding). CPUs without AVX-512 will not work.
- **Turbo Boost should be disabled** (or at least carefully managed) to avoid frequency scaling during real-time operation. We cover this in [System Preparation](../02-system-preparation/01-os-installation.md).

You can check your CPU's capabilities before purchasing or setting up:

```bash
$ lscpu | grep -E "Model name|CPU\(s\)|NUMA|Flags"
$ lscpu | grep avx512
```

## Network Interface Card (NIC)

### Intel E810 Variants

| Model | Ports | GNSS | Typical Use |
|---|---|---|---|
| E810-XXVDA2 | 2x 25GbE SFP28 | No | Budget option, sufficient if using external PTP GM |
| E810-XXVDA4 | 4x 25GbE SFP28 | No | More ports for separating fronthaul, backhaul, and management |
| E810-XXVDA4**T** | 4x 25GbE SFP28 | **Yes** | Recommended — built-in GNSS eliminates need for external PTP grandmaster |

:::note
The "T" suffix on the E810-XXVDA4T indicates the **timing** variant with an integrated GNSS receiver. If you use this variant with a GPS antenna, the NIC itself can act as a PTP grandmaster, significantly simplifying the timing architecture. See [Timing & Synchronization](../04-timing-synchronization/01-ptp-overview.md) for details.
:::

### SFP28 Transceivers and Cables

You need SFP28 modules or DAC (Direct Attach Copper) cables to connect the E810 to your Radio Unit or switch:

- **DAC cables** (1-5m): Cheapest option for direct connections. Intel-compatible 25G DAC cables work well.
- **SFP28 transceivers + fiber**: Required for longer runs or when connecting through a switch. Use multimode (SR) for runs under 100m.

## Radio Unit (RU)

The Radio Unit is the component that transmits and receives RF signals over the air interface. For ORAN Split 7.2, the RU connects to the srsRAN DU via eCPRI over Ethernet (the fronthaul).

### RU Selection

RU selection depends on your **frequency band**, **transmit power requirements**, and **budget**. Common ORAN Split 7.2 compatible RUs that have been tested with srsRAN include:

| Vendor | Model(s) | Band(s) | Power | Notes |
|---|---|---|---|---|
| **Benetel** | RAN650 | n78 (3.5 GHz) | 2x2 MIMO, 1W per port | Widely used in O-RAN labs, good srsRAN compatibility |
| **Foxconn** | RPQN-7800e | n78 (3.5 GHz) | 4x4 MIMO, higher power | Carrier-grade, requires more configuration |
| **Liteon** | Various | n78 (3.5 GHz) | 4x4 MIMO | Available through O-RAN alliance partners |

:::warning
RU compatibility with srsRAN is not universal. Before purchasing an RU, check the [srsRAN documentation](https://docs.srsran.com/) and community forums for confirmed working combinations. The srsRAN team maintains a list of tested RUs.
:::

### Band Considerations

This tutorial uses **n78 (3.5 GHz TDD)** as the reference band because:
- It is the most common mid-band 5G NR frequency worldwide.
- Most ORAN Split 7.2 RUs target n78.
- CBRS (n48, 3.5 GHz in the US) is closely related and many RUs support both.

If you plan to use a different band, the core network and most of the DU configuration remain the same. Only the RU-specific parameters and RF configuration change.

## SIM Cards

Commercial 5G UEs require a SIM card (USIM) with properly programmed authentication credentials (IMSI, Ki, OPc) that match the subscriber database in the core network.

### Recommended: Sysmocom SJA2

| Item | Details |
|---|---|
| **SIM Card** | Sysmocom sysmoISIM-SJA2 (5G-capable, programmable) |
| **Form Factor** | 2FF/3FF/4FF combo (punch out to needed size) |
| **Quantity** | At least 2 (one for testing, one spare) |
| **Programming Tool** | pySim (open-source, included in software prerequisites) |

### SIM Card Reader

You need a PC/SC compatible smart card reader to program the SIMs:

| Item | Details |
|---|---|
| **Reader** | HID Omnikey 3121 (USB) |
| **Alternative** | Any PC/SC compatible reader that supports T=0 protocol |

:::tip
Order SIM cards early. Sysmocom ships from Germany, and delivery to North America can take 2-3 weeks. Order at least 5 cards — they are inexpensive and you will inevitably lock one during development.
:::

## User Equipment (UE)

Any **5G NR-capable** device that supports your target band will work. Common options:

| Type | Examples | Notes |
|---|---|---|
| **5G Phone** | Samsung Galaxy S21+, Google Pixel 7 Pro, OnePlus 9 | Must support n78; check carrier model restrictions |
| **5G Modem** | Quectel RM520N-GL, Sierra Wireless EM9291 | USB or M.2 modules, easier to script/automate |
| **5G CPE** | Various | Fixed wireless access devices, useful for throughput testing |

:::note
Carrier-locked phones may refuse to connect to private networks even if the hardware supports the band. Use **unlocked** devices or 5G modems for reliable testing.
:::

## Timing Equipment

ORAN Split 7.2 requires precise time and frequency synchronization between the DU and RU. The synchronization method depends on your deployment topology.

### Option A: E810-XXVDA4T with GPS Antenna (Recommended)

If you have the E810 timing variant:

| Item | Details |
|---|---|
| **GPS Antenna** | Active GPS/GNSS antenna with SMA connector |
| **Cable** | SMA to u.FL pigtail (E810-XXVDA4T has u.FL GNSS input) |
| **Mounting** | Antenna needs clear sky view (window or rooftop) |

This is the simplest timing setup. The E810-XXVDA4T's GNSS receiver disciplines the NIC's oscillator directly, and the NIC acts as a PTP grandmaster for the RU.

### Option B: External PTP Grandmaster

If you use the non-timing E810 variant (or need higher precision):

| Item | Details |
|---|---|
| **PTP Grandmaster** | Microchip/Microsemi TimeProvider 4100, Meinberg LANTIME M300 |
| **Connection** | Ethernet to managed switch or directly to E810 |

### Option C: Direct Connect (LLS-C1)

For the simplest lab setup with direct DU-to-RU cabling:

- No external PTP grandmaster or switch required.
- The E810 NIC provides PTP timestamps directly to the RU.
- Works when the DU and RU are connected via a single Ethernet link.

## Switching

### When You Need a Switch

You need a managed switch if:
- You have multiple RUs.
- The DU and RU are not directly connected (i.e., there is a network between them).
- You need LLS-C3 timing (PTP over a switched network).

### Switch Requirements (If Needed)

| Feature | Requirement |
|---|---|
| **PTP Support** | IEEE 1588v2 Boundary Clock or Transparent Clock |
| **Port Speed** | 25GbE SFP28 ports for fronthaul |
| **VLAN** | 802.1Q VLAN tagging |
| **PFC/ECN** | Priority Flow Control recommended for fronthaul traffic |

### When You Do Not Need a Switch

For a single-RU lab with direct connection between the E810 and the RU, no switch is required. This is the topology we use for the primary tutorial path.

## Bill of Materials

The following table provides approximate costs for a complete single-RU lab setup. Prices are approximate and vary by region and vendor.

### Core Lab (Minimum Viable)

| Item | Qty | Approx. Cost (USD) | Notes |
|---|---|---|---|
| Server (Dell R740xd or similar) | 1 | $800 - $2,000 | Refurbished; with Xeon Gold, 64GB RAM, NVMe |
| Intel E810-XXVDA4T NIC | 1 | $300 - $500 | New; timing variant recommended |
| SFP28 DAC Cable (3m) | 1 | $20 - $40 | For DU-to-RU direct connect |
| GPS Antenna (active, SMA) | 1 | $20 - $50 | For E810-T GNSS input |
| SMA to u.FL pigtail | 1 | $5 - $10 | Adapter for E810 board connector |
| Sysmocom sysmoISIM-SJA2 SIMs | 5 | $5 - $10 each | Programmable 5G SIM cards |
| HID Omnikey 3121 Reader | 1 | $30 - $50 | USB smart card reader |
| ORAN Split 7.2 Radio Unit | 1 | $2,000 - $10,000 | Price varies dramatically by vendor/band/power |
| 5G UE (unlocked phone or modem) | 1 | $200 - $800 | Any n78-capable device |
| **Estimated Total** | | **$3,400 - $13,500** | |

### Software-Only Start (No RF Hardware)

| Item | Qty | Approx. Cost (USD) | Notes |
|---|---|---|---|
| Server (Dell R740xd or similar) | 1 | $800 - $2,000 | Refurbished |
| Intel E810-XXVDA2 NIC | 1 | $150 - $300 | Non-timing variant is fine for testmode |
| **Estimated Total** | | **$950 - $2,300** | srsRAN testmode, no OTA RF |

:::tip
**Start with testmode.** You can validate the entire software stack — srsRAN DU, SD-Core, subscriber provisioning, PDU session establishment — using srsRAN's built-in testmode before purchasing RF hardware. This lets you build confidence with the configuration before spending thousands on an RU.
:::

## Power and Cooling

Do not overlook physical infrastructure:

- **Power:** A loaded Xeon server draws 300-500W. Ensure your lab has appropriate power and ideally a UPS.
- **Cooling:** The server will generate significant heat, especially with CPU isolation and real-time workloads pinning cores at 100%. Ensure adequate airflow.
- **Rack space:** A 2U server, RU, and optional switch fit comfortably in a half-rack. A desktop/tower server on a bench works equally well for a lab.

## Next Steps

Once you have your hardware (or at minimum a server with an E810 NIC for software-only testing), proceed to the [Architecture Overview](./03-architecture-overview.md) to understand how all these components connect, then on to [Software Prerequisites](./04-software-prerequisites.md) to prepare your software environment.
