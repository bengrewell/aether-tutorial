---
id: introduction
title: "Introduction: Building a Private 5G Lab"
sidebar_label: Introduction
sidebar_position: 1
description: >
  Overview of the Aether SD-Core + srsRAN private 5G tutorial series. Learn what
  we are building, why these components were chosen, how the tutorial is organized,
  and what you need to know before starting.
keywords:
  - private 5G
  - Aether SD-Core
  - srsRAN
  - ORAN Split 7.2
  - 5G tutorial
  - open-source 5G
  - telco lab
---

# Introduction: Building a Private 5G Lab

## What We Are Building

This tutorial series walks you through building a **fully functional private 5G network** from bare metal to a working end-to-end data session. By the end, you will have:

- A **cloud-native 5G core network** (Aether SD-Core) running the complete set of 3GPP network functions.
- An **open-source 5G gNodeB** (srsRAN) with ORAN Split 7.2 fronthaul to a Radio Unit.
- A **real-time, DPDK-accelerated** system capable of handling live over-the-air traffic.
- A **standards-compliant** deployment that a commercial UE (phone or modem) can attach to, authenticate against, establish a PDU session on, and pass user-plane traffic through.

This is not a simulation. When you finish, you will have a real private 5G cell that devices connect to and route IP traffic through.

<!-- IMAGE PLACEHOLDER: High-level diagram showing the complete lab setup — UE connecting over the air to a Radio Unit, fronthaul to the server running srsRAN DU and Aether SD-Core, with data path out to the internet. -->

## Why Aether SD-Core

Several open-source 5G core implementations exist. We chose **Aether SD-Core** (from the Open Networking Foundation) for the following reasons:

| Criterion | Aether SD-Core | Open5GS |
|---|---|---|
| **Architecture** | Cloud-native, microservices from the ground up | Monolithic processes, systemd-managed |
| **Orchestration** | Kubernetes-native with Helm charts | Manual process management or custom scripts |
| **Backing** | Linux Foundation / ONF, carrier-grade lineage | Community-driven |
| **Edge Design** | Purpose-built for edge deployments via the Aether platform | Primarily designed for lab/research |
| **Automation** | Aether OnRamp provides turnkey deployment tooling | Manual configuration |
| **User Plane** | High-performance UPF (BESS-based) with DPDK support | GTP-U via kernel networking |
| **Configuration** | REST API and centralized config via ROC/Connectivity Service | Config files per NF |

:::tip
If you are coming from an Open5GS background, the core 3GPP concepts (AMF, SMF, UPF, etc.) are identical. The difference is operational: SD-Core deploys as containers orchestrated by Kubernetes, making it far easier to manage, upgrade, and scale.
:::

Aether SD-Core is the mobile core component of the broader **Aether platform**, which includes the SD-RAN controller, Runtime Operational Control (ROC), and monitoring/observability stacks. This tutorial focuses on SD-Core itself, but the architecture is designed so you can layer on additional Aether components later.

## Why srsRAN

The gNodeB (gNB) is the radio access network element that bridges the air interface to the core. We chose **srsRAN Project** because:

- **Only open-source gNB with ORAN Split 7.2 support.** This is the critical differentiator. ORAN Split 7.2 separates the Distributed Unit (DU) from the Radio Unit (RU) over a standardized eCPRI fronthaul, letting you use commercial off-the-shelf RUs.
- **DPDK-accelerated fronthaul.** The DU uses DPDK for wire-speed packet processing on the fronthaul interface, which is essential for meeting the strict timing requirements of Split 7.2.
- **Active development.** srsRAN Project (the 5G NR stack from SRS, distinct from the older srsLTE/srsRAN 4G) has frequent releases, an active community, and commercial backing from Software Radio Systems.
- **Standards compliance.** Implements 3GPP Release 17 features and passes interoperability testing with multiple commercial RUs and cores.

:::note
srsRAN Project is the 5G NR-only stack. It is a separate codebase from the older srsRAN 4G (formerly srsLTE). Throughout this tutorial, "srsRAN" refers to the **srsRAN Project** 5G NR stack unless stated otherwise.
:::

## Tutorial Organization

The tutorial is divided into **10 sections**, designed to be followed in order:

