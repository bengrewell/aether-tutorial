---
id: cpu-manager-sriov
title: "CPU Manager and SR-IOV Configuration"
sidebar_label: CPU Manager & SR-IOV
sidebar_position: 2
description: >
  Configuring Kubernetes CPU Manager static policy for guaranteed CPU allocation
  to real-time workloads, and setting up SR-IOV device plugin for direct NIC
  access from pods running the UPF and gNB.
keywords:
  - CPU Manager
  - static policy
  - SR-IOV
  - device plugin
  - guaranteed QoS
  - CPU pinning
  - Kubernetes real-time
  - DPDK pods
  - NIC passthrough
---

# CPU Manager and SR-IOV Configuration

<!-- COMING SOON -->

This page will cover two critical Kubernetes configurations for running telco workloads with real-time performance requirements:

- **CPU Manager static policy** — Configuring the kubelet to use the `static` CPU Manager policy, which provides exclusive CPU core allocation to pods in the `Guaranteed` QoS class. This is essential for the srsRAN gNB and UPF pods, which require dedicated CPU cores to meet real-time processing deadlines without interference from other workloads.

- **SR-IOV device plugin** — Deploying the SR-IOV Network Device Plugin to expose physical NIC Virtual Functions (VFs) as allocatable Kubernetes resources. This allows the UPF and gNB pods to directly access NIC hardware (bypassing the kernel network stack) for DPDK-accelerated packet processing on the fronthaul and user-plane interfaces.

:::note
This section is pending completion of the custom deployment Web UI. Content will be added once the tooling is ready for use.
:::
