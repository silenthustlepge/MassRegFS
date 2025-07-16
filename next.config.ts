
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // typescript and eslint options are not needed here
  // as they are checked during the build process
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
