---
id: sd-core-architecture
title: "SD-Core Architecture"
sidebar_label: SD-Core Architecture
sidebar_position: 2
description: >
  Architecture of the SD-Core 5G core network, including descriptions of each
  3GPP network function (AMF, SMF, UPF, AUSF, UDM, UDR, NRF, NSSF, PCF) and
  how they interact within a cloud-native, Kubernetes-orchestrated deployment.
keywords:
  - SD-Core architecture
  - 5G network functions
  - AMF
  - SMF
  - UPF
  - AUSF
  - UDM
  - UDR
  - NRF
  - NSSF
  - PCF
  - 3GPP SBA
  - service-based architecture
---

# SD-Core Architecture

<!-- COMING SOON -->

SD-Core implements the 3GPP **Service-Based Architecture (SBA)** for the 5G core network. Each network function runs as an independent containerized microservice, communicating over HTTP/2 (for control plane) and GTP-U (for user plane). The following network functions comprise the SD-Core deployment:

| Network Function | Full Name | Role |
|---|---|---|
| **AMF** | Access and Mobility Management Function | Entry point for the RAN. Handles UE registration, connection management, mobility (handover), and relays NAS messages between the UE and other core NFs. |
| **SMF** | Session Management Function | Manages PDU sessions — establishment, modification, and release. Selects and configures the UPF for user-plane forwarding. |
| **UPF** | User Plane Function | Forwards user-plane packets between the RAN and external data networks. SD-Core uses a high-performance BESS-based UPF that supports DPDK acceleration. |
| **AUSF** | Authentication Server Function | Handles UE authentication procedures (5G-AKA, EAP-AKA'). Validates credentials provided by the UE against the UDM/UDR. |
| **UDM** | Unified Data Management | Manages subscriber identity, access authorization, and subscription data. Computes authentication vectors using subscriber credentials from the UDR. |
| **UDR** | Unified Data Repository | Persistent storage backend for subscriber profiles, policy data, and session records. Provides a standardized data access interface to UDM, PCF, and other NFs. |
| **NRF** | Network Repository Function | Service discovery and registration. Each NF registers itself with the NRF, and other NFs query the NRF to discover available service endpoints. |
| **NSSF** | Network Slice Selection Function | Selects the appropriate network slice for a UE based on subscription data, requested NSSAI, and operator policy. |
| **PCF** | Policy Control Function | Provides policy rules for session management (QoS, charging, access control). Delivers PCC rules to the SMF for enforcement in the UPF. |

<!-- IMAGE PLACEHOLDER: SD-Core architecture diagram showing all network functions with their interconnections. Control-plane NFs (AMF, SMF, AUSF, UDM, UDR, NRF, NSSF, PCF) connected via the SBA bus (HTTP/2). User-plane path from gNB through UPF to the data network. Show the N1 (UE-AMF NAS), N2 (gNB-AMF NGAP), N3 (gNB-UPF GTP-U), N4 (SMF-UPF PFCP), and N6 (UPF-DN) reference points. -->

:::note
This section is a placeholder. Detailed architecture discussion, configuration guidance, and deployment walkthroughs will be added once the custom Web UI (based on Aether OnRamp) is ready.
:::
