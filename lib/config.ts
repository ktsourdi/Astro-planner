// Configuration management with environment variables and defaults

export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
    nominatimUrl: process.env.NEXT_PUBLIC_NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org',
    wikipediaUrl: process.env.NEXT_PUBLIC_WIKIPEDIA_API_URL || 'https://en.wikipedia.org/api/rest_v1',
    cameraDbUrl: process.env.NEXT_PUBLIC_CAMERA_DB_URL || 'https://raw.githubusercontent.com/openMVG/CameraSensorSizeDatabase/master/sensor_database.csv',
    openNgcUrl: process.env.NEXT_PUBLIC_OPENNGC_URL || 'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/OpenNGC.csv',
  },
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

export default config;