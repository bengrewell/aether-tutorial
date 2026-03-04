---
id: gnb-configuration
title: gNB Configuration File Walkthrough
sidebar_label: gNB Configuration
sidebar_position: 3
description: Comprehensive walkthrough of the srsRAN gNB YAML configuration file, covering AMF connectivity, Open Fronthaul parameters, cell configuration, DPDK settings, and logging for an O-RAN Split 7.2 deployment.
keywords:
  - gNB configuration
  - srsRAN YAML
  - Open Fronthaul
  - ru_ofh
  - cell_cfg
  - cu_cp
  - DPDK HAL
  - timing windows
  - T1a
  - Ta4
  - BFP compression
  - TDD pattern
  - PRACH
  - ARFCN
---

# gNB Configuration File Walkthrough

The srsRAN gNB is configured entirely through a YAML file that defines every aspect of its operation — from core network connectivity to radio parameters and fronthaul timing. This guide walks through each section of the configuration file, explaining every parameter and its impact.

## Configuration File Structure

The gNB configuration YAML is organized into the following top-level sections:

```yaml
cu_cp:          # Core network connectivity (AMF/N2)
cell_cfg:       # Cell radio parameters (band, bandwidth, TDD, PRACH, MIMO)
ru_ofh:         # Open Fronthaul settings (timing, compression, MAC/VLAN)
hal:            # Hardware Abstraction Layer (DPDK EAL arguments)
log:            # Logging configuration
metrics:        # Metrics and KPI output
expert_phy:     # Advanced PHY-layer tuning (optional)
```

:::tip
srsRAN ships example configuration files in the `configs/` directory of the repository. These provide a starting point, but every deployment requires customization for the specific RU, spectrum, and network topology.
:::

## Complete Reference Configuration

Below is a complete configuration file annotated with explanations. Each section is then discussed in detail.

```yaml title="gnb.yml"
cu_cp:
  amf:
    addr: 10.20.0.10
    bind_addr: 10.20.0.1
    n2_bind_addr: 10.20.0.1
    n2_bind_interface: enp81s0f1

cell_cfg:
  dl_arfcn: 637212
  band: 78
  channel_bandwidth_MHz: 100
  common_scs: 30
  plmn: "00101"
  tac: 1
  nof_antennas_dl: 4
  nof_antennas_ul: 2
  tdd_ul_dl_cfg:
    dl_ul_tx_period: 5
    nof_dl_slots: 7
    nof_dl_symbols: 6
    nof_ul_slots: 2
    nof_ul_symbols: 4
  prach:
    prach_config_index: 159
    prach_root_sequence_index: 1
    zero_correlation_zone: 0
    prach_frequency_start: 12

ru_ofh:
  t1a_max_cp_dl: 470
  t1a_min_cp_dl: 250
  t1a_max_cp_ul: 336
  t1a_min_cp_ul: 50
  t1a_max_up: 345
  t1a_min_up: 50
  ta4_max: 500
  ta4_min: 25
  is_prach_cp_enabled: true
  compr_method_ul: bfp
  compr_bitwidth_ul: 9
  compr_method_dl: bfp
  compr_bitwidth_dl: 9
  compr_method_prach: bfp
  compr_bitwidth_prach: 9
  iq_scaling: 5.5
  ru_mac_addr: "70:b3:d5:e1:00:01"
  du_mac_addr: "00:11:22:33:44:55"
  vlan_tag_cp: 2
  vlan_tag_up: 2

hal:
  eal_args: "--lcores '(0-3)@(2-5)' -a 0000:51:01.0 --file-prefix gnb --iova-mode=va"

log:
  filename: /tmp/gnb.log
  all_level: warning
  phy_level: warning
  mac_level: warning
  ofh_level: warning

metrics:
  enable_json_metrics: true
  addr: 0.0.0.0
  port: 55555
```

## cu_cp — Core Network Connectivity

The `cu_cp` section configures the connection between the gNB and the 5G core network's AMF (Access and Mobility Management Function) over the N2 interface.

