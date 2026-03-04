---
id: troubleshooting
title: Troubleshooting Guide
sidebar_label: Troubleshooting
sidebar_position: 2
description: >
  Comprehensive troubleshooting guide for the Aether SD-Core + srsRAN private 5G
  deployment, organized by subsystem. Covers boot, DPDK, PTP, gNB, core network,
  UE connectivity, and Kubernetes issues with symptoms, causes, and resolution steps.
keywords:
  - troubleshooting
  - debugging 5G
  - srsRAN errors
  - DPDK issues
  - PTP synchronization
  - gNB crash
  - UE attach failure
  - Kubernetes pod errors
  - SD-Core troubleshooting
  - ORAN fronthaul
---

# Troubleshooting Guide

This page catalogs common problems encountered when building a private 5G lab with Aether SD-Core and srsRAN. Issues are organized by subsystem. For each issue you will find the symptom, possible causes, and resolution steps.

:::tip
When troubleshooting, always start by checking the logs. The most useful log sources are:

- **gNB**: `/tmp/gnb.log` or stdout (set `log.all_level: info` or `debug` in `gnb.yml`)
- **SD-Core**: `kubectl logs -n omec <pod-name>`
- **PTP**: `journalctl -u ptp4l` and `journalctl -u phc2sys`
- **System**: `dmesg`, `journalctl -b`
:::

---

## Boot and System Issues

### Kernel Panic on Boot After Installing RT Kernel

**Symptom:** The system panics or hangs during boot after installing `linux-image-realtime` or a custom `PREEMPT_RT` kernel.

**Possible causes:**
1. Incompatible kernel module (e.g., out-of-tree NVIDIA driver compiled for a non-RT kernel).
2. GRUB parameters conflicting with the RT kernel (e.g., `isolcpus` specifying cores that do not exist).
3. Secure Boot rejecting an unsigned kernel.

**Resolution:**
1. Boot into the previous (non-RT) kernel by selecting it in the GRUB menu (hold Shift during POST).
2. Check `dmesg` output from the failed boot (if captured): `journalctl --boot=-1`.
3. If caused by an NVIDIA driver, remove it or rebuild with `dkms` against the RT kernel headers.
4. Verify your `isolcpus` range does not exceed the number of available CPUs: `lscpu | grep "^CPU(s)"`.
5. If Secure Boot is the issue, either enroll the kernel signing key via MOK or disable Secure Boot in the BIOS.

---

### Hugepage Allocation Failures

**Symptom:** After boot, `cat /proc/meminfo | grep Huge` shows fewer hugepages than requested. DPDK applications fail with memory allocation errors.

**Possible causes:**
1. Not enough contiguous physical memory available at boot time.
2. GRUB hugepage parameters are not being applied (e.g., `update-grub` was not run).
3. Memory is fragmented if hugepages were requested after boot rather than via GRUB.

**Resolution:**
1. Verify GRUB parameters are active: `cat /proc/cmdline | grep hugepages`.
2. If parameters are missing, re-run `sudo update-grub` and reboot.
3. For 1 GB hugepages, they **must** be allocated at boot via GRUB. They cannot be allocated at runtime.
4. If the system does not have enough RAM, reduce the hugepage count. DPDK typically needs 2-4 GB for the gNB; 16 x 1 GB is generous.
5. Check that no other application is consuming hugepages: `cat /sys/kernel/mm/hugepages/hugepages-1048576kB/free_hugepages`.

---

### IOMMU Errors or IOMMU Not Enabled

**Symptom:** `dmesg | grep -i iommu` shows no IOMMU initialization, or DPDK complains about IOMMU not being available.

**Possible causes:**
1. IOMMU not enabled in BIOS (Intel VT-d / AMD-Vi).
2. Missing `intel_iommu=on iommu=pt` in GRUB parameters.
3. On AMD systems: `amd_iommu=on iommu=pt` is needed instead of `intel_iommu=on`.

**Resolution:**
1. Enter BIOS setup and enable Intel VT-d (or AMD-Vi / AMD IOMMU).
2. Verify GRUB: `cat /proc/cmdline | grep iommu`.
3. If missing, add the parameters to `/etc/default/grub`, run `sudo update-grub`, and reboot.
4. After reboot, confirm: `dmesg | grep -i "DMAR\|IOMMU"` should show the IOMMU being initialized.

