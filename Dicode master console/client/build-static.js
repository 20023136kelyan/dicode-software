#!/usr/bin/env node
/**
 * Build script for static export
 * Temporarily removes API routes to allow static export
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API_DIR = path.join(__dirname, 'src/app/api');
const API_BACKUP = path.join(__dirname, 'src/app/_api_backup');
const BUILD_OUT = path.join(__dirname, 'out');
const BUILD_TARGET = path.join(__dirname, 'build');

console.log('📦 Starting static build process...\n');

try {
  // Step 1: Backup API directory
  console.log('1️⃣  Backing up API routes...');
  if (fs.existsSync(API_BACKUP)) {
    fs.rmSync(API_BACKUP, { recursive: true, force: true });
  }
  if (fs.existsSync(API_DIR)) {
    fs.renameSync(API_DIR, API_BACKUP);
    console.log('   ✓ API routes backed up\n');
  }

  // Step 2: Clean build cache
  console.log('2️⃣  Cleaning build cache...');
  const nextDir = path.join(__dirname, '.next');
  const outDir = path.join(__dirname, 'out');
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
  }
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  console.log('   ✓ Cache cleaned\n');

  // Step 3: Update next.config.ts to enable static export
  console.log('3️⃣  Enabling static export...');
  const configPath = path.join(__dirname, 'next.config.ts');
  const configContent = fs.readFileSync(configPath, 'utf8');

  // Only add output if not already present
  let staticConfig = configContent;
  if (!configContent.includes('output:')) {
    staticConfig = configContent.replace(
      /const nextConfig: NextConfig = \{/,
      'const nextConfig: NextConfig = {\n  output: "export",'
    );
    fs.writeFileSync(configPath, staticConfig);
  }
  console.log('   ✓ Static export enabled\n');

  // Step 4: Build
  console.log('4️⃣  Building Next.js app...');
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  console.log('   ✓ Build complete\n');

  // Step 5: Copy output to build directory
  console.log('5️⃣  Copying build output...');
  if (fs.existsSync(BUILD_TARGET)) {
    fs.rmSync(BUILD_TARGET, { recursive: true, force: true });
  }
  fs.cpSync(BUILD_OUT, BUILD_TARGET, { recursive: true });
  console.log('   ✓ Output copied to build/\n');

  console.log('✅ Static build complete!');

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exitCode = 1;
} finally {
  // Restore API directory
  console.log('\n6️⃣  Restoring API routes...');
  if (fs.existsSync(API_BACKUP)) {
    if (fs.existsSync(API_DIR)) {
      fs.rmSync(API_DIR, { recursive: true, force: true });
    }
    fs.renameSync(API_BACKUP, API_DIR);
    console.log('   ✓ API routes restored\n');
  }

  // Restore next.config.ts
  console.log('7️⃣  Restoring Next.js config...');
  execSync('git checkout next.config.ts 2>/dev/null || true', { cwd: __dirname });
  console.log('   ✓ Config restored\n');
}