```yaml
cu_cp:
  amf:
    addr: 10.20.0.10        # AMF IP address
    bind_addr: 10.20.0.1    # gNB bind address for N2
    n2_bind_addr: 10.20.0.1
    n2_bind_interface: enp81s0f1
```

### Parameter Details

| Parameter | Value | Description |
|-----------|-------|-------------|
| `addr` | `10.20.0.10` | IP address of the SD-Core AMF. The gNB initiates an SCTP connection to this address. |
| `bind_addr` | `10.20.0.1` | Local IP address the gNB binds to for all CU-CP communications. |
| `n2_bind_addr` | `10.20.0.1` | Specific bind address for the N2 (NGAP) interface. Usually the same as `bind_addr`. |
| `n2_bind_interface` | `enp81s0f1` | Network interface used for N2 traffic. Must have the `n2_bind_addr` configured on it. |

:::warning
The AMF address must be reachable from the gNB. If the core network is on a different subnet, ensure proper routing is configured. The N2 interface uses SCTP (port 38412 by default), so any firewalls between the gNB and AMF must allow SCTP traffic.
:::

### N3 (User Plane) Connectivity

The N3 interface (gNB to UPF) is typically configured implicitly — the gNB uses the same `bind_addr` for GTP-U traffic. If your N3 traffic needs to use a different interface or IP address, add:

```yaml
cu_up:
  upf:
    bind_addr: 10.20.0.1    # gNB bind address for N3 (GTP-U)
```

## cell_cfg — Cell Radio Parameters

The `cell_cfg` section defines the radio characteristics of the cell, including frequency, bandwidth, MIMO, TDD pattern, and random access configuration.

### Frequency and Bandwidth

```yaml
cell_cfg:
  dl_arfcn: 637212
  band: 78
  channel_bandwidth_MHz: 100
  common_scs: 30
```

| Parameter | Value | Description |
|-----------|-------|-------------|
| `dl_arfcn` | `637212` | Downlink Absolute Radio Frequency Channel Number |
| `band` | `78` | 3GPP NR band number |
| `channel_bandwidth_MHz` | `100` | Channel bandwidth in MHz |
| `common_scs` | `30` | Subcarrier spacing in kHz |

#### Understanding dl_arfcn 637212

The ARFCN (Absolute Radio Frequency Channel Number) maps to a specific center frequency. For NR, the mapping is:

- Band n78 range: 3300–3800 MHz
- ARFCN 637212 corresponds to a center frequency of **3604.08 MHz**
- The formula: `F = F_REF_Offs + ΔF_Global × (N_REF - N_REF_Offs)` where for the range 3000–24250 MHz: `F = 3000 MHz + 0.015 MHz × (ARFCN - 600000)` = `3000 + 0.015 × 37212` = `3000 + 558.18` = **3558.18 MHz** (point A) with the actual center depending on bandwidth

:::note
The ARFCN must correspond to a valid NR raster point within your licensed or authorized spectrum. For lab/test deployments, ensure you are operating in spectrum you are authorized to use. CBRS (3550–3700 MHz) in the US requires SAS authorization.
:::

#### 100 MHz with 30 kHz SCS

With 100 MHz channel bandwidth and 30 kHz subcarrier spacing:

- **Number of PRBs**: 273 (each PRB = 12 subcarriers × 30 kHz = 360 kHz)
- **Occupied bandwidth**: 273 × 360 kHz = 98.28 MHz
- **Guard bands**: ~0.86 MHz on each side
- **FFT size**: 4096

### Network Identity

```yaml
  plmn: "00101"
  tac: 1
```

| Parameter | Value | Description |
|-----------|-------|-------------|
| `plmn` | `"00101"` | Public Land Mobile Network identity (MCC=001, MNC=01). This is a test PLMN. |
| `tac` | `1` | Tracking Area Code. Must match the TAC configured in SD-Core. |

:::warning
The PLMN and TAC must match exactly between the gNB and SD-Core configuration. A mismatch will prevent UE registration. The test PLMN `00101` is commonly used for lab deployments. Production deployments require a registered MCC/MNC.
:::

### MIMO Configuration

