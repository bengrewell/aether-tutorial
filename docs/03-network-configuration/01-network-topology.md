---
id: network-topology
title: "Network Topology and IP Addressing"
sidebar_label: Network Topology
sidebar_position: 1
description: >
  Physical and logical network topology for a private 5G deployment with Aether
  SD-Core and srsRAN. Covers fronthaul (eCPRI), backhaul (N2/N3), management,
  and data network design, IP addressing plan, VLAN configuration, and Netplan
  examples for the Intel E810-XXVDA4T NIC.
keywords:
  - network topology
  - 5G network architecture
  - IP addressing plan
  - eCPRI fronthaul
  - N2 N3 backhaul
  - VLAN configuration
  - Netplan
  - Intel E810
  - private 5G networking
---

# Network Topology and IP Addressing

A private 5G deployment requires multiple isolated network segments, each serving a distinct purpose with different performance characteristics. This page defines the physical and logical topology, assigns IP addresses and VLANs, and provides Netplan configuration for every interface on the server.

## Physical Topology

The reference deployment uses a single server equipped with:

- **On-board management NIC** (e.g., `eno1`) -- 1 GbE, connected to the management/OAM switch.
- **Intel E810-XXVDA4T** (4 x 25 GbE SFP28 ports) -- provides dedicated ports for fronthaul, backhaul, and the data network.

The E810 ports connect to the following physical network segments:

| E810 Port | Physical Connection | Cable / Optic | Speed |
|-----------|-------------------|---------------|-------|
| Port 0 | Radio Unit (RU) fronthaul switch or direct | SFP28 25G DAC or fiber | 25 Gbps |
| Port 1 | Core network switch (N2/N3) | SFP28 25G DAC or fiber | 25 Gbps |
| Port 2 | Data network / internet gateway (N6) | SFP28 25G DAC or fiber | 25 Gbps |
| Port 3 | Spare / redundancy | -- | 25 Gbps |

The on-board NIC connects to a standard management switch that provides SSH access, monitoring, and out-of-band management.

<!-- IMAGE PLACEHOLDER: Physical topology diagram showing the server with E810 NIC, four SFP28 ports labeled P0-P3, connections to: (P0) Radio Unit via fronthaul switch, (P1) core network switch, (P2) internet/DN router, (P3) spare. On-board NIC (eno1) connected to management switch. Include a laptop connected to the management switch for SSH access. -->

:::tip
If you are connecting the fronthaul port directly to the RU (no switch), make sure you use a **DAC cable or fiber** that supports 25 Gbps. Many RUs ship with 10G SFP+ optics -- verify the RU port speed matches the E810 port configuration.
:::

## Logical Networks

The deployment requires four logically separate networks. Even though some may share the same physical switch infrastructure, they must be isolated at Layer 2 (VLANs) or Layer 3 (separate subnets with firewall rules).

### Fronthaul Network (eCPRI)

The fronthaul carries **IQ sample data** between the Distributed Unit (DU) running on the server and the Radio Unit (RU). In an ORAN Split 7.2 deployment, this uses the **eCPRI** (enhanced Common Public Radio Interface) protocol over Ethernet.

Key characteristics:

- **Protocol:** eCPRI over Ethernet (typically raw Ethernet frames, not IP-based).
- **VLAN:** Tagged with VLAN 2 (configurable; must match the RU configuration).
- **Bandwidth:** Up to ~10 Gbps for a 100 MHz TDD cell (depends on numerology, MIMO layers, and compression).
- **Latency:** Sub-millisecond. The fronthaul has strict timing requirements tied to the 5G NR slot structure.
- **Interface:** E810 Port 0, accessed via DPDK (kernel bypass). The kernel does not see this traffic -- srsRAN's DU process handles it directly.

:::warning
The fronthaul interface is **not** configured with a normal IP address when DPDK is in use. DPDK binds the interface (or a Virtual Function on it) directly, removing it from kernel networking. The VLAN tag and MAC-level configuration happen inside srsRAN's DU configuration, not in Netplan.
:::

### Backhaul Network (N2 / N3)

The backhaul connects the gNB to the 5G core network functions:

- **N2 interface:** gNB to AMF (Access and Mobility Management Function). Carries **NGAP** signaling over **SCTP**. Used for UE attach, handover, paging, and session management signaling.
- **N3 interface:** gNB to UPF (User Plane Function). Carries **user-plane data** encapsulated in **GTP-U** tunnels over UDP/IP.

