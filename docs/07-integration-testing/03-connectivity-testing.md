---
id: connectivity-testing
title: "Connectivity Testing"
sidebar_label: Connectivity Testing
sidebar_position: 3
description: >
  Verifying end-to-end IP connectivity through the private 5G network, including
  ping tests, DNS resolution, routing verification, and data path validation
  from UE through the UPF to external networks.
keywords:
  - connectivity testing
  - ping test
  - DNS resolution
  - 5G data path
  - UPF routing
  - PDU session
  - NAT
  - IP connectivity
  - private 5G verification
---

# Connectivity Testing

<!-- COMING SOON -->

This page will cover the methodology for verifying end-to-end IP connectivity after a UE has successfully attached and established a PDU session. The content will include:

- **Basic reachability** — Ping tests from the UE to the UPF, the core network server, and external hosts (e.g., `8.8.8.8`) to verify the complete data path.
- **DNS resolution** — Confirming that DNS queries from the UE resolve correctly, including DNS server configuration in the SMF and DNN settings.
- **Routing verification** — Tracing the packet path from UE through the GTP-U tunnel (N3), the UPF (N6), and out to the data network. Verifying NAT/masquerade rules if the UPF performs address translation.
- **tcpdump capture points** — Where to capture packets at each segment (gNB N3 interface, UPF access/core interfaces, external interface) to diagnose data path issues.
- **MTU considerations** — GTP-U encapsulation adds overhead; verifying that MTU settings accommodate the tunnel headers without fragmentation.

:::note
This section is pending completion of the custom deployment Web UI. Content will be added once the full end-to-end stack can be deployed and tested through the UI-driven workflow.
:::
