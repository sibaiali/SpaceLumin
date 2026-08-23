const { spawn } = require('child_process');
const path = require('path');

const nodeExe = process.execPath;
const serverPath = path.join(__dirname, 'mcp_server.js');

console.log(`Starting MCP server test...`);
console.log(`Node Executable: ${nodeExe}`);
console.log(`Server Script: ${serverPath}`);

const mcpProcess = spawn(nodeExe, [serverPath]);

let responseBuffer = '';
const expectedSteps = [
    {
        name: 'initialize',
        payload: {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                clientInfo: { name: 'TestClient', version: '1.0.0' }
            }
        },
        verify: (res) => {
            if (res.result && res.result.serverInfo && res.result.serverInfo.name === 'spacelumin-mcp-server') {
                console.log('✅ initialize response verified.');
                return true;
            }
            console.log('❌ initialize response verification failed:', res);
            return false;
        }
    },
    {
        name: 'tools/list',
        payload: {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {}
        },
        verify: (res) => {
            if (res.result && res.result.tools && res.result.tools[0].name === 'get_telemetry_snapshot') {
                console.log('✅ tools/list response verified.');
                return true;
            }
            console.log('❌ tools/list response verification failed:', res);
            return false;
        }
    },
    {
        name: 'tools/call (latest)',
        payload: {
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: 'get_telemetry_snapshot',
                arguments: {}
            }
        },
        verify: (res) => {
            if (res.result && !res.isError && res.result.content) {
                const text = res.result.content[0].text;
                const parsed = JSON.parse(text);
                console.log('✅ tools/call (latest) verified. Telemetry Packet:');
                console.log(JSON.stringify(parsed, null, 2));
                if (parsed.smoothed_neuro_flow_coefficient_lambda !== undefined && parsed.lasso_solver_dominant_feature && parsed.active_mutation_profile) {
                    console.log(`✅ Telemetry packet properties strictly validated.`);
                    console.log(`⏱ Latency reported by server: ${parsed.metadata.latency_ms} ms`);
                    return true;
                }
            }
            console.log('❌ tools/call response verification failed:', res);
            return false;
        }
    },
    {
        name: 'tools/call (specific)',
        payload: {
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
                name: 'get_telemetry_snapshot',
                arguments: {
                    episodeId: '0001',
                    tick: 50
                }
            }
        },
        verify: (res) => {
            if (res.result && !res.isError && res.result.content) {
                const text = res.result.content[0].text;
                const parsed = JSON.parse(text);
                console.log('✅ tools/call (specific episode 0001, tick 50) verified:');
                console.log(JSON.stringify(parsed, null, 2));
                if (parsed.metadata.tick === 50) {
                    console.log(`✅ Telemetry specific tick verified successfully.`);
                    return true;
                }
            }
            console.log('❌ tools/call specific verification failed:', res);
            return false;
        }
    }
];

let stepIdx = 0;

function runNextStep() {
    if (stepIdx >= expectedSteps.length) {
        console.log('\n🎉 All test steps completed successfully!');
        mcpProcess.kill();
        process.exit(0);
        return;
    }
    
    const step = expectedSteps[stepIdx];
    console.log(`\nSending request: ${step.name}`);
    mcpProcess.stdin.write(JSON.stringify(step.payload) + '\n');
}

mcpProcess.stdout.on('data', (data) => {
    responseBuffer += data.toString();
    const lines = responseBuffer.split('\n');
    
    // Keep the last partial line in the buffer
    responseBuffer = lines.pop();
    
    for (const line of lines) {
        if (line.trim() === '') continue;
        
        try {
            const res = JSON.parse(line);
            const step = expectedSteps[stepIdx];
            if (step && res.id === step.payload.id) {
                const success = step.verify(res);
                if (success) {
                    stepIdx++;
                    runNextStep();
                } else {
                    console.error(`Step ${step.name} failed verification. Exiting.`);
                    mcpProcess.kill();
                    process.exit(1);
                }
            }
        } catch (err) {
            console.error('Failed to parse line:', line, err);
        }
    }
});

mcpProcess.stderr.on('data', (data) => {
    console.error(`[Server stderr] ${data.toString().trim()}`);
});

mcpProcess.on('close', (code) => {
    if (code !== 0 && stepIdx < expectedSteps.length) {
        console.error(`MCP process exited with code ${code} before all tests finished.`);
        process.exit(1);
    }
});

// Run the first step
runNextStep();