```yaml
  nof_antennas_dl: 4
  nof_antennas_ul: 2
```

| Parameter | Value | Description |
|-----------|-------|-------------|
| `nof_antennas_dl` | `4` | Number of downlink antenna ports (transmit) |
| `nof_antennas_ul` | `2` | Number of uplink antenna ports (receive) |

This configures a **4T2R** MIMO setup:

- **Downlink**: 4 antenna ports enable up to Rank 4 transmission, supporting spatial multiplexing for higher DL throughput
- **Uplink**: 2 antenna ports provide receive diversity and up to Rank 2 UL reception

The antenna configuration must match your RU's physical antenna capabilities. A 4T4R RU can be operated in 4T2R mode by using only 2 of the 4 receive paths.

### TDD Pattern

```yaml
  tdd_ul_dl_cfg:
    dl_ul_tx_period: 5
    nof_dl_slots: 7
    nof_dl_symbols: 6
    nof_ul_slots: 2
    nof_ul_symbols: 4
```

| Parameter | Value | Description |
|-----------|-------|-------------|
| `dl_ul_tx_period` | `5` | TDD pattern periodicity in milliseconds |
| `nof_dl_slots` | `7` | Number of full downlink slots per period |
| `nof_dl_symbols` | `6` | Number of downlink symbols in the special slot |
| `nof_ul_slots` | `2` | Number of full uplink slots per period |
| `nof_ul_symbols` | `4` | Number of uplink symbols in the special slot |

#### TDD Pattern Breakdown

With 30 kHz SCS, one slot = 0.5 ms, so a 5 ms period contains 10 slots. The pattern distributes as follows:

```
Slot:     0    1    2    3    4    5    6    7    8    9
Type:     D    D    D    D    D    D    D    S    U    U
                                              ↑
                                         Special slot
                                     (6 DL + guard + 4 UL symbols)
```

This **7D2U** pattern provides:

- **DL ratio**: ~78% (7 full DL slots + 6 DL symbols in special slot)
- **UL ratio**: ~22% (2 full UL slots + 4 UL symbols in special slot)
- **Guard period**: Symbols between DL and UL in the special slot for timing advance and RF switching

The DL-heavy ratio favors download throughput (typical for eMBB deployments). Adjust the ratio if your use case requires more uplink capacity (e.g., video upload, sensor data).

<!-- IMAGE PLACEHOLDER: [Visual representation of the TDD slot pattern showing 10 slots with DL (blue), UL (green), and Special (yellow) slots, with the special slot expanded to show DL symbols, guard period, and UL symbols] -->

### PRACH Configuration

```yaml
  prach:
    prach_config_index: 159
    prach_root_sequence_index: 1
    zero_correlation_zone: 0
    prach_frequency_start: 12
```

| Parameter | Value | Description |
|-----------|-------|-------------|
| `prach_config_index` | `159` | Selects the PRACH format, time/frequency occasion, and periodicity from 3GPP TS 38.211 Table 6.3.3.2-3 |
| `prach_root_sequence_index` | `1` | Zadoff-Chu root sequence index used for preamble generation |
| `zero_correlation_zone` | `0` | Controls the cyclic shift granularity (0 = unrestricted set, maximum preambles) |
| `prach_frequency_start` | `12` | Starting PRB offset for the PRACH occasion in the frequency domain |

#### PRACH Config Index 159

Config index 159 corresponds to:

- **PRACH format**: B4 (short preamble format, suited for TDD)
- **Subcarrier spacing**: 30 kHz (matching the cell SCS)
- **Occasion periodicity**: Configured for every available UL slot
- Suitable for small to medium cell deployments with moderate UE attach rates

:::tip
For lab testing with few UEs, config index 159 works well. For high-density deployments, you may need to increase the number of PRACH occasions or use a different config index. Refer to 3GPP TS 38.211, Table 6.3.3.2-3 for the complete mapping.
:::

## ru_ofh — Open Fronthaul Configuration

The `ru_ofh` section configures the O-RAN Split 7.2 fronthaul interface between the DU and RU. This is the most hardware-specific section and must be carefully matched to your RU's capabilities.

