---
id: testmode-validation
title: Testmode Validation
sidebar_label: Testmode Validation
sidebar_position: 4
description: Validate the srsRAN gNB using testmode simulation, RU emulators, and systematic verification checklists before connecting to live radio hardware.
keywords:
  - srsRAN testmode
  - gNB validation
  - RU emulator
  - ProtO-RU
  - VIAVI
  - test UE
  - SSB power
  - PHY initialization
  - log interpretation
  - startup troubleshooting
---

# Testmode Validation

Before connecting the gNB to a physical Radio Unit and live UEs, it is essential to validate the software configuration in a controlled environment. srsRAN provides several testmode capabilities that simulate radio components, allowing you to verify the entire protocol stack — from PHY initialization through UE attach and data transfer — without any RF hardware.

This step catches configuration errors, dependency issues, and performance problems before they become difficult to diagnose with real hardware in the loop.

## Validation Approaches

There are three progressively more realistic approaches to validating the gNB before live operation.

### 1. Testmode UE (Built-in Simulation)

srsRAN includes a built-in testmode that simulates a UE within the gNB process itself. When enabled, the gNB:

- Generates synthetic uplink IQ data as if a UE were transmitting
- Processes the simulated UE through the full protocol stack (PHY → MAC → RLC → PDCP → RRC)
- Establishes a simulated PDU session with the core network
- Generates traffic to validate end-to-end data flow

This is the simplest and fastest way to validate the gNB configuration.

### 2. RU Emulator (Built-in)

srsRAN includes an RU emulator application (`ru_emulator`) that simulates an O-RAN Split 7.2 Radio Unit on the fronthaul interface. This validates:

- DPDK initialization and packet I/O
- eCPRI message framing and parsing
- C-Plane and U-Plane message exchange
- Timing window compliance
- VLAN tagging and MAC addressing

The RU emulator runs as a separate process and communicates with the gNB over the actual Ethernet interface (or loopback), providing a more realistic test of the fronthaul path.

### 3. ProtO-RU (VIAVI O-RU Emulator)

