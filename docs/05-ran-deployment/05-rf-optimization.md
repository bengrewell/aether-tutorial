---
id: rf-optimization
title: RF Parameter Optimization
sidebar_label: RF Optimization
sidebar_position: 5
description: Iterative tuning of uplink power control, antenna configuration, and RF parameters for optimal throughput and signal quality in a live srsRAN O-RAN Split 7.2 deployment.
keywords:
  - RF optimization
  - uplink power control
  - p0_nominal_with_grant
  - RSRP
  - SINR
  - MCS
  - HARQ
  - antenna placement
  - throughput tuning
  - iperf3
  - 5G performance
---

# RF Parameter Optimization

With the gNB validated in testmode and connected to a physical RU, the next step is iterative tuning of RF parameters to optimize signal quality and throughput for your specific environment. This guide covers uplink power control, target metrics, the tuning workflow, antenna considerations, and environmental factors.

RF optimization is inherently iterative — you make a change, observe the effect on metrics, and refine. There is no single "correct" configuration because every deployment environment (room geometry, antenna placement, interference landscape) is different.

## Uplink Power Control

Uplink power control determines how much transmit power a UE uses when sending data to the gNB. The goal is to ensure the gNB receives the UE's signal at an adequate power level — strong enough for reliable demodulation, but not so strong that it causes interference or wastes UE battery.

### p0_nominal_with_grant

The primary parameter for uplink power control in srsRAN is `p0_nominal_with_grant`, configured in the `cell_cfg` section:

```yaml
cell_cfg:
  pusch:
    p0_nominal_with_grant: -76
```

This parameter sets the **target received power per PRB** (in dBm) at the gNB for PUSCH (Physical Uplink Shared Channel) transmissions. The UE adjusts its transmit power based on:

- `p0_nominal_with_grant` (configured in SIB)
- Path loss estimate (derived from DL reference signal measurements)
- Fractional path loss compensation factor (alpha)
- TPC (Transmit Power Control) commands from the gNB

The open-loop power control formula (simplified) is:

```
P_UE_TX = p0_nominal + alpha × PL + delta_TF + f(TPC)
```

Where:
- `P_UE_TX` = UE transmit power (dBm)
- `p0_nominal` = target received power (`p0_nominal_with_grant`)
- `alpha` = path loss compensation factor (0 to 1; 1 = full compensation)
- `PL` = UE-estimated path loss (dB)
- `delta_TF` = transport format dependent offset
- `f(TPC)` = accumulated TPC adjustments

### Tuning p0_nominal_with_grant

| Scenario | Adjustment | Effect |
|----------|-----------|--------|
| UL SNR too low, high NACK rate | **Increase** p0 (e.g., -76 → -70) | UE transmits more power, stronger signal at gNB |
| UE near gNB, signal overloading | **Decrease** p0 (e.g., -76 → -82) | UE reduces transmit power, prevents ADC saturation |
| UE at cell edge, poor UL performance | **Increase** p0 | Compensates for higher path loss |
| UE battery drain is a concern | **Decrease** p0 (within acceptable SNR margin) | Reduces UE power consumption |

:::note
Start with `p0_nominal_with_grant: -76` as a reasonable default for indoor small-cell deployments. Adjust in steps of 2–3 dB based on observed UL metrics.
:::

## Target Metrics

When optimizing RF performance, monitor the following key metrics. These are reported by the gNB in its metrics output (console or JSON).

### Uplink Metrics

| Metric | Target Range | Description |
|--------|-------------|-------------|
| **UL RSRP** | -10 to -20 dB | Reference Signal Received Power at the gNB per antenna port. Indicates signal strength. |
| **PUSCH SINR** | > 25 dB | Signal-to-Interference-plus-Noise Ratio on the uplink shared channel. Higher is better. |
| **UL MCS** | 20–28 | Modulation and Coding Scheme index. Higher MCS = more bits per symbol = higher throughput. |
| **UL BLER** | < 10% | Block Error Rate. Percentage of uplink transport blocks that fail CRC. |
| **HARQ NACK rate** | < 10% | Percentage of HARQ transmissions requiring retransmission. |

### Downlink Metrics

| Metric | Target Range | Description |
|--------|-------------|-------------|
| **CQI** | 12–15 | Channel Quality Indicator reported by UE. 15 = best channel conditions. |
| **DL MCS** | 20–28 | Downlink MCS. Determined by scheduler based on CQI. |
| **DL BLER** | < 10% | Downlink block error rate. |
| **MIMO Rank** | 2–4 | Number of spatial layers used. Higher rank = higher throughput. |
| **SS-RSRP** (at UE) | > -100 dBm | SSB Reference Signal Received Power at the UE. |
| **SS-SINR** (at UE) | > 10 dB | SSB SINR at the UE. |

### Throughput Targets

Expected throughput depends heavily on MCS, MIMO rank, TDD pattern, and bandwidth. For a 100 MHz, n78, 7D2U TDD pattern with 4T2R:

