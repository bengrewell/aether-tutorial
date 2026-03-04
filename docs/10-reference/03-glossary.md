---
id: glossary
title: Glossary of Terms
sidebar_label: Glossary
sidebar_position: 3
description: >
  Comprehensive glossary of telecommunications, 5G NR, O-RAN, and systems terminology
  used throughout the Aether SD-Core + srsRAN private 5G tutorial.
keywords:
  - 5G glossary
  - telecom terminology
  - ORAN terms
  - 3GPP definitions
  - NR terminology
  - RAN glossary
  - core network terms
  - DPDK glossary
---

# Glossary of Terms

This glossary defines the acronyms and technical terms used throughout the tutorial series. Entries are sorted alphabetically.

---

### AMF
**Access and Mobility Management Function.** The 5G core network function responsible for UE registration, authentication (in coordination with AUSF), mobility management, and NAS signaling. The gNB connects to the AMF via the NGAP protocol over SCTP. In Aether SD-Core, the AMF runs as a Kubernetes pod.

### ARFCN
**Absolute Radio Frequency Channel Number.** A numerical identifier that maps to a specific carrier frequency. In 5G NR, the downlink ARFCN (e.g., 627340) uniquely determines the center frequency of the cell. Defined in 3GPP TS 38.104.

### AUSF
**Authentication Server Function.** A 5G core network function that performs primary authentication of UEs using 5G-AKA or EAP-AKA' procedures. It interacts with the UDM to retrieve authentication credentials.

### BFP
**Block Floating Point.** A compression method used in O-RAN fronthaul to reduce the bandwidth required for IQ sample transport. BFP groups consecutive IQ samples into a block that shares a common exponent, typically achieving 30-50% compression with minimal signal degradation.

### BSR
**Buffer Status Report.** A MAC-layer message sent by the UE to inform the gNB about the amount of data waiting in its uplink buffers. The gNB scheduler uses BSRs to allocate uplink resources.

### CQI
**Channel Quality Indicator.** A metric reported by the UE to the gNB that describes the quality of the downlink channel. The gNB scheduler uses CQI to select the appropriate MCS for each UE.

### CU
**Central Unit.** In the 3GPP RAN functional split, the CU hosts the RRC, PDCP, and SDAP layers. It connects to one or more DUs via the F1 interface. srsRAN implements the CU as part of the monolithic gNB binary.

### CU-CP
**Central Unit — Control Plane.** The control-plane portion of the CU, handling RRC and PDCP-C (control plane PDCP). Communicates with the AMF via NGAP and with the CU-UP via E1AP.

### CU-UP
**Central Unit — User Plane.** The user-plane portion of the CU, handling PDCP-U (user plane PDCP) and SDAP. Communicates with the UPF via GTP-U and with the CU-CP via E1AP.

### DAC
**Digital-to-Analog Converter.** In the context of a Radio Unit, the DAC converts digital IQ samples into analog RF signals for transmission over the air.

### DCI
**Downlink Control Information.** Control messages transmitted on the PDCCH that inform UEs about downlink resource assignments, uplink grants, power control commands, and other scheduling decisions.

### DMRS
**Demodulation Reference Signal.** A reference signal transmitted alongside data on PDSCH (downlink) or PUSCH (uplink) that allows the receiver to estimate the channel and coherently demodulate the data.

### DN
**Data Network.** The external network (e.g., the internet) that a UE accesses through the 5G core. The UPF serves as the anchor point between the 5G core and the DN.

### DPDK
**Data Plane Development Kit.** A set of libraries and drivers for fast user-space packet processing that bypasses the Linux kernel network stack. In this tutorial, DPDK is used to accelerate O-RAN fronthaul (eCPRI) traffic between the DU and RU via the Intel E810 NIC.

### DRB
**Data Radio Bearer.** A logical channel between the UE and the gNB that carries user-plane data. Each PDU session typically maps to one or more DRBs, each associated with a QoS flow.

