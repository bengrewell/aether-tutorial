---
id: architecture-overview
title: Architecture Overview
sidebar_label: Architecture Overview
sidebar_position: 3
description: >
  Detailed architecture overview of the private 5G lab, covering 5G network
  components, ORAN Split 7.2, SD-Core network functions, 3GPP interfaces,
  fronthaul, deployment models, and the end-to-end data flow.
keywords:
  - 5G architecture
  - ORAN Split 7.2
  - SD-Core network functions
  - 5G interfaces
  - eCPRI fronthaul
  - AMF SMF UPF
  - 5G data flow
---

# Architecture Overview

This page explains the architecture of the private 5G network we are building. Understanding how the components fit together will make every subsequent configuration step more intuitive.

## 5G Network Components at a Glance

A 5G network has three major domains:

```
┌──────────┐        ┌──────────────────────────┐        ┌─────────────────────┐
│          │  Air   │                          │  N2/N3 │                     │
│    UE    │◄──────►│         gNodeB           │◄──────►│     5G Core         │
│          │  Uu    │     (Radio Access)        │        │   (SD-Core)         │
└──────────┘        └──────────────────────────┘        └─────────────────────┘
                                                                  │
                                                                  │ N6
                                                                  ▼
                                                        ┌─────────────────────┐
                                                        │   Data Network      │
                                                        │   (Internet/LAN)    │
                                                        └─────────────────────┘
```

- **UE (User Equipment):** The 5G phone, modem, or device. Communicates with the gNB over the air interface (Uu).
- **gNodeB (gNB):** The 5G base station. Handles radio transmission/reception and connects to the core network. In our deployment, this is **srsRAN**.
- **5G Core:** The set of network functions that handle authentication, session management, policy, and user-plane forwarding. In our deployment, this is **Aether SD-Core**.
- **Data Network (DN):** The external network (internet, enterprise LAN) that UE traffic is routed to after passing through the core.

## ORAN Split 7.2

### What Is Functional Splitting?

In traditional cellular networks, the base station is a single monolithic unit that handles everything from RF processing to higher-layer protocols. **O-RAN (Open Radio Access Network)** defines standardized ways to split this functionality across separate components.

**Split 7.2** (also called the **low-layer split** or **7-2x split**) divides the gNB into two physical components:

```
┌─────────────────────────────────────────────────────┐
│                    gNodeB (logical)                  │
│                                                     │
│  ┌─────────────────────────┐  ┌──────────────────┐  │
│  │   Distributed Unit (DU) │  │  Radio Unit (RU)  │  │
│  │                         │  │                   │  │
│  │  - RLC layer            │  │  - Low PHY        │  │
│  │  - MAC layer            │  │  - RF front-end   │  │
│  │  - High PHY             │  │  - DAC/ADC        │  │
│  │  - L2 scheduling        │  │  - Beamforming    │  │
│  │                         │  │                   │  │
│  │  Runs on: x86 server    │  │  Runs on: RU HW   │  │
│  │  (srsRAN)               │  │  (Benetel, etc.)  │  │
│  └────────────┬────────────┘  └────────┬──────────┘  │
│               │      eCPRI / Ethernet  │             │
│               └────────────────────────┘             │
│                    Fronthaul                         │
└─────────────────────────────────────────────────────┘
```

### Why Split 7.2 Matters

| Benefit | Explanation |
|---|---|
| **Hardware disaggregation** | The DU runs on standard x86 servers (COTS hardware). Only the RU is specialized RF equipment. |
| **Vendor interoperability** | Any O-RAN compliant RU should work with any compliant DU, breaking vendor lock-in. |
| **Centralized processing** | PHY-layer processing (LDPC, FFT) runs on the server where you have more compute. The RU is simpler and cheaper. |
| **Flexibility** | You can upgrade DU software independently of the RU, and vice versa. |

### Fronthaul Requirements

The fronthaul link between DU and RU carries **time-domain IQ samples** (after iFFT in downlink, before FFT in uplink). This creates demanding requirements:

- **Bandwidth:** 25 Gbps per link is typical for a 100 MHz n78 cell with 4x4 MIMO.
- **Latency:** One-way latency must be under ~100 microseconds (depends on numerology and RU processing budget).
- **Timing:** The DU and RU must be time-synchronized to within ~tens of nanoseconds via IEEE 1588 (PTP).
- **Protocol:** eCPRI (enhanced Common Public Radio Interface) over Ethernet.

