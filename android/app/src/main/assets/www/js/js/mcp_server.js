const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ==========================================
// 1. JSON SCHEMA VALIDATOR (Vanilla implementation)
// ==========================================
function validateSchema(data, schema, pathStr = '') {
    if (schema.type === 'object') {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            throw new Error(`Validation error at ${pathStr || 'root'}: expected object, got ${typeof data}`);
        }
        if (schema.required) {
            for (const req of schema.required) {
                if (!(req in data)) {
                    throw new Error(`Validation error at ${pathStr || 'root'}: missing required property "${req}"`);
                }
            }
        }
        if (schema.properties) {
            for (const prop in data) {
                if (schema.properties[prop]) {
                    validateSchema(data[prop], schema.properties[prop], pathStr ? `${pathStr}.${prop}` : prop);
                }
            }
        }
    } else if (schema.type === 'array') {
        if (!Array.isArray(data)) {
            throw new Error(`Validation error at ${pathStr || 'root'}: expected array, got ${typeof data}`);
        }
        if (schema.items) {
            for (let i = 0; i < data.length; i++) {
                validateSchema(data[i], schema.items, `${pathStr || 'root'}[${i}]`);
            }
        }
    } else if (schema.type === 'integer') {
        if (!Number.isInteger(data)) {
            throw new Error(`Validation error at ${pathStr || 'root'}: expected integer, got ${typeof data}`);
        }
        if (schema.minimum !== undefined && data < schema.minimum) {
            throw new Error(`Validation error at ${pathStr || 'root'}: value ${data} is less than minimum ${schema.minimum}`);
        }
    } else if (schema.type === 'number') {
        if (typeof data !== 'number' || isNaN(data)) {
            throw new Error(`Validation error at ${pathStr || 'root'}: expected number, got ${typeof data}`);
        }
        if (schema.minimum !== undefined && data < schema.minimum) {
            throw new Error(`Validation error at ${pathStr || 'root'}: value ${data} is less than minimum ${schema.minimum}`);
        }
    } else if (schema.type === 'string') {
        if (typeof data !== 'string') {
            throw new Error(`Validation error at ${pathStr || 'root'}: expected string, got ${typeof data}`);
        }
        if (schema.enum && !schema.enum.includes(data)) {
            throw new Error(`Validation error at ${pathStr || 'root'}: value "${data}" is not one of enum [${schema.enum.join(', ')}]`);
        }
    }
}

// Pydantic-equivalent JSON Schema for SpaceLumin telemetry line
const schema = {
    type: "object",
    properties: {
        tick: { type: "integer", minimum: 1 },
        profile: { type: "string", enum: ["Perfect Flow", "Boredom", "Frustration"] },
        time: { type: "number", minimum: 0 },
        kinematics: {
            type: "object",
            properties: {
                vx: { type: "number" },
                vy: { type: "number" },
                accelMag: { type: "number" },
                jerkMag: { type: "number" },
                reactMs: { type: "number" },
                accuracy: { type: "number" }
            },
            required: ["vx", "vy", "accelMag", "jerkMag", "reactMs", "accuracy"]
        },
        stimuli: {
            type: "object",
            properties: {
                enemyDensity: { type: "number" },
                bulletCoverage: { type: "number" },
                audioPeakDb: { type: "number" },
                visibleMeshes: { type: "number" },
                aggressionMult: { type: "number" },
                waveTimerRatio: { type: "number" }
            },
            required: ["enemyDensity", "bulletCoverage", "audioPeakDb", "visibleMeshes", "aggressionMult", "waveTimerRatio"]
        },
        neuroflow: {
            type: "object",
            properties: {
                entropy: { type: "number" },
                flowProb: { type: "number" },
                boredomProb: { type: "number" },
                frustrationProb: { type: "number" },
                kalmanLambda: { type: "number" }
            },
            required: ["entropy", "flowProb", "boredomProb", "frustrationProb", "kalmanLambda"]
        },
        lassoAlpha: {
            type: "array",
            items: { type: "number" }
        },
        attrScores: {
            type: "array",
            items: { type: "number" }
        }
    },
    required: ["tick", "profile", "time", "kinematics", "stimuli", "neuroflow", "lassoAlpha", "attrScores"]
};

// ==========================================
// 2. BIOLOGICAL GENE MAPPING
// ==========================================
function getMutationProfile(flowProb, boredomProb, frustrationProb, aggressionMult) {
    if (frustrationProb > 0.5) {
        return "high_aggression_scaled";
    } else if (boredomProb > 0.5) {
        return "understimulation_boost_active";
    } else if (flowProb > 0.5) {
        return "balanced_flow_exploration";
    }
    return "standard_equilibrium";
}

// ==========================================
// 3. MCP METHOD ROUTERS
// ==========================================
function sendResponse(id, result) {
    const response = {
        jsonrpc: "2.0",
        id: id,
        result: result
    };
    process.stdout.write(JSON.stringify(response) + '\n');
}

function sendError(id, code, message, data) {
    const response = {
        jsonrpc: "2.0",
        id: id,
        error: {
            code: code,
            message: message
        }
    };
    if (data) response.error.data = data;
    process.stdout.write(JSON.stringify(response) + '\n');
}

