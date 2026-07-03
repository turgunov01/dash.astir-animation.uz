// PM2 ecosystem for astir-dashboard (Nuxt 3, nitro node-server preset).
// Build first:  npm run build   ->  generates .output/server/index.mjs
// Then start:   pm2 start ecosystem.config.cjs
//
// Uses the .cjs extension because package.json has "type": "module"
// (a plain .js file would be parsed as ESM and module.exports would throw).
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "astir-dashboard",
      // Run the built Nitro node server directly.
      script: ".output/server/index.mjs",
      cwd: __dirname,
      interpreter: "node",
      exec_mode: "fork", // Nitro is a single self-contained server; cluster not needed.
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: 3000,
        // Consumed via runtimeConfig.public.apiBaseUrl. Override per environment.
        NUXT_PUBLIC_API_BASE_URL: "https://test-api.astir-animation.uz"
      },
      out_file: path.join(__dirname, "logs", "astir-dashboard.out.log"),
      error_file: path.join(__dirname, "logs", "astir-dashboard.err.log"),
      merge_logs: true,
      time: true
    }
  ]
};
