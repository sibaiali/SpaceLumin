#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    analyzeEvaluationPackages,
    createSessionMetricsCSV,
    createGroupMetricsCSV,
    createConfusionMatrixCSV,
    createMarkdownReport,
    DEFAULT_BOOTSTRAP_REPLICATES,
    DEFAULT_BOOTSTRAP_SEED
} = require('../js/PredictionEvaluationMetrics.js');

function usage() {
    return [
        'Usage:',
        '  node scripts/analyze_prediction_evaluation.js [options] <export.json> [...]',
        '',
        'Options:',
        `  --bootstrap-replicates <n>  Session-clustered replicates (default ${DEFAULT_BOOTSTRAP_REPLICATES})`,
        `  --bootstrap-seed <n>        Deterministic integer seed (default ${DEFAULT_BOOTSTRAP_SEED})`,
        '  --json-output <file>        Write complete metrics JSON',
        '  --session-csv-output <file> Write one metrics row per session',
        '  --group-csv-output <file>   Write one row per deterministic breakdown group',
        '  --confusion-csv-output <file> Write raw confusion-matrix cells',
        '  --report-output <file>      Write a concise Markdown report',
        '  --compact                   Emit compact JSON',
        '  --help                      Show this help',
        '',
        'A filename may contain * or ? in its final path component.'
    ].join('\n');
}

function parseInteger(value, option) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) throw new Error(`${option} requires an integer`);
    return parsed;
}

function parseArguments(argv) {
    const options = {
        bootstrapReplicates: DEFAULT_BOOTSTRAP_REPLICATES,
        bootstrapSeed: DEFAULT_BOOTSTRAP_SEED,
        jsonOutput: null,
        sessionCsvOutput: null,
        groupCsvOutput: null,
        confusionCsvOutput: null,
        reportOutput: null,
        compact: false,
        files: []
    };
    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];
        if (argument === '--help' || argument === '-h') return { ...options, help: true };
        if (argument === '--compact') {
            options.compact = true;
        } else if (argument === '--bootstrap-replicates') {
            options.bootstrapReplicates = parseInteger(argv[++index], argument);
        } else if (argument === '--bootstrap-seed') {
            options.bootstrapSeed = parseInteger(argv[++index], argument);
        } else if (argument === '--json-output' || argument === '--output') {
            options.jsonOutput = argv[++index];
            if (!options.jsonOutput) throw new Error(`${argument} requires a filename`);
        } else if (argument === '--session-csv-output') {
            options.sessionCsvOutput = argv[++index];
            if (!options.sessionCsvOutput) throw new Error(`${argument} requires a filename`);
        } else if (argument === '--group-csv-output') {
            options.groupCsvOutput = argv[++index];
            if (!options.groupCsvOutput) throw new Error(`${argument} requires a filename`);
        } else if (argument === '--confusion-csv-output') {
            options.confusionCsvOutput = argv[++index];
            if (!options.confusionCsvOutput) throw new Error(`${argument} requires a filename`);
        } else if (argument === '--report-output') {
            options.reportOutput = argv[++index];
            if (!options.reportOutput) throw new Error(`${argument} requires a filename`);
        } else if (argument.startsWith('-')) {
            throw new Error(`Unknown option ${argument}`);
        } else {
            options.files.push(argument);
        }
    }
    return options;
}

function wildcardExpression(pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
}

function expandFileArgument(argument) {
    if (!/[?*]/.test(argument)) return [path.resolve(argument)];
    const directory = path.resolve(path.dirname(argument));
    const pattern = path.basename(argument);
    if (!fs.existsSync(directory)) return [];
    const expression = wildcardExpression(pattern);
    return fs.readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isFile() && expression.test(entry.name))
        .map(entry => path.join(directory, entry.name))
        .sort((left, right) => left.localeCompare(right));
}

function loadPackages(fileArguments) {
    const files = [...new Set(fileArguments.flatMap(expandFileArgument))]
        .sort();
    if (!files.length) throw new Error('No input JSON files matched');
    return {
        files,
        packages: files.map(filename => {
            let parsed;
            try {
                parsed = JSON.parse(fs.readFileSync(filename, 'utf8'));
            } catch (error) {
                throw new Error(`Cannot read ${filename}: ${error.message}`);
            }
            return parsed;
        })
    };
}

function main(argv = process.argv.slice(2)) {
    const options = parseArguments(argv);
    if (options.help) {
        process.stdout.write(`${usage()}\n`);
        return 0;
    }
    if (!options.files.length) throw new Error(`No input files supplied\n\n${usage()}`);
    const loaded = loadPackages(options.files);
    const outputEntries = [
        ['--json-output', options.jsonOutput],
        ['--session-csv-output', options.sessionCsvOutput],
        ['--group-csv-output', options.groupCsvOutput],
        ['--confusion-csv-output', options.confusionCsvOutput],
        ['--report-output', options.reportOutput]
    ].filter(([, filename]) => filename).map(([option, filename]) =>
        [option, path.resolve(filename)]
    );
    const uniqueOutputs = new Set();
    for (const [option, outputPath] of outputEntries) {
        if (loaded.files.includes(outputPath)) {
            throw new Error(`${option} must not overwrite an input evaluation export`);
        }
        if (uniqueOutputs.has(outputPath)) {
            throw new Error('Each analysis output must use a different path');
        }
        uniqueOutputs.add(outputPath);
    }
    const result = analyzeEvaluationPackages(loaded.packages, {
        bootstrapReplicates: options.bootstrapReplicates,
        bootstrapSeed: options.bootstrapSeed
    });
    const serialized = JSON.stringify(result, null, options.compact ? 0 : 2) + '\n';
    if (options.jsonOutput) {
        fs.writeFileSync(path.resolve(options.jsonOutput), serialized, 'utf8');
    }
    if (options.sessionCsvOutput) {
        fs.writeFileSync(path.resolve(options.sessionCsvOutput),
            `${createSessionMetricsCSV(result)}\r\n`, 'utf8');
    }
    if (options.groupCsvOutput) {
        fs.writeFileSync(path.resolve(options.groupCsvOutput),
            `${createGroupMetricsCSV(result)}\r\n`, 'utf8');
    }
    if (options.confusionCsvOutput) {
        fs.writeFileSync(path.resolve(options.confusionCsvOutput),
            `${createConfusionMatrixCSV(result)}\r\n`, 'utf8');
    }
    if (options.reportOutput) {
        fs.writeFileSync(path.resolve(options.reportOutput),
            createMarkdownReport(result), 'utf8');
    }
    if (!outputEntries.length) {
        process.stdout.write(serialized);
    }
    return 0;
}

if (require.main === module) {
    try {
        process.exitCode = main();
    } catch (error) {
        process.stderr.write(`Prediction evaluation analysis failed: ${error.message}\n`);
        process.exitCode = 1;
    }
}

module.exports = Object.freeze({
    main,
    parseArguments,
    expandFileArgument,
    loadPackages
});