Key characteristics:

- **Protocol:** IP-based (SCTP for N2, UDP for N3).
- **VLAN:** Untagged in this reference design (dedicated physical port). Use a VLAN if sharing a port.
- **Bandwidth:** N2 signaling is low-bandwidth. N3 throughput matches the aggregate user-plane throughput of connected UEs.
- **Interface:** E810 Port 1, managed by the kernel with a standard IP address.

### Management Network

The management network provides:

- **SSH access** to the server.
- **Monitoring** traffic (Prometheus scraping, Grafana dashboards).
- **OAM** (Operations, Administration, and Maintenance) for the RU (many RUs expose a web UI or NETCONF/YANG interface on a management VLAN).

Key characteristics:

- **Protocol:** Standard TCP/IP.
- **VLAN:** Untagged (native VLAN on the management switch).
- **Bandwidth:** Low (< 100 Mbps typical).
- **Interface:** On-board NIC (`eno1`), 1 GbE.

### Data Network (N6)

The N6 interface connects the UPF to the external data network (internet or a private enterprise network). This is where user traffic exits the 5G system.

Key characteristics:

- **Protocol:** Standard IP. The UPF performs NAT or routes UE traffic toward the DN.
- **VLAN:** Untagged in this reference design.
- **Bandwidth:** Aggregate of all UE traffic destined for the internet/DN.
- **Interface:** E810 Port 2, managed by the kernel with a standard IP address.

## IP Addressing Plan

The following table defines the reference IP addressing scheme. Adjust subnets and addresses to fit your environment, but maintain the logical separation.

| Network | Subnet | VLAN | Interface | Server IP | Gateway | Purpose |
|---------|--------|------|-----------|-----------|---------|---------|
| Management | 192.168.1.0/24 | -- (native) | `eno1` | 192.168.1.10 | 192.168.1.1 | SSH, OAM, monitoring |
| Fronthaul (eCPRI) | 10.10.0.0/24 | 2 | E810 P0 (DPDK) | 10.10.0.1 | -- | eCPRI IQ samples to RU |
| Backhaul (N2/N3) | 10.20.0.0/24 | -- | E810 P1 (`enp81s0f1`) | 10.20.0.10 | 10.20.0.1 | gNB to AMF/UPF |
| Data (N6) | 10.30.0.0/24 | -- | E810 P2 (`enp81s0f2`) | 10.30.0.10 | 10.30.0.1 | UPF to internet/DN |

:::note
The fronthaul IP address (10.10.0.1) is configured **inside srsRAN's DU configuration**, not in the operating system, because DPDK bypasses the kernel network stack. The address is listed here for planning purposes and to avoid conflicts.
:::

### Core Network Function Addresses

When SD-Core runs on the **same server** (single-node deployment), the core NFs are typically reached via Kubernetes pod or service IPs. For reference, the key addresses the gNB needs to know are:

| Function | Address | Port | Protocol | Notes |
|----------|---------|------|----------|-------|
| AMF (N2) | 10.20.0.10 (or K8s service IP) | 38412 | SCTP | NGAP signaling |
| UPF (N3) | 10.20.0.10 (or K8s service IP) | 2152 | UDP | GTP-U user plane |

If the core runs on a **separate server**, replace these with the actual IPs of that server's backhaul interface.

## Interface Naming

Ubuntu 24.04 uses **predictable network interface names** by default. The E810's four ports will appear as names based on PCI bus location, such as:

```
enp81s0f0   # E810 Port 0 (PCI bus 81, slot 0, function 0)
enp81s0f1   # E810 Port 1
enp81s0f2   # E810 Port 2
enp81s0f3   # E810 Port 3
```

To determine the actual names on your system:

```bash
$ ip link show | grep -E "^[0-9]+" | awk '{print $2}' | tr -d ':'
```

Or list the E810 ports specifically:

```bash
$ ls -la /sys/class/net/ | grep -i e810
# Or identify by driver:
$ for iface in /sys/class/net/*/device/driver; do
    echo "$(basename $(dirname $(dirname $iface))): $(basename $(readlink $iface))"
  done | grep ice
```

The `ice` driver is the kernel driver for the Intel E810. All four ports should appear with this driver.

:::tip
If your system uses different PCI slot numbers, the interface names will differ. Throughout this tutorial, we use `enp81s0f0` through `enp81s0f3` as representative names. **Replace these with your actual interface names** wherever they appear.
:::

## Netplan Configuration