| Section | Title | What You Will Do |
|---|---|---|
| **01** | Getting Started | Understand the architecture, gather hardware, verify prerequisites (you are here) |
| **02** | System Preparation | Install Ubuntu, RT kernel, configure BIOS, CPU isolation, hugepages |
| **03** | Network Configuration | Set up DPDK, bind NICs, configure VLANs, IP addressing |
| **04** | Timing & Synchronization | Configure PTP (IEEE 1588), SyncE, or GPS-based timing for fronthaul |
| **05** | RAN Deployment | Build and configure srsRAN, connect to the Radio Unit |
| **06** | Core Network | Deploy SD-Core network functions, configure subscribers |
| **07** | Integration & Testing | End-to-end testing, UE attach, PDU session, throughput validation |
| **08** | Kubernetes Deployment | Migrate from bare-metal to a Kubernetes-orchestrated deployment |
| **09** | Advanced Topics | Monitoring, multi-slice, QoS, troubleshooting |
| **10** | Reference | Configuration references, glossary, troubleshooting index |

Each section builds on the previous one. However, individual pages within a section are self-contained enough that you can return to them as reference material after your initial build.

## Conventions Used in This Tutorial

### Command Prompts

Commands you run as a regular user are shown with a `$` prompt:

```bash
$ kubectl get pods -n aether
```

Commands that require root privileges are shown with a `#` prompt:

```bash
# apt-get install linux-image-realtime
```

Alternatively, `sudo` is shown explicitly when used:

```bash
$ sudo tuned-adm profile realtime
```

### Placeholders

Values you must replace with your own are shown in angle brackets:

```
--amf-addr <AMF_IP_ADDRESS>
```

Or in `UPPER_SNAKE_CASE` when inline:

```bash
$ ping CORE_SERVER_IP
```

### File Paths

Configuration file paths are shown as absolute paths. When a file is being created or edited, the full path is given at the top of the code block:

```yaml title="/etc/srsran/gnb.yaml"
amf:
  addr: 10.100.1.1
```

### Admonitions

Throughout the tutorial, colored callout boxes convey specific meanings:

:::note
**Notes** provide additional context or background information that is helpful but not critical.
:::

:::tip
**Tips** offer shortcuts, best practices, or alternative approaches that can save you time.
:::

:::warning
**Warnings** highlight common mistakes or configurations that could cause subtle problems if overlooked.
:::

:::danger
**Danger** boxes flag actions that can cause data loss, system instability, or security issues if performed incorrectly.
:::

### Cross-References

Links to other pages in the tutorial use relative paths, for example: [CPU Isolation](../02-system-preparation/04-cpu-isolation.md). When a concept is explained in detail elsewhere, we link to it rather than repeating the explanation.

## Prerequisites

This tutorial assumes the following:

### Knowledge

- **Linux command line fluency.** You should be comfortable navigating the filesystem, editing configuration files, managing services with `systemctl`, and reading log output.
- **Basic IP networking.** You need to understand IP addresses, subnets, VLANs, routing, and how to use tools like `ip`, `ping`, and `tcpdump`.
- **Conceptual familiarity with containers.** You do not need to be a Kubernetes expert (we walk through everything), but knowing what a container and a pod are will help.

### Mindset

- **Willingness to work with real-time systems.** Parts of this build involve kernel tuning, CPU isolation, NUMA topology, and interrupt affinity. These are not typical application-development tasks, and they require patience and precision.
- **Comfort with debugging.** Integrating multiple open-source components means you will encounter version mismatches, configuration errors, and timing issues. The tutorial provides troubleshooting guidance, but an investigative mindset is essential.
- **Time.** A first-time build takes approximately **2-3 full days** of focused work. Subsequent rebuilds are much faster once you understand the components.

:::warning
This tutorial targets **Intel-based systems** exclusively. All kernel parameters, BIOS settings, and DPDK configurations use `intel_iommu=on` and assume Intel CPU features (SSE4.2, AVX-512, etc.). AMD-based systems require different IOMMU, hugepage, and CPU isolation configurations that are not covered here.
:::

## Next Steps

Start by reviewing the [Hardware Requirements](./02-hardware-requirements.md) to ensure you have (or can procure) the necessary equipment, then move on to the [Architecture Overview](./03-architecture-overview.md) to understand how all the pieces fit together.
