---
id: sim-programming
title: "SIM Card Programming"
sidebar_label: SIM Programming
sidebar_position: 1
description: >
  Programming SIM cards for a private 5G network using pySim. Covers reader
  hardware, installing pySim and PCSC tools, reading SIM contents, writing
  PLMN/IMSI/Ki/OPC values, disabling SUPI concealment (SUCI) for lab use,
  and verification procedures for sysmocom SJA2 SIM cards.
keywords:
  - SIM programming
  - pySim
  - SIM card
  - IMSI
  - Ki
  - OPC
  - PLMN
  - sysmocom SJA2
  - sysmoISIM-SJA2
  - SUCI
  - SUPI concealment
  - Omnikey 3121
  - PCSC
  - private 5G SIM
---

# SIM Card Programming

Before a UE can attach to your private 5G network, its SIM card must be programmed with credentials that match what is provisioned in the core network. This page covers the complete workflow for programming SIM cards using **pySim**, the open-source SIM card management tool from the Osmocom project.

SIM programming is independent of how the core network is deployed — the same procedure applies whether you are running SD-Core standalone, on Kubernetes, or using any other 5G core implementation.

## Prerequisites

### SIM Cards

This tutorial uses **sysmocom sysmoISIM-SJA2** programmable SIM cards. These are ISIM-capable cards that support 5G-AKA authentication and can be purchased from the [sysmocom webshop](https://shop.sysmocom.de/). The SJA2 cards come with a default ADM key printed on the card packaging, which is required for writing to protected fields.

:::warning
Not all SIM cards are programmable. Consumer SIM cards from mobile operators have locked ADM keys and cannot be reprogrammed. You must use purpose-built programmable SIM cards such as the sysmoISIM-SJA2.
:::

### SIM Card Reader

You need a PC/SC-compatible smart card reader. Recommended options:

| Reader | Interface | Notes |
|---|---|---|
| **HID Omnikey 3121** | USB | Widely used, reliable, well-supported on Linux |
| **Gemalto IDBridge CT30** | USB | Compact, good Linux support |
| **ACS ACR38U** | USB | Budget option, works with pySim |

The reader must support the **T=0** protocol used by SIM cards. Most USB smart card readers from major vendors work without issue.

### Software Installation

#### PCSC Daemon and Tools

The PC/SC (Personal Computer / Smart Card) framework provides the low-level interface between the smart card reader and applications. Install the daemon and diagnostic tools:

```bash
sudo apt install pcscd pcsc-tools
```

Start the PCSC daemon and verify the reader is detected:

```bash
sudo systemctl start pcscd
sudo systemctl enable pcscd
pcsc_scan
```

You should see output identifying your reader and, if a SIM card is inserted, the ATR (Answer To Reset) string. Press `Ctrl+C` to exit `pcsc_scan`.

:::tip
If `pcsc_scan` does not detect your reader, try unplugging and reinserting the USB cable, or check `dmesg` for driver errors. The Omnikey 3121 uses the `ccid` driver, which is typically included in the `pcscd` package.
:::

#### pySim

pySim is a set of Python tools for reading, programming, and managing SIM/USIM/ISIM cards. Install it using pip:

```bash
pip3 install pysim
```

Alternatively, for the latest development version, clone the repository directly:

```bash
git clone https://gitea.osmocom.org/sim-card/pysim.git
cd pysim
pip3 install -e .
```

Verify the installation:

```bash
pySim-read.py --help
```

## Reading SIM Card Contents

Before programming, read the current contents of the SIM card to verify communication and inspect default values:

```bash
pySim-read.py -p 0
```

The `-p 0` flag selects PCSC reader slot 0 (the first detected reader). The output will show the current ICCID, IMSI, PLMN, and other parameters stored on the card.

If you have the SJA2 card's ADM key (printed on the card packaging or provided by sysmocom), you can read additional protected fields:

```bash
pySim-read.py -p 0 -a <ADM_KEY>
```

:::note
The default ADM key for sysmocom SJA2 cards is typically an 8-digit hex value printed on the plastic card holder or included in the order documentation. Keep this value safe — without it, you cannot write to the SIM card.
:::

## Programming the SIM Card

### Writing Core Parameters

Use `pySim-prog.py` to write the essential identity and authentication parameters:

```bash
pySim-prog.py -p 0 -t sysmoISIM-SJA2 \
  --mcc 001 --mnc 01 \
  --imsi 001010000000001 \
  --ki 00112233445566778899AABBCCDDEEFF \
  --opc 00112233445566778899AABBCCDDEEFF \
  --acc 0001
```

**Parameter reference:**

| Parameter | Description | Example Value |
|---|---|---|
| `-p 0` | PCSC reader slot index | `0` (first reader) |
| `-t sysmoISIM-SJA2` | Card type (tells pySim the card's file structure and capabilities) | `sysmoISIM-SJA2` |
| `--mcc` | Mobile Country Code — part of the PLMN identity | `001` (test network) |
| `--mnc` | Mobile Network Code — part of the PLMN identity | `01` (test network) |
| `--imsi` | International Mobile Subscriber Identity — unique subscriber ID (15 digits) | `001010000000001` |
| `--ki` | Authentication key (128-bit hex) — shared secret for AKA | `00112233...` |
| `--opc` | Operator variant of the authentication algorithm key (128-bit hex) | `00112233...` |
| `--acc` | Access Control Class | `0001` |

:::danger
The `--ki` and `--opc` values shown above are **examples only**. In a real deployment, use randomly generated 128-bit keys for each SIM card. These values must be recorded and provisioned identically in the core network's subscriber database. If the Ki or OPC on the SIM does not match the core network, authentication will fail and the UE will not attach.
:::

:::tip
The MCC/MNC pair `001/01` is designated for test networks by ITU-T and will not conflict with any commercial operator. Use this for lab deployments. If you need to use a different PLMN, ensure it matches the PLMN configured in the AMF and gNB.
:::

### Disabling SUPI Concealment (SUCI)

5G introduces **SUPI concealment** (also called SUCI — Subscription Concealed Identifier), a privacy feature that encrypts the IMSI/SUPI over the air interface so it cannot be intercepted. While this is important for commercial networks, it adds complexity to lab environments because it requires provisioning a home network public key on the SIM card and the corresponding private key in the core network (UDM).

For lab testing, it is simpler to **disable SUPI concealment** so the IMSI is sent in cleartext during registration. This is done by configuring the SIM card's USIM/ISIM application to use the **null scheme** for SUCI calculation.

Using `pySim-shell.py`, connect to the SIM and disable the SUCI privacy features:

```bash
pySim-shell.py -p 0
```

Within the pySim shell, navigate to the USIM application and configure the SUCI parameters:

```
select MF
select ADF.USIM
select EF.UST
```

The specific commands to disable SUCI depend on the card type and pySim version. For sysmoISIM-SJA2 cards, the key step is ensuring that the **routing indicator** is set and the **protection scheme** is set to null (scheme identifier 0):

```
select EF.Routing_Indicator
update_binary 0000ffff
```

:::warning
Disabling SUPI concealment means the IMSI is transmitted in cleartext over the air interface. This is acceptable for a private lab network but should **never** be done on a production network or any network where subscriber privacy is a concern.
:::

### Verifying Programmed Values

After programming, read the SIM card again to confirm all values were written correctly:

```bash
pySim-read.py -p 0
```

Verify the following in the output:

- **IMSI** matches what you programmed (e.g., `001010000000001`).
- **MCC/MNC** matches your PLMN (e.g., `001/01`).
- **ICCID** is present (this is the card's serial number and is not typically changed).
- The command completes without errors.

:::note
The Ki and OPC are **write-only** fields on most SIM cards — they cannot be read back for security reasons. You must keep a separate record of these values for provisioning in the core network.
:::

## Programming Multiple SIM Cards

When programming a batch of SIM cards for multiple UEs, keep the following in mind:

### IMSI Allocation

Each SIM must have a **unique IMSI**. A simple scheme for lab use is to increment the last digits:

| SIM | IMSI |
|---|---|
| UE 1 | `001010000000001` |
| UE 2 | `001010000000002` |
| UE 3 | `001010000000003` |
| ... | ... |

### Ki/OPC Generation

Each SIM should ideally have **unique Ki and OPC values** for security. You can generate random 128-bit hex keys with:

```bash
openssl rand -hex 16
```

Run this command twice per SIM (once for Ki, once for OPC) and record the values in a spreadsheet or database alongside the IMSI and ICCID.

:::tip
For a small lab with a handful of UEs, using the same Ki/OPC across all SIMs simplifies initial debugging. You can always reprogram individual SIMs with unique keys later once the system is working end-to-end.
:::

### Batch Programming Script

For more than a few SIMs, consider writing a simple script that iterates through a CSV file of IMSI/Ki/OPC values:

```bash
#!/bin/bash
# batch_program_sims.sh
# CSV format: IMSI,Ki,OPC

while IFS=',' read -r IMSI KI OPC; do
  echo "Programming IMSI: $IMSI"
  pySim-prog.py -p 0 -t sysmoISIM-SJA2 \
    --mcc 001 --mnc 01 \
    --imsi "$IMSI" \
    --ki "$KI" \
    --opc "$OPC" \
    --acc 0001
  echo "Done. Insert next SIM card and press Enter."
  read -r
done < sims.csv
```

## Sysmocom SJA2 Card Specifics

The **sysmoISIM-SJA2** is the recommended card for this tutorial. Key characteristics:

| Feature | Value |
|---|---|
| **Card type** | ISIM + USIM dual-application |
| **Form factor** | 2FF, 3FF, 4FF (punch-out) |
| **Authentication** | Milenage (Ki/OPC), TUAK |
| **5G support** | 5G-AKA, SUCI (can be disabled) |
| **ADM key** | Printed on card packaging |
| **Available from** | [sysmocom webshop](https://shop.sysmocom.de/) |
| **pySim card type flag** | `-t sysmoISIM-SJA2` |

:::note
The SJA2 card supports both USIM (for 5G NR / LTE) and ISIM (for IMS) applications. For this tutorial, only the USIM application is required. The ISIM application is relevant if you later add VoNR (Voice over New Radio) support.
:::

### Default PIN/PUK

SJA2 cards ship with default PIN and PUK values documented by sysmocom. For lab use, you can disable the PIN requirement using pySim or your UE's settings to avoid the PIN prompt at boot.

### ADM Key Handling

The ADM (Administrative) key is the master key that authorizes write access to protected files on the SIM card. Without the correct ADM key, `pySim-prog.py` will fail with an authentication error when attempting to write.

If you lose the ADM key, the card **cannot be reprogrammed**. Store the ADM key securely alongside your IMSI/Ki/OPC records.

## Next Steps

Once your SIM cards are programmed, the corresponding subscriber credentials (IMSI, Ki, OPC) must be provisioned in the core network. See [Subscriber Management](../06-core-network/05-subscriber-management.md) for details.

After both SIM and core-side provisioning are complete, proceed to [UE Attachment](./02-ue-attachment.md) to test the end-to-end registration and PDU session flow.
