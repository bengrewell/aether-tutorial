---
id: configuration-reference
title: Configuration Reference
sidebar_label: Configuration Reference
sidebar_position: 1
description: >
  Complete, copy-pasteable configuration file templates for TuneD, GRUB, PTP, gNB,
  Netplan, and systemd services used throughout the Aether SD-Core + srsRAN private 5G
  tutorial.
keywords:
  - configuration reference
  - TuneD profile
  - GRUB parameters
  - ptp4l configuration
  - ts2phc configuration
  - phc2sys
  - gNB YAML
  - Netplan
  - srsRAN config
  - 5G NR configuration
---

# Configuration Reference

This page consolidates every major configuration file used throughout the tutorial into a single reference. Each template is copy-pasteable and annotated with inline comments explaining every parameter. Adjust values to match your specific hardware, network topology, and spectrum allocation.

:::tip
These templates correspond to the configurations built up incrementally in earlier sections. If you are looking for the reasoning behind a particular setting, cross-reference the relevant tutorial section:

- TuneD and GRUB: [Real-Time Kernel](../02-system-preparation/02-realtime-kernel.md)
- PTP: [PTP Overview](../04-timing-synchronization/01-ptp-overview.md)
- gNB: [RAN Deployment](../05-ran-deployment/01-srsran-overview.md) (if available)
- Netplan: [Network Topology](../03-network-configuration/01-network-topology.md)
:::

---

## TuneD Profile

TuneD applies system-level tuning for real-time performance. The profile consists of a `tuned.conf` descriptor and an optional `script.sh` that runs at profile activation.

### tuned.conf

Create this file at `/etc/tuned/realtime-5g/tuned.conf`:

```ini
#
# TuneD profile for 5G DU workloads
# Inherits from the realtime base profile and adds 5G-specific overrides.
#

[main]
summary=Real-time profile optimized for 5G DU / O-RAN Split 7.2
include=realtime

[variables]
# Cores isolated for the gNB real-time threads.
# Adjust to match your hardware. Use lscpu to identify cores.
# Example: cores 4-19 on a 20-core Xeon.
isolated_cores=4-19

# Cores reserved for housekeeping (kernel threads, IRQs, OS services).
housekeeping_cores=0-3

[bootloader]
# These are APPENDED to the kernel command line via GRUB.
# They mirror the GRUB parameters section below but are managed by TuneD
# so that activating the profile automatically applies them.
cmdline_realtime=+isolcpus=managed_irq,domain,${isolated_cores} intel_pstate=disable nosoftlockup tsc=reliable

[sysctl]
# Disable watchdog timers that cause latency spikes on isolated cores.
kernel.nmi_watchdog=0
kernel.watchdog=0

# Increase maximum locked memory (needed for DPDK hugepage mapping).
vm.max_map_count=1048576

# Network tuning for high-throughput fronthaul.
net.core.rmem_max=16777216
net.core.wmem_max=16777216
net.core.rmem_default=16777216
net.core.wmem_default=16777216
net.core.netdev_max_backlog=5000

[scheduler]
# Move all unpinned kernel threads to housekeeping cores.
isolated_cores=${isolated_cores}

[irqbalance]
# Prevent IRQ balancer from placing interrupts on isolated cores.
banned_cpus=${isolated_cores}

[script]
# Run the companion script at profile activation.
script=${i:PROFILE_DIR}/script.sh
```

### script.sh

Create this file at `/etc/tuned/realtime-5g/script.sh` and make it executable (`chmod +x`):

```bash
#!/bin/bash
#
# TuneD activation script for the realtime-5g profile.
# Runs once when the profile is applied.
#

. /usr/lib/tuned/functions

start() {
    # Disable kernel transparent huge pages — they cause unpredictable latency spikes
    # when the kernel compacts memory in the background.
    echo never > /sys/kernel/mm/transparent_hugepage/enabled
    echo never > /sys/kernel/mm/transparent_hugepage/defrag

    # Disable machine-check exception logging on isolated cores (reduces jitter).
    # This writes 0 to /sys/devices/system/machinecheck/machinecheck<N>/check_interval
    # for every isolated core.
    for cpu in $(cat /sys/devices/system/cpu/isolated); do
        if [ -f /sys/devices/system/machinecheck/machinecheck${cpu}/check_interval ]; then
            echo 0 > /sys/devices/system/machinecheck/machinecheck${cpu}/check_interval
        fi
    done

    return 0
}

stop() {
    # Re-enable transparent huge pages on profile deactivation.
    echo madvise > /sys/kernel/mm/transparent_hugepage/enabled
    echo madvise > /sys/kernel/mm/transparent_hugepage/defrag
    return 0
}

process $@
```