### DU
**Distributed Unit.** In the 3GPP RAN functional split, the DU hosts the RLC, MAC, and parts of the PHY layer. It connects to the CU via the F1 interface and to the RU via the O-RAN fronthaul. srsRAN implements the DU as part of the monolithic gNB binary.

### eCPRI
**enhanced Common Public Radio Interface.** The transport protocol used on the O-RAN fronthaul to carry IQ sample data, control messages, and synchronization information between the DU and RU. eCPRI can run over Ethernet (L2) or IP/UDP (L3).

### eNB
**eNodeB.** The base station in 4G LTE networks. Equivalent to the gNB in 5G NR.

### EPC
**Evolved Packet Core.** The core network architecture for 4G LTE, consisting of MME, SGW, PGW, and HSS. Superseded by the 5G Core (5GC) in 5G deployments.

### E-UTRA
**Evolved Universal Terrestrial Radio Access.** The radio access technology for 4G LTE, as defined by 3GPP.

### FDD
**Frequency Division Duplexing.** A duplexing method where uplink and downlink transmissions use separate frequency bands simultaneously. Contrast with TDD.

### gNB
**next generation NodeB.** The 5G NR base station. It implements the RAN protocol stack (RRC, PDCP, RLC, MAC, PHY) and connects to the 5G core via the NG interface. In this tutorial, srsRAN provides the gNB implementation.

### GNSS
**Global Navigation Satellite System.** A constellation of satellites providing positioning and timing services. GPS, Galileo, GLONASS, and BeiDou are all GNSS systems. The Intel E810 NIC can receive GNSS signals via an SMA connector to serve as a PTP Grandmaster time source.

### GTP-U
**GPRS Tunneling Protocol — User plane.** A tunneling protocol that encapsulates user-plane IP packets between the gNB (CU-UP) and the UPF. GTP-U adds a header containing a Tunnel Endpoint Identifier (TEID) for demultiplexing.

### HARQ
**Hybrid Automatic Repeat Request.** A MAC-layer error correction mechanism that combines forward error correction (FEC) with retransmissions. When the receiver cannot decode a transport block, it sends a NACK, and the transmitter retransmits additional redundancy bits that the receiver soft-combines with the original.

### IOMMU
**Input/Output Memory Management Unit.** A hardware unit that provides memory address translation and access control for DMA-capable devices. Required for DPDK VFIO-based device passthrough. Intel calls their implementation VT-d; AMD calls theirs AMD-Vi.

### IQ
**In-phase and Quadrature.** The two orthogonal components of a complex baseband signal. IQ samples are the raw digital representation of radio signals exchanged between the DU and RU over the O-RAN fronthaul.

### Ki
**Subscriber Authentication Key.** A 128-bit secret key stored on the SIM card and in the core network's subscriber database (UDM/UDR). Used in the 5G-AKA authentication procedure. Must match exactly between the SIM and the core.

### LDPC
**Low-Density Parity-Check.** The forward error correction coding scheme used for data channels (PDSCH, PUSCH) in 5G NR. LDPC offers near-Shannon-limit performance with parallelizable decoding.

### MAC
**Medium Access Control.** The layer-2 sublayer in the RAN protocol stack responsible for scheduling, HARQ, multiplexing logical channels onto transport channels, and random access. Sits between RLC (above) and PHY (below).

### MCS
**Modulation and Coding Scheme.** An index (0-28 in NR) that determines the combination of modulation order (QPSK, 16QAM, 64QAM, 256QAM) and code rate used for a transmission. Higher MCS values carry more data but require better channel conditions.

### MIMO
**Multiple-Input Multiple-Output.** A radio technique using multiple antennas at both transmitter and receiver to increase throughput (spatial multiplexing) or reliability (diversity). A 4x4 MIMO configuration uses 4 transmit and 4 receive antennas.

### MME
**Mobility Management Entity.** The control-plane node in the 4G EPC, analogous to the AMF in 5G.

### NACK
**Negative Acknowledgment.** A signal sent by the receiver in HARQ to indicate that a transport block was not successfully decoded, triggering a retransmission.

