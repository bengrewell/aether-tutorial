---
id: faq
title: Frequently Asked Questions
sidebar_label: FAQ
sidebar_position: 4
description: >
  Answers to frequently asked questions about building a private 5G lab with Aether
  SD-Core and srsRAN, covering hardware choices, software alternatives, costs,
  spectrum licensing, performance expectations, and community support.
keywords:
  - 5G FAQ
  - private 5G questions
  - srsRAN FAQ
  - hardware cost 5G
  - AMD vs Intel 5G
  - SDR vs ORAN
  - spectrum license
  - Open5GS vs SD-Core
  - 5G throughput
  - community support
---

# Frequently Asked Questions

Common questions and answers about building a private 5G lab with Aether SD-Core and srsRAN.

---

## Hardware

### Can I use AMD processors instead of Intel?

**Yes**, but with some differences to be aware of:

- **IOMMU**: Use `amd_iommu=on` instead of `intel_iommu=on` in your GRUB parameters. The rest of the IOMMU configuration is the same.
- **DPDK drivers**: DPDK itself is processor-agnostic, but if you are using an Intel E810 NIC, the `ice` kernel driver and DPDK PMD work identically on AMD platforms.
- **No E810 GNSS**: The Intel E810's GNSS feature (SMA input for GNSS antenna) works on AMD systems — it is a NIC feature, not a CPU feature. However, some BIOS-level PTP configurations may differ.
- **CPU isolation**: The `isolcpus`, `nohz_full`, and `rcu_nocbs` parameters work the same way, but AMD's SMT (Simultaneous Multithreading) topology may differ from Intel's Hyper-Threading. Use `lscpu --extended` to verify core/thread mapping.
- **Power management**: Replace `intel_pstate=disable` with `amd_pstate=disable` or use `cpufreq.default_governor=performance` for AMD platforms.
- **Real-time performance**: AMD EPYC and Ryzen processors can achieve excellent real-time latency with PREEMPT_RT. Ensure you disable all C-states and frequency scaling in the BIOS, just as you would with Intel.

:::tip
Several community members have successfully built srsRAN Split 7.2 labs on AMD Ryzen 7000 and EPYC platforms. The key requirement is a CPU with enough cores to dedicate to both gNB real-time threads and system housekeeping.
:::

---

### Can I use a different NIC instead of the Intel E810?

**It is possible, but the E810 is the best-supported option** for this specific workload. Here is why:

| Feature | Intel E810 | Mellanox ConnectX-5/6 | Other NICs |
|---|---|---|---|
| DPDK PMD | Mature (`ice` PMD) | Mature (`mlx5` PMD) | Varies |
| Hardware PTP timestamping | Yes | Yes | Some |
| GNSS input (SMA) | Yes (built-in) | No | No |
| SR-IOV | Yes (up to 256 VFs) | Yes | Some |
| srsRAN OFH testing | Primary test platform | Community-tested | Limited |
| Price | $300-500 | $200-600 | Varies |

If you use a **Mellanox/NVIDIA ConnectX** NIC:
- You will need an external GNSS receiver or a separate PTP Grandmaster device.
- The DPDK EAL arguments and PMD driver names change (`-a` flag BDF is the same, but driver internals differ).
- The srsRAN OFH library should work, but you may need to adjust DPDK configuration.

If you use any other NIC, verify it supports: (1) DPDK with a stable PMD, (2) hardware PTP timestamping, and (3) SR-IOV if you plan to run Kubernetes workloads. Without all three, you will face significant limitations.

---

### How much does the hardware cost?

Rough estimates for a minimal private 5G lab (as of 2025/2026, USD):

| Component | Estimated Cost | Notes |
|---|---|---|
| Server (Intel Xeon / AMD EPYC) | $2,000 - $5,000 | Used/refurbished rack server works well. Needs 20+ cores, 64+ GB RAM. |
| Intel E810 NIC (100GbE or 25GbE) | $300 - $500 | The E810-XXVDA4 (4x25G) is a common choice. Available on eBay and from distributors. |
| O-RAN Radio Unit | $1,000 - $10,000+ | The biggest cost variable. Benetel, Foxconn, Compal, and others make n78 RUs. Prices vary widely. |
| GNSS antenna + cable | $30 - $100 | A basic active GPS/GNSS antenna with SMA connector. |
| Programmable SIM cards | $10 - $50 | sysmoUSIM-SJS1 or similar. You need at least 2-3 for testing. |
| SIM card reader/writer | $15 - $30 | A PC/SC compatible USB reader (e.g., Omnikey, HID). |
| Ethernet switch (optional) | $0 - $500 | Direct connect works. If you need a switch, a PTP-aware managed switch is recommended. |
| RF cables, attenuators, enclosure | $50 - $300 | SMA/N-type cables, 30-40 dB attenuators for bench testing, optional RF shielded box. |
| **Total** | **$3,500 - $16,000+** | Heavily depends on RU choice and whether you buy new or used. |

