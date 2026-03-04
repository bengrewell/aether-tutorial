---
id: monitoring-dashboards
title: "Monitoring and Dashboards"
sidebar_label: Monitoring & Dashboards
sidebar_position: 2
description: >
  Setting up Prometheus and Grafana for monitoring a private 5G network,
  including SD-Core metrics collection, gNB performance dashboards, UPF
  throughput visualization, and alerting for network function health.
keywords:
  - Prometheus
  - Grafana
  - monitoring
  - dashboards
  - 5G monitoring
  - SD-Core metrics
  - gNB monitoring
  - UPF metrics
  - observability
  - alerting
---

# Monitoring and Dashboards

<!-- COMING SOON -->

This page will cover deploying **Prometheus** and **Grafana** for monitoring and visualizing the health and performance of your private 5G network. SD-Core network functions expose Prometheus-compatible metrics endpoints, and the Aether platform includes pre-built Grafana dashboards for common operational views.

Topics will include deploying the Prometheus/Grafana stack (standalone or via the kube-prometheus-stack Helm chart), configuring scrape targets for SD-Core NFs and the srsRAN gNB, importing Aether dashboard definitions, key metrics to monitor (connected UEs, PDU sessions, throughput, NF health), and setting up alerts for critical conditions (NF restarts, authentication failures, UPF overload).

:::note
This section is pending completion of the custom deployment Web UI. Content will be added once the tooling is ready for use.
:::
