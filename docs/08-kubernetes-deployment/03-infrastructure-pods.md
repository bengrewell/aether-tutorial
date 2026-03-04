---
id: infrastructure-pods
title: "Infrastructure Pods"
sidebar_label: Infrastructure Pods
sidebar_position: 3
description: >
  Deploying Kubernetes infrastructure components required by SD-Core and srsRAN,
  including Multus for multi-network pod interfaces, CNI plugins (Flannel,
  Calico), MetalLB for bare-metal load balancing, and cert-manager for TLS.
keywords:
  - Multus
  - CNI
  - Flannel
  - Calico
  - MetalLB
  - cert-manager
  - Kubernetes infrastructure
  - multi-network
  - pod networking
  - bare-metal load balancer
---

# Infrastructure Pods

<!-- COMING SOON -->

This page will cover the deployment of Kubernetes infrastructure components that SD-Core and srsRAN depend on:

- **Multus CNI** — A meta-CNI plugin that enables pods to have multiple network interfaces. SD-Core NFs require separate interfaces for different network segments (e.g., N3 access, N4 control, N6 core), and the gNB pod needs a dedicated DPDK-bound interface for fronthaul.
- **Primary CNI (Flannel or Calico)** — The cluster's primary pod network for inter-pod communication and Kubernetes service networking.
- **MetalLB** — A bare-metal load balancer implementation that provides `LoadBalancer`-type Service IPs in environments without a cloud provider, used for exposing AMF NGAP and other externally reachable endpoints.
- **cert-manager** — Automated TLS certificate management for securing inter-NF communication and webhook endpoints.

:::note
This section is pending completion of the custom deployment Web UI. Content will be added once the tooling is ready for use.
:::