Apply the profile:

```bash
sudo tuned-adm profile realtime-5g
sudo tuned-adm verify
```

---

## GRUB Parameters

Edit `/etc/default/grub` and set the `GRUB_CMDLINE_LINUX_DEFAULT` line. If you are using TuneD with the `[bootloader]` section above, TuneD manages these parameters for you. If you prefer manual control, use the following:

```bash
GRUB_CMDLINE_LINUX_DEFAULT="default_hugepagesz=1G hugepagesz=1G hugepages=16 hugepagesz=2M hugepages=1024 isolcpus=managed_irq,domain,4-19 nohz_full=4-19 rcu_nocbs=4-19 rcu_nocb_poll kthread_cpus=0-3 irqaffinity=0-3 intel_pstate=disable intel_iommu=on iommu=pt nosoftlockup tsc=reliable nmi_watchdog=0 audit=0 mce=off processor.max_cstate=0 idle=poll"
```

**Parameter breakdown:**

| Parameter | Purpose |
|---|---|
| `default_hugepagesz=1G hugepagesz=1G hugepages=16` | Reserve 16 x 1 GB hugepages for DPDK |
| `hugepagesz=2M hugepages=1024` | Reserve 1024 x 2 MB hugepages for general use |
| `isolcpus=managed_irq,domain,4-19` | Isolate cores 4-19 from the general scheduler and IRQ delivery |
| `nohz_full=4-19` | Disable periodic timer tick on isolated cores |
| `rcu_nocbs=4-19` | Offload RCU callbacks from isolated cores |
| `rcu_nocb_poll` | Use polling instead of interrupts for RCU offloaded callbacks |
| `kthread_cpus=0-3` | Confine unbound kernel threads to housekeeping cores |
| `irqaffinity=0-3` | Default IRQ affinity to housekeeping cores |
| `intel_pstate=disable` | Disable Intel P-state driver so TuneD/cpupower can set governors |
| `intel_iommu=on iommu=pt` | Enable IOMMU in passthrough mode (required for DPDK/SR-IOV) |
| `nosoftlockup` | Suppress soft lockup warnings on isolated cores |
| `tsc=reliable` | Trust the TSC as a clocksource (required for accurate DPDK timers) |
| `nmi_watchdog=0` | Disable NMI watchdog |
| `audit=0` | Disable audit subsystem (reduces jitter) |
| `mce=off` | Disable machine check exception polling |
| `processor.max_cstate=0` | Prevent CPU from entering any sleep state |
| `idle=poll` | Use polling idle loop instead of halt (lowest latency, highest power) |

After editing, apply and reboot:

```bash
sudo update-grub
sudo reboot
```

:::caution
`idle=poll` and `processor.max_cstate=0` keep all isolated cores at 100% power draw at all times. This is intentional for production RAN workloads. For lab use where power consumption matters, you may omit these and accept slightly higher worst-case latency.
:::

---

## PTP Configuration

### ptp4l — Grandmaster Mode

Use this configuration when the Intel E810 NIC has a GNSS antenna connected and acts as the PTP Grandmaster clock for the network segment. Create or edit `/etc/linuxptp/ptp4l-gm.conf`:

```ini
#
# ptp4l configuration — Grandmaster mode
# The E810 NIC receives GNSS time via its SMA connector and distributes
# it as a PTP Grandmaster to downstream devices (switches, RUs).
#

[global]
#
# --- Clock identity and priority ---
#
# Priority1 and priority2 control BMCA (Best Master Clock Algorithm).
# Lower values win. 128 is the default; set to lower values to prefer
# this clock over other potential GMs on the network.
priority1               128
priority2               128

#
# --- Domain ---
#
# PTP domain number. All devices in the same timing domain must share
# this value. Domain 0 is common; some operators use 24 or 44.
domainNumber            0

#
# --- Network transport ---
#
# Use L2 (Ethernet) transport. This avoids IP/UDP overhead and works
# without requiring IP configuration on the PTP VLAN.
network_transport       L2

#
# --- Profile ---
#
# Use the default E2E (end-to-end) delay mechanism.
delay_mechanism         E2E

#
# --- Timestamps ---
#
# Enable hardware timestamping. The E810 supports it natively.
time_stamping           hardware

#
# --- Servo ---
#
tx_timestamp_timeout    50
logging_level           6
verbose                 0
summary_interval        1

#
# --- Clock class ---
#
# clockClass 6 indicates a PTP GM locked to a primary reference (GNSS).
# When GNSS lock is lost, ptp4l will degrade this automatically.
clockClass              6
clockAccuracy           0x21
offsetScaledLogVariance 0x4E5D

#
# --- Announce / Sync intervals ---
#
# logAnnounceInterval 1 = one announce every 2 seconds.
# logSyncInterval -4 = 16 sync messages per second (62.5ms).
logAnnounceInterval     1
logSyncInterval         -4
logMinDelayReqInterval  -4

#
# --- Fault handling ---
#
announceReceiptTimeout  3

[ens2f0]
# Replace ens2f0 with your E810 PTP-capable interface name.
```

### ptp4l — Follower (Client) Mode

Use this on any device that synchronizes to a Grandmaster. Create or edit `/etc/linuxptp/ptp4l-follower.conf`:

```ini
#
# ptp4l configuration — Follower (client) mode
# This device synchronizes its NIC PHC to a PTP Grandmaster on the network.
#

[global]
#
# High priority1 value ensures this clock never becomes GM.
priority1               255
priority2               255

domainNumber            0
network_transport       L2
delay_mechanism         E2E
time_stamping           hardware

tx_timestamp_timeout    50
logging_level           6
verbose                 0
summary_interval        1

#
# Servo parameters
#
# PI servo gains — the defaults work well for most E810 setups.
# Increase step_threshold if initial convergence takes too long.
step_threshold          1.0
first_step_threshold    0.00002

logAnnounceInterval     1
logSyncInterval         -4
logMinDelayReqInterval  -4
announceReceiptTimeout  3

[ens2f0]
# Replace ens2f0 with your PTP-capable interface name.
```

---

### ts2phc Configuration

`ts2phc` disciplines the NIC PHC (PTP Hardware Clock) to a 1PPS signal from GNSS. Create or edit `/etc/linuxptp/ts2phc.conf`:

```ini
#
# ts2phc configuration — Synchronize NIC PHC to GNSS 1PPS
# Used on the Grandmaster host where the E810 has a GNSS antenna connected.
#

[global]
use_syslog              1
verbose                 0
logging_level           6

# The NMEA serial device for time-of-day information.
# On the E810, the GNSS serial port appears as /dev/gnss0 or a ttyGNSS device.
ts2phc.nmea_serialport  /dev/gnss0

# NMEA baud rate.
ts2phc.nmea_baudrate    9600

# Master mode: ts2phc reads 1PPS from the source and writes to the PHC.
ts2phc.pulsewidth       500000000

[ens2f0]
# Replace ens2f0 with the E810 interface connected to GNSS.
ts2phc.extts_polarity   rising
ts2phc.pin_index        0
```

---

### phc2sys systemd Service

`phc2sys` synchronizes the Linux system clock (CLOCK_REALTIME) to the NIC PHC. Create `/etc/systemd/system/phc2sys.service`:

```ini
[Unit]
Description=Synchronize system clock to NIC PTP Hardware Clock
Documentation=man:phc2sys(8)
After=ptp4l.service
Requires=ptp4l.service

[Service]
Type=simple

# -s <interface>: source PHC (the NIC interface running ptp4l)
# -c CLOCK_REALTIME: destination clock (system clock)
# -w: wait for ptp4l to synchronize before starting
# -m: print messages to stdout (captured by journald)
# -l 6: logging level
# -S 1.0: step threshold in seconds — step if offset exceeds 1s
ExecStart=/usr/sbin/phc2sys -s ens2f0 -c CLOCK_REALTIME -w -m -l 6 -S 1.0

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable phc2sys.service
sudo systemctl start phc2sys.service
```