### NAS
**Non-Access Stratum.** The signaling layer between the UE and the core network (AMF) that handles registration, authentication, security, and session management. NAS messages are transparently relayed by the gNB.

### NF
**Network Function.** A processing function in the 5G core network with defined interfaces. Examples: AMF, SMF, UPF, NRF, AUSF, UDM, PCF. In SD-Core, each NF runs as a separate container.

### NMEA
**National Marine Electronics Association.** A standard for the data format output by GNSS receivers. NMEA sentences provide time, date, position, and satellite information. The E810 GNSS receiver outputs NMEA data used by `ts2phc`.

### NR
**New Radio.** The 5G radio access technology defined by 3GPP, supporting frequencies from sub-1 GHz to 71 GHz, flexible numerology, massive MIMO, and beamforming.

### NRF
**Network Repository Function.** A 5G core NF that provides service registration and discovery. Other NFs register with the NRF and query it to find the addresses of peer NFs.

### NSSF
**Network Slice Selection Function.** A 5G core NF that selects the appropriate network slice for a UE based on the requested S-NSSAI (Single Network Slice Selection Assistance Information).

### OAM
**Operations, Administration, and Maintenance.** The management and monitoring functions for network equipment. In O-RAN, the M-plane handles OAM for the Radio Unit.

### OFH
**Open Fronthaul.** The O-RAN Alliance specification for the interface between the DU and RU, defining the transport of IQ samples, control messages, synchronization, and management data. srsRAN implements OFH for Split 7.2.

### OPC
**Operator Variant Algorithm Configuration Field.** A 128-bit value derived from the operator key (OP) and Ki, used in the MILENAGE authentication algorithm. Stored on the SIM and in the UDM database.

### ORAN
**Open Radio Access Network.** An initiative (O-RAN Alliance) to define open, interoperable interfaces in the RAN. Key specifications include the fronthaul (7.2x split), RIC (RAN Intelligent Controller), and management interfaces.

### PBCH
**Physical Broadcast Channel.** The physical channel that carries the Master Information Block (MIB), which UEs read during initial cell search. Transmitted within the SSB.

### PCF
**Policy Control Function.** A 5G core NF that provides policy rules for QoS, charging, and access control to the SMF and AMF.

### PDCP
**Packet Data Convergence Protocol.** A RAN protocol sublayer between RRC/SDAP (above) and RLC (below). PDCP handles header compression, ciphering, integrity protection, reordering, and duplicate detection.

### PDSCH
**Physical Downlink Shared Channel.** The main physical channel for carrying downlink user data and some control information (e.g., SIBs, paging). Scheduled dynamically by the MAC layer.

### PHC
**PTP Hardware Clock.** A hardware clock embedded in network interface cards (like the Intel E810) that provides nanosecond-precision timestamps. PTP software (`ptp4l`) disciplines the PHC to a Grandmaster, and `phc2sys` can synchronize the system clock to the PHC.

### PHY
**Physical Layer.** The lowest layer of the RAN protocol stack, responsible for modulation/demodulation, channel coding/decoding, OFDM processing, beamforming, and timing synchronization. In O-RAN Split 7.2, the PHY is split between the DU (high-PHY) and RU (low-PHY).

### PLMN
**Public Land Mobile Network.** A mobile network identified by a combination of MCC (Mobile Country Code) and MNC (Mobile Network Code). For example, MCC=001, MNC=01 gives PLMN 00101, which is a test PLMN commonly used in lab environments.

### PPS
**Pulse Per Second.** A precision timing signal — a rising edge once per second — used to synchronize clocks. GNSS receivers output a 1PPS signal that the E810 NIC uses as a time reference.

### PRACH
**Physical Random Access Channel.** The uplink physical channel used by UEs to initiate random access (e.g., during initial attach or handover). The gNB configures PRACH occasions and preamble sequences.

### PRB
**Physical Resource Block.** The basic unit of frequency-domain resource allocation in NR. One PRB consists of 12 consecutive subcarriers. A 100 MHz channel with 30 kHz SCS contains 273 PRBs.

