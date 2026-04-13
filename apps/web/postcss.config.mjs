/**
 * Next.js requires `plugins` to be an object of string plugin names → options,
 * not raw PostCSS plugin functions. See `getPostCssPlugins` in next/dist/build/webpack/config/blocks/css/plugins.js
 *
 * `@tailwindcss/postcss` is installed at the workspace root so resolution works
 * from the apps/web directory under pnpm.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};

export default config;