:::note
Replace `ens2f0` in all PTP configuration files with the actual interface name of your Intel E810 NIC. Verify with `ethtool -T <interface>` that hardware timestamping is supported.
:::

---

## gNB YAML — Full Reference Configuration

This is a comprehensive srsRAN gNB configuration for O-RAN Split 7.2 with an Intel E810 NIC and a compatible Radio Unit. Save as `gnb.yml`:

```yaml
# =============================================================================
# srsRAN gNB Configuration — Full Reference
# =============================================================================
# This file configures the gNB for O-RAN Split 7.2 operation with DPDK-
# accelerated fronthaul. Adjust values for your specific hardware, spectrum
# allocation, and Radio Unit.
# =============================================================================

# -----------------------------------------------------------------------------
# AMF connection — connects the gNB to the 5G core network
# -----------------------------------------------------------------------------
amf:
  # IP address of the AMF (Aether SD-Core).
  # For bare-metal SD-Core: the host IP where the AMF container runs.
  # For Kubernetes: the AMF NodePort or LoadBalancer IP.
  addr: 10.100.1.1

  # SCTP port — 38412 is the standard NGAP port.
  port: 38412

  # Local IP address the gNB binds to for NGAP/SCTP.
  bind_addr: 10.100.1.2

  # SCTP initial retransmission timeout in ms.
  # sctp_initial_to: 120

  # SCTP max retransmission attempts.
  # sctp_max_init_retries: 3

# -----------------------------------------------------------------------------
# Cell configuration — defines the radio parameters for the cell
# -----------------------------------------------------------------------------
cell_cfg:
  # Physical Cell Identity (0-1007). Must be unique per cell in your network.
  pci: 1

  # Downlink ARFCN — determines the center frequency.
  # Example: 627340 = 3489.42 MHz (n78 band).
  dl_arfcn: 627340

  # NR band number. Must be consistent with dl_arfcn.
  band: 78

  # Channel bandwidth in MHz. Common values: 10, 20, 40, 50, 100.
  common_scs: 30

  # Channel bandwidth in number of PRBs.
  # 100 MHz @ 30 kHz SCS = 273 PRBs.
  # 40 MHz @ 30 kHz SCS = 106 PRBs.
  nof_antennas_dl: 4
  nof_antennas_ul: 4
  channel_bandwidth_MHz: 100

  # PLMN configuration — must match the core network.
  plmn: "00101"

  # Tracking Area Code — must match the TAC configured in the AMF.
  tac: 1

  # SSB (Synchronization Signal Block) configuration.
  ssb:
    # SSB period in ms (5, 10, 20). Lower = faster cell search by UEs.
    ssb_period_ms: 10
    # SSB offset relative to the point A.
    # ssb_offset: 0

  # PDSCH (downlink data channel) configuration.
  pdsch:
    # Minimum MCS index for downlink scheduling.
    min_ue_mcs: 0
    # Maximum MCS index for downlink scheduling.
    max_ue_mcs: 28
    # Maximum number of HARQ retransmissions.
    max_nof_harq_retx: 4
    # Max RBs allocated per UE in downlink.
    max_rb_size: 273

  # PUSCH (uplink data channel) configuration.
  pusch:
    min_ue_mcs: 0
    max_ue_mcs: 28
    max_nof_harq_retx: 4
    max_rb_size: 273

  # PRACH (Random Access Channel) configuration.
  prach:
    # PRACH configuration index. Determines PRACH occasion timing.
    prach_config_index: 159
    # Root sequence index for preamble generation.
    prach_root_sequence_index: 0
    # Zero correlation zone config (controls preamble detection range).
    zero_correlation_zone: 0
    # Number of PRACH preambles available for contention-based RA.
    # nof_cb_preambles_per_ssb: 64

  # TDD pattern — defines the UL/DL slot ratio.
  tdd_ul_dl_cfg:
    # Number of DL slots per TDD period.
    nof_dl_slots: 7
    # Number of DL symbols in the "flexible" slot.
    nof_dl_symbols: 6
    # Number of UL slots per TDD period.
    nof_ul_slots: 2
    # Number of UL symbols in the "flexible" slot.
    nof_ul_symbols: 4

  # Paging configuration.
  # paging:
  #   pg_search_space_id: 1
  #   default_paging_cycle: 128

# -----------------------------------------------------------------------------
# CU-CP (Control Plane) configuration
# -----------------------------------------------------------------------------
cu_cp:
  inactivity_timer: 7200

# -----------------------------------------------------------------------------
# CU-UP (User Plane) configuration
# -----------------------------------------------------------------------------
cu_up:
  # GTP-U bind address — used for user-plane traffic to the UPF.
  gtpu_bind_addr: 10.100.1.2

  # UPF address — where GTP-U tunnels terminate in the core.
  upf_addr: 10.100.1.1

# -----------------------------------------------------------------------------
# DU (Distributed Unit) configuration
# -----------------------------------------------------------------------------
du:
  # Warn if the scheduling latency exceeds this threshold (microseconds).
  warn_on_drop: true

# -----------------------------------------------------------------------------
# RU (Radio Unit) — O-RAN Split 7.2 fronthaul configuration
# -----------------------------------------------------------------------------
ru_ofh:
  # Transport type: dpdk for DPDK-accelerated fronthaul.
  gps_alpha: 0
  gps_beta: 0

  # T1a/T2a timing parameters (in microseconds).
  # These define the timing advance windows for DL and UL.
  # Must be tuned to match your RU's timing characteristics.
  t1a_max_cp_dl: 470
  t1a_min_cp_dl: 250
  t1a_max_cp_ul: 336
  t1a_min_cp_ul: 50
  t1a_max_up: 345
  t1a_min_up: 50

  t2a_max_cp_dl: 470
  t2a_min_cp_dl: 50
  t2a_max_cp_ul: 336
  t2a_min_cp_ul: 50
  t2a_max_up: 345
  t2a_min_up: 50

  # Whether the RU is responsible for PRACH processing.
  is_prach_cp_enabled: true

  # Compression method for IQ samples (none, bfp, modcomp).
  compr_method_ul: bfp
  compr_bitwidth_ul: 9
  compr_method_dl: bfp
  compr_bitwidth_dl: 9
  compr_method_prach: bfp
  compr_bitwidth_prach: 9

  # DPDK-based fronthaul cells configuration.
  cells:
    - network_interface: 0000:xx:xx.x    # PCIe BDF of the E810 VF or PF for fronthaul
      ru_mac_addr: 70:b3:d5:xx:xx:xx     # MAC address of the Radio Unit
      du_mac_addr: 40:a6:b7:xx:xx:xx     # MAC address of the E810 interface
      vlan_tag_cp: 1                       # C-plane VLAN tag
      vlan_tag_up: 1                       # U-plane VLAN tag
      ru_prach_port_id: [4, 5, 6, 7]
      ru_dl_port_id: [0, 1, 2, 3]
      ru_ul_port_id: [0, 1, 2, 3]

# -----------------------------------------------------------------------------
# DPDK configuration for the OFH (Open Fronthaul) library
# -----------------------------------------------------------------------------
hal:
  # EAL (Environment Abstraction Layer) arguments for DPDK.
  eal_args: "--lcores 4,5,6 -a 0000:xx:xx.x"

# -----------------------------------------------------------------------------
# Expert / advanced configuration
# -----------------------------------------------------------------------------
expert_phy:
  # Number of threads for the upper PHY layer (LDPC, scrambling, etc.).
  nof_ul_threads: 4
  # PUSCH decoder maximum iterations.
  pusch_decoder_max_iterations: 6
  # Maximum number of concurrent PUSCH decoding operations.
  max_nof_simultaneous_pusch: 32

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
log:
  # Log file path. Use "stdout" to log to console.
  filename: /tmp/gnb.log

  # Per-layer log levels: none, error, warning, info, debug.
  all_level: warning

  # Override specific layers for troubleshooting:
  # phy_level: info
  # mac_level: info
  # rlc_level: info
  # pdcp_level: info
  # rrc_level: info
  # ngap_level: info
  # ofh_level: info

  # Maximum log file size in bytes (0 = unlimited).
  # max_size: 104857600

# -----------------------------------------------------------------------------
# PCAP capture (for debugging)
# -----------------------------------------------------------------------------
pcap:
  mac_enable: false
  mac_filename: /tmp/gnb_mac.pcap
  ngap_enable: false
  ngap_filename: /tmp/gnb_ngap.pcap
  e2ap_enable: false
  e2ap_filename: /tmp/gnb_e2ap.pcap

# -----------------------------------------------------------------------------
# Metrics
# -----------------------------------------------------------------------------
metrics:
  enable_json_metrics: false
  addr: 127.0.0.1
  port: 55555
```

