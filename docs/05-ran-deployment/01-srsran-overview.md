---
id: srsran-overview
title: srsRAN Project Overview
sidebar_label: srsRAN Overview
sidebar_position: 1
description: Overview of the srsRAN Project open-source 5G RAN stack, its CU/DU architecture, O-RAN Split 7.2 support, performance requirements, and how it integrates with Aether SD-Core.
keywords:
  - srsRAN
  - 5G gNB
  - open-source RAN
  - CU-CP
  - CU-UP
  - DU
  - O-RAN Split 7.2
  - eCPRI
  - Open Fronthaul
  - Aether integration
---

# srsRAN Project Overview

The srsRAN Project, developed by [Software Radio Systems (SRS)](https://www.srs.io/), is an open-source 5G NR RAN implementation written in C++. It provides a fully functional gNB (next-generation Node B) that implements the 3GPP NR protocol stack and supports O-RAN Split 7.2 fronthaul connectivity to commercial Radio Units. In the Aether deployment, srsRAN serves as the RAN component — the gNB — while ONF's SD-Core provides the 5G core network.

This section provides a conceptual overview of srsRAN's architecture, capabilities, and requirements before moving into the hands-on build and configuration guides that follow.

## What is srsRAN Project?

srsRAN Project is the 5G NR counterpart to the earlier srsLTE (now called srsRAN 4G). Key characteristics:

- **Open source** under the AGPLv3 license
- **3GPP compliant** 5G NR gNB implementation
- **O-RAN compatible** with Split 7.2 fronthaul support via the Open Fronthaul (OFH) library
- **High performance** — designed to run on commercial off-the-shelf (COTS) x86 hardware with DPDK acceleration
- **Actively maintained** with regular releases and community support

:::note
srsRAN Project (the 5G NR stack) is a separate codebase from srsRAN 4G (the LTE stack). This tutorial exclusively uses srsRAN Project for the 5G gNB.
:::

## CU/DU Architecture

The 5G RAN protocol stack is logically divided into a Centralized Unit (CU) and a Distributed Unit (DU), following the 3GPP functional split architecture.

### Centralized Unit — Control Plane (CU-CP)

The CU-CP handles control-plane signaling between the gNB and the 5G core network, as well as between the gNB and UEs:

| Protocol | Function |
|----------|----------|
| **RRC** (Radio Resource Control) | UE connection management, security activation, measurement configuration, handover control |
| **PDCP** (Packet Data Convergence Protocol) — control plane | Ciphering and integrity protection of RRC messages |
| **NGAP** (NG Application Protocol) | Interface to the AMF in the core network over the N2 reference point |
| **F1AP** (F1 Application Protocol) | Interface between CU-CP and DU (internal in monolithic gNB) |

The CU-CP communicates with the AMF over the **N2 interface** using SCTP transport.

### Centralized Unit — User Plane (CU-UP)

The CU-UP handles user-plane data forwarding between the core network and the DU:

| Protocol | Function |
|----------|----------|
| **SDAP** (Service Data Adaptation Protocol) | QoS flow mapping between the core and the RAN |
| **PDCP** (Packet Data Convergence Protocol) — user plane | Header compression (ROHC), ciphering, reordering |
| **GTP-U** (GPRS Tunnelling Protocol — User Plane) | Tunneling user data over the N3 interface to the UPF |

The CU-UP communicates with the UPF over the **N3 interface** using GTP-U over UDP.

### Distributed Unit (DU)

The DU handles the lower layers of the protocol stack, including the time-critical real-time processing:

| Protocol | Function |
|----------|----------|
| **RLC** (Radio Link Control) | Segmentation, reassembly, ARQ retransmission |
| **MAC** (Medium Access Control) | Scheduling, HARQ, multiplexing, random access handling |
| **PHY** (Physical Layer) | Modulation/demodulation, channel coding, FFT/IFFT, beamforming |

The DU communicates with the Radio Unit (RU) over the **Open Fronthaul** interface using eCPRI over Ethernet.

<!-- IMAGE PLACEHOLDER: [Diagram showing the CU-CP, CU-UP, and DU functional blocks with protocol layers labeled, and the N2, N3, F1, and Open Fronthaul interfaces connecting them to the AMF, UPF, and RU respectively] -->

### Monolithic gNB in srsRAN

In srsRAN Project, the CU-CP, CU-UP, and DU typically run as a **single monolithic process** (the `gnb` binary). While the 3GPP architecture defines logical separation, srsRAN combines them for simplicity and performance when using O-RAN Split 7.2:

```
┌─────────────────────────────────────────────┐
│                srsRAN gnb process            │
│                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │
│  │  CU-CP  │  │  CU-UP  │  │     DU      │  │
│  │ RRC     │  │ SDAP    │  │ RLC/MAC/PHY │  │
│  │ PDCP-C  │  │ PDCP-U  │  │             │  │
│  └────┬────┘  └────┬────┘  └──────┬──────┘  │
│       │             │              │          │
└───────┼─────────────┼──────────────┼──────────┘
        │             │              │
   N2 (SCTP)    N3 (GTP-U)    O-RAN FH (eCPRI)
        │             │              │
      ┌─┴─┐        ┌──┴──┐       ┌──┴──┐
      │AMF│        │ UPF │       │ RU  │
      └───┘        └─────┘       └─────┘
```

:::tip
Running CU and DU in the same process eliminates the latency and complexity of the F1 interface. This is the recommended deployment model for O-RAN Split 7.2 with srsRAN.
:::

## O-RAN Split 7.2 Support

srsRAN implements the O-RAN Alliance Split 7.2 (also called 7-2x) low-layer functional split. In this split:

- **DU responsibilities**: Resource element mapping, precoding, layer mapping, modulation, and channel coding
- **RU responsibilities**: iFFT/FFT, cyclic prefix insertion/removal, digital beamforming (if applicable), RF front-end

### Open Fronthaul Interface

The fronthaul connection between the DU and RU uses:

| Aspect | Detail |
|--------|--------|
| **Transport** | Ethernet (layer 2) with VLAN tagging |
| **Protocol** | eCPRI (enhanced Common Public Radio Interface) |
| **Library** | srsRAN's built-in OFH (Open Fronthaul) library |
| **NIC** | Intel E810-XXVDA4T with DPDK for deterministic packet I/O |
| **Plane separation** | Control plane (C-Plane) and User plane (U-Plane) messages, each with configurable VLAN tags |

### Timing on the Fronthaul

O-RAN Split 7.2 imposes strict timing requirements. The DU must transmit downlink IQ data and control messages to the RU within precise timing windows relative to the radio frame boundary:

- **T1a** windows: Define when the DU must send C-Plane and U-Plane messages *before* the radio frame boundary
- **Ta4** window: Defines when the DU expects to receive uplink U-Plane data *after* the radio frame boundary

These timing parameters are configured in the `ru_ofh` section of the gNB configuration and must be matched to your specific RU's capabilities. See [gNB Configuration](./03-gnb-configuration.md) for details.

:::warning
Timing window mismatches between the DU and RU will cause packet drops, scheduling failures, and degraded throughput. Always consult your RU vendor's documentation for the supported T1a and Ta4 ranges.
:::

## Supported Configurations

srsRAN Project supports a range of 5G NR configurations:

### Frequency Bands

| Band | Frequency Range | Duplex | Common Use |
|------|----------------|--------|------------|
| n3 | 1805–1880 MHz | FDD | Refarmed LTE spectrum |
| n7 | 2620–2690 MHz | FDD | Refarmed LTE spectrum |
| n41 | 2496–2690 MHz | TDD | CBRS-adjacent |
| n77 | 3300–4200 MHz | TDD | C-Band |
| **n78** | **3300–3800 MHz** | **TDD** | **C-Band (used in this tutorial)** |
| n79 | 4400–5000 MHz | TDD | Upper C-Band |

### Bandwidth and Subcarrier Spacing

| Bandwidth (MHz) | 15 kHz SCS | 30 kHz SCS | 60 kHz SCS |
|-----------------|-----------|-----------|-----------|
| 10 | 52 PRBs | 24 PRBs | 11 PRBs |
| 20 | 106 PRBs | 51 PRBs | 24 PRBs |
| 40 | — | 106 PRBs | 51 PRBs |
| 50 | — | 133 PRBs | 65 PRBs |
| 80 | — | 217 PRBs | 107 PRBs |
| **100** | — | **273 PRBs** | 135 PRBs |

:::note
This tutorial uses **Band n78**, **100 MHz bandwidth**, and **30 kHz SCS** (273 PRBs). This is a common configuration for private 5G deployments and CBRS-adjacent spectrum.
:::

### MIMO Configurations

srsRAN supports multiple antenna configurations:

- **1T1R** — Single antenna transmit and receive
- **2T2R** — Two transmit, two receive
- **4T2R** — Four transmit, two receive (used in this tutorial with 4 DL / 2 UL antenna ports)
- **4T4R** — Four transmit, four receive

### TDD Patterns

The TDD uplink/downlink slot pattern is fully configurable. Common patterns include:

- **DDDSU** (3:1 DL-heavy) — Common for eMBB
- **DDDDDDDSUU** (7D2U) — Used in this tutorial, balances DL throughput with UL capacity
- **DDSUU** — More balanced UL/DL ratio

## Performance Requirements

Running a 5G gNB with O-RAN Split 7.2 places demanding requirements on the host system. The PHY layer must process IQ samples in real-time with sub-microsecond precision.

### Hardware Requirements

| Component | Requirement | This Tutorial |
|-----------|-------------|---------------|
| **CPU** | Intel Xeon Cascade Lake or newer | Intel Xeon (Cascade Lake+) |
| **NIC** | Intel E810 series with DPDK support | Intel E810-XXVDA4T |
| **RAM** | 32 GB minimum, DDR4-2666+ | 64 GB recommended |
| **Storage** | SSD (for builds and logs) | NVMe SSD |

### Software Requirements

| Component | Requirement | Reference |
|-----------|-------------|-----------|
| **OS** | Ubuntu 24.04 LTS | [OS Installation](../02-system-preparation/01-os-installation.md) |
| **Kernel** | Real-time kernel (PREEMPT_RT) | [Real-Time Kernel](../02-system-preparation/02-realtime-kernel.md) |
| **CPU isolation** | Isolated cores for DU threads | [CPU Isolation](../02-system-preparation/04-cpu-isolation.md) |
| **DPDK** | 24.11.2 with E810 PMD | [DPDK Installation](../03-network-configuration/02-dpdk-setup.md) |
| **PTP** | IEEE 1588 synchronization | [Timing Synchronization](../04-timing-synchronization/01-ptp-overview.md) |

:::danger
Running srsRAN without a real-time kernel and isolated CPUs will result in missed scheduling deadlines, dropped fronthaul packets, and degraded radio performance. These prerequisites are not optional for Split 7.2 deployments.
:::

### CPU Core Allocation

A typical allocation for a 100 MHz cell with 4T2R MIMO:

| Function | Cores | Notes |
|----------|-------|-------|
| PHY (DL processing) | 2–4 | Most CPU-intensive, must be isolated |
| PHY (UL processing) | 1–2 | Must be isolated |
| MAC/RLC/PDCP | 1–2 | Can share with other non-RT tasks |
| OFH (fronthaul I/O) | 1–2 | DPDK poll-mode, must be isolated |
| System / OS | Remaining | Non-isolated cores |

## Relationship to Aether

In the Aether architecture, srsRAN and SD-Core work together to provide an end-to-end 5G network:

```
┌─────┐         ┌───────────────┐         ┌─────────────────┐
│ UE  │ ──RF──▶ │  RU ──eCPRI──▶│  srsRAN gNB (DU+CU)     │
└─────┘         └───────────────┘  │                        │
                                   │  N2 (SCTP) ──────────▶ AMF  ┐
                                   │  N3 (GTP-U) ─────────▶ UPF  │ SD-Core
                                   └─────────────────────┘       │
                                                                  └────────┘
```

| Interface | Protocol | Endpoints | Purpose |
|-----------|----------|-----------|---------|
| **N2** | SCTP | gNB CU-CP ↔ AMF | Control plane: registration, PDU session setup, handover |
| **N3** | GTP-U / UDP | gNB CU-UP ↔ UPF | User plane: tunneled user data |

The gNB connects to SD-Core's AMF for control-plane signaling and to the UPF for user-plane traffic. The SD-Core components (AMF, SMF, UPF, NRF, AUSF, UDM, UDR, PCF, NSSF) are deployed separately — see [Section 06 - Core Network](../06-core-network/01-sd-core-overview.md) for details.

:::tip
The N2 and N3 interfaces are IP-based, so the gNB and core network do not need to be co-located. They can communicate over any routable IP network, though low latency is preferred.
:::

## Next Steps

With an understanding of srsRAN's architecture and requirements, proceed to [Building srsRAN](./02-building-srsran.md) to compile the gNB from source with DPDK support.