:::danger
Fronthaul timing violations cause immediate cell failure. If the DU cannot deliver downlink IQ samples to the RU within the timing window, the RU transmits silence (or garbage), and UEs will not be able to connect. Proper timing synchronization (covered in [Timing & Synchronization](../04-timing-synchronization/01-ptp-overview.md)) is the single most critical configuration step.
:::

## SD-Core Network Functions

Aether SD-Core implements the **5G Service Based Architecture (SBA)** as defined by 3GPP. Each network function runs as a separate container (microservice) and communicates with others via HTTP/2-based service interfaces.

<!-- IMAGE PLACEHOLDER: 5G SBA architecture diagram showing all network functions connected to the service bus, with reference point interfaces (N1-N6) labeled between UE, gNB, and core NFs. -->

### Control Plane Network Functions

| Network Function | Full Name | Role |
|---|---|---|
| **AMF** | Access and Mobility Management Function | Entry point for all UE signaling. Handles registration, authentication orchestration, mobility, and connection management. Terminates N1 (from UE) and N2 (from gNB). |
| **SMF** | Session Management Function | Manages PDU sessions (the data tunnels). Selects the UPF, allocates IP addresses, installs forwarding rules via N4, and enforces QoS policies. |
| **AUSF** | Authentication Server Function | Executes the 5G-AKA authentication protocol. Verifies subscriber credentials (Ki/OPc) provided by the UDM. |
| **UDM** | Unified Data Management | Subscriber profile management. Stores and retrieves authentication credentials, subscription data, and access policies. Interfaces with the UDR for persistent storage. |
| **UDR** | Unified Data Repository | The persistent data store for subscriber profiles, policy data, and application data. Backed by a database (MongoDB in SD-Core). |
| **NRF** | Network Repository Function | Service discovery. Each NF registers with the NRF, and other NFs query it to find service endpoints. Think of it as DNS for 5G network functions. |
| **NSSF** | Network Slice Selection Function | Determines the correct network slice for a UE based on requested NSSAI (Network Slice Selection Assistance Information). |
| **PCF** | Policy Control Function | Provides policy rules to the SMF (QoS, charging, access control). In SD-Core's default lab configuration, basic policies are pre-configured. |

### User Plane Network Function

| Network Function | Full Name | Role |
|---|---|---|
| **UPF** | User Plane Function | The data plane workhorse. Receives GTP-U encapsulated user packets from the gNB (via N3), decapsulates them, applies policy/QoS, and forwards them to the Data Network (via N6). Also handles the reverse path. SD-Core uses a **BESS-based UPF** that supports DPDK for high-throughput forwarding. |

:::note
The UPF is the only network function in the user-plane data path. All other NFs are control-plane only. This means the UPF's performance directly determines your network's throughput capacity. SD-Core's BESS-UPF can achieve multi-gigabit throughput with DPDK.
:::

### Supporting Components

In addition to the 3GPP network functions, SD-Core deployments include:

| Component | Role |
|---|---|
| **MongoDB** | Backend database for UDR (subscriber data) |
| **Webui** | Web-based interface for subscriber management (adding IMSIs, configuring profiles) |
| **Config Service** | Centralized configuration management for SD-Core NFs |

## 3GPP Reference Point Interfaces

The following interfaces connect the major network elements:

```
                          N1 (NAS signaling, encapsulated in N2)
          ┌──────────────────────────────────────────────────────┐
          │                                                      │
          ▼                                                      │
     ┌─────────┐          N2 (NGAP)           ┌──────────┐      │
     │         │◄────────────────────────────►│          │      │
     │   gNB   │                              │   AMF    │◄─────┘
     │ (srsRAN)│          N3 (GTP-U)          │          │
     │         │◄───────────────────┐         └──────────┘
     └─────────┘                    │
                                    ▼
                              ┌──────────┐        N6         ┌──────────┐
                              │          │◄─────────────────►│   Data   │
                              │   UPF    │                    │ Network  │
                              │          │                    └──────────┘
                              └──────────┘
                                    ▲
                                    │ N4 (PFCP)
                                    ▼
                              ┌──────────┐
                              │   SMF    │
                              └──────────┘
```