---

## DPDK Issues

### DPDK Bind Failure — "Cannot bind to driver"

**Symptom:** `dpdk-devbind.py -b vfio-pci 0000:xx:xx.x` fails with "Error: bind failed" or "No such device".

**Possible causes:**
1. The `vfio-pci` kernel module is not loaded.
2. IOMMU is not enabled (see above).
3. The device is currently in use by a kernel driver and the kernel driver was not unbound first.
4. Incorrect PCIe BDF address.

**Resolution:**
1. Load the module: `sudo modprobe vfio-pci`.
2. Verify IOMMU: `dmesg | grep -i iommu`.
3. Check the current driver: `dpdk-devbind.py -s | grep <BDF>`.
4. Unbind from the kernel driver first:
   ```bash
   sudo dpdk-devbind.py -u 0000:xx:xx.x
   sudo dpdk-devbind.py -b vfio-pci 0000:xx:xx.x
   ```
5. Verify the BDF with `lspci | grep -i ethernet`.

---

### DPDK No Hugepages Available

**Symptom:** DPDK application exits with `EAL: No free 2048 kB hugepages reported` or similar.

**Possible causes:**
1. Hugepages not allocated (see Boot section above).
2. Hugepage filesystem not mounted.
3. Another DPDK process already consumed all available hugepages.

**Resolution:**
1. Check allocation: `cat /proc/meminfo | grep HugePages_`.
2. Mount the filesystem if missing:
   ```bash
   sudo mkdir -p /dev/hugepages
   sudo mount -t hugetlbfs nodev /dev/hugepages
   ```
3. For persistent mount, add to `/etc/fstab`:
   ```
   nodev /dev/hugepages hugetlbfs defaults 0 0
   ```
4. Kill any stale DPDK processes: `sudo fuser -k /dev/hugepages/*`.

---

### Permission Errors with DPDK / VFIO

**Symptom:** Non-root user cannot access VFIO devices. Error: "Permission denied" on `/dev/vfio/X`.

**Possible causes:**
1. The user is not in the correct group.
2. VFIO container permissions are restrictive.

**Resolution:**
1. Run the gNB as root (simplest for a lab), or:
2. Add a udev rule to set permissions:
   ```bash
   echo 'SUBSYSTEM=="vfio", MODE="0666"' | sudo tee /etc/udev/rules.d/99-vfio.rules
   sudo udevadm control --reload-rules
   sudo udevadm trigger
   ```
3. Alternatively, use `unsafe_noiommu_mode` for testing only (not recommended for production):
   ```bash
   echo 1 | sudo tee /sys/module/vfio/parameters/enable_unsafe_noiommu_mode
   ```

---

### testpmd Crashes or Shows No Traffic

**Symptom:** `dpdk-testpmd` starts but shows 0 RX/TX packets, or crashes immediately.

**Possible causes:**
1. Wrong PCIe BDF specified in EAL arguments.
2. No link partner (cable not connected, RU not powered on).
3. Core mask includes cores not isolated or not available.

**Resolution:**
1. Start with a minimal testpmd command to validate:
   ```bash
   sudo dpdk-testpmd -l 4,5 -a 0000:xx:xx.x -- -i --forward-mode=macswap
   ```
2. Inside testpmd, check port status: `show port info 0`.
3. If "Link status: down", check physical cabling and the RU's power state.
4. Verify the EAL core list uses only isolated, available cores.

---

## PTP Issues

### No Grandmaster Found

**Symptom:** `ptp4l` logs show `port 1: LISTENING` indefinitely and never transitions to `SLAVE` or `MASTER` state. Offset values are never printed.

**Possible causes:**
1. No GM is present on the network (or GM is on a different VLAN / broadcast domain).
2. PTP domain mismatch between GM and follower.
3. Network transport mismatch (L2 vs. UDP).
4. Physical layer issue (cable, switch port, VLAN configuration).