function findLatestEpisode(factoryDir) {
    let left = 1;
    let right = 10000;
    let latest = 0;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const filename = `episode_${String(mid).padStart(4, '0')}.jsonl`;
        const filePath = path.join(factoryDir, filename);
        
        if (fs.existsSync(filePath)) {
            latest = mid;
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return latest;
}

function handleGetTelemetrySnapshot(id, args) {
    const startTime = process.hrtime();
    const factoryDir = path.join(__dirname, '..', 'telemetry_factory');
    
    try {
        if (!fs.existsSync(factoryDir)) {
            return sendResponse(id, {
                content: [{ type: "text", text: JSON.stringify({ error: "Telemetry factory directory not found" }) }],
                isError: true
            });
        }
        
        let targetEpisode = 0;
        let specificFile = false;
        
        if (args.episodeId && args.episodeId !== 'latest') {
            targetEpisode = parseInt(args.episodeId, 10);
            specificFile = true;
        } else {
            targetEpisode = findLatestEpisode(factoryDir);
            if (targetEpisode === 0) {
                return sendResponse(id, {
                    content: [{ type: "text", text: JSON.stringify({ error: "No telemetry files found in telemetry_factory" }) }],
                    isError: true
                });
            }
        }
        
        let tickData = null;
        let attempt = 0;
        const maxAttempts = 5;
        let currentNum = targetEpisode;
        
        while (!tickData && attempt < maxAttempts && currentNum > 0) {
            const targetFile = `episode_${String(currentNum).padStart(4, '0')}.jsonl`;
            const filePath = path.join(factoryDir, targetFile);
            
            try {
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const lines = content.trim().split('\n');
                    if (lines.length > 0) {
                        let lineIndex = lines.length - 1;
                        if (args.tick !== undefined && args.tick !== 'latest') {
                            const targetTick = parseInt(args.tick, 10);
                            if (targetTick >= 1 && targetTick <= lines.length) {
                                lineIndex = targetTick - 1;
                            }
                        }
                        
                        const line = lines[lineIndex];
                        if (line) {
                            const parsed = JSON.parse(line);
                            validateSchema(parsed, schema);
                            tickData = parsed;
                        }
                    }
                }
            } catch (err) {
                if (specificFile) {
                    throw err;
                }
                console.error(`[MCP warning] Error reading file ${targetFile}: ${err.message}`);
            }
            
            if (specificFile) break;
            currentNum--;
            attempt++;
        }
        
        if (!tickData) {
            return sendResponse(id, {
                content: [{ type: "text", text: JSON.stringify({ error: "Could not read any valid telemetry tick data" }) }],
                isError: true
            });
        }
        
        // 1. Neuro-flow Coefficient (lambda)
        const lambda = tickData.neuroflow.kalmanLambda;
        
        // 2. Dominant Lasso feature attribution
        const stimNames = ['threat_density_count', 'bulletCoverage', 'audioPeakDb', 'visibleMeshes', 'aggressionMult', 'waveTimerRatio'];
        let maxScore = -1;
        let dominantIndex = 0;
        for (let i = 0; i < tickData.attrScores.length; i++) {
            if (tickData.attrScores[i] > maxScore) {
                maxScore = tickData.attrScores[i];
                dominantIndex = i;
            }
        }
        const dominantFeature = stimNames[dominantIndex];
        
        // 3. EnemyDNA active mutation profile
        const mutationProfile = getMutationProfile(
            tickData.neuroflow.flowProb,
            tickData.neuroflow.boredomProb,
            tickData.neuroflow.frustrationProb,
            tickData.stimuli.aggressionMult
        );
        
        const diff = process.hrtime(startTime);
        const latencyMs = (diff[0] * 1e9 + diff[1]) / 1e6;
        
        const responsePacket = {
            smoothed_neuro_flow_coefficient_lambda: lambda,
            lasso_solver_dominant_feature: dominantFeature,
            active_mutation_profile: mutationProfile,
            metadata: {
                tick: tickData.tick,
                profile: tickData.profile,
                latency_ms: parseFloat(latencyMs.toFixed(3))
            }
        };
        
        return sendResponse(id, {
            content: [{ type: "text", text: JSON.stringify(responsePacket, null, 2) }],
            isError: false
        });
        
    } catch (err) {
        return sendResponse(id, {
            content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
            isError: true
        });
    }
}

function handleRequest(req) {
    if (req.jsonrpc !== "2.0") {
        return sendError(req.id, -32600, "Invalid Request");
    }
    
    switch (req.method) {
        case "initialize":
            return sendResponse(req.id, {
                protocolVersion: req.params.protocolVersion || "2024-11-05",
                capabilities: {
                    tools: {}
                },
                serverInfo: {
                    name: "spacelumin-mcp-server",
                    version: "1.0.0"
                }
            });
            
        case "initialized":
            return; // Notification, no response
            
        case "tools/list":
            return sendResponse(req.id, {
                tools: [
                    {
                        name: "get_telemetry_snapshot",
                        description: "Retrieves the latest cognitive and telemetry state snapshot from SpaceLumin simulation runs.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                episodeId: {
                                    type: "string",
                                    description: "Optional episode ID (e.g. '0001' or 'latest')"
                                },
                                tick: {
                                    type: "integer",
                                    description: "Optional tick index (1-100)"
                                }
                            }
                        }
                    }
                ]
            });
            
        case "tools/call":
            if (!req.params || req.params.name !== "get_telemetry_snapshot") {
                return sendError(req.id, -32601, "Method not found");
            }
            return handleGetTelemetrySnapshot(req.id, req.params.arguments || {});
            
        case "ping":
            return sendResponse(req.id, {});
            
        default:
            if (req.id !== undefined) {
                return sendError(req.id, -32601, "Method not found");
            }
    }
}

// ==========================================
// 4. STDIO INTERFACE READ LOOP
// ==========================================
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.on('line', (line) => {
    try {
        const request = JSON.parse(line);
        handleRequest(request);
    } catch (err) {
        sendError(null, -32700, "Parse error");
    }
});
