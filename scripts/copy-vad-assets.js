#!/usr/bin/env node

/**
 * Copy VAD Assets Script
 * 
 * Copies ONNX model and WebAssembly files from @ricky0123/vad-web
 * to the public directory for Next.js static serving.
 * 
 * This script runs automatically before build (prebuild step).
 */

const fs = require('fs');
const path = require('path');

console.log('🎙️ Copying VAD assets for production build...');

// Source: node_modules/@ricky0123/vad-web/dist/
const sourceDir = path.join(__dirname, '../node_modules/@ricky0123/vad-web/dist');
// ONNX Runtime WASM files
const onnxRuntimeDir = path.join(__dirname, '../node_modules/onnxruntime-web/dist');
// Destination: public/vad/
const destDir = path.join(__dirname, '../public/vad');

// Check if source directory exists
if (!fs.existsSync(sourceDir)) {
  console.error('❌ ERROR: VAD source directory not found:', sourceDir);
  console.error('   Make sure @ricky0123/vad-web is installed: npm install');
  process.exit(1);
}

// Create destination directory
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  console.log('✅ Created destination directory:', destDir);
}

// Copy all files from source to destination
let copiedCount = 0;
let errorCount = 0;

try {
  const files = fs.readdirSync(sourceDir);
  
  if (files.length === 0) {
    console.warn('⚠️  WARNING: No files found in VAD source directory');
  }
  
  files.forEach(file => {
    try {
      const sourcePath = path.join(sourceDir, file);
      const destPath = path.join(destDir, file);
      
      // Skip directories (like 'models' subdirectory)
      const stats = fs.statSync(sourcePath);
      if (stats.isDirectory()) {
        console.log(`   ⊗ ${file} (skipping directory)`);
        return;
      }
      
      // Copy file
      fs.copyFileSync(sourcePath, destPath);
      
      // Get file size for logging
      const sizeKB = (stats.size / 1024).toFixed(2);
      
      console.log(`   ✓ ${file} (${sizeKB} KB)`);
      copiedCount++;
    } catch (err) {
      console.error(`   ✗ Failed to copy ${file}:`, err.message);
      errorCount++;
    }
  });
  
  // Copy ONNX Runtime WASM files
  console.log('');
  console.log('🔧 Copying ONNX Runtime WASM files...');
  
  const wasmFiles = [
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd.wasm',
    'ort-wasm-simd.mjs',
    'ort-wasm.wasm',
    'ort-wasm.mjs'
  ];
  
  wasmFiles.forEach(file => {
    try {
      const sourcePath = path.join(onnxRuntimeDir, file);
      const destPath = path.join(destDir, file);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        const stats = fs.statSync(destPath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`   ✓ ${file} (${sizeKB} KB)`);
        copiedCount++;
      }
    } catch (err) {
      console.error(`   ✗ Failed to copy ${file}:`, err.message);
      errorCount++;
    }
  });
  
  console.log('');
  console.log(`✅ Successfully copied ${copiedCount} VAD asset(s) to ${destDir}`);
  
  if (errorCount > 0) {
    console.warn(`⚠️  ${errorCount} file(s) failed to copy`);
  }
  
  // List expected critical files
  const criticalFiles = [
    'silero_vad_legacy.onnx',
    'vad.worklet.bundle.min.js',
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.mjs'
  ];
  
  console.log('');
  console.log('🔍 Checking for critical VAD files:');
  
  criticalFiles.forEach(file => {
    const filePath = path.join(destDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`   ✓ ${file}`);
    } else {
      console.warn(`   ⚠️  ${file} (not found - may cause runtime errors)`);
    }
  });
  
  console.log('');
  console.log('🎉 VAD assets preparation complete!');
  
} catch (err) {
  console.error('❌ ERROR: Failed to copy VAD assets:', err.message);
  process.exit(1);
}
