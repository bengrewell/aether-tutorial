---
id: performance-benchmarking
title: "Performance Benchmarking"
sidebar_label: Performance Benchmarking
sidebar_position: 4
description: >
  Benchmarking throughput and latency of the private 5G network using iperf3,
  including downlink and uplink test methodology, expected throughput ranges
  for different configurations, and identifying bottlenecks.
keywords:
  - performance benchmarking
  - iperf3
  - throughput testing
  - 5G throughput
  - downlink
  - uplink
  - latency
  - private 5G performance
  - UPF throughput
  - DPDK performance
---

# Performance Benchmarking

<!-- COMING SOON -->

This page will cover the methodology for benchmarking the throughput and latency of your private 5G network. The content will include:

- **iperf3 setup** — Running an iperf3 server on the core network side and an iperf3 client on the UE (or a tethered laptop) to measure end-to-end throughput.
- **Downlink (DL) testing** — Measuring the maximum sustained throughput from the network to the UE, with expected ranges based on bandwidth, MIMO configuration, and modulation.
- **Uplink (UL) testing** — Measuring UE-to-network throughput, which is typically lower than downlink due to UE transmit power and TDD slot allocation.
- **Latency measurement** — Round-trip time measurements using ping and iperf3, with expected latency ranges for the user plane path.
- **Expected throughput ranges** — Baseline numbers for common configurations (e.g., 40 MHz TDD n78, 2x2 MIMO) to help identify whether your deployment is performing within normal bounds.
- **Bottleneck identification** — How to determine whether throughput limitations are in the RF link, the gNB processing, the UPF forwarding path, or the backhaul.
- **DPDK vs. kernel UPF** — Comparing user-plane forwarding performance with and without DPDK acceleration.

:::note
This section is pending completion of the custom deployment Web UI. Content will be added once the full end-to-end stack can be deployed and tested through the UI-driven workflow.
:::