### Timing Windows

```yaml
ru_ofh:
  t1a_max_cp_dl: 470
  t1a_min_cp_dl: 250
  t1a_max_cp_ul: 336
  t1a_min_cp_ul: 50
  t1a_max_up: 345
  t1a_min_up: 50
  ta4_max: 500
  ta4_min: 25
```

The timing windows control when the DU sends and expects fronthaul messages relative to the radio frame boundary. All values are in **microseconds**.

#### T1a Windows (DU → RU)

T1a defines the time window *before* the radio frame boundary during which the DU must transmit messages to the RU:

| Parameter | Value (us) | Description |
|-----------|-----------|-------------|
| `t1a_max_cp_dl` | 470 | Maximum advance time for DL Control-Plane messages |
| `t1a_min_cp_dl` | 250 | Minimum advance time for DL Control-Plane messages |
| `t1a_max_cp_ul` | 336 | Maximum advance time for UL Control-Plane messages |
| `t1a_min_cp_ul` | 50 | Minimum advance time for UL Control-Plane messages |
| `t1a_max_up` | 345 | Maximum advance time for DL User-Plane messages (IQ data) |
| `t1a_min_up` | 50 | Minimum advance time for DL User-Plane messages |

```
         T1a_max                T1a_min
         ◄──────────────────────►
    ─────┬──────────────────────┬──────┬──────────
         │   Valid TX window    │      │ Radio frame
         │   (DU sends here)   │      │ boundary
    ─────┴──────────────────────┴──────┴──────────
                                         time →
```

If the DU sends a message *too early* (before T1a_max) or *too late* (after T1a_min), the RU will discard it.

#### Ta4 Window (RU → DU)

Ta4 defines the time window *after* the radio frame boundary during which the DU expects to receive uplink IQ data from the RU:

| Parameter | Value (us) | Description |
|-----------|-----------|-------------|
| `ta4_max` | 500 | Maximum delay after the radio frame boundary for receiving UL data |
| `ta4_min` | 25 | Minimum delay after the radio frame boundary for receiving UL data |

```
                        ta4_min          ta4_max
                        ►────────────────►
    ────────┬───────────┬────────────────┬──────────
    Radio   │           │  Valid RX      │
    frame   │           │  window        │
    boundary│           │  (DU expects   │
    ────────┴───────────┴──RU data here)─┴──────────
                                            time →
```

:::danger
Incorrect timing window values are the most common cause of fronthaul failures. Always obtain the correct T1a and Ta4 ranges from your RU vendor's documentation. The values shown here are examples — your RU may require different values.
:::

:::tip
If you see "late" messages in the OFH logs, your T1a_min values may be too tight (DU is not sending early enough). If you see "early" messages, T1a_max may be too small. Widen the windows gradually until stable operation is achieved.
:::

### IQ Compression

```yaml
  compr_method_ul: bfp
  compr_bitwidth_ul: 9
  compr_method_dl: bfp
  compr_bitwidth_dl: 9
  compr_method_prach: bfp
  compr_bitwidth_prach: 9
```

| Parameter | Value | Description |
|-----------|-------|-------------|
| `compr_method_ul` | `bfp` | Uplink compression method |
| `compr_method_dl` | `bfp` | Downlink compression method |
| `compr_method_prach` | `bfp` | PRACH compression method |
| `compr_bitwidth_ul` | `9` | Uplink compression bitwidth |
| `compr_bitwidth_dl` | `9` | Downlink compression bitwidth |
| `compr_bitwidth_prach` | `9` | PRACH compression bitwidth |

#### BFP9 Compression Explained

**BFP** (Block Floating Point) is the standard O-RAN compression method for fronthaul IQ data. It works by:

1. Grouping IQ samples into blocks (typically 12 samples per PRB)
2. Finding the maximum magnitude within each block
3. Computing a shared exponent (the "block floating point") that scales all samples in the block
4. Quantizing each sample to the specified bitwidth (9 bits)

**BFP9** means each IQ sample is represented with 9 bits plus a shared exponent per block:

- **Uncompressed**: 16 bits per I + 16 bits per Q = 32 bits per sample
- **BFP9**: 9 bits per I + 9 bits per Q + shared exponent = ~60% bandwidth reduction
- **Quality impact**: Minimal — BFP9 preserves the dynamic range effectively for most signal conditions

The compression method and bitwidth must match between the DU and RU. BFP9 is the most commonly supported configuration.

### IQ Scaling

```yaml
  iq_scaling: 5.5
```

The `iq_scaling` parameter controls the digital gain applied to downlink IQ samples before they are sent to the RU. It is specified in **dB**.

- **Higher values**: Increase digital signal amplitude (risk of clipping at the RU DAC)
- **Lower values**: Decrease amplitude (reduced signal power, lower SNR at UE)

:::note
The optimal `iq_scaling` value depends on your RU's DAC dynamic range and the desired output power. Start with the default or your RU vendor's recommendation and adjust based on SSB power measurements. See [RF Optimization](./05-rf-optimization.md) for tuning guidance.
:::

### PRACH Control Plane

```yaml
  is_prach_cp_enabled: true
```

When `true`, the DU sends a separate Control-Plane message for PRACH occasions to the RU. This is required by most O-RAN compliant RUs.

### MAC Addresses and VLAN Configuration

```yaml
  ru_mac_addr: "70:b3:d5:e1:00:01"
  du_mac_addr: "00:11:22:33:44:55"
  vlan_tag_cp: 2
  vlan_tag_up: 2
```

| Parameter | Value | Description |
|-----------|-------|-------------|
| `ru_mac_addr` | `70:b3:d5:e1:00:01` | MAC address of the RU's fronthaul port |
| `du_mac_addr` | `00:11:22:33:44:55` | MAC address of the DU's fronthaul port (E810 VF) |
| `vlan_tag_cp` | `2` | VLAN ID for C-Plane (control) eCPRI messages |
| `vlan_tag_up` | `2` | VLAN ID for U-Plane (user) eCPRI messages |

:::warning
The `du_mac_addr` must match the MAC address of the DPDK-bound interface (the SR-IOV VF or PF that DPDK controls). Obtain it with `ip link show` before binding the interface to DPDK. After DPDK binding, the interface is no longer visible to the kernel.
:::

The VLAN tags must match the RU's configuration. Some RUs use different VLAN IDs for C-Plane and U-Plane traffic; others use the same VLAN for both.

## hal — DPDK Hardware Abstraction Layer

The `hal` section provides DPDK EAL (Environment Abstraction Layer) arguments that configure how DPDK initializes and which resources it uses.

```yaml
hal:
  eal_args: "--lcores '(0-3)@(2-5)' -a 0000:51:01.0 --file-prefix gnb --iova-mode=va"
```

### EAL Arguments Breakdown

| Argument | Description |
|----------|-------------|
| `--lcores '(0-3)@(2-5)'` | Maps DPDK logical cores 0–3 to physical CPUs 2–5. The notation `(logical)@(physical)` controls thread affinity. |
| `-a 0000:51:01.0` | PCI address of the NIC (or VF) to use. Obtain with `lspci \| grep E810` or `dpdk-devbind.py -s`. |
| `--file-prefix gnb` | Unique prefix for DPDK hugepage and shared memory files. Required if running multiple DPDK apps. |
| `--iova-mode=va` | Use Virtual Address mode for IOMMU-based I/O. Required when using IOMMU/VT-d with DPDK. |

#### lcore Mapping Explained

The `--lcores` argument maps DPDK's logical core IDs to physical CPU cores:

```
(0-3)@(2-5)

DPDK logical core 0 → Physical CPU 2
DPDK logical core 1 → Physical CPU 3
DPDK logical core 2 → Physical CPU 4
DPDK logical core 3 → Physical CPU 5
```

These physical CPUs should be:

1. **Isolated** from the kernel scheduler (via `isolcpus` or `cset`) — see [CPU Isolation](../02-system-preparation/04-cpu-isolation.md)
2. **On the same NUMA node** as the Intel E810 NIC — check with `lstopo` or `lspci -s <pci_addr> -vv | grep NUMA`
3. **Not shared** with other latency-sensitive workloads