**Resolution:**
1. Verify the GM is running: on the GM host, check `ptp4l` status and ensure it is in `MASTER` state.
2. Ensure `domainNumber` matches in both configurations.
3. Ensure `network_transport` matches (both must be `L2` or both `UDPv4`).
4. If using a switch, confirm it passes PTP multicast frames (some managed switches filter multicast by default).
5. Use `tcpdump -i <interface> -nn ether proto 0x88f7` to check for PTP frames on the wire.

---

### High PTP Offset (Microseconds or More)

**Symptom:** `ptp4l` synchronizes but reports offsets in the hundreds of nanoseconds or microseconds range, causing OFH timing errors in the gNB.

**Possible causes:**
1. Software timestamping instead of hardware timestamping.
2. Network path includes a non-PTP-aware switch introducing variable delay.
3. CPU frequency scaling causing TSC drift.

**Resolution:**
1. Confirm hardware timestamping: `ethtool -T <interface>` must show `hardware-raw-clock`.
2. Verify `time_stamping hardware` is set in the ptp4l config.
3. Use a PTP-aware (boundary clock or transparent clock) switch, or connect the GM and follower directly.
4. Ensure `intel_pstate=disable` and a fixed-frequency governor: `cpupower frequency-set -g performance`.
5. Target offset should be under 100 ns for O-RAN Split 7.2.

---

### phc2sys Not Synchronizing

**Symptom:** `phc2sys` starts but the system clock offset to the PHC remains large or erratic. `timedatectl` shows the clock jumping.

**Possible causes:**
1. `phc2sys` started before `ptp4l` locked to the GM.
2. `chronyd` or `systemd-timesyncd` is fighting with `phc2sys` over the system clock.
3. Wrong interface specified in the `phc2sys` command.

**Resolution:**
1. Use the `-w` flag (wait for ptp4l) in the `phc2sys` command.
2. Stop and disable NTP services:
   ```bash
   sudo systemctl stop chronyd systemd-timesyncd
   sudo systemctl disable chronyd systemd-timesyncd
   ```
3. Verify you specified the correct interface (the one running `ptp4l`).
4. Check `journalctl -u phc2sys` for error messages.

---

### NTP Conflicting with PTP

**Symptom:** System clock jumps erratically. Both PTP and NTP services are running and fighting over CLOCK_REALTIME.

**Possible causes:**
1. `chrony`, `ntpd`, or `systemd-timesyncd` is enabled alongside `phc2sys`.

**Resolution:**
1. Only one service should discipline the system clock. For a 5G lab, PTP via `phc2sys` should be the sole source.
2. Disable all NTP services:
   ```bash
   sudo systemctl stop chronyd ntpd systemd-timesyncd 2>/dev/null
   sudo systemctl disable chronyd ntpd systemd-timesyncd 2>/dev/null
   sudo timedatectl set-ntp false
   ```
3. Verify: `timedatectl` should show `NTP service: inactive`.

---

## gNB Issues

### gNB Crashes at Startup

**Symptom:** The `gnb` binary exits immediately with a segmentation fault or assertion failure.

**Possible causes:**
1. Missing or invalid configuration file.
2. DPDK EAL initialization failure (wrong core list, no hugepages, VFIO not available).
3. Binary built without DPDK support but OFH configuration is present.
4. Incompatible library versions.

**Resolution:**
1. Run with verbose logging: set `log.all_level: debug` in `gnb.yml`.
2. Check for EAL errors in the first few lines of output.
3. Verify DPDK prerequisites: hugepages, VFIO module, device binding (see DPDK section).
4. Confirm the binary was built with `-DENABLE_DPDK=ON` and `-DENABLE_EXPORT=ON`:
   ```bash
   ./gnb --version  # or check the build log
   ```
5. Try running with `sudo` if permission errors are suspected.

---

### PHY Initialization Failure

**Symptom:** gNB logs show `PHY init failed` or `Could not initialize lower PHY`.

**Possible causes:**
1. The E810 VF/PF is not bound to `vfio-pci`.
2. PCIe BDF in `ru_ofh.cells.network_interface` does not match the actual device.
3. EAL arguments in `hal.eal_args` reference incorrect cores or devices.

