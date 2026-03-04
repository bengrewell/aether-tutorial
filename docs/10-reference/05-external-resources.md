---
id: external-resources
title: External Resources
sidebar_label: External Resources
sidebar_position: 5
description: >
  Curated collection of external documentation, specifications, tools, and community
  resources for building and operating a private 5G network with Aether SD-Core,
  srsRAN, O-RAN, DPDK, and PTP.
keywords:
  - 5G resources
  - srsRAN documentation
  - Aether documentation
  - ORAN specifications
  - 3GPP specifications
  - LinuxPTP
  - DPDK documentation
  - Intel E810
  - 5G community
  - open-source telecom
---

# External Resources

A curated collection of documentation, specifications, tools, and community resources relevant to the Aether SD-Core + srsRAN private 5G lab. Links are organized by category.

---

## srsRAN

| Resource | URL | Description |
|---|---|---|
| srsRAN Documentation | [docs.srsran.com](https://docs.srsran.com) | Official documentation covering installation, configuration, tutorials, and API reference for the srsRAN Project (gNB). |
| srsRAN GitHub Repository | [github.com/srsran/srsRAN_Project](https://github.com/srsran/srsRAN_Project) | Source code for the srsRAN 5G gNB. Includes build instructions, example configs, and CI/CD workflows. |
| srsRAN GitHub Discussions | [github.com/srsran/srsRAN_Project/discussions](https://github.com/srsran/srsRAN_Project/discussions) | Community Q&A forum. Search here first when troubleshooting — many common issues have already been discussed and resolved. |
| srsRAN 4G (legacy) | [github.com/srsran/srsRAN_4G](https://github.com/srsran/srsRAN_4G) | The legacy 4G LTE suite (srsUE, srsENB, srsEPC). Useful if you need a software UE for testing or LTE interworking. |

:::tip
When referencing srsRAN documentation, ensure you are looking at the **srsRAN Project** (5G) docs and not the older **srsRAN 4G** docs. The two projects have separate documentation sites.
:::

---

## Aether / SD-Core

| Resource | URL | Description |
|---|---|---|
| Aether Project Documentation | [docs.aetherproject.org](https://docs.aetherproject.org) | Official Aether documentation covering architecture, deployment guides (OnRamp), and operations. |
| SD-Core Overview | [opennetworking.org/sd-core](https://opennetworking.org/sd-core) | ONF's SD-Core product page with architecture overviews, feature descriptions, and use cases. |
| ONF GitHub (SD-Core) | [github.com/omec-project](https://github.com/omec-project) | Source code repositories for SD-Core components (AMF, SMF, UPF, NRF, AUSF, UDM, etc.). |
| Aether OnRamp | [docs.aetherproject.org/master/onramp](https://docs.aetherproject.org/master/onramp) | Automated deployment tooling for Aether, including single-node and multi-node Kubernetes setups. |
| SD-Core Helm Charts | [github.com/omec-project/sdcore-helm-charts](https://github.com/omec-project/sdcore-helm-charts) | Helm charts for deploying SD-Core on Kubernetes. Includes default values files with all configurable parameters. |

---

## O-RAN Alliance

| Resource | URL | Description |
|---|---|---|
| O-RAN Alliance | [o-ran.org](https://www.o-ran.org) | The O-RAN Alliance home page. Publishes specifications for open RAN interfaces, including the fronthaul (WG4). |
| O-RAN Specifications | [specifications.o-ran.org](https://specifications.o-ran.org) | Public access to released O-RAN specifications. Key documents for this tutorial: WG4 (Open Fronthaul), WG1 (Use Cases), WG6 (Cloudification). |
| O-RAN Software Community (OSC) | [o-ran-sc.org](https://o-ran-sc.org) | Open-source software implementations aligned with O-RAN specifications, including the Near-RT RIC and related components. |

:::note
Access to some O-RAN specifications requires an O-RAN Alliance membership. However, many foundational documents and technical reports are publicly available.
:::

---

## 3GPP Specifications

The 3GPP specifications are the authoritative source for all 5G NR protocol definitions. Key specifications referenced in this tutorial:

| Specification | Title | Relevance |
|---|---|---|
| **TS 38.104** | NR: Base Station (BS) radio transmission and reception | Defines frequency bands, channel bandwidths, ARFCNs, and RF requirements. Use this to look up band n78 parameters. |
| **TS 38.211** | NR: Physical channels and modulation | Defines the physical layer structure: resource grids, OFDM parameters, reference signals (DMRS, PTRS, SRS), and synchronization signals (PSS, SSS). |
| **TS 38.212** | NR: Multiplexing and channel coding | Defines channel coding (LDPC, polar codes), rate matching, and transport channel processing. |
| **TS 38.213** | NR: Physical layer procedures for control | Defines PDCCH, DCI formats, PUCCH, HARQ-ACK, and CSI reporting procedures. |
| **TS 38.214** | NR: Physical layer procedures for data | Defines PDSCH and PUSCH procedures, MCS tables, MIMO configurations, and scheduling. |
| **TS 38.331** | NR: Radio Resource Control (RRC) protocol | Defines RRC connection establishment, reconfiguration, measurement, handover, and all RRC information elements. Essential for understanding gNB-UE signaling. |
| **TS 38.401** | NR: NG-RAN architecture description | Defines the overall RAN architecture, including CU/DU split, F1/E1 interfaces, and NG interface to the core. |
| **TS 23.501** | System architecture for the 5G System | Defines the 5G core network architecture, network functions (AMF, SMF, UPF, etc.), reference points, and service-based architecture. |
| **TS 23.502** | Procedures for the 5G System | Defines the call flows for registration, PDU session establishment, handover, and other 5GS procedures. |
| **TS 33.501** | Security architecture and procedures for 5G | Defines 5G-AKA authentication, NAS/AS security, key derivation, and SUCI/SUPI privacy mechanisms. |

Access 3GPP specifications at [3gpp.org/specifications](https://www.3gpp.org/specifications) or search the specification database at [portal.3gpp.org](https://portal.3gpp.org).

---

## LinuxPTP

| Resource | URL | Description |
|---|---|---|
| LinuxPTP Project | [linuxptp.sourceforge.net](https://linuxptp.sourceforge.net) | Home of the LinuxPTP project, which provides `ptp4l`, `phc2sys`, `ts2phc`, and related tools. |
| LinuxPTP Source Code | [git.code.sf.net/p/linuxptp/code](https://git.code.sf.net/p/linuxptp/code) | Git repository for LinuxPTP source code. |
| ptp4l Man Page | `man ptp4l` (installed with linuxptp) | Comprehensive reference for all `ptp4l` configuration options. |
| IEEE 1588-2019 | [standards.ieee.org](https://standards.ieee.org/standard/1588-2019.html) | The PTP v2.1 standard. Defines the protocol, profiles, and BMCA used by `ptp4l`. |

---

## DPDK

| Resource | URL | Description |
|---|---|---|
| DPDK Documentation | [doc.dpdk.org](https://doc.dpdk.org) | Official DPDK documentation, including the Getting Started Guide, Programmer's Guide, and API reference. |
| DPDK GitHub Repository | [github.com/DPDK/dpdk](https://github.com/DPDK/dpdk) | DPDK source code. Includes PMD drivers for Intel, Mellanox, and other NICs. |
| Intel E810 DPDK Guide | [doc.dpdk.org/guides/nics/ice.html](https://doc.dpdk.org/guides/nics/ice.html) | DPDK PMD documentation specific to the Intel E810 (ice driver). Covers features, limitations, and configuration. |
| DPDK Testpmd Guide | [doc.dpdk.org/guides/testpmd_app_ug](https://doc.dpdk.org/guides/testpmd_app_ug) | User guide for `dpdk-testpmd`, the DPDK packet forwarding test application used to validate NIC and hugepage setup. |

---

## Intel E810 / ice Driver

| Resource | URL | Description |
|---|---|---|
| Intel E810 Product Page | [intel.com/e810](https://www.intel.com/content/www/us/en/products/details/ethernet/800-controllers.html) | Intel Ethernet 800 Series product family page with datasheets and specifications. |
| ice Driver Downloads | [sourceforge.net/projects/e1000](https://sourceforge.net/projects/e1000/files/ice%20stable/) | Out-of-tree `ice` kernel driver releases. May be needed for newer NIC firmware features not yet in the Ubuntu kernel. |
| Intel E810 GNSS / SyncE Documentation | [github.com/intel/ethernet-linux-ice](https://github.com/intel/ethernet-linux-ice) | Intel's out-of-tree ice driver repository with documentation on GNSS, SyncE, and PTP pin configuration. |
| Intel DDP (Dynamic Device Personalization) | [downloadcenter.intel.com](https://www.intel.com/content/www/us/en/download/19660/intel-network-adapter-driver-for-e810-series-devices-under-linux.html) | DDP profiles for the E810 that enable advanced packet classification features. |

---

## Community Resources

| Resource | URL | Description |
|---|---|---|
| Nils Fuerste's Blog | [nilsfuerste.com](https://nilsfuerste.com) | Detailed technical blog posts about building private 5G networks with srsRAN and O-RAN Split 7.2. Includes hardware recommendations, configuration guides, and performance measurements. Highly recommended. |
| OpenAirInterface (OAI) | [openairinterface.org](https://openairinterface.org) | An alternative open-source 5G RAN and core network implementation. Useful for comparison and reference, though this tutorial focuses on srsRAN. |
| Magma | [magmacore.org](https://magmacore.org) | An open-source mobile core network platform from the Linux Foundation, focused on access network agnostic connectivity. |
| Open5GS | [open5gs.org](https://open5gs.org) | An open-source 5G core and EPC implementation. A popular alternative to SD-Core, especially for smaller lab setups. See the [FAQ](./04-faq.md) for a comparison. |
| free5GC | [free5gc.org](https://free5gc.org) | Another open-source 5G core implementation, developed at NCTU in Taiwan. Kubernetes-native with Go-based NFs. |
| Telecom Infra Project (TIP) | [telecominfraproject.com](https://telecominfraproject.com) | An industry initiative for open, disaggregated telecom infrastructure. Runs OpenRAN and other working groups. |

---

## Tools

### pySim — SIM Card Programming

| Resource | URL | Description |
|---|---|---|
| pySim GitHub | [github.com/osmocom/pysim](https://github.com/osmocom/pysim) | Python tool for reading, writing, and programming SIM/USIM/ISIM cards. Essential for provisioning test SIMs with IMSI, Ki, OPc, and PLMN values. |
| pySim Documentation | [osmocom.org/projects/pysim/wiki](https://osmocom.org/projects/pysim/wiki) | Usage documentation and supported card types. |

Common pySim commands for this tutorial:

```bash
# Read SIM card contents
pySim-read.py -p 0

# Program a test SIM with IMSI, Ki, OPc, and PLMN
pySim-prog.py -p 0 \
  -t sysmoUSIM-SJS1 \
  -i 001010000000001 \
  -k 00112233445566778899AABBCCDDEEFF \
  -o 00112233445566778899AABBCCDDEEFF \
  -x 001 -y 01 \
  --mcc 001 --mnc 01
```

### Wireshark — Protocol Analysis

| Resource | URL | Description |
|---|---|---|
| Wireshark | [wireshark.org](https://www.wireshark.org) | Network protocol analyzer with built-in dissectors for 5G NR protocols (NGAP, NAS-5G, GTP-U, RRC, MAC, RLC, PDCP, F1AP, E1AP, eCPRI). |
| 5G NR Wireshark Filters | See below | Useful display filters for 5G protocol analysis. |

Useful Wireshark display filters for 5G debugging:

```
# NGAP (gNB <-> AMF signaling)
ngap

# NAS 5G (UE <-> AMF signaling, carried within NGAP)
nas-5gs

# GTP-U (user plane tunneling)
gtp

# SCTP (transport for NGAP)
sctp

# eCPRI (O-RAN fronthaul)
ecpri

# Filter by specific message type
ngap.procedureCode == 15     # InitialUEMessage
ngap.procedureCode == 21     # NGSetupRequest
nas-5gs.mm.message_type == 65  # Registration Request
```

### iPerf3 — Throughput Testing

| Resource | URL | Description |
|---|---|---|
| iPerf3 | [iperf.fr](https://iperf.fr) | Network throughput measurement tool. The standard tool for measuring end-to-end throughput through the 5G network. |

Common iPerf3 commands for 5G lab testing:

```bash
# Start server on the DN side (or UPF host)
iperf3 -s -p 5201

# Downlink test (run from UE or a device behind the UE)
iperf3 -c <server-ip> -p 5201 -t 30 -P 4

# Uplink test
iperf3 -c <server-ip> -p 5201 -t 30 -P 4 -R

# UDP test with target bitrate (useful for checking throughput ceiling)
iperf3 -c <server-ip> -p 5201 -t 30 -u -b 500M
```

### Other Useful Tools

| Tool | Purpose | URL |
|---|---|---|
| `cyclictest` | Measure real-time scheduling latency on the RT kernel. | Part of `rt-tests` package (`sudo apt install rt-tests`). |
| `hwlatdetect` | Detect hardware-induced latency spikes (SMI, NMI). | Part of `rt-tests` package. |
| `dpdk-devbind.py` | Bind/unbind NICs to/from DPDK-compatible drivers. | Included with DPDK (`dpdk-dev` package). |
| `ethtool` | Query NIC capabilities, firmware version, PTP support, and statistics. | `sudo apt install ethtool`. |
| `cpupower` | Query and set CPU frequency governor and C-state settings. | `sudo apt install linux-tools-common`. |
| `turbostat` | Monitor CPU frequency, C-states, and power consumption in real time. | Part of `linux-tools` package. |
| `numactl` | Control NUMA node affinity for processes and memory allocation. | `sudo apt install numactl`. |
| `taskset` | Set CPU affinity for running processes. | Part of `util-linux` (installed by default). |
| `tcpdump` | Capture packets on specific interfaces for protocol analysis. | `sudo apt install tcpdump`. |
| `ptp4l`, `phc2sys`, `ts2phc` | PTP clock synchronization tools. | `sudo apt install linuxptp`. |
