/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fluent UI React v9 ships untranspiled ESM for some sub-packages.
  transpilePackages: ['@fluentui/react-components', '@fluentui/react-icons'],
};

export default nextConfig;
