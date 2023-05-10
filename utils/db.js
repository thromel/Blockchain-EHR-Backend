const { Pool } = require('pg');

const pool = new Pool({
  user: 'romel',
  host: 'localhost',
  database: 'Blockchain-Healthcare',
  password: '',
  port: 5432,
});

module.exports = pool;
