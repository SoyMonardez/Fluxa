const z = require('zod');
const { esFecha } = require('./fechas');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const fail = (status, message) => {
  throw new HttpError(status, message);
};

// Esquemas reutilizables
const id = z.coerce.number().int().positive();
const fecha = z.string().refine(esFecha, 'Fecha inválida (YYYY-MM-DD)');
const texto = (max) => z.string().trim().max(max).default('');
const dinero = z.number().min(0).max(1_000_000_000);

const paramId = (req) => id.parse(req.params.id);

module.exports = { HttpError, fail, id, fecha, texto, dinero, paramId };
