---
id: sd-core-overview
title: "SD-Core Overview"
sidebar_label: SD-Core Overview
sidebar_position: 1
description: >
  Introduction to the SD-Core mobile core network — an open-source, cloud-native
  5G core from the Open Networking Foundation (ONF) and Linux Foundation, and the
  reasons it was chosen for this tutorial's Aether-based private 5G deployment.
keywords:
  - SD-Core
  - 5G core network
  - ONF
  - Open Networking Foundation
  - Aether
  - cloud-native 5G
  - 3GPP
  - mobile core
---

# SD-Core Overview

<!-- COMING SOON -->

SD-Core is an open-source, cloud-native 5G core network originally developed by the **Open Networking Foundation (ONF)** and now maintained under the **Linux Foundation**. It implements the full set of 3GPP Release 15/16 network functions as containerized microservices, designed from the ground up for Kubernetes orchestration. SD-Core forms the mobile core component of the broader **Aether platform**, which provides an integrated, edge-optimized private 5G/LTE connectivity solution.

This tutorial uses SD-Core because of its Kubernetes-native architecture, Helm-based deployment model, high-performance BESS-based UPF with DPDK support, and the operational tooling provided by the Aether ecosystem. For more information, see the [SD-Core project page](https://opennetworking.org/sd-core/).

:::note
This section is a placeholder. Full deployment instructions will be added once the custom Web UI (based on Aether OnRamp) is ready. The deployment workflow for SD-Core in this tutorial will be driven through that UI rather than manual Helm commands.
:::