:::note
The single largest cost is the Radio Unit. For initial learning and development, you can use srsRAN's ZMQ-based simulated RF to avoid the RU cost entirely, then add real hardware later. See the SDR question below.
:::

---

## Software Alternatives

### Can I skip Kubernetes and run everything on bare metal?

**Yes.** Sections 01 through 07 of this tutorial cover a fully bare-metal deployment:

- The gNB runs as a native Linux binary.
- SD-Core NFs can be run as Docker containers without Kubernetes using `docker-compose`.
- PTP, DPDK, and all system preparation steps are bare-metal by nature.

Sections 08 (Kubernetes Deployment) and 09 (Advanced Topics) are optional extensions for those who want a production-like cloud-native deployment. You can skip them entirely and still have a fully working private 5G network.

The trade-offs of bare metal vs. Kubernetes:

| Aspect | Bare Metal | Kubernetes |
|---|---|---|
| Complexity | Lower | Higher |
| Setup time | Faster | Slower (initial cluster setup) |
| Lifecycle management | Manual (systemd, scripts) | Automated (Helm, rollbacks) |
| Scaling | Manual | Automated |
| Resource isolation | Manual (cgroups, taskset) | Built-in (CPU manager, SR-IOV plugin) |
| Recommended for | Learning, small labs | Production, multi-cell, CI/CD |

---

### Can I use SDR (Software-Defined Radio) instead of an O-RAN RU?

**srsRAN supports multiple radio front-ends**, but this tutorial focuses specifically on O-RAN Split 7.2 with a hardware RU. Here are your options:

1. **ZMQ (Zero MQ) — No RF hardware at all.** srsRAN can simulate the RF interface entirely in software using ZMQ sockets. This is ideal for learning the protocol stack, testing core network integration, and CI/CD pipelines. You lose real over-the-air operation but gain zero hardware cost.

2. **USRP (Split 8) — SDR approach.** srsRAN supports Ettus Research USRP devices (B200, B210, X310, N310) for Split 8 (full-stack) operation. The gNB performs all PHY processing and directly drives the SDR's ADC/DAC. This gives real over-the-air operation at lower cost than an ORAN RU, but:
   - Bandwidth is limited by the SDR's capabilities (B210: 56 MHz instantaneous BW).
   - No DPDK fronthaul — the CPU handles all RF sample I/O.
   - Different build and configuration than Split 7.2.

3. **O-RAN Split 7.2 (this tutorial).** Uses a standards-compliant RU with DPDK-accelerated fronthaul. This is the architecture used in production deployments and is the focus of this guide.