**Resolution:**
1. Verify the device is bound: `dpdk-devbind.py -s | grep <BDF>`.
2. Cross-check the BDF in `gnb.yml` against `lspci`:
   ```bash
   lspci -nn | grep -i ethernet
   ```
3. Ensure the EAL `-a` argument matches the `network_interface` BDF.
4. Ensure the core list in `--lcores` uses only isolated cores that are not used by other gNB threads.

---

### OFH Late or Early Packets

**Symptom:** gNB logs show `OFH: Late DL packet` or `OFH: Early UL packet` warnings. The RU may show similar timing alarms.

**Possible causes:**
1. PTP synchronization is not converged or has high offset.
2. T1a/T2a timing window parameters in `gnb.yml` are not tuned for your RU.
3. CPU cores are not properly isolated, causing scheduling jitter.
4. System is under heavy non-RT load (compiling, logging to disk, etc.).

**Resolution:**
1. Verify PTP offset: `journalctl -u ptp4l | tail -20`. Offset should be under 100 ns.
2. Adjust `t1a_*` and `t2a_*` parameters incrementally. Increase `max` values and decrease `min` values to widen the acceptance window, then narrow once stable.
3. Verify CPU isolation: `cat /proc/cmdline | grep isolcpus`. Ensure no other processes run on isolated cores: `ps -eo pid,psr,comm | grep <core-number>`.
4. Minimize background activity during gNB operation. Avoid running builds, large file copies, or heavy logging.

---

### No Cell Broadcast (UE Cannot See the Cell)

**Symptom:** The gNB appears to start successfully but UEs do not detect the cell during network scan.

**Possible causes:**
1. The RU is not transmitting (power off, not configured, fronthaul link down).
2. ARFCN / band mismatch between gNB config and UE capabilities.
3. SSB not being transmitted due to timing errors.
4. RF shielding or antenna issues.

**Resolution:**
1. Check RU status via its management interface (web UI, SSH, or SNMP). Verify the RU shows a fronthaul link UP and is transmitting.
2. Verify the gNB logs show successful cell activation: look for `Cell started` or `SIB1 transmitted`.
3. Confirm the UE supports the configured band (n78) and bandwidth.
4. If using a shielded enclosure, verify the UE antenna is inside the enclosure.
5. Try a UE-side manual network scan and look for the PLMN (`00101` if using test PLMN).

---

## Core Network Issues

### AMF Connection Refused

**Symptom:** gNB logs show `NGAP: Connection to AMF failed` or `SCTP: connect() failed: Connection refused`.

**Possible causes:**
1. The AMF is not running or not listening on the configured port.
2. IP address or port mismatch between `gnb.yml` and the AMF configuration.
3. Firewall blocking SCTP port 38412.
4. SCTP kernel module not loaded.

**Resolution:**
1. Verify the AMF is running:
   - Bare metal: `docker ps | grep amf` or `kubectl get pods -n omec | grep amf`.
   - Check AMF logs for errors.
2. Verify the AMF is listening: `ss -tlnp | grep 38412` on the AMF host.
3. Test SCTP connectivity (install `ncat` if needed):
   ```bash
   ncat -z --sctp <amf-ip> 38412
   ```
4. Check firewall: `sudo iptables -L -n | grep 38412`. Open if blocked:
   ```bash
   sudo iptables -A INPUT -p sctp --dport 38412 -j ACCEPT
   ```
5. Load the SCTP module: `sudo modprobe sctp`.

---

### SCTP Association Failure

**Symptom:** gNB connects to AMF but the SCTP association drops repeatedly. Logs show `SCTP: ABORT` or `SCTP: SHUTDOWN`.

**Possible causes:**
1. SCTP heartbeat timeout due to network latency.
2. Middlebox (firewall, NAT) not handling SCTP correctly.
3. MTU mismatch causing fragmentation.

**Resolution:**
1. Avoid NAT between gNB and AMF. SCTP multi-homing and NAT do not mix well.
2. Verify MTU: `ping -M do -s 8000 <amf-ip>`. If it fails, check MTU settings on all intermediate links.
3. Capture traffic: `sudo tcpdump -i <interface> -nn sctp` to see INIT/INIT-ACK/ABORT sequences.

