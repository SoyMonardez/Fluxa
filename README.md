# Fluxa

Sistema de gestión para centralizar trabajadores, asistencias, proyectos, proveedores, ingresos, gastos y comprobantes de una empresa de construcción.

**Estado:** MVP funcional en mantenimiento.

## Funcionalidades verificadas

- Administración de trabajadores, proyectos y proveedores.
- Asignación de personal a obras.
- Registro semanal de asistencias y cálculo de liquidaciones.
- Registro de ingresos y movimientos financieros.
- Carga y consulta de comprobantes.
- Panel con resúmenes, gráficos y estado de obras.
- Autenticación mediante JWT.

## Stack

- **Frontend:** React, Vite, Tailwind CSS y Recharts.
- **Backend:** Node.js, Express y Zod.
- **Base de datos:** MySQL.
- **Infraestructura:** Docker Compose y Nginx.

## Inicio con Docker

1. Copiar `.env.example` a `.env`.
2. Reemplazar las contraseñas y el secreto JWT.
3. Ejecutar:

```bash
docker compose up --build
```

## Desarrollo local

Backend:

```bash
cd backend
npm install
npm start
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Seguridad

Las credenciales se cargan desde variables de entorno. Los archivos `.env`, uploads, dependencias, builds y copias comprimidas se mantienen fuera del repositorio.

## Pruebas

Actualmente el repositorio no cuenta con una suite automatizada de pruebas. El frontend incluye comandos de lint y build.

## Licencia

Este repositorio no incluye actualmente una licencia de distribución. La elección de licencia queda pendiente.

## Autor

Alejo Monárdez  
[Portfolio](https://alejomonardez.com) · [GitHub](https://github.com/SoyMonardez)