### PSS
**Primary Synchronization Signal.** One of two synchronization signals (along with SSS) transmitted in the SSB. The UE uses PSS to achieve initial time and frequency synchronization with the cell.

### PTP
**Precision Time Protocol.** IEEE 1588 protocol for synchronizing clocks across a network with sub-microsecond accuracy. Essential for O-RAN Split 7.2 operation where the DU and RU must be time-aligned. Implemented by `ptp4l` from the LinuxPTP project.

### PUCCH
**Physical Uplink Control Channel.** The uplink physical channel for carrying control information from the UE, including HARQ ACK/NACK, CQI reports, scheduling requests, and CSI feedback.

### PUSCH
**Physical Uplink Shared Channel.** The main uplink physical channel for carrying user data and some control information from the UE. Dynamically scheduled by the gNB.

### QoS
**Quality of Service.** A framework for differentiating traffic treatment based on requirements such as latency, reliability, and throughput. In 5G, QoS flows are mapped to DRBs with specific 5QI (5G QoS Identifier) values.

### RAN
**Radio Access Network.** The part of the mobile network that provides wireless connectivity between UEs and the core network. In 5G, the RAN consists of gNBs (and optionally ng-eNBs for LTE interworking).

### RLC
**Radio Link Control.** A RAN protocol sublayer between MAC (below) and PDCP (above). RLC provides segmentation/reassembly, retransmission (in AM mode), and duplicate detection.

### RMS
**Root Mean Square.** A statistical measure of signal amplitude. In the context of RF, RMS voltage or power describes the effective signal level.

### RNTI
**Radio Network Temporary Identifier.** A temporary identifier assigned to a UE by the gNB for use in scheduling and control signaling. Different RNTI types exist (C-RNTI, RA-RNTI, SI-RNTI, P-RNTI) for different purposes.

### RRC
**Radio Resource Control.** The highest RAN protocol layer, responsible for establishing, maintaining, and releasing the radio connection. RRC handles cell selection/reselection, measurement configuration, handover, and security activation.

### RU
**Radio Unit.** In the O-RAN architecture, the RU implements the low-PHY (FFT/iFFT, beamforming, digital-to-analog conversion) and the RF front-end (amplifiers, filters, antennas). Connected to the DU via the O-RAN fronthaul interface.

### S1AP
**S1 Application Protocol.** The control-plane protocol between the eNB and MME in 4G LTE. The 5G equivalent is NGAP (NG Application Protocol) between the gNB and AMF.

### SCS
**Subcarrier Spacing.** The frequency spacing between adjacent subcarriers in the OFDM waveform. NR supports SCS values of 15, 30, 60, 120, and 240 kHz. Higher SCS reduces symbol duration and latency but requires wider minimum bandwidth.

### SCTP
**Stream Control Transmission Protocol.** A transport-layer protocol used for signaling in mobile networks (NGAP, S1AP). SCTP provides multi-streaming, multi-homing, and message-oriented delivery. The gNB connects to the AMF using SCTP on port 38412.

### SD-Core
**Software-Defined Core.** The 5G core network implementation from the Open Networking Foundation (ONF), part of the Aether platform. SD-Core is cloud-native, Kubernetes-based, and implements the full set of 3GPP 5G core NFs.

### SDAP
**Service Data Adaptation Protocol.** The topmost user-plane protocol in the 5G RAN, sitting above PDCP. SDAP maps QoS flows to data radio bearers (DRBs).

### SDR
**Software-Defined Radio.** A radio communication system where components traditionally implemented in hardware (filters, modulators, demodulators) are implemented in software. srsRAN supports SDR devices (e.g., USRP) for Split 8 (RF split) deployments.

### SIB
**System Information Block.** Broadcast messages that provide UEs with information about the cell configuration, access parameters, and neighboring cells. SIB1 (carried on PDSCH) contains essential cell access information.