For the highest-fidelity pre-deployment validation, [VIAVI ProtO-RU](https://www.viavi.com) provides a commercial-grade O-RU emulator that:

- Emulates a fully compliant O-RAN Split 7.2 Radio Unit
- Supports M-Plane management (if applicable)
- Validates fronthaul interoperability before connecting to a physical RU
- Provides detailed protocol analysis and conformance testing

:::note
The ProtO-RU is a commercial product and requires a license. For most lab deployments, the built-in testmode UE and RU emulator are sufficient for initial validation.
:::

## Running gNB in Testmode

### Testmode Configuration

To enable testmode, you can either add the `test_mode` section to your existing configuration file or use a dedicated testmode configuration file.

Add the following to your `gnb.yml`:

```yaml title="gnb_testmode.yml"
test_mode:
  test_ue:
    rnti: 0x44       # C-RNTI for the simulated UE
    nof_ues: 1        # Number of simulated UEs
    pdsch_active: true # Enable downlink data generation
    pusch_active: true # Enable uplink data generation
    cqi: 15            # Channel Quality Indicator (15 = best)
    ri: 1              # Rank Indicator
```

For a complete testmode configuration, you typically modify the existing `gnb.yml` by:

1. Adding the `test_mode` section above
2. Replacing `ru_ofh` with `ru_dummy` (to skip fronthaul entirely) or keeping `ru_ofh` if testing with the RU emulator

#### Minimal Testmode Config (No Fronthaul)

For pure software validation without any fronthaul:

```yaml title="gnb_testmode_minimal.yml"
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

test_mode:
  test_ue:
    rnti: 0x44
    nof_ues: 1
    pdsch_active: true
    pusch_active: true
    cqi: 15
    ri: 1

log:
  filename: /tmp/gnb_testmode.log
  all_level: info

metrics:
  enable_json_metrics: true
  addr: 0.0.0.0
  port: 55555
```

### Launching Testmode

Start the gNB in testmode:

```bash
sudo gnb -c gnb_testmode.yml
```

<!-- IMAGE PLACEHOLDER: [Terminal screenshot showing gNB startup in testmode with successful PHY initialization, cell broadcasting, and simulated UE attachment messages] -->

### Running the RU Emulator

If testing the fronthaul path, start the RU emulator in a separate terminal before launching the gNB:

```bash
sudo ru_emulator -c ru_emulator.yml
```

Then start the gNB with the full configuration (including `ru_ofh`):

```bash
sudo gnb -c gnb.yml
```

The RU emulator will respond to the gNB's fronthaul messages, simulating a real RU.

## Validation Checklist

Work through the following checklist systematically. Each item should be confirmed before proceeding to the next.

### Startup Validation

- [ ] **gNB starts without errors** — No `ERROR` or `FATAL` messages in the first 10 seconds of log output
- [ ] **PHY layer initializes** — Look for log messages indicating PHY initialization:
  ```
  PHY layer initialized successfully
  ```
- [ ] **Cell is broadcasting (SSB)** — The System Information Block and SSB are being generated:
  ```
  SSB: cell_id=0, pci=1, ...
  ```
- [ ] **NGAP connection established** — The gNB connects to the AMF:
  ```
  NG connection established
  ```
  or
  ```
  NGAP: Successfully initiated
  ```

### Testmode UE Validation

When running with testmode enabled:

- [ ] **Simulated UE attaches** — The test UE completes the RRC connection and registration:
  ```
  UE rnti=0x44 connected
  ```
- [ ] **PDU session established** — A data session is set up through the core network:
  ```
  PDU session established for UE rnti=0x44
  ```
- [ ] **Traffic flows** — DL/UL throughput is visible in the metrics output

### Performance Validation

- [ ] **CPU usage is within bounds** — Check with `htop` or `top`:
  - Isolated cores running gNB threads should show high utilization (this is expected for poll-mode)
  - System cores should have minimal load from gNB
- [ ] **No late/dropped packets** — Check OFH counters in the logs or metrics:
  ```
  OFH: tx_late=0, tx_early=0, rx_late=0
  ```
  Any non-zero late or early counters indicate timing issues
- [ ] **Memory usage is stable** — No continuous memory growth over a 5-minute observation period

:::tip
Run the testmode validation for at least 5 minutes to ensure stability. Transient issues like memory leaks or timing drift may not appear immediately.
:::

## SSB Power Verification

The SSB (Synchronization Signal Block) is the first signal a UE detects when searching for a cell. Verifying SSB power ensures the downlink signal chain is functioning correctly.

### SSB Power Calculation

The SSB power is derived from the configured cell power and distributed across the SSB resource elements:

```
SSB power per RE = Total cell power / Number of SSB REs
```

For a typical configuration:

- SSB occupies 240 subcarriers × 4 OFDM symbols = 960 REs (minus reserved REs for PSS/SSS)
- The `iq_scaling` parameter in `ru_ofh` controls the digital amplitude

### Measuring SSB Power

With a physical RU or spectrum analyzer:

1. **Spectrum analyzer**: Connect to a test port on the RU (if available) and measure the SSB power at the expected center frequency. The SSB should appear as a distinct peak occupying 7.2 MHz bandwidth (240 × 30 kHz SCS).

2. **RU management interface**: Many RUs provide a management interface (web UI or CLI) that reports transmitted power levels, including SSB power.

3. **UE measurement reports**: Once a UE attaches (in non-testmode), it reports SS-RSRP (Reference Signal Received Power) which can be used to infer transmitted SSB power given known path loss.

:::note
In pure testmode (without a physical RU), SSB power cannot be directly measured over the air. This verification step applies when using the RU emulator or a physical RU.
:::

## Log Interpretation

Understanding key log messages helps diagnose issues quickly.

### Successful Startup Sequence

A healthy gNB startup produces log messages roughly in this order:

| Order | Log Message (paraphrased) | Meaning |
|-------|--------------------------|---------|
| 1 | `Cell configured: PCI=1, band=78, BW=100 MHz, SCS=30 kHz` | Cell parameters parsed and validated |
| 2 | `PHY initialized with X cores` | PHY layer threads created and pinned |
| 3 | `OFH: fronthaul interface ready` | DPDK and fronthaul initialized |
| 4 | `NGAP: Connecting to AMF at 10.20.0.10:38412` | Initiating core network connection |
| 5 | `NGAP: NG Setup successful` | AMF accepted the gNB registration |
| 6 | `Cell broadcasting: SSB active` | Cell is on air (or simulated) |
| 7 | (testmode) `UE rnti=0x44 attached` | Simulated UE successfully connected |

### Warning Messages

| Log Message | Meaning | Action |
|-------------|---------|--------|
| `OFH: late DL C-Plane message` | DU sent a control-plane message outside the T1a window | Widen T1a timing windows or optimize CPU performance |
| `OFH: late DL U-Plane message` | DU sent IQ data outside the T1a window | Same as above; check for CPU contention |
| `MAC: HARQ NACK rate > X%` | High retransmission rate | Check RF conditions, timing, or UL power control |
| `PHY: slot processing overrun` | PHY could not complete processing within the slot duration | Insufficient CPU allocation or missing RT kernel |

### Error Messages

| Log Message | Meaning | Action |
|-------------|---------|--------|
| `NGAP: Connection refused` | Cannot reach AMF | Verify AMF address, check routing, ensure SD-Core is running |
| `NGAP: NG Setup failure` | AMF rejected gNB registration | Check PLMN/TAC match between gNB and core |
| `OFH: DPDK init failed` | DPDK EAL initialization error | Check hugepages, PCIe address, IOMMU, permissions |
| `PHY: Cannot allocate memory` | Insufficient hugepages or RAM | Increase hugepage allocation |
| `EAL: Cannot open /dev/vfio` | VFIO access denied | Check IOMMU is enabled, device is bound to vfio-pci |

## Common Startup Errors and Fixes

### Error: "Cannot connect to AMF"

**Cause**: The AMF is not reachable from the gNB.

**Diagnosis**:
```bash
# Test SCTP connectivity to AMF
sudo apt install -y sctp-tools
checksctp
sctp_test -H 10.20.0.1 -P 38412 -h 10.20.0.10 -p 38412 -s
```

**Fix**:
- Verify AMF IP and port in the configuration
- Check network routing: `ip route get 10.20.0.10`
- Ensure SD-Core AMF is running: check pod status or service status
- Verify no firewall is blocking SCTP (port 38412)

### Error: "DPDK EAL initialization failed"

**Cause**: DPDK cannot initialize due to missing resources or incorrect configuration.

**Diagnosis**:
```bash
# Check hugepages
grep Huge /proc/meminfo

# Check IOMMU groups
ls /sys/kernel/iommu_groups/

# Check device binding
dpdk-devbind.py --status
```

**Fix**:
- Ensure hugepages are allocated: see [DPDK Installation](../03-network-configuration/02-dpdk-setup.md)
- Verify the PCIe address in `hal.eal_args` matches a DPDK-bound device
- Ensure IOMMU is enabled in the kernel command line (`intel_iommu=on iommu=pt`)
- Run with `sudo` (DPDK requires root or appropriate capabilities)

### Error: "NG Setup failure — Unknown PLMN"

**Cause**: The PLMN configured in the gNB does not match any PLMN configured in the AMF.

**Fix**:
- Verify `cell_cfg.plmn` in gNB config matches the PLMN in SD-Core configuration
- Check that the TAC also matches
- Restart the AMF after configuration changes

### Error: "PHY slot processing overrun"

**Cause**: The CPU cannot complete PHY processing within the slot duration (0.5 ms for 30 kHz SCS).

**Fix**:
- Verify you are running a real-time kernel: `uname -r` should contain `rt` or `PREEMPT_RT`
- Confirm CPU isolation is active: `cat /proc/cmdline` should show `isolcpus=`
- Check that the lcore mapping targets isolated cores on the correct NUMA node
- Ensure no other processes are running on the isolated cores
- Reduce logging verbosity (set to `warning` or `error`)

:::danger
PHY slot overruns in a live deployment cause dropped radio frames and degraded service for all connected UEs. If overruns persist after the above fixes, the hardware may be insufficient for the configured bandwidth and MIMO mode. Consider reducing bandwidth or antenna count.
:::

### Error: "No fronthaul packets received"

**Cause**: The RU is not sending uplink data, or the data is not reaching the DU.

**Diagnosis**:
```bash
# Check if DPDK can see the interface
dpdk-devbind.py --status

# If using a physical connection, check link status
ethtool enp81s0f0  # (before DPDK binding)

# Check for VLAN mismatch — capture with tcpdump on a mirror port
```

**Fix**:
- Verify `ru_mac_addr` and `du_mac_addr` are correct
- Verify VLAN tags match between DU and RU
- Check physical cable connectivity
- Ensure the RU is powered on and configured for Split 7.2

## Testmode Performance Benchmarks

Use the following as rough reference values for a healthy testmode run on Intel Xeon (Cascade Lake+) with 100 MHz bandwidth and 30 kHz SCS:

| Metric | Expected Value | Notes |
|--------|---------------|-------|
| DL throughput (testmode) | 400–800 Mbps | Depends on MCS, MIMO rank, TDD ratio |
| UL throughput (testmode) | 50–150 Mbps | Limited by TDD UL ratio |
| CPU usage (PHY cores) | 80–100% | Poll-mode, expected to be high |
| CPU usage (system cores) | < 20% | Should be low |
| OFH late packets | 0 | Any non-zero value needs investigation |
| Memory usage | 2–8 GB | Stable after initial allocation |

:::tip
These benchmarks are for testmode with ideal simulated channel conditions (CQI=15). Real-world throughput will be lower due to actual channel conditions, UE capabilities, and propagation effects.
:::

## Next Steps

Once all checklist items pass and the gNB runs stably in testmode, proceed to [RF Optimization](./05-rf-optimization.md) to tune radio parameters for live operation with a physical RU and real UEs.
