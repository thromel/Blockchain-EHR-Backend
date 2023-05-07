// db.js
const pgp = require('pg-promise')();

const dbConfig = {
  host: 'your_host',
  port: 5432,
  database: 'your_database',
  user: 'your_username',
  password: 'your_password',
};

const db = pgp(dbConfig);

module.exports = db;