Ubuntu 24.04 uses [Netplan](https://netplan.readthedocs.io/) for network configuration. Below is the complete Netplan configuration covering all interfaces.

Create or edit the Netplan configuration file:

```yaml title="/etc/netplan/01-network-config.yaml"
network:
  version: 2
  renderer: networkd

  ethernets:
    # ── Management Interface ──────────────────────────────
    eno1:
      addresses:
        - 192.168.1.10/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
      mtu: 1500

    # ── Fronthaul (E810 Port 0) ───────────────────────────
    # NOTE: This interface is managed by DPDK at runtime.
    # We define it here only to ensure it is UP at boot so
    # that VFs can be created. Do NOT assign an IP address.
    enp81s0f0:
      mtu: 9000
      optional: true

    # ── Backhaul N2/N3 (E810 Port 1) ─────────────────────
    enp81s0f1:
      addresses:
        - 10.20.0.10/24
      routes:
        - to: 10.20.0.0/24
          via: 10.20.0.1
      mtu: 9000

    # ── Data Network N6 (E810 Port 2) ────────────────────
    enp81s0f2:
      addresses:
        - 10.30.0.10/24
      routes:
        - to: default
          via: 10.30.0.1
          metric: 200
      mtu: 9000

    # ── Spare (E810 Port 3) ──────────────────────────────
    enp81s0f3:
      optional: true
```

:::warning
Do **not** configure two default gateways without using route metrics. In the example above, the management interface (`eno1`) is the primary default route, and the N6 interface has a higher metric (200) so it serves as a fallback. If your N6 traffic must route through its own gateway, use policy-based routing instead.
:::

### Applying the Configuration

```bash
# Validate the configuration first
$ sudo netplan try
# If the configuration is correct and connectivity is maintained, accept it:
# Press ENTER to accept, or wait for automatic revert after 120 seconds

# Or apply directly (no automatic revert safety net):
$ sudo netplan apply
```

After applying, verify each interface:

```bash
$ ip addr show eno1
$ ip addr show enp81s0f1
$ ip addr show enp81s0f2
```

### Fronthaul VLAN Configuration

Since the fronthaul uses DPDK, the VLAN tag is **not** configured in Netplan. Instead, it is set in the srsRAN DU configuration file. For reference, the relevant srsRAN configuration snippet is:

```yaml title="/etc/srsran/gnb.yaml (excerpt)"
ru_ofh:
  vlan_tag: 2
```

If you need a kernel-visible VLAN subinterface on the fronthaul port for **non-DPDK testing** (e.g., pinging the RU's management interface), you can temporarily add a VLAN in Netplan:

```yaml title="/etc/netplan/01-network-config.yaml (temporary, for testing only)"
  vlans:
    vlan2:
      id: 2
      link: enp81s0f0
      addresses:
        - 10.10.0.1/24
      mtu: 9000
```

:::danger
Remove any kernel VLAN configuration on the fronthaul port before starting srsRAN with DPDK. DPDK and the kernel cannot share the same physical port simultaneously. Leaving both active will cause undefined behavior and packet loss.
:::

## Verifying Connectivity

After applying the Netplan configuration, verify connectivity on each network segment:

### Management Network

```bash
$ ping -c 4 192.168.1.1
$ ssh localhost  # verify SSH is accessible
```

### Backhaul Network

```bash
$ ping -c 4 10.20.0.1
# If the core is on a separate server:
$ ping -c 4 <CORE_SERVER_BACKHAUL_IP>
```

### Data Network

```bash
$ ping -c 4 10.30.0.1
$ ping -c 4 8.8.8.8  # verify internet reachability through N6
```

### Fronthaul Network

Fronthaul connectivity cannot be verified with `ping` when DPDK is active. Verification happens later during [DPDK Setup](./02-dpdk-setup.md) and [RAN Deployment](../05-ran-deployment/02-building-srsran.md).

## Network Security Considerations

:::warning
The reference configuration does **not** include firewalling. In a production deployment, you should:

- Restrict management access to specific source IPs using `ufw` or `nftables`.
- Isolate the fronthaul network on a dedicated VLAN with no external routing.
- Apply rate limiting on the N6 interface.
- Use IPsec on the N2/N3 interfaces if the core and gNB are on separate physical networks.
:::

## Next Steps

With the network topology defined and interfaces configured, proceed to [DPDK Setup](./02-dpdk-setup.md) to configure kernel bypass for the fronthaul interface.