| Interface | Between | Protocol | Purpose |
|---|---|---|---|
| **N1** | UE and AMF | NAS (Non-Access Stratum) | Registration, authentication, session management signaling. Carried transparently through the gNB. |
| **N2** | gNB and AMF | NGAP over SCTP | RAN control plane. UE context setup, handover, paging, NAS message transport. |
| **N3** | gNB and UPF | GTP-U over UDP/IP | User plane data transport. UE IP packets are GTP-U encapsulated between gNB and UPF. |
| **N4** | SMF and UPF | PFCP over UDP | Session management. The SMF installs packet detection rules (PDRs) and forwarding action rules (FARs) in the UPF. |
| **N6** | UPF and Data Network | Raw IP | Decapsulated user traffic. From the DN's perspective, traffic looks like regular IP packets sourced from the UE's assigned IP. |

:::tip
For debugging, the most useful interfaces to capture are:
- **N2 (SCTP port 38412):** See UE registration, authentication, and PDU session setup signaling.
- **N3 (GTP-U, UDP port 2152):** See encapsulated user-plane traffic.
- **N4 (PFCP, UDP port 8805):** See session rule installation between SMF and UPF.

Use `tcpdump` or Wireshark with appropriate filters. We cover this in [Integration & Testing](../07-integration-testing/01-sim-programming.md).
:::

## Fronthaul: eCPRI over Ethernet

Between the DU (srsRAN) and the RU, the fronthaul uses the **eCPRI (enhanced Common Public Radio Interface)** protocol, carried directly over Ethernet (no IP layer):

```
┌─────────────────────────────────────────────────────────────────┐
│                    Fronthaul (eCPRI)                             │
│                                                                 │
│  ┌──────────┐    Ethernet Frame    ┌──────────┐                │
│  │          │    ┌────────────┐    │          │                │
│  │   DU     │───►│ eCPRI Hdr  │───►│   RU     │   Downlink     │
│  │ (srsRAN) │    │ + IQ Data  │    │          │                │
│  │          │◄───│            │◄───│          │   Uplink       │
│  └──────────┘    └────────────┘    └──────────┘                │
│                                                                 │
│  VLAN tagged (typically VLAN 2 for U-Plane, VLAN 3 for C-Plane)│
│  Priority: PCP 7 for timing, PCP 6 for U-Plane                 │
└─────────────────────────────────────────────────────────────────┘
```

Key characteristics:
- **Layer 2 transport:** eCPRI uses Ethernet directly (EtherType 0xAEFE). No IP routing is involved.
- **VLAN separation:** The O-RAN standard recommends separate VLANs for U-Plane (IQ data), C-Plane (control), S-Plane (synchronization/PTP), and M-Plane (management).
- **Timing-critical:** Every Ethernet frame must arrive within a precise timing window defined by the slot structure and numerology.

## Deployment Models

### Model 1: Single Server (This Tutorial)

The primary path in this tutorial runs everything on a single physical server:

```
┌──────────────────────────────────────────────────────┐
│                  Single Server                        │
│                                                      │
│  ┌─────────────────┐    ┌──────────────────────────┐ │
│  │  srsRAN DU      │    │  SD-Core                 │ │
│  │  (bare metal,   │    │  (Kubernetes pods or     │ │
│  │   isolated cores)│    │   bare-metal containers) │ │
│  └────────┬────────┘    └──────────────────────────┘ │
│           │ uses DPDK                                 │
│  ┌────────┴────────┐                                 │
│  │  Intel E810 NIC │                                 │
│  │  Port 0: FH     │  Port 1: Backhaul/Mgmt         │
│  └────────┬────────┘                                 │
└───────────┼──────────────────────────────────────────┘
            │ eCPRI (25G Ethernet)
            ▼
       ┌─────────┐
       │   RU    │
       └─────────┘
```

- **Port 0** of the E810 connects to the RU (fronthaul, eCPRI).
- **Port 1** (or the onboard NIC) handles backhaul, management, and core network traffic.
- srsRAN runs on **isolated CPU cores** with hugepage memory, directly on the host (not in a container), to meet real-time requirements.
- SD-Core runs either as **Kubernetes pods** or as **Docker containers**, on the remaining (non-isolated) CPU cores.

### Model 2: Kubernetes Cluster (Advanced)

For production-like deployments, you can separate the RAN and core onto different nodes:

