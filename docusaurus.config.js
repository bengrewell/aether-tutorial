// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Aether SD-Core + srsRAN Lab Guide',
  tagline: 'Build a private 5G telco lab with Aether SD-Core and srsRAN using ORAN Split 7.2',
  favicon: 'img/favicon.ico',

  url: 'https://bengrewell.github.io',
  baseUrl: '/aether-tutorial/',

  organizationName: 'bengrewell',
  projectName: 'aether-tutorial',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/bengrewell/aether-tutorial/tree/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Aether + srsRAN Lab Guide',
        logo: {
          alt: 'Aether Lab Guide Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Tutorial',
          },
          {
            href: 'https://github.com/bengrewell/aether-tutorial',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Guide',
            items: [
              {
                label: 'Getting Started',
                to: '/docs/getting-started/introduction',
              },
              {
                label: 'System Preparation',
                to: '/docs/system-preparation/os-installation',
              },
              {
                label: 'RAN Deployment',
                to: '/docs/ran-deployment/srsran-overview',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'srsRAN Project',
                href: 'https://www.srsran.com/',
              },
              {
                label: 'Aether / SD-Core',
                href: 'https://opennetworking.org/sd-core/',
              },
              {
                label: 'ONF Community',
                href: 'https://opennetworking.org/',
              },
            ],
          },
          {
            title: 'Resources',
            items: [
              {
                label: 'srsRAN Docs',
                href: 'https://docs.srsran.com/',
              },
              {
                label: 'Aether OnRamp',
                href: 'https://docs.aetherproject.org/',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/bengrewell/aether-tutorial',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Aether SD-Core + srsRAN Lab Guide.`,
      },
      prism: {
        theme: require('prism-react-renderer').themes.github,
        darkTheme: require('prism-react-renderer').themes.dracula,
        additionalLanguages: ['bash', 'yaml', 'ini', 'toml', 'json'],
      },
    }),
};

module.exports = config;