| Direction | Rank 1 | Rank 2 | Rank 4 |
|-----------|--------|--------|--------|
| **DL peak** | ~250 Mbps | ~500 Mbps | ~900 Mbps |
| **UL peak** | ~50 Mbps | ~100 Mbps | — |

:::tip
These are theoretical peak values assuming MCS 27 (256QAM), no retransmissions, and full resource allocation. Real-world throughput is typically 60–80% of peak due to overhead (SSB, CORESET, DMRS, guard periods).
:::

## Iterative Tuning Process

Follow this systematic process to optimize RF parameters:

### Step 1: Start with Default Parameters

Launch the gNB with the configuration from [gNB Configuration](./03-gnb-configuration.md) and default power control settings:

```bash
sudo gnb -c gnb.yml
```

### Step 2: Attach a UE

Power on a 5G UE (commercial phone or test UE) and allow it to search for and attach to the cell. Verify attachment in the gNB logs:

```
UE rnti=0x4601 connected
PDU session established
```

:::warning
Ensure the UE's SIM/eSIM is provisioned in SD-Core with the matching PLMN, IMSI, and authentication keys. See [Section 06 - Core Network](../06-core-network/01-sd-core-overview.md) for subscriber provisioning.
:::

### Step 3: Monitor Baseline Metrics

Observe the gNB metrics output for 1–2 minutes to establish a baseline. Focus on:

```
          rnti | cqi | ri | mcs | brate | nof_nacks | snr
 UE 0x4601   14    2   25   450M       2      32.1
```

Key columns:
- **cqi**: Channel Quality Indicator (0–15)
- **ri**: Rank Indicator (1–4)
- **mcs**: Modulation and Coding Scheme (0–28)
- **brate**: Bit rate (throughput)
- **nof_nacks**: HARQ NACKs in the reporting interval
- **snr**: Signal-to-Noise Ratio (dB)

### Step 4: Adjust p0_nominal_with_grant

Based on the observed UL SNR:

| Observed UL SNR | Action |
|-----------------|--------|
| < 15 dB | Increase `p0_nominal_with_grant` by 3 dB |
| 15–25 dB | Minor adjustment (1–2 dB) if NACK rate is high |
| 25–35 dB | Good operating range, no change needed |
| > 35 dB | Consider decreasing by 2–3 dB to reduce UE power |

Edit the configuration, restart the gNB, re-attach the UE, and observe the change.

:::tip
Make only one parameter change at a time. Changing multiple parameters simultaneously makes it impossible to attribute the observed effect to a specific change.
:::

### Step 5: Check HARQ Retransmissions

High HARQ NACK rates indicate the receiver is failing to decode transport blocks on the first attempt. Investigate:

| NACK Rate | Likely Cause | Fix |
|-----------|-------------|-----|
| < 10% | Normal operation | No action needed |
| 10–20% | Marginal channel conditions | Adjust power control, check antenna alignment |
| 20–30% | Poor channel or interference | Move UE closer, check for interference sources |
| > 30% | Serious issue | Check timing, antenna connections, cabling, interference |

In the uplink, NACK rate is directly influenced by UL power control settings. In the downlink, it depends on channel conditions and DL power/beamforming.

### Step 6: Verify Throughput with iperf3

Once metrics look healthy, run throughput tests:

**Downlink test** (server on the data network, client on UE):

```bash
# On the server (connected to UPF data network)
iperf3 -s -p 5201

# On the UE
iperf3 -c <server_ip> -p 5201 -t 30 -R
```

**Uplink test**:

```bash
# On the UE
iperf3 -c <server_ip> -p 5201 -t 30
```

**Bidirectional test**:

```bash
# On the UE
iperf3 -c <server_ip> -p 5201 -t 30 --bidir
```

Compare the results against the expected throughput targets from the table above.

:::note
iperf3 measures TCP or UDP throughput at the application layer. TCP throughput will be lower than the radio layer peak due to TCP overhead and congestion control. Use UDP with a specified bandwidth (`-u -b 500M`) to test closer to the radio capacity.
:::

### Step 7: Iterate

Repeat steps 3–6, making incremental adjustments until:

- UL and DL throughput meet your deployment requirements
- HARQ NACK rate is consistently below 10%
- MCS is stable at a high value (20+)
- No late/dropped packets in OFH counters

<!-- IMAGE PLACEHOLDER: [Flowchart showing the iterative tuning process: Start → Attach UE → Monitor Metrics → Adjust Parameters → Re-test → Decision diamond (Meets targets?) → Yes: Done / No: loop back to Adjust Parameters] -->

## Antenna Considerations

Antenna placement and configuration significantly impact RF performance, often more than any software parameter adjustment.

### RU Antenna Placement

