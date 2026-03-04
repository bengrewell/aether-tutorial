import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

const sections = [
  {
    title: '01 — Getting Started',
    description: 'Hardware requirements, architecture overview, and software prerequisites for your private 5G lab.',
    link: '/docs/getting-started/introduction',
  },
  {
    title: '02 — System Preparation',
    description: 'OS installation, real-time kernel, TuneD profiles, and CPU isolation for deterministic performance.',
    link: '/docs/system-preparation/os-installation',
  },
  {
    title: '03 — Network Configuration',
    description: 'Network topology, DPDK setup, and NIC optimization for high-throughput fronthaul and backhaul.',
    link: '/docs/network-configuration/network-topology',
  },
  {
    title: '04 — Timing & Synchronization',
    description: 'PTP configuration with LinuxPTP for nanosecond-accurate synchronization required by ORAN Split 7.2.',
    link: '/docs/timing-synchronization/ptp-overview',
  },
  {
    title: '05 — RAN Deployment',
    description: 'Build srsRAN from source, configure the gNB, validate in testmode, and optimize RF parameters.',
    link: '/docs/ran-deployment/srsran-overview',
  },
  {
    title: '06 — Core Network',
    description: 'Deploy Aether SD-Core as your 5G mobile core with AMF, SMF, UPF, and subscriber management.',
    link: '/docs/core-network/sd-core-overview',
    comingSoon: true,
  },
  {
    title: '07 — Integration & Testing',
    description: 'SIM programming, UE attachment, end-to-end connectivity testing, and performance benchmarking.',
    link: '/docs/integration-testing/sim-programming',
    comingSoon: true,
  },
  {
    title: '08 — Kubernetes Deployment',
    description: 'Production-grade K8s deployment with SR-IOV, CPU Manager, and Aether OnRamp automation.',
    link: '/docs/kubernetes-deployment/k8s-cluster-setup',
    comingSoon: true,
  },
  {
    title: '09 — Advanced Topics',
    description: 'Network slicing, monitoring dashboards, DPDK-accelerated UPF, and multi-cell deployments.',
    link: '/docs/advanced-topics/network-slicing',
    comingSoon: true,
  },
  {
    title: '10 — Reference',
    description: 'Configuration templates, troubleshooting guide, glossary, FAQ, and external resources.',
    link: '/docs/reference/configuration-reference',
  },
];

function HeroBanner() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className="hero hero--primary" style={{ padding: '4rem 0' }}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div style={{ marginTop: '2rem' }}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/introduction"
          >
            Start the Tutorial
          </Link>
        </div>
      </div>
    </header>
  );
}

function SectionCard({ title, description, link, comingSoon }) {
  return (
    <div className="col col--4" style={{ marginBottom: '1.5rem' }}>
      <div className="feature-card" style={{ height: '100%' }}>
        <h3>
          <Link to={link}>{title}</Link>
          {comingSoon && <span className="badge--coming-soon">Coming Soon</span>}
        </h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="Home"
      description={siteConfig.tagline}
    >
      <HeroBanner />
      <main>
        <section style={{ padding: '3rem 0' }}>
          <div className="container">
            <div className="row">
              {sections.map((props, idx) => (
                <SectionCard key={idx} {...props} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