```
┌────────────────────┐          ┌────────────────────┐
│   RAN Node         │          │  Core Node         │
│   (srsRAN DU)      │◄────────►│  (SD-Core on K8s)  │
│   RT kernel, DPDK  │  N2/N3   │  Standard kernel   │
│   Intel E810       │          │  Any NIC           │
└────────┬───────────┘          └────────────────────┘
         │ eCPRI
    ┌────┴────┐
    │   RU    │
    └─────────┘
```

This model is covered in [Kubernetes Deployment](../08-kubernetes-deployment/01-k8s-cluster-setup.md).

## End-to-End Data Flow

Understanding the complete data flow helps with debugging. Here is what happens when a UE powers on, registers, establishes a data session, and sends its first packet.

### Step 1: UE Registration

```
UE                    gNB (srsRAN)              AMF                AUSF/UDM/UDR
│                         │                      │                      │
│── RRC Setup Request ──►│                      │                      │
│◄── RRC Setup ──────────│                      │                      │
│── Registration Req ───►│── Initial UE Msg ──►│                      │
│   (NAS, via N1)        │   (NGAP, via N2)     │                      │
│                         │                      │── Auth Request ────►│
│                         │                      │◄── Auth Vector ─────│
│◄── Auth Challenge ─────│◄── DL NAS Transport─│                      │
│── Auth Response ──────►│── UL NAS Transport─►│                      │
│                         │                      │── Verify ──────────►│
│                         │                      │◄── Confirm ─────────│
│◄── Registration Accept─│◄── DL NAS Transport─│                      │
```

1. The UE sends a Registration Request (NAS message, carried over the air interface).
2. The gNB forwards it to the AMF via the N2 interface (NGAP).
3. The AMF orchestrates authentication via AUSF, which retrieves credentials from UDM/UDR.
4. 5G-AKA authentication completes, and the AMF accepts the registration.

### Step 2: PDU Session Establishment

```
UE                    gNB (srsRAN)       AMF          SMF          UPF
│                         │               │            │            │
│── PDU Session Est Req ►│──────────────►│            │            │
│                         │               │── Create ►│            │
│                         │               │  Session   │── N4 ────►│
│                         │               │            │  (PFCP     │
│                         │               │            │   Rules)   │
│                         │               │◄── SM Ctx─│            │
│                         │◄── PDU Sess  │            │            │
│                         │   Resource   │            │            │
│                         │   Setup Req  │            │            │
│◄── RRC Reconfig ───────│               │            │            │
│── RRC Reconfig Cmplt ►│── PDU Sess ─►│            │            │
│                         │   Res Setup  │            │            │
│                         │   Response   │            │            │
│◄── PDU Session Est Acc │◄─────────────│            │            │
```

1. The UE requests a PDU session (a data tunnel).
2. The AMF delegates to the SMF, which selects a UPF and allocates a UE IP address.
3. The SMF installs forwarding rules in the UPF via the N4 interface (PFCP).
4. GTP-U tunnel endpoints are established between the gNB and UPF (N3).
5. The UE receives its IP address and can now send data.

### Step 3: User Plane Data

```
UE                    gNB (srsRAN)                 UPF                 Internet
│                         │                         │                      │
│── IP Packet ──────────►│── GTP-U Encap ────────►│── Decap + NAT ──────►│
│   (e.g., DNS query)    │   (N3 tunnel)           │   (N6 interface)     │
│                         │                         │                      │
│◄── IP Packet ──────────│◄── GTP-U Encap ────────│◄── Response ─────────│
│   (DNS response)       │   (N3 tunnel)           │   (N6 interface)     │
```

1. The UE sends an IP packet (e.g., a DNS query).
2. The gNB encapsulates it in GTP-U and sends it to the UPF via the N3 tunnel.
3. The UPF decapsulates the GTP-U header, applies any policy, and forwards the raw IP packet out the N6 interface toward the Data Network (internet).
4. Return traffic follows the reverse path.

:::note
The UPF performs NAT (Network Address Translation) if the UE's IP address is from a private range (which is the default in SD-Core). The N6 interface can also be configured for direct routing if the UE IPs are routable on your network.
:::

<!-- IMAGE PLACEHOLDER: Complete end-to-end data flow diagram showing all components (UE, RU, DU, AMF, SMF, UPF, DN) with protocol stacks at each interface (Uu, eCPRI, N2/NGAP, N3/GTP-U, N4/PFCP, N6/IP). -->

## Next Steps

Now that you understand the architecture, review the [Software Prerequisites](./04-software-prerequisites.md) to ensure you have all the required software versions before beginning the build.