---

### UPF Not Routing Traffic

**Symptom:** UE attaches and gets an IP address, but has no internet connectivity. Ping from UE fails.

**Possible causes:**
1. UPF does not have a route to the internet (missing default route or NAT).
2. IP forwarding is disabled on the UPF host.
3. GTP-U tunnel is established but the UPF is not decapsulating correctly.
4. The UE's IP pool is not routable from the UPF's upstream network.

**Resolution:**
1. On the UPF host, verify IP forwarding: `sysctl net.ipv4.ip_forward` (must be 1).
2. Verify NAT/masquerade is configured for the UE IP pool:
   ```bash
   sudo iptables -t nat -A POSTROUTING -s 10.45.0.0/16 -o <upstream-interface> -j MASQUERADE
   ```
3. Check GTP-U tunnel status in the UPF logs.
4. Verify routing on the UPF: `ip route` should show the UE subnet and a default route.
5. Test from the UPF itself: `ping -I <upf-core-interface> 8.8.8.8`.

---

## UE Issues

### UE Does Not Find the PLMN

**Symptom:** The UE's network scan shows no available network, or the test PLMN (00101) does not appear.

**Possible causes:**
1. gNB is not broadcasting (see "No Cell Broadcast" above).
2. UE does not support the configured band or bandwidth.
3. UE is too far from the RU antenna or in a shielded area.
4. SIM is not provisioned with the correct PLMN.

**Resolution:**
1. Verify gNB is broadcasting (check gNB logs for successful cell start).
2. Check UE band support in the device specifications.
3. Move the UE closer to the antenna. In lab setups, 1-3 meters is typical.
4. Check SIM PLMN configuration using pySim:
   ```bash
   pySim-read.py -p 0  # Read SIM contents
   ```

---

### Attach Rejected

**Symptom:** UE attempts to attach but is rejected. gNB logs show `Registration Reject` with a 5GMM cause code.

**Possible causes and cause codes:**
- **Cause 3 (Illegal UE):** SUPI/IMSI not provisioned in the UDM database.
- **Cause 5 (PLMN not allowed):** PLMN mismatch between SIM and core network.
- **Cause 6 (TA not allowed):** TAC mismatch between gNB config and AMF.
- **Cause 7 (Roaming not allowed):** The SIM's home PLMN differs from the serving PLMN and roaming is disabled.
- **Cause 9 (UE identity cannot be derived):** SUCI decryption failure (wrong key in UDM).
- **Cause 111 (Protocol error):** Generic — check AMF and AUSF logs for details.

**Resolution:**
1. Verify the IMSI (SUPI) is registered in the SD-Core subscriber database (via the ROC portal or API).
2. Ensure the PLMN in `gnb.yml`, the AMF, and the SIM all match (e.g., `00101`).
3. Ensure the TAC in `gnb.yml` matches the TAC in the AMF configuration.
4. Verify the SIM credentials (Ki, OPc) match what is configured in the core:
   ```bash
   pySim-read.py -p 0  # Compare Ki/OPc with core database
   ```
5. Check AMF, AUSF, and UDM logs for the specific rejection reason.

---

### No PDU Session

**Symptom:** UE attaches and registers but does not establish a PDU session (no IP address, no data connectivity).

**Possible causes:**
1. APN/DNN mismatch (the UE requests a DNN that the SMF does not know about).
2. No IP pool configured for the requested DNN in the SMF/UPF.
3. The UE is not configured to request a PDU session automatically.
4. SMF or UPF is down.

**Resolution:**
1. Check the DNN configured on the UE (typically `internet` for test SIMs).
2. Verify the SMF has a matching DNN configuration with an IP pool.
3. On Android: go to APN settings and ensure the APN name matches the DNN in the core.
4. Check SMF and UPF pod/process logs for PDU session setup failures.
5. Some UEs require a manual APN configuration:
   - APN: `internet` (or your configured DNN)
   - APN type: `default`
   - APN protocol: `IPv4`

---

### UE Attached but No Internet

**Symptom:** UE has an IP address from the core network but cannot reach the internet. Ping to external IPs fails.