| Factor | Guidance |
|--------|----------|
| **Height** | Mount the RU at 2.5–3 m height for indoor deployments, tilted slightly downward toward the coverage area |
| **Orientation** | Align antenna boresight toward the center of the desired coverage area |
| **Clearance** | Maintain at least 1 m clearance from walls and metallic objects to avoid reflections |
| **Cable routing** | Keep RF cables as short as possible and avoid sharp bends (minimum bend radius per cable spec) |

### Near-Field vs. Far-Field

Understanding the antenna's near-field and far-field boundaries is important for testing:

```
Near-field boundary: d = 2 * D² / λ
```

Where:
- `D` = largest antenna dimension (meters)
- `λ` = wavelength at operating frequency

For a typical n78 RU (3.6 GHz, λ ≈ 0.083 m) with a 0.3 m antenna:

```
d = 2 × 0.3² / 0.083 ≈ 2.2 m
```

:::warning
Do not place the UE within the near-field boundary during testing. Near-field measurements are not representative of normal operating conditions. Maintain at least 3 meters distance for reliable measurements at n78 frequencies.
:::

### Cable Loss Budget

Account for cable losses in your power budget:

| Cable Type | Loss at 3.6 GHz (per meter) | Typical Length | Total Loss |
|-----------|---------------------------|----------------|------------|
| LMR-400 | ~0.22 dB/m | 3 m | 0.66 dB |
| LMR-600 | ~0.14 dB/m | 5 m | 0.70 dB |
| 1/2" superflex | ~0.11 dB/m | 10 m | 1.10 dB |
| Jumper (N-to-SMA) | 0.2–0.5 dB per connector | 2 connectors | 0.4–1.0 dB |

Add connector losses (typically 0.1–0.25 dB per connector). Total cable loss directly reduces effective radiated power and received signal strength.

:::tip
For lab testing, minimize cable length. Every dB of cable loss is a dB of signal you cannot recover. Direct connection (or very short jumpers) between the RU and test antenna is ideal.
:::

## Environmental Factors

### Interference Sources

Common sources of interference in the n78 band and adjacent frequencies:

| Source | Impact | Mitigation |
|--------|--------|------------|
| Adjacent 5G cells (macro) | Co-channel or adjacent-channel interference | Coordinate with operators, use frequency offsets |
| Wi-Fi at 5 GHz | Out-of-band but can cause receiver desensitization | Physical separation, band-pass filtering |
| Radar systems (C-band) | Can occupy n77/n78 spectrum | Check spectrum availability, DFS if applicable |
| Other lab equipment | Spurious emissions | Shield or relocate equipment |

### Multipath in Indoor Environments

Indoor deployments experience significant multipath propagation:

- **Reflections** from walls, floors, ceilings, and metallic surfaces create multiple signal paths
- **Delay spread** caused by multipath can impact channel estimation and equalization
- **Small-scale fading** causes rapid signal strength variations as the UE moves

The 5G NR OFDM waveform with cyclic prefix is inherently robust to multipath, but severe delay spread can still degrade performance.

**Mitigation strategies**:

1. **Antenna diversity** (4T2R or 4T4R) provides spatial diversity to combat fading
2. **MIMO spatial multiplexing** can exploit multipath for higher throughput in rich scattering environments
3. **Appropriate cyclic prefix** — the normal CP for 30 kHz SCS is 2.34 us, sufficient for most indoor environments
4. **UE positioning** — avoid deep nulls by testing at multiple locations in the coverage area

### Spectrum Analysis

Before deploying, perform a spectrum scan at your operating frequency to identify:

- Pre-existing signals in your band
- Noise floor level
- Intermittent interference sources

```bash
# If you have a USRP or SDR available
# Use srsRAN's cell_search tool or a spectrum analyzer application
```

:::note
A proper RF site survey with a calibrated spectrum analyzer is recommended for production deployments. For lab environments, a software-defined radio (SDR) running GNU Radio or similar tools can provide a basic spectrum view.
:::

## Summary: Optimization Quick Reference

| Parameter | Where to Configure | Starting Value | Adjust When |
|-----------|--------------------|---------------|-------------|
| `p0_nominal_with_grant` | `cell_cfg.pusch` | -76 dBm | UL SNR too low or too high |
| `iq_scaling` | `ru_ofh` | 5.5 dB | SSB/DL power needs adjustment |
| `nof_antennas_dl` | `cell_cfg` | 4 | Matching RU antenna count |
| `nof_antennas_ul` | `cell_cfg` | 2 | Matching RU antenna count |
| TDD pattern | `cell_cfg.tdd_ul_dl_cfg` | 7D2U | DL/UL ratio doesn't match traffic profile |
| T1a/Ta4 windows | `ru_ofh` | Per RU spec | OFH late/early packet counters non-zero |

## Next Steps

With the RAN optimized and validated, proceed to [Section 06 - Core Network](../06-core-network/01-sd-core-overview.md) to deploy and configure the Aether SD-Core 5G core network components, or to [Section 07 - Integration Testing](../07-integration-testing/01-sim-programming.md) if the core is already deployed and you are ready for end-to-end validation.