### SIM
**Subscriber Identity Module.** A smart card (or eSIM) that stores the subscriber's identity (IMSI/SUPI), authentication keys (Ki, OPc), and network-specific parameters. Physical SIM cards (programmable) are used in this tutorial.

### SMF
**Session Management Function.** A 5G core NF responsible for PDU session establishment, modification, and release. The SMF selects a UPF, allocates IP addresses, and configures QoS policies.

### SNR
**Signal-to-Noise Ratio.** The ratio of desired signal power to noise power, typically expressed in dB. Higher SNR enables higher MCS and throughput. Reported by the UE via CQI/CSI.

### SRB
**Signaling Radio Bearer.** A logical channel between the UE and the gNB that carries RRC and NAS signaling. SRB0 is used before security activation; SRB1 carries RRC messages; SRB2 carries NAS messages after security activation.

### SR-IOV
**Single Root I/O Virtualization.** A PCI Express standard that allows a single physical NIC to present multiple Virtual Functions (VFs) to the OS or hypervisor. Used in this tutorial to provide dedicated DPDK-capable interfaces for the gNB while keeping other interfaces available for the kernel.

### SRS
**Sounding Reference Signal.** An uplink reference signal transmitted by the UE that the gNB uses to estimate the uplink channel quality across the full bandwidth. Used for frequency-selective scheduling and MIMO precoding decisions. Also the name of the company (SRS — Software Radio Systems) that develops srsRAN.

### SSB
**Synchronization Signal Block.** A set of physical channels and signals (PSS, SSS, PBCH) transmitted periodically by the gNB to enable cell search, synchronization, and system information acquisition by UEs.

### SSS
**Secondary Synchronization Signal.** One of two synchronization signals (along with PSS) in the SSB. Together with PSS, the SSS allows the UE to determine the Physical Cell Identity (PCI).

### SUCI
**Subscription Concealed Identifier.** An encrypted form of the SUPI used during initial registration to protect the subscriber's permanent identity over the air. The AUSF decrypts the SUCI using the home network's private key.

### SUPI
**Subscription Permanent Identifier.** The globally unique permanent identifier for a subscriber in 5G. Typically in IMSI format (MCC + MNC + MSIN). Stored on the SIM and in the UDM.

### TAC
**Tracking Area Code.** A 16-bit or 24-bit identifier for a tracking area — a group of cells within which a UE can move without updating its registration. The TAC in the gNB configuration must match the TAC configured in the AMF.

### TDD
**Time Division Duplexing.** A duplexing method where uplink and downlink transmissions share the same frequency band but alternate in time. Used in NR band n78 (and most NR bands). The TDD pattern defines the UL/DL slot ratio.

### TuneD
**TuneD.** A Linux system tuning daemon that applies predefined or custom profiles to optimize system performance. In this tutorial, a custom `realtime-5g` TuneD profile configures CPU isolation, power management, and kernel parameters for low-latency RAN operation.

### UDM
**Unified Data Management.** A 5G core NF that manages subscriber data (authentication credentials, subscription profiles, access authorization). Equivalent to the 4G HSS.

### UDR
**Unified Data Repository.** A 5G core NF that provides persistent storage for subscription data, policy data, and application data. The UDM reads and writes subscriber records via the UDR.

### UE
**User Equipment.** The end-user device that connects to the 5G network — a smartphone, modem, IoT device, or CPE (Customer Premises Equipment).

### UPF
**User Plane Function.** The 5G core NF that handles user-plane packet processing: GTP-U tunnel termination, packet forwarding, QoS enforcement, and traffic accounting. In SD-Core, the UPF is based on BESS (Berkeley Extensible Software Switch) with optional DPDK acceleration.

### VF
**Virtual Function.** In SR-IOV, a lightweight PCIe function created by the Physical Function (PF) that can be independently assigned to a virtual machine, container, or DPDK application. Each VF has its own set of queues and can be bound to `vfio-pci`.

### VNF
**Virtualized Network Function.** A network function implemented in software and running on virtual infrastructure (VMs or containers) rather than on dedicated hardware. All SD-Core NFs are VNFs running as containers.