**Possible causes:**
1. UPF not routing (see "UPF Not Routing Traffic" above).
2. DNS not configured on the UE.
3. MTU issues causing packet drops on GTP-U encapsulated traffic.
4. The UE's IP address is in a private range with no NAT configured.

**Resolution:**
1. Test basic connectivity first: `ping <upf-ip>` from the UE. If this fails, the GTP-U tunnel is broken.
2. Test DNS: `ping 8.8.8.8` (bypasses DNS). If this works but `ping google.com` does not, configure DNS on the UE or in the SMF's PDU session configuration.
3. Check MTU. GTP-U adds ~36 bytes overhead. If the path MTU is 1500, the inner MTU should be 1464 or lower.
4. Verify NAT on the UPF host (see UPF section above).

---

## Kubernetes Issues

### Pod in CrashLoopBackOff

**Symptom:** `kubectl get pods -n omec` shows one or more pods in `CrashLoopBackOff` state.

**Possible causes:**
1. Configuration error in the Helm values.
2. Dependency not ready (e.g., AMF waiting for NRF, SMF waiting for AMF).
3. Insufficient resources (CPU, memory).
4. Image pull failure (wrong tag, registry unreachable).

**Resolution:**
1. Check pod logs: `kubectl logs -n omec <pod-name> --previous` (the `--previous` flag shows logs from the crashed container).
2. Check pod events: `kubectl describe pod -n omec <pod-name>`.
3. If a dependency issue, wait for the dependency pod to become healthy. SD-Core pods have readiness probes and will retry.
4. Verify Helm values: `helm get values -n omec sd-core`.
5. Check resource availability: `kubectl describe node | grep -A 5 "Allocated resources"`.

---

### SR-IOV VFs Not Available in Kubernetes

**Symptom:** Pods requesting SR-IOV VF resources remain in `Pending` state. `kubectl describe pod` shows `Insufficient intel.com/intel_sriov_vfio` (or similar).

**Possible causes:**
1. SR-IOV device plugin not deployed or not running.
2. VFs not created on the host.
3. VFs not bound to `vfio-pci`.
4. Node label/selector mismatch.

**Resolution:**
1. Check the SR-IOV device plugin pod is running:
   ```bash
   kubectl get pods -n kube-system | grep sriov
   ```
2. Verify VFs exist on the host:
   ```bash
   cat /sys/class/net/ens2f0/device/sriov_numvfs
   ```
3. If zero, create VFs:
   ```bash
   echo 4 | sudo tee /sys/class/net/ens2f0/device/sriov_numvfs
   ```
4. Bind VFs to vfio-pci (see DPDK section).
5. Restart the SR-IOV device plugin pod to re-discover devices.
6. Check allocatable resources: `kubectl get node -o json | jq '.items[].status.allocatable'`.

---

### CPU Manager Errors

**Symptom:** Pods requesting `resources.limits.cpu` as whole numbers (for guaranteed QoS and CPU pinning) fail to schedule. Events show `TopologyAffinityError` or `CPUManager` errors.

**Possible causes:**
1. CPU manager not enabled on the kubelet.
2. CPU manager policy is `none` instead of `static`.
3. Not enough exclusive CPUs available (other guaranteed pods have claimed them).
4. CPU topology does not satisfy the requested topology constraints.

**Resolution:**
1. Verify CPU manager policy:
   ```bash
   cat /var/lib/kubelet/cpu_manager_state
   ```
2. Enable static CPU manager in `/var/lib/kubelet/config.yaml`:
   ```yaml
   cpuManagerPolicy: static
   reservedSystemCPUs: "0-3"   # Housekeeping cores
   ```
3. Delete the CPU manager state file and restart kubelet:
   ```bash
   sudo rm /var/lib/kubelet/cpu_manager_state
   sudo systemctl restart kubelet
   ```
4. Ensure there are enough unreserved CPUs for the pod's request.
5. Use `kubectl describe node` to view allocatable CPU count.

:::note
For additional help, see the [FAQ](./04-faq.md) for common questions and the [External Resources](./05-external-resources.md) page for community support channels.
:::
