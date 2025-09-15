#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Astradio Development Environment...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  No .env file found!');
  console.log('📝 Creating .env from template...');
  
  const envExamplePath = path.join(__dirname, '..', 'env.example');
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Created .env file from template');
    console.log('🔧 Please edit .env with your configuration before continuing\n');
  } else {
    console.log('❌ env.example not found. Please create a .env file manually.');
    process.exit(1);
  }
}

// Check if database migration has been run
console.log('🗄️  Checking database setup...');
const { Pool } = require('pg');
require('dotenv').config();

async function checkDatabase() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
  });

  try {
    await pool.connect();
    console.log('✅ Database connection successful');
    
    // Check if users table exists
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (result.rows[0].exists) {
      console.log('✅ Database tables already exist');
    } else {
      console.log('📊 Running database migrations...');
      const migrateProcess = spawn('node', ['scripts/migrate.js'], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      migrateProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Database migrations completed');
        } else {
          console.log('❌ Database migrations failed');
          process.exit(1);
        }
      });
    }
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    console.log('💡 Make sure PostgreSQL is running and POSTGRES_URL is correct in .env');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Check Redis connection
async function checkRedis() {
  console.log('🔴 Checking Redis connection...');
  const redis = require('../lib/redis');
  
  try {
    await redis.connect();
    console.log('✅ Redis connection successful');
  } catch (error) {
    console.log('❌ Redis connection failed:', error.message);
    console.log('💡 Make sure Redis is running and REDIS_URL is correct in .env');
    process.exit(1);
  }
}

// Start the main server
function startServer() {
  console.log('🌐 Starting main server...');
  const serverProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  serverProcess.on('close', (code) => {
    console.log(`\n🛑 Server stopped with code ${code}`);
  });
}

// Start the render worker
function startWorker() {
  console.log('⚙️  Starting render worker...');
  const workerProcess = spawn('node', ['workers/render-worker.js'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  workerProcess.on('close', (code) => {
    console.log(`\n🛑 Worker stopped with code ${code}`);
  });
}

// Main startup sequence
async function main() {
  try {
    await checkDatabase();
    await checkRedis();
    
    console.log('\n🎵 Starting Astradio services...\n');
    
    // Start worker in background
    startWorker();
    
    // Start server
    startServer();
    
  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development environment...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down development environment...');
  process.exit(0);
});

main();
