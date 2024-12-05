const { spawn } = require('child_process');

const services = [
    { port: 3010, script: './auth.js' },
    { port: 3011, script: './article.js' },
    { port: 3012, script: './ad.js' },
    { port: 3013, script: './comment.js' },
    { port: 3014, script: './search.js' },
];

services.forEach(service => {
    const process = spawn('node', [service.script]);
});