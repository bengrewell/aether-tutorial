---
id: building-srsran
title: Building srsRAN from Source
sidebar_label: Building srsRAN
sidebar_position: 2
description: Clone, compile, and install srsRAN Project from source with DPDK support on Ubuntu 24.04 for O-RAN Split 7.2 gNB deployment.
keywords:
  - srsRAN build
  - compile srsRAN
  - DPDK support
  - cmake
  - gNB installation
  - build dependencies
  - srsRAN Project
---

# Building srsRAN from Source

This guide covers cloning the srsRAN Project repository, installing build dependencies, compiling with DPDK support, and verifying the installation. Building from source ensures you have the latest features and can enable the specific compile-time options required for O-RAN Split 7.2 with DPDK acceleration.

## Prerequisites

Before building srsRAN, ensure the following are in place:

- Ubuntu 24.04 LTS installed and configured per [OS Installation](../02-system-preparation/01-os-installation.md)
- Essential build tools installed (gcc, cmake, etc.) — covered in [OS Installation](../02-system-preparation/01-os-installation.md)
- DPDK 24.11.2 installed per [DPDK Installation](../03-network-configuration/02-dpdk-setup.md)
- At least 16 GB of RAM available (the build is memory-intensive)
- At least 10 GB of free disk space

:::note
If you followed the system preparation guides in [Section 02](../02-system-preparation/01-os-installation.md), most build dependencies are already installed. This section lists them explicitly for completeness.
:::

## Install Build Dependencies

Install all required development libraries and tools:

```bash
sudo apt install -y \
  cmake \
  make \
  gcc \
  g++ \
  pkg-config \
  libfftw3-dev \
  libmbedtls-dev \
  libsctp-dev \
  libyaml-cpp-dev \
  libgtest-dev \
  libzmq3-dev \
  libboost-all-dev \
  libconfig++-dev \
  libelf-dev
```

### Dependency Purpose Reference

| Package | Purpose |
|---------|---------|
| `cmake`, `make`, `gcc`, `g++` | C/C++ build toolchain |
| `pkg-config` | Locates installed libraries and their compile/link flags |
| `libfftw3-dev` | Fast Fourier Transform — used extensively in the PHY layer |
| `libmbedtls-dev` | TLS/crypto library — used for RRC/PDCP security |
| `libsctp-dev` | SCTP protocol — required for NGAP (N2) and F1AP interfaces |
| `libyaml-cpp-dev` | YAML parsing — configuration file handling |
| `libgtest-dev` | Google Test framework — for running unit tests |
| `libzmq3-dev` | ZeroMQ — used for ZMQ-based radio (useful for testing without hardware) |
| `libboost-all-dev` | Boost C++ libraries — various utilities |
| `libconfig++-dev` | Configuration file parsing library |
| `libelf-dev` | ELF parsing — required by some DPDK components |

:::tip
If you plan to run srsRAN unit tests during development, also install `libgtest-dev`. For production deployments, it is optional.
:::

## Clone the Repository

Clone the srsRAN Project repository from GitHub:

```bash
git clone https://github.com/srsran/srsRAN_Project.git
cd srsRAN_Project
```

To use a specific release tag instead of the latest `main` branch:

```bash
# List available tags
git tag -l

# Checkout a specific release
git checkout release_24_10
```

:::warning
The `main` branch contains the latest development code and may include untested features. For production deployments, use a tagged release. For this tutorial, we use the latest stable release available at the time of your build.
:::

### Repository Structure

Key directories in the srsRAN Project repository:

```
srsRAN_Project/
├── apps/              # Application entry points (gnb, ru_emulator, etc.)
├── configs/           # Example configuration files
├── include/           # Public header files
├── lib/               # Core library implementations
│   ├── du/            # DU implementation
│   ├── cu_cp/         # CU-CP implementation
│   ├── cu_up/         # CU-UP implementation
│   ├── mac/           # MAC layer
│   ├── phy/           # PHY layer
│   ├── ofh/           # Open Fronthaul library
│   └── ...
├── tests/             # Unit and integration tests
└── CMakeLists.txt     # Top-level CMake build configuration
```

## Build with DPDK Support

Create a build directory and configure the build with CMake:

```bash
mkdir build && cd build
cmake .. -DENABLE_DPDK=ON -DENABLE_EXPORT=ON -DCMAKE_BUILD_TYPE=Release
```

### CMake Options Explained

| Option | Value | Purpose |
|--------|-------|---------|
| `-DENABLE_DPDK=ON` | Required | Enables DPDK-accelerated fronthaul I/O for O-RAN Split 7.2 |
| `-DENABLE_EXPORT=ON` | Recommended | Exports build targets for external tools and integrations |
| `-DCMAKE_BUILD_TYPE=Release` | Recommended | Enables compiler optimizations (`-O3`), strips debug symbols |

Other useful CMake options:

| Option | Purpose |
|--------|---------|
| `-DCMAKE_BUILD_TYPE=RelWithDebInfo` | Release optimizations with debug symbols — useful for profiling and troubleshooting |
| `-DENABLE_UHD=ON` | Enable USRP Hardware Driver support (for SDR-based deployments) |
| `-DBUILD_TESTS=ON` | Build unit tests (adds build time) |
| `-DCMAKE_INSTALL_PREFIX=/usr/local` | Override the install location (default is `/usr/local`) |