:::tip
Use `lstopo` to visualize your CPU topology and NUMA layout. Place DPDK lcores on the same NUMA node as the E810 NIC for optimal performance (avoiding cross-NUMA memory access).
:::

#### Finding the PCIe Address

Identify your E810 VF's PCIe address:

```bash
# List all E810 devices
lspci | grep E810

# Or use DPDK's device binding tool
dpdk-devbind.py --status
```

The address format is `DDDD:BB:DD.F` (domain:bus:device.function), e.g., `0000:51:01.0`.

## log — Logging Configuration

```yaml
log:
  filename: /tmp/gnb.log
  all_level: warning
  phy_level: warning
  mac_level: warning
  ofh_level: warning
```

| Parameter | Value | Description |
|-----------|-------|-------------|
| `filename` | `/tmp/gnb.log` | Log file path. Use `/tmp/` for non-persistent logs or a path under `/var/log/` for persistence. |
| `all_level` | `warning` | Default log level for all components |
| `phy_level` | `warning` | PHY layer log level (overrides `all_level`) |
| `mac_level` | `warning` | MAC layer log level |
| `ofh_level` | `warning` | Open Fronthaul log level |

### Log Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `none` | No logging | Production (maximum performance) |
| `error` | Only errors | Production |
| `warning` | Errors and warnings | **Recommended for normal operation** |
| `info` | Informational messages | Initial deployment and verification |
| `debug` | Detailed debug output | Troubleshooting specific issues |

:::warning
Setting log levels to `info` or `debug` generates significant I/O and can impact real-time performance. Use `warning` or `error` for normal operation. Only increase verbosity temporarily when diagnosing specific issues.
:::

:::tip
During initial deployment, temporarily set `all_level: info` to observe startup behavior and verify all components initialize correctly. Revert to `warning` once the system is stable.
:::

## metrics — Metrics and KPI Output

```yaml
metrics:
  enable_json_metrics: true
  addr: 0.0.0.0
  port: 55555
```

| Parameter | Value | Description |
|-----------|-------|-------------|
| `enable_json_metrics` | `true` | Enables JSON-formatted metrics output over a network socket |
| `addr` | `0.0.0.0` | Bind address for the metrics server |
| `port` | `55555` | Port for the metrics server |

The JSON metrics endpoint can be consumed by monitoring tools (Prometheus, Grafana) for real-time KPI visualization. Metrics include:

- UE counts and states
- DL/UL throughput per UE
- MCS distribution
- HARQ NACK rates
- PHY timing statistics
- OFH packet counters

## Putting It All Together

### Launching the gNB

With the configuration file complete, launch the gNB:

```bash
sudo gnb -c /path/to/gnb.yml
```

:::note
The `gnb` process must run as root (or with `CAP_NET_ADMIN` and `CAP_SYS_RAWIO` capabilities) because DPDK requires access to hugepages, PCIe devices, and raw Ethernet frames.
:::

### Configuration Validation

Before connecting to a live RU, validate your configuration using testmode. See [Testmode Validation](./04-testmode-validation.md) for the detailed procedure.

### Quick Configuration Checklist

Before launching, verify:

- [ ] AMF address (`cu_cp.amf.addr`) matches SD-Core AMF IP
- [ ] PLMN and TAC match SD-Core configuration
- [ ] `du_mac_addr` matches the DPDK-bound interface MAC address
- [ ] `ru_mac_addr` matches your RU's fronthaul MAC address
- [ ] VLAN tags match RU configuration
- [ ] PCIe address in `hal.eal_args` matches the correct E810 VF
- [ ] lcore mapping targets isolated CPUs on the correct NUMA node
- [ ] Timing windows (T1a, Ta4) match your RU's specifications
- [ ] PLMN is set to your authorized network identity

## Next Steps

With the configuration file prepared, proceed to [Testmode Validation](./04-testmode-validation.md) to verify the gNB starts correctly and can simulate UE traffic before connecting to real hardware.
