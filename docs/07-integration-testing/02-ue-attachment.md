---
id: ue-attachment
title: "UE Attachment Testing"
sidebar_label: UE Attachment
sidebar_position: 2
description: >
  End-to-end UE attachment testing for a private 5G network, including a
  pre-flight checklist, NGAP and NAS signaling verification, and common
  failure modes during registration and PDU session establishment.
keywords:
  - UE attachment
  - 5G registration
  - NAS signaling
  - NGAP
  - PDU session
  - AMF
  - gNB
  - PLMN selection
  - authentication
  - private 5G testing
---

# UE Attachment Testing

<!-- COMING SOON -->

This page will cover the end-to-end UE attachment procedure for verifying that a commercial UE (phone or modem) can successfully register with the private 5G network and establish a PDU session. The content will include:

**Pre-Flight Checklist:**

- SD-Core network functions are running and healthy (all pods in `Running` state).
- gNB is connected to the AMF (NGAP/SCTP association established).
- SIM card is programmed with correct PLMN, IMSI, Ki, and OPC (see [SIM Programming](./01-sim-programming.md)).
- Subscriber credentials are provisioned in the core network (IMSI, Ki, OPC match the SIM).
- PLMN identity (MCC/MNC) is consistent across the SIM card, gNB configuration, and AMF configuration.
- UE is configured for manual PLMN selection (to select the test network PLMN).
- RF environment is suitable (RU is transmitting, antenna connected, UE within range).

**Attachment Procedure Walkthrough:**

- PLMN search and selection on the UE.
- 5G NR RRC connection establishment.
- NAS Registration Request and 5G-AKA authentication exchange.
- Security mode command and completion.
- Registration Accept and PDU session establishment.
- IP address assignment verification.

**Troubleshooting Common Failures:**

- Authentication failures (Ki/OPC mismatch, SUCI issues).
- Registration rejects (PLMN mismatch, subscriber not provisioned).
- PDU session failures (SMF/UPF misconfiguration, DNN mismatch).
- RRC connection failures (RF/timing issues).

:::note
This section is pending completion of the custom deployment Web UI. Content will be added once the full end-to-end stack can be deployed and tested through the UI-driven workflow.
:::
