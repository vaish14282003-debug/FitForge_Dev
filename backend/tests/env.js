process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret-test';
// Placeholder to satisfy env validation; tests connect to the in-memory server instead.
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/fitforge-test';
// Uploads go to a throwaway folder per test run.
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), `fitforge-test-uploads-${process.pid}`);
