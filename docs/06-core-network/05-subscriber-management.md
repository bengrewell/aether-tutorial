---
id: subscriber-management
title: "Subscriber Management"
sidebar_label: Subscriber Management
sidebar_position: 5
description: >
  Provisioning and managing subscribers in SD-Core, including adding IMSI/SUPI
  entries, configuring authentication credentials (Ki, OPC), assigning network
  slices and QoS profiles, and verifying subscriber registration.
keywords:
  - subscriber management
  - IMSI provisioning
  - SUPI
  - Ki
  - OPC
  - SIM provisioning
  - SD-Core subscribers
  - 5G authentication
  - subscriber database
---

# Subscriber Management

<!-- COMING SOON -->

This page will cover the provisioning and management of subscribers within SD-Core. Each subscriber (identified by IMSI/SUPI) must be registered in the core network's subscriber database with matching authentication credentials before a UE can attach. Key topics include:

- **Adding subscriber entries** — Registering IMSI, Ki, OPC, and sequence number (SQN) values that must match the corresponding SIM card programmed in [SIM Programming](../07-integration-testing/01-sim-programming.md).
- **Slice and DNN assignment** — Associating each subscriber with one or more network slices (S-NSSAI) and data network names (DNN).
- **QoS profile mapping** — Assigning AMBR (Aggregate Maximum Bit Rate) limits and default 5QI values per subscriber or subscriber group.
- **Bulk provisioning** — Techniques for adding multiple subscribers efficiently.
- **Verification** — Confirming that subscriber entries are correctly stored in the UDR and accessible by the UDM/AUSF during authentication.

:::warning
The Ki and OPC values provisioned in SD-Core must exactly match the values programmed on the SIM card. A mismatch will cause authentication failure during UE attachment. See [SIM Programming](../07-integration-testing/01-sim-programming.md) for details on programming SIM cards.
:::

:::note
This section is pending completion of the custom deployment Web UI. Subscriber provisioning will be performed through the UI's subscriber management interface. Content will be added once the tooling is ready for use.
:::
