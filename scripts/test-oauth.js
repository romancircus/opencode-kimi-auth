#!/usr/bin/env node
/**
 * Test script for opencode-kimi-auth OAuth flow
 * 
 * This script tests the OAuth device authorization flow without requiring
 * the full OpenCode CLI integration. Useful for development and debugging.
 * 
 * Usage:
 *   node scripts/test-oauth.js
 * 
 * The script will:
 * 1. Request device authorization from Kimi
 * 2. Display the user code and verification URL
 * 3. Poll for the access token
 * 4. Store the token locally
 * 5. Test the token with a simple API call
 */

import {
  requestDeviceAuthorization,
  pollForToken,
  getToken,
  clearCredentials,
  isAuthenticated,
} from '../dist/oauth.js';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

const TOKEN_FILE = join(homedir(), '.opencode-kimi-auth', 'oauth.json');

async function testOAuthFlow() {
  console.log('🔐 Testing Kimi OAuth Flow\n');
  console.log('=' .repeat(50));

  try {
    // Check if already authenticated
    const alreadyAuth = await isAuthenticated();
    if (alreadyAuth) {
      console.log('\n✅ Already authenticated!');
      const token = await getToken();
      console.log('\n📋 Current token info:');
      console.log(`   Access token: ${token.access_token.slice(0, 20)}...`);
      console.log(`   Expires in: ${token.expires_in} seconds`);
      
      // Ask if user wants to test API or re-authenticate
      console.log('\n📝 What would you like to do?');
      console.log('   1. Test API call with current token');
      console.log('   2. Re-authenticate (clear current token)');
      console.log('   3. Exit');
      
      // For now, just test the API
      await testApiCall(token.access_token);
      return;
    }

    // Step 1: Request device authorization
    console.log('\n📱 Step 1: Requesting device authorization...');
    const deviceAuth = await requestDeviceAuthorization();
    
    console.log('\n✅ Device authorization received!');
    console.log(`\n📝 User Code: ${deviceAuth.user_code}`);
    console.log(`🔗 Verification URL: ${deviceAuth.verification_uri}`);
    console.log(`\n⏱️  Expires in: ${deviceAuth.expires_in} seconds`);
    console.log(`🔄 Poll interval: ${deviceAuth.interval || 5} seconds`);

    // Step 2: Open browser automatically (if possible)
    console.log('\n🌐 Opening browser...');
    try {
      const { exec } = await import('child_process');
      const platform = process.platform;
      const cmd = platform === 'darwin' ? 'open' : 
                  platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${cmd} "${deviceAuth.verification_uri_complete || deviceAuth.verification_uri}"`);
      console.log('✅ Browser opened!');
    } catch (e) {
      console.log('⚠️  Could not open browser automatically. Please open the URL manually.');
    }

    console.log('\n⏳ Waiting for authorization...');
    console.log('   (Please complete the authorization in your browser)');

    // Step 3: Poll for token
    const token = await pollForToken(deviceAuth.device_code, {
      pollInterval: (deviceAuth.interval || 5) * 1000,
      timeout: deviceAuth.expires_in * 1000,
    });

    console.log('\n✅ Token received!');
    console.log(`\n📋 Token info:`);
    console.log(`   Access token: ${token.access_token.slice(0, 20)}...`);
    console.log(`   Refresh token: ${token.refresh_token.slice(0, 20)}...`);
    console.log(`   Token type: ${token.token_type}`);
    console.log(`   Expires in: ${token.expires_in} seconds`);

    // Step 4: Test API call
    console.log('\n🧪 Step 4: Testing API call...');
    await testApiCall(token.access_token);

    // Step 5: Verify token storage
    console.log('\n💾 Step 5: Verifying token storage...');
    try {
      const storedData = await readFile(TOKEN_FILE, 'utf-8');
      const storedToken = JSON.parse(storedData);
      console.log('✅ Token stored successfully!');
      console.log(`   Storage location: ${TOKEN_FILE}`);
      console.log(`   Device ID: ${storedToken.device_id}`);
      console.log(`   Expires at: ${new Date(storedToken.expires_at).toISOString()}`);
    } catch (e) {
      console.error('❌ Failed to verify token storage:', e.message);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ OAuth flow test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Configure opencode to use the plugin:');
    console.log('   2. Run: opencode --provider kimi');

  } catch (error) {
    console.error('\n❌ OAuth test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

async function testApiCall(accessToken) {
  try {
    const response = await fetch('https://kimi.com/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API call successful!');
      console.log(`   Available models: ${data.data?.length || 'unknown'}`);
      if (data.data && data.data.length > 0) {
        console.log(`   First model: ${data.data[0].id}`);
      }
    } else {
      console.error(`❌ API call failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('   Error details:', errorText.slice(0, 200));
    }
  } catch (error) {
    console.error('❌ API call error:', error.message);
  }
}

// Command line arguments
const args = process.argv.slice(2);
if (args.includes('--clear') || args.includes('-c')) {
  console.log('🧹 Clearing stored credentials...');
  clearCredentials()
    .then(() => {
      console.log('✅ Credentials cleared!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to clear credentials:', error.message);
      process.exit(1);
    });
} else if (args.includes('--status') || args.includes('-s')) {
  isAuthenticated()
    .then((auth) => {
      if (auth) {
        console.log('✅ Authenticated');
        getToken().then((token) => {
          console.log(`   Token expires in: ${token.expires_in}s`);
        });
      } else {
        console.log('❌ Not authenticated');
      }
    });
} else {
  testOAuthFlow();
}
