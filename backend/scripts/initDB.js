const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function initDB() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    console.log('Conectado a MySQL. Configurando ETEM Management...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'etem_management'}\``);
    await connection.query(`USE \`${process.env.DB_NAME || 'etem_management'}\``);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS proyectos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        cliente VARCHAR(100) DEFAULT '',
        descripcion TEXT,
        estado ENUM('Activo', 'Pausado', 'Terminado') DEFAULT 'Activo',
        fecha_inicio DATE NOT NULL,
        fecha_fin DATE DEFAULT NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS trabajadores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        rol VARCHAR(50) NOT NULL,
        activo TINYINT(1) DEFAULT 1
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS asignaciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        trabajador_id INT NOT NULL,
        proyecto_id INT NOT NULL,
        pago_jornal DECIMAL(10,2) NOT NULL,
        activo TINYINT(1) DEFAULT 1,
        fecha_desde DATE NOT NULL,
        FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id) ON DELETE CASCADE,
        FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS asistencias (
        id INT AUTO_INCREMENT PRIMARY KEY,
        trabajador_id INT NOT NULL,
        proyecto_id INT NOT NULL,
        fecha DATE NOT NULL,
        cantidad_jornales DECIMAL(3,1) NOT NULL DEFAULT 0,
        extra_pago DECIMAL(10,2) NOT NULL DEFAULT 0,
        UNIQUE KEY idx_trab_proy_fecha (trabajador_id, proyecto_id, fecha),
        FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id) ON DELETE CASCADE,
        FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ingresos_obra (
        id INT AUTO_INCREMENT PRIMARY KEY,
        proyecto_id INT NOT NULL,
        tipo ENUM('Adelanto','Pago Parcial','Pago Final','Otro') NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        descripcion TEXT,
        fecha DATE NOT NULL,
        FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS gastos_proveedor (
        id INT AUTO_INCREMENT PRIMARY KEY,
        categoria VARCHAR(100) NOT NULL,
        proveedor VARCHAR(100) DEFAULT '',
        descripcion TEXT,
        monto DECIMAL(12,2) NOT NULL,
        fecha DATE NOT NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS comprobantes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        categoria ENUM('IVA','Ferretería / Áridos','Certificados de Obra','Pagos a Obreros','Otros') NOT NULL,
        nombre_original VARCHAR(255) NOT NULL,
        nombre_archivo VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100),
        tamanio INT,
        descripcion TEXT,
        fecha DATE NOT NULL,
        proyecto_id INT DEFAULT NULL,
        FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE SET NULL
      )
    `);

    const [rows] = await connection.query('SELECT id FROM usuarios WHERE username = ?', ['admin']);
    if (rows.length === 0) {
      console.log('Creando usuario admin...');
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Etem2026!', 10);
      await connection.execute(
        'INSERT INTO usuarios (username, password_hash) VALUES (?, ?)',
        ['admin', hashedPassword]
      );
    }

    console.log('Base de datos ETEM lista.');
    await connection.end();
  } catch (error) {
    console.error('Error inicializando DB:', error.message);
    process.exit(1);
  }
}

initDB();
