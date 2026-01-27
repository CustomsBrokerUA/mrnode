const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 3000;
const ENV_PATH = path.join(__dirname, '..', '.env');

console.clear();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 MRNode Internet Access (Ngrok Debug Mode)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

function getAuthData() {
    if (!fs.existsSync(ENV_PATH)) return { token: null, domain: null };
    const content = fs.readFileSync(ENV_PATH, 'utf8');
    const tokenMatch = content.match(/NGROK_AUTHTOKEN="?([^"\s\n]+)"?/);
    const domainMatch = content.match(/NGROK_DOMAIN="?([^"\s\n]+)"?/);
    return {
        token: tokenMatch ? tokenMatch[1] : null,
        domain: domainMatch ? domainMatch[1] : null
    };
}

const { token: authToken, domain: staticDomain } = getAuthData();

if (!authToken) {
    console.log('❌ NGROK_AUTHTOKEN not found in .env!');
    process.exit(1);
}

function updateEnv(url) {
    try {
        let envContent = fs.readFileSync(ENV_PATH, 'utf8');
        const nextAuthUrlLine = `NEXTAUTH_URL="${url}"`;
        if (envContent.includes('NEXTAUTH_URL=')) {
            envContent = envContent.replace(/NEXTAUTH_URL=(.*)/g, nextAuthUrlLine);
        } else {
            envContent += `\n${nextAuthUrlLine}\n`;
        }
        fs.writeFileSync(ENV_PATH, envContent);
        console.log(`✅ Authentication URL updated: ${url}`);
    } catch (e) {
        console.error('❌ Failed to update .env:', e.message);
    }
}

let retryCount = 0;
const MAX_RETRIES = 15;

let serverRetryCount = 0;
const MAX_SERVER_RETRIES = 60;

async function checkTunnelApi() {
    http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                const tunnel = json.tunnels.find(t => t.proto === 'https');
                if (tunnel && tunnel.public_url) {
                    updateEnv(tunnel.public_url);
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('🌟 SUCCESS! SYSTEM IS ONLINE');
                    console.log(`🔗 PUBLIC LINK: ${tunnel.public_url}`);
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('📟 KEEP THIS WINDOW OPEN.');
                } else {
                    retry();
                }
            } catch (e) {
                retry();
            }
        });
    }).on('error', () => {
        retry();
    });
}

function retry() {
    retryCount++;
    if (retryCount < MAX_RETRIES) {
        process.stdout.write('.');
        setTimeout(checkTunnelApi, 2000);
    } else {
        console.log('\n❌ Failed to get tunnel URL after several attempts.');
        console.log('Please check if another ngrok instance is running.');
    }
}

console.log('📡 Starting Ngrok process...');
function waitForServer() {
    http.get(`http://127.0.0.1:${PORT}/`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
            startNgrok();
            return;
        }
        retryServerWait();
    }).on('error', () => {
        retryServerWait();
    });
}

function retryServerWait() {
    serverRetryCount++;
    if (serverRetryCount < MAX_SERVER_RETRIES) {
        process.stdout.write('.');
        setTimeout(waitForServer, 1000);
    } else {
        console.log(`\n❌ Local server did not become ready on http://127.0.0.1:${PORT} in time.`);
        console.log('Start the app first (npm run dev) and try again.');
    }
}

let ngrok;

function startNgrok() {
    console.log('\n✅ Local server is reachable. Starting ngrok...');
    const ngrokArgs = ['-y', 'ngrok', 'http', `http://127.0.0.1:${PORT}`, '--authtoken', authToken, '--host-header', 'localhost:3000'];
    if (staticDomain) {
        console.log(`💎 Using static domain: ${staticDomain}`);
        ngrokArgs.push('--domain', staticDomain);
    }
    ngrok = spawn('npx', ngrokArgs, { shell: true });

    ngrok.stdout.on('data', (data) => {
        // Usually ngrok doesn't output much to stdout in this mode
    });

    ngrok.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('error')) {
            console.error('\n⚠️ Ngrok reported an error:', output.trim());
        }
    });

    ngrok.on('exit', (code) => {
        if (code !== 0) {
            console.log(`\n❌ Ngrok process exited with code ${code}`);
        }
    });

    console.log('⏳ Connecting to tunnel API');
    checkTunnelApi();

    process.on('SIGINT', () => {
        console.log('\n🛑 Stopping tunnel...');
        try {
            // Kill ngrok and its children on Windows
            execSync(`taskkill /F /T /PID ${ngrok.pid} 2>nul`);
        } catch (e) { }
        process.exit();
    });
}

process.stdout.write('⏳ Waiting for local server on http://127.0.0.1:3000');
waitForServer();