:::warning
The `cells` section under `ru_ofh` contains placeholder values (`0000:xx:xx.x`, `70:b3:d5:xx:xx:xx`). You **must** replace these with your actual PCIe BDF address (from `lspci`), RU MAC address, and DU MAC address. Failure to do so will cause the gNB to fail at startup.
:::

---

## Netplan Configuration

This example configures the Intel E810 NIC with separate interfaces for management, fronthaul, and core network traffic. Save as `/etc/netplan/01-5g-lab.yaml`:

```yaml
# =============================================================================
# Netplan configuration for 5G lab server
# =============================================================================
# Interface mapping (adjust to match your hardware):
#   eno1       — Management / SSH access
#   ens2f0     — Fronthaul to RU (PTP + OFH C/U-plane)
#   ens2f1     — Core network (NGAP to AMF, GTP-U to UPF)
# =============================================================================

network:
  version: 2
  renderer: networkd

  ethernets:
    # -----------------------------------------------------------------
    # Management interface — connects to your LAN / out-of-band network.
    # -----------------------------------------------------------------
    eno1:
      dhcp4: true
      # Optional: static IP for management.
      # addresses:
      #   - 192.168.1.10/24
      # routes:
      #   - to: default
      #     via: 192.168.1.1
      # nameservers:
      #   addresses: [8.8.8.8, 1.1.1.1]

    # -----------------------------------------------------------------
    # Fronthaul interface — connects to the Radio Unit.
    # -----------------------------------------------------------------
    # NOTE: If DPDK manages this interface, Netplan should NOT configure
    # an IP address on it. DPDK binds the device directly and bypasses
    # the kernel network stack. Leave this section commented out or
    # configure only if using kernel-mode fronthaul for debugging.
    # -----------------------------------------------------------------
    # ens2f0:
    #   addresses:
    #     - 10.10.0.1/24
    #   mtu: 9000

    # -----------------------------------------------------------------
    # Core network interface — connects to SD-Core (AMF, UPF).
    # -----------------------------------------------------------------
    ens2f1:
      addresses:
        - 10.100.1.2/24
      mtu: 9000
      routes:
        - to: 10.100.0.0/16
          via: 10.100.1.1
      # If this interface also provides the default route to the internet
      # (e.g., for UE data breakout through the UPF), add:
      # routes:
      #   - to: default
      #     via: 10.100.1.1

  # -----------------------------------------------------------------
  # VLAN sub-interfaces (if using VLANs for fronthaul/core separation)
  # -----------------------------------------------------------------
  # vlans:
  #   vlan100-fh:
  #     id: 100
  #     link: ens2f0
  #     addresses:
  #       - 10.10.0.1/24
  #     mtu: 9000
  #
  #   vlan200-core:
  #     id: 200
  #     link: ens2f1
  #     addresses:
  #       - 10.100.1.2/24
  #     mtu: 9000
```

Apply the configuration:

```bash
sudo netplan apply
```

:::tip
Run `sudo netplan try` instead of `netplan apply` when making changes remotely over SSH. `netplan try` automatically reverts after 120 seconds if you do not confirm, preventing lockouts caused by misconfigurations.
:::
