---
id: network-slicing
title: "5G Network Slicing"
sidebar_label: Network Slicing
sidebar_position: 1
description: >
  Configuring 5G network slicing with SD-Core, including S-NSSAI definitions,
  per-slice SMF and UPF instances, subscriber-to-slice mapping, and QoS
  differentiation across slices for different service types.
keywords:
  - network slicing
  - S-NSSAI
  - SST
  - SD
  - NSSF
  - slice isolation
  - 5G slicing
  - QoS differentiation
  - SD-Core slicing
---

# 5G Network Slicing

<!-- COMING SOON -->

This page will cover configuring **5G network slicing** with SD-Core. Network slicing is a fundamental 5G architecture concept that allows a single physical network to be partitioned into multiple logical networks (slices), each tailored for a specific service type or tenant. SD-Core supports multiple slices through the NSSF (Network Slice Selection Function), with per-slice SMF and UPF instances providing data-path isolation.

Topics will include defining S-NSSAI values (SST and SD), configuring slice-specific SMF/UPF pairs, mapping subscribers to slices in the UDR, and verifying that UE traffic is forwarded through the correct slice's user plane.

:::note
This section is pending completion of the custom deployment Web UI. Content will be added once the tooling is ready for use.
:::
