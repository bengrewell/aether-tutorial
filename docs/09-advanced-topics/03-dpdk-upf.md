---
id: dpdk-upf
title: "DPDK-Accelerated UPF"
sidebar_label: DPDK UPF
sidebar_position: 3
description: >
  Configuring the SD-Core UPF with DPDK acceleration for high-throughput user
  plane forwarding, including hugepage allocation, NIC binding with vfio-pci,
  BESS pipeline tuning, and performance comparison with kernel-based forwarding.
keywords:
  - DPDK
  - UPF
  - BESS
  - user plane acceleration
  - high throughput
  - vfio-pci
  - hugepages
  - packet processing
  - SD-Core UPF
  - data plane performance
---

# DPDK-Accelerated UPF

<!-- COMING SOON -->

This page will cover configuring the SD-Core UPF with **DPDK (Data Plane Development Kit)** acceleration for high-throughput user plane forwarding. The SD-Core UPF is based on **BESS (Berkeley Extensible Software Switch)**, a modular software switch framework that supports DPDK for kernel-bypass packet processing.

In a DPDK-accelerated configuration, the UPF bypasses the Linux kernel network stack entirely, polling NIC queues directly from user space. This eliminates context switches, interrupt overhead, and kernel buffer copies, enabling multi-gigabit forwarding rates on commodity hardware. Topics will include hugepage memory allocation, binding NIC ports with `vfio-pci`, BESS pipeline configuration, CPU core assignment for PMD (Poll Mode Driver) threads, and comparing throughput and latency between DPDK and kernel-based forwarding modes.

:::note
This section is pending completion of the custom deployment Web UI. Content will be added once the tooling is ready for use.
:::
