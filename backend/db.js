const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  // DATE vuelve como 'YYYY-MM-DD' (sin zona horaria) y DECIMAL como number.
  dateStrings: true,
  decimalNumbers: true,
};

const pool = mysql.createPool({
  ...config,
  database: process.env.DB_NAME || 'etem_management',
  waitForConnections: true,
  connectionLimit: 10,
});

// Ejecuta fn dentro de una transacción con su propia conexión.
async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, tx, config };
