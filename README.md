# Fluxa / ETEM - Sistema de Gestión Integrado

Un sistema de gestión moderno y robusto diseñado para la administración de trabajadores, control de asistencias, gestión de proyectos, registro de ingresos, procesamiento de comprobantes/gastos y visualización de métricas clave a través de un panel de control interactivo.

El proyecto está estructurado como un monorepositorio que separa claramente el **Frontend** y el **Backend**, facilitando su despliegue y desarrollo local o en contenedores.

---

## 🚀 Arquitectura y Tecnologías

### Frontend (`/frontend`)
*   **Core**: React 19 + Vite 8
*   **Estilos**: Tailwind CSS v4
*   **Enrutado**: React Router Dom v7
*   **Visualización de datos**: Recharts
*   **Iconos**: Lucide React
*   **Notificaciones**: React Hot Toast
*   **Cliente HTTP**: Axios

### Backend (`/backend`)
*   **Core**: Node.js + Express 5
*   **Base de Datos**: MySQL 8 (usando `mysql2`)
*   **Autenticación**: JWT (JSON Web Tokens) & Encriptación con Bcrypt
*   **Validación**: Zod
*   **Subida de archivos**: Multer (para comprobantes y documentos)

---

## 🛠️ Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:
*   [Node.js](https://nodejs.org/) (v18 o superior recomendado)
*   [Docker](https://www.docker.com/) y **Docker Compose** (opcional, para despliegue simplificado)
*   [MySQL Server](https://dev.mysql.com/downloads/mysql/) (si corres la base de datos de manera local)

---

## 🐳 Despliegue con Docker Compose (Recomendado)

La forma más rápida de inicializar todo el ecosistema (Base de datos MySQL, Servidor Express y Frontend en Nginx) es usando Docker Compose:

1.  Copia el archivo `.env.example` de la raíz a un nuevo archivo `.env` en la misma ubicación:
    ```bash
    cp .env.example .env
    ```
2.  Configura las variables de entorno en el nuevo `.env`:
    *   `DB_PASSWORD`: Contraseña segura para el administrador de la base de datos.
    *   `DB_NAME`: Nombre de la base de datos (por defecto `etem_management`).
    *   `JWT_SECRET`: Clave secreta para firmar los tokens de sesión.
    *   `ADMIN_PASSWORD`: Contraseña inicial para el panel de administración.
3.  Levanta los contenedores:
    ```bash
    docker-compose up --build -d
    ```
4.  El frontend estará disponible en [http://localhost](http://localhost) (Puerto 80).
5.  El backend correrá internamente en el puerto `3001` y se comunicará de forma segura.

---

## 💻 Configuración Local para Desarrollo (Sin Docker)

Si prefieres ejecutar el frontend y el backend de forma independiente en tu entorno local:

### 1. Configuración del Backend
1.  Navega al directorio del backend:
    ```bash
    cd backend
    ```
2.  Instala las dependencias:
    ```bash
    npm install
    ```
3.  Crea un archivo `.env` dentro de `backend/` basado en la configuración de la base de datos de tu servidor MySQL local (por ejemplo, XAMPP o MySQL estándar):
    ```env
    PORT=3003
    DB_HOST=localhost
    DB_USER=root
    DB_PASSWORD=tu_contraseña
    DB_NAME=etem_management
    JWT_SECRET=tu_jwt_secreto
    ```
4.  Inicia el servidor en modo desarrollo/producción:
    ```bash
    node server.js
    ```

### 2. Configuración del Frontend
1.  Navega al directorio del frontend:
    ```bash
    cd ../frontend
    ```
2.  Instala las dependencias:
    ```bash
    npm install
    ```
3.  Inicia el servidor de desarrollo de Vite:
    ```bash
    npm run dev
    ```
4.  El frontend estará disponible en [http://localhost:5173](http://localhost:5173).

---

## 🔒 Seguridad y Buenas Prácticas de Git

Para proteger el entorno y la privacidad de tus datos, se han implementado las siguientes exclusiones automáticas en el control de versiones (`.gitignore`):
*   Archivos de configuración del entorno (`.env`, `backend/.env`)
*   Directorios de dependencias (`node_modules/`)
*   Compilaciones de producción (`dist/`)
*   Copias de seguridad comprimidas (`*.zip`)
*   Archivos temporales del sistema (`.DS_Store`, `Thumbs.db`)
*   Directorios del editor de código (`.vscode/`, `.idea/`)

---

## 📄 Licencia

Este proyecto está bajo la Licencia ISC. Consúltese el archivo de licencia correspondiente para más detalles.
