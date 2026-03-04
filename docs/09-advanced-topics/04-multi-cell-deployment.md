---
id: multi-cell-deployment
title: "Multi-Cell Deployment"
sidebar_label: Multi-Cell Deployment
sidebar_position: 4
description: >
  Scaling the private 5G network to multiple gNBs and cells, including cell
  planning, TAC allocation, X2/Xn handover configuration, AMF load distribution,
  and inter-cell interference management.
keywords:
  - multi-cell
  - multiple gNBs
  - cell planning
  - handover
  - Xn interface
  - TAC
  - inter-cell interference
  - 5G scaling
  - coverage expansion
  - mobility management
---

# Multi-Cell Deployment

<!-- COMING SOON -->

This page will cover scaling the private 5G network beyond a single gNB/cell to a **multi-cell deployment** with multiple Radio Units and potentially multiple DU instances. Topics will include cell planning considerations (frequency assignment, PCI allocation, coverage overlap for mobility), TAC (Tracking Area Code) allocation strategy, configuring the Xn interface between gNBs for handover support, AMF configuration for handling multiple gNB associations, and managing inter-cell interference in co-channel deployments.

Multi-cell deployments introduce mobility management challenges (handover latency, measurement reporting, neighbor cell lists) that do not exist in a single-cell lab. This section will bridge the gap between a proof-of-concept single-cell setup and a deployment that provides continuous coverage across a facility.

:::note
This section is pending completion of the custom deployment Web UI. Content will be added once the tooling is ready for use.
:::