:::tip
If you are starting from scratch and want to validate your core network and gNB configuration before investing in an RU, start with ZMQ. The srsRAN project provides [ZMQ documentation](https://docs.srsran.com/projects/project/en/latest/tutorials/source/srsUE/source/index.html) and example configurations.
:::

---

### Can I use Open5GS instead of Aether SD-Core?

**Yes.** The system preparation (Sections 01-04) and RAN deployment (Sections 05-07) are identical regardless of which core network you use. The gNB connects to any 3GPP-compliant AMF via the standard NGAP/SCTP interface.

If you choose Open5GS:
- Skip Sections 06 (Core Network) and 08 (Kubernetes Deployment) or adapt them.
- Install Open5GS using its own [documentation](https://open5gs.org/open5gs/docs/).
- Configure the AMF IP address in `gnb.yml` to point to the Open5GS AMF.
- Provision subscribers in the Open5GS WebUI instead of the SD-Core ROC.

The primary reasons this tutorial uses SD-Core are its cloud-native architecture, Kubernetes integration, and the Aether OnRamp automation tooling. See the [Introduction](../01-getting-started/01-introduction.md) for a detailed comparison.

---

## Spectrum and Licensing

### Do I need a spectrum license?

**It depends on your country and how you plan to operate:**

- **United States — CBRS (Band 48, 3550-3700 MHz):** The CBRS band provides General Authorized Access (GAA) spectrum that does not require an individual license, though you must use a certified CBRS device and register with a Spectrum Access System (SAS). For a lab environment, this is the most accessible option.

- **United States — Lab use with shielding:** If your setup is entirely contained within an RF-shielded enclosure (Faraday cage) and does not emit radiation outside the enclosure, it may fall under FCC Part 15 experimental use exemptions. However, this is a gray area — consult FCC regulations or a spectrum attorney.

- **Europe:** Many countries offer local/private 5G spectrum in the 3.8-4.2 GHz range. Germany, UK, France, and others have specific frameworks for private network licenses.

- **Band n78 (3300-3800 MHz):** This is the most common NR band for private 5G globally, but it is licensed spectrum in most jurisdictions. You need either a license, a CBRS-like shared access framework, or a shielded environment.

:::warning
Operating a radio transmitter without appropriate authorization is illegal in most countries and can result in significant fines. Always verify your local regulations before transmitting. For pure lab/development work, an RF-shielded enclosure is the safest approach.
:::

---

## Performance

### What throughput can I expect?

Throughput depends on several factors. Here are theoretical peak values for common configurations in Band n78 (TDD):

| Configuration | DL Peak (Theory) | UL Peak (Theory) | Notes |
|---|---|---|---|
| 20 MHz, 2x2 MIMO, 30 kHz SCS | ~80 Mbps | ~30 Mbps | Minimum practical BW for NR |
| 40 MHz, 2x2 MIMO, 30 kHz SCS | ~160 Mbps | ~60 Mbps | Good for initial testing |
| 100 MHz, 2x2 MIMO, 30 kHz SCS | ~400 Mbps | ~150 Mbps | Common lab configuration |
| 100 MHz, 4x4 MIMO, 30 kHz SCS | ~800 Mbps | ~300 Mbps | Requires 4T4R RU |

**Real-world throughput** will be lower due to:
- TDD pattern overhead (the 7:2 DL:UL ratio used in this tutorial allocates ~70% of slots to DL).
- Control channel overhead (PDCCH, DMRS, SSB, SIB, PRACH).
- HARQ retransmissions.
- MCS limited by actual channel conditions (SNR).
- Protocol overhead (GTP-U, IP, TCP/UDP headers).

A realistic expectation for a **100 MHz, 4x4 MIMO** lab setup is **400-500 Mbps DL** and **100-150 Mbps UL** as measured by iPerf3 at the application layer.

:::tip
To maximize throughput in your lab:
1. Use the highest MCS the channel supports (place the UE close to the RU with good SNR).
2. Use 100 MHz bandwidth if your RU and license support it.
3. Use 4x4 MIMO if your RU supports 4T4R.
4. Optimize the TDD pattern for your traffic profile (more DL slots = higher DL throughput).
5. Ensure the UPF and backhaul network are not bottlenecks.
:::

---

## Maintenance

### How do I update srsRAN?

To update srsRAN to the latest version:

```bash
# Navigate to the srsRAN source directory
cd ~/srsRAN_Project

# Fetch and pull the latest changes
git fetch origin
git pull origin main

# Clean and rebuild
cd build
cmake ..
make -j$(nproc)

# Optionally install system-wide
sudo make install
```

After rebuilding:
1. Stop the running gNB process.
2. Review the [srsRAN changelog](https://github.com/srsran/srsRAN_Project/releases) for any configuration file changes.
3. Update `gnb.yml` if the new version introduces new required parameters or deprecates old ones.
4. Restart the gNB with the updated binary.

:::caution
Major version updates may change configuration file format or default behavior. Always read the release notes before updating. For production systems, test the new version in a staging environment first.
:::

---

## Getting Help

### Where can I get help if I am stuck?

There are several community resources available:

1. **srsRAN GitHub Discussions:** [github.com/srsran/srsRAN_Project/discussions](https://github.com/srsran/srsRAN_Project/discussions) — The primary support channel for srsRAN. Search existing discussions before posting a new question.

2. **ONF Community / Aether Slack:** The Open Networking Foundation maintains community channels for SD-Core and Aether. Visit [opennetworking.org](https://opennetworking.org) for Slack workspace invitations.

3. **3GPP and O-RAN specifications:** For protocol-level questions, the authoritative source is always the 3GPP and O-RAN Alliance specifications. See [External Resources](./05-external-resources.md) for links.

4. **This tutorial's repository:** If you find errors or have suggestions for this tutorial, open an issue or pull request in the tutorial's GitHub repository.

5. **Community blogs and forums:**
   - [Nils Fuerste's blog](https://nilsfuerste.com) — Detailed write-ups on srsRAN with ORAN Split 7.2.
   - Reddit r/cellular and r/networking communities.
   - Various Telegram and Discord groups focused on open-source telecom.

**When asking for help, include:**
- Your hardware configuration (CPU, NIC model, RU model).
- The exact software versions (srsRAN commit hash, kernel version, DPDK version).
- The full error message or log snippet.
- The relevant configuration file sections.
- What you have already tried.
