const functions = require('./dist/index.js');
console.log('Exports:', Object.keys(functions));
if (functions.askCompanyBot) {
    console.log('askCompanyBot is exported!');
} else {
    console.error('askCompanyBot is NOT exported!');
}
