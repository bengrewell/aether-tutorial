---
id: network-function-config
title: "Network Function Configuration"
sidebar_label: NF Configuration
sidebar_position: 4
description: >
  Configuring individual SD-Core network functions (AMF, SMF, UPF, and others)
  via the deployment UI, including PLMN settings, DNN configuration, IP address
  pools, and inter-NF connectivity parameters.
keywords:
  - network function configuration
  - AMF configuration
  - SMF configuration
  - UPF configuration
  - PLMN
  - DNN
  - SD-Core configuration
  - 5G core tuning
---

# Network Function Configuration

<!-- COMING SOON -->

This page will cover the configuration of individual SD-Core network functions after initial deployment. Key configuration areas include:

- **AMF** — PLMN identity (MCC/MNC), NGAP binding address, supported TAC list, and slice (S-NSSAI) configuration.
- **SMF** — DNN definitions, UE IP address pool allocation, UPF associations via PFCP, and QoS profile mappings.
- **UPF** — Access (N3) and core (N6) interface bindings, GTP-U tunnel configuration, DPDK port assignments, and IP route injection for the data network.
- **AUSF/UDM/UDR** — Authentication algorithm selection (5G-AKA vs. EAP-AKA'), subscriber data schema, and database backend configuration.
- **NRF/NSSF/PCF** — Service registration endpoints, slice selection policies, and PCC rule definitions.

Configuration will be performed through the deployment Web UI, which provides a structured interface for modifying these parameters without directly editing Helm values files or NF configuration YAML.

:::note
This section is pending completion of the custom deployment Web UI. Content will be added once the tooling is ready for use.
:::