### Compile

Build using all available CPU cores:

```bash
make -j$(nproc)
```

:::note
The build takes approximately 10–30 minutes depending on your CPU and available cores. A 16-core system typically completes in about 10 minutes. Memory usage peaks at roughly 1–2 GB per parallel job, so reduce `-j` if you have limited RAM (e.g., `make -j8` for a 16 GB system).
:::

### Install

Install the compiled binaries and libraries system-wide:

```bash
sudo make install
```

This installs the `gnb` binary and supporting libraries to `/usr/local/bin` and `/usr/local/lib` respectively.

After installation, update the shared library cache:

```bash
sudo ldconfig
```

## Verify the Installation

Confirm that the `gnb` binary is accessible and functional:

```bash
# Check that the binary is in the PATH
which gnb

# Display help information
gnb -h
```

Expected output from `gnb -h` (truncated):

```
Usage: gnb [options] -c <config_file>

Options:
  -c, --config <file>     Path to the configuration file
  -h, --help              Show this help message
  ...
```

:::tip
If `gnb` is not found, ensure `/usr/local/bin` is in your `PATH`. You can also run it directly: `/usr/local/bin/gnb -h`.
:::

## Build Troubleshooting

### DPDK Not Found

**Symptom**: CMake reports `DPDK not found` or `Could not find DPDK`.

**Cause**: The `pkg-config` path does not include the DPDK installation.

**Fix**: Set the `PKG_CONFIG_PATH` to include DPDK's pkgconfig directory:

```bash
export PKG_CONFIG_PATH=/usr/local/lib/x86_64-linux-gnu/pkgconfig:$PKG_CONFIG_PATH
```

Or if DPDK was installed to a custom prefix:

```bash
export PKG_CONFIG_PATH=/opt/dpdk/lib/pkgconfig:$PKG_CONFIG_PATH
```

Then re-run CMake:

```bash
cmake .. -DENABLE_DPDK=ON -DENABLE_EXPORT=ON -DCMAKE_BUILD_TYPE=Release
```

:::tip
To make the `PKG_CONFIG_PATH` persistent, add the export to `~/.bashrc` or `/etc/environment`.
:::

### Missing Dependencies

**Symptom**: CMake reports `Could NOT find <library>`.

**Fix**: Install the corresponding `-dev` package. Common examples:

| CMake Error | Package to Install |
|-------------|-------------------|
| `Could NOT find FFTW3` | `sudo apt install libfftw3-dev` |
| `Could NOT find MbedTLS` | `sudo apt install libmbedtls-dev` |
| `Could NOT find SCTP` | `sudo apt install libsctp-dev` |
| `Could NOT find yaml-cpp` | `sudo apt install libyaml-cpp-dev` |
| `Could NOT find Boost` | `sudo apt install libboost-all-dev` |

### Compiler Errors (Out of Memory)

**Symptom**: Build fails with internal compiler errors (ICE), segmentation faults in `cc1plus`, or `out of memory` messages.

**Cause**: Parallel compilation exceeds available RAM.

**Fix**: Reduce the number of parallel jobs:

```bash
# Use fewer parallel jobs
make -j4

# Or for very limited memory systems
make -j2
```

### Linker Errors with DPDK

**Symptom**: Undefined reference errors related to DPDK symbols during linking.

**Cause**: DPDK library path is not in the linker search path.

**Fix**: Ensure DPDK libraries are discoverable:

```bash
# Check if DPDK libs are installed
pkg-config --libs libdpdk

# If the path is non-standard, add it
echo "/usr/local/lib/x86_64-linux-gnu" | sudo tee /etc/ld.so.conf.d/dpdk.conf
sudo ldconfig
```

Then rebuild:

```bash
make clean
make -j$(nproc)
```

## Build Types: Release vs. RelWithDebInfo

| Build Type | Optimization | Debug Symbols | Use Case |
|-----------|-------------|---------------|----------|
| `Release` | `-O3` | No | Production deployment, maximum performance |
| `RelWithDebInfo` | `-O2` | Yes | Profiling, debugging crashes, performance analysis |
| `Debug` | `-O0` | Yes | Development, step-through debugging (too slow for real-time) |

:::warning
Never use the `Debug` build type for real-time operation. The lack of compiler optimizations makes it impossible to meet O-RAN Split 7.2 timing deadlines, even on capable hardware.
:::

For initial deployment, use `Release`. If you encounter issues that require detailed stack traces or profiling with `perf`, rebuild with `RelWithDebInfo`:

```bash
cd build
cmake .. -DENABLE_DPDK=ON -DENABLE_EXPORT=ON -DCMAKE_BUILD_TYPE=RelWithDebInfo
make -j$(nproc)
sudo make install
```

## Keeping srsRAN Updated

To update to a newer version:

```bash
cd srsRAN_Project
git fetch --all --tags
git checkout <new_tag_or_branch>
cd build
cmake .. -DENABLE_DPDK=ON -DENABLE_EXPORT=ON -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
sudo make install
sudo ldconfig
```

:::warning
After updating srsRAN, always re-test your configuration in testmode before connecting to a live RU. Configuration parameters and defaults may change between versions.
:::

## Next Steps

With srsRAN compiled and installed, proceed to [gNB Configuration](./03-gnb-configuration.md) to create the YAML configuration file that defines your cell parameters, fronthaul settings, and core network connectivity.
