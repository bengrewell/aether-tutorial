---
id: srsran-on-k8s
title: "srsRAN on Kubernetes"
sidebar_label: srsRAN on K8s
sidebar_position: 5
description: >
  Running the srsRAN gNB as a containerized workload on Kubernetes, including
  container image build, DPDK device passthrough via SR-IOV, CPU pinning for
  real-time threads, and fronthaul interface configuration within a pod.
keywords:
  - srsRAN Kubernetes
  - containerized gNB
  - DPDK Kubernetes
  - SR-IOV gNB
  - real-time pod
  - srsRAN container
  - gNB pod
  - CPU pinning
  - fronthaul pod
---

# srsRAN on Kubernetes

<!-- COMING SOON -->

This page will cover running the srsRAN gNB as a containerized workload within the Kubernetes cluster. Unlike typical application pods, the gNB container requires specialized configurations: DPDK-bound NIC access via SR-IOV VF passthrough, guaranteed CPU cores with static CPU Manager policy for real-time L1/L2 processing threads, hugepage memory allocation, and precise fronthaul interface configuration. Topics will include building the container image, writing the pod/deployment manifest with appropriate resource requests and security contexts, and verifying gNB-to-AMF connectivity from within the Kubernetes environment.

:::note
This section is pending completion of the custom deployment Web UI. Content will be added once the tooling is ready for use.
:::
