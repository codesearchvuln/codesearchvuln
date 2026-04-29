export const paths = {
    app: '@/app',

    components: '@/components',
  ui: '@/components/ui',
  layout: '@/components/layout',
  features: '@/components/features',
  common: '@/components/common',

    pages: '@/pages',

    analysisFeature: '@/features/analysis',
  projectsFeature: '@/features/projects',
  scanFeature: '@/features/audit',

    shared: '@/shared',
  hooks: '@/shared/hooks',
  services: '@/shared/services',
  types: '@/shared/types',
  utils: '@/shared/utils',
  constants: '@/shared/constants',
  config: '@/shared/config',

    assets: '@/assets',
  images: '@/assets/images',
  icons: '@/assets/icons',
  styles: '@/assets/styles',
} as const;

export function getPath(key: keyof typeof paths): string {
  return paths[key];
}