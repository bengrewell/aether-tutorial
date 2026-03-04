---
id: standalone-deployment
title: "Standalone SD-Core Deployment"
sidebar_label: Standalone Deployment
sidebar_position: 3
description: >
  Deploying SD-Core as a standalone 5G core network using the custom Web UI
  based on Aether OnRamp, including initial bootstrap, configuration, and
  verification of all network functions.
keywords:
  - SD-Core deployment
  - standalone 5G core
  - Aether OnRamp
  - Web UI deployment
  - Helm charts
  - 5G core installation
---

# Standalone SD-Core Deployment

<!-- COMING SOON -->

This page will cover the end-to-end deployment of SD-Core as a standalone 5G core network. The deployment will be driven through a **custom Web UI** built on top of the Aether OnRamp automation framework, providing a guided workflow for bootstrapping the core, configuring network parameters (PLMN, DNN, IP pools), and verifying that all network functions come up healthy.

The standalone deployment model runs all SD-Core network functions on a single server (or a small cluster), making it ideal for lab environments and initial bring-up before migrating to a full Kubernetes-orchestrated deployment.

:::note
This section is pending completion of the custom deployment Web UI. The UI is based on Aether OnRamp and will streamline the deployment process compared to manual Helm chart installation. Content will be added once the tooling is ready for use.
:::
