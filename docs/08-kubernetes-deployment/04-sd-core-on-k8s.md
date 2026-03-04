---
id: sd-core-on-k8s
title: "SD-Core on Kubernetes"
sidebar_label: SD-Core on K8s
sidebar_position: 4
description: >
  Deploying SD-Core on Kubernetes using Helm charts, including values file
  customization, namespace configuration, persistent storage for the UDR,
  and verifying all network function pods reach healthy state.
keywords:
  - SD-Core Kubernetes
  - Helm deployment
  - SD-Core Helm charts
  - 5G core on K8s
  - network function pods
  - Aether Helm
  - SD-Core values
---

# SD-Core on Kubernetes

<!-- COMING SOON -->

This page will cover the Helm-based deployment of SD-Core on a Kubernetes cluster, migrating from the standalone deployment covered in [Section 06](../06-core-network/03-standalone-deployment.md) to a fully orchestrated Kubernetes environment. Topics will include Helm chart repositories, values file customization for your network parameters (PLMN, DNN, IP pools, interfaces), namespace organization, persistent volume configuration for the UDR database, and post-deployment verification of all network function pods.

:::note
This section is pending completion of the custom deployment Web UI. The Helm deployment will be orchestrated through the UI. Content will be added once the tooling is ready for use.
:::
