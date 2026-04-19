const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const mysql = require("mysql2/promise");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;

const publicFiles = {
  "/": "index.html",
  "/index.html": "index.html",
  "/login.html": "login.html",
  "/cadastro.html": "cadastro.html",
  "/home.html": "home.html",
  "/style.css": "style.css",
  "/shared.js": "shared.js",
  "/login.js": "login.js",
  "/cadastro.js": "cadastro.js",
  "/home.js": "home.js"
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function loadEnvFile() {
  const envPath = path.join(ROOT_DIR, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"|"$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const dbName = process.env.DB_NAME || "sistema_contas_pagar";

const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: dbName,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

async function initializeDatabase() {
  const bootstrapConnection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: dbConfig.ssl
  });

  await bootstrapConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrapConnection.end();

  pool = mysql.createPool(dbConfig);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL AUTO_INCREMENT,
      nome VARCHAR(120) NOT NULL,
      email VARCHAR(160) NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      token CHAR(36) NOT NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sessions_token (token),
      KEY idx_sessions_user_id (user_id),
      CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function getRequestBody(request) {
  return new Promise((resolve, reject) => {
    let rawData = "";

    request.on("data", (chunk) => {
      rawData += chunk;

      if (rawData.length > 1_000_000) {
        request.destroy();
        reject(new Error("Payload muito grande."));
      }
    });

    request.on("end", () => {
      if (!rawData) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawData));
      } catch {
        reject(new Error("JSON inválido."));
      }
    });

    request.on("error", reject);
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

async function createSession(userId) {
  const token = crypto.randomUUID();
  await pool.query("INSERT INTO sessions (user_id, token) VALUES (?, ?)", [userId, token]);
  return token;
}

async function findUserByToken(request) {
  const authHeader = request.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return null;
  }

  const [rows] = await pool.query(
    `
      SELECT users.id, users.nome, users.email
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.token = ?
      LIMIT 1
    `,
    [token]
  );

  return rows[0] || null;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email
  };
}

async function handleApi(request, response) {
  if (request.method === "POST" && request.url === "/api/auth/register") {
    const body = await getRequestBody(request);
    const nome = body.nome?.trim();
    const email = body.email?.trim().toLowerCase();
    const senha = body.senha?.trim();

    if (!nome || nome.length < 3 || !email || !senha || senha.length < 6) {
      sendJson(response, 400, { message: "Preencha nome, e-mail e senha válidos." });
      return;
    }

    const [existingUsers] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existingUsers.length > 0) {
      sendJson(response, 409, { message: "Já existe um usuário cadastrado com este e-mail." });
      return;
    }

    const [result] = await pool.query(
      "INSERT INTO users (nome, email, senha_hash) VALUES (?, ?, ?)",
      [nome, email, hashPassword(senha)]
    );

    sendJson(response, 201, {
      message: "Usuário criado com sucesso.",
      user: { id: result.insertId, nome, email }
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/auth/login") {
    const body = await getRequestBody(request);
    const email = body.email?.trim().toLowerCase();
    const senha = body.senha?.trim();

    if (!email || !senha) {
      sendJson(response, 400, { message: "Informe e-mail e senha." });
      return;
    }

    const [users] = await pool.query(
      "SELECT id, nome, email, senha_hash FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    const user = users[0];
    if (!user || !verifyPassword(senha, user.senha_hash)) {
      sendJson(response, 401, { message: "Credenciais inválidas." });
      return;
    }

    const token = await createSession(user.id);
    sendJson(response, 200, {
      message: "Login realizado com sucesso.",
      token,
      user: sanitizeUser(user)
    });
    return;
  }

  if (request.method === "GET" && request.url === "/api/auth/me") {
    const user = await findUserByToken(request);

    if (!user) {
      sendJson(response, 401, { message: "Sessão inválida ou expirada." });
      return;
    }

    sendJson(response, 200, { user: sanitizeUser(user) });
    return;
  }

  sendJson(response, 404, { message: "Rota não encontrada." });
}

function serveStaticFile(response, filePath) {
  const extension = path.extname(filePath);
  const contentType = mimeTypes[extension] || "application/octet-stream";

  try {
    const content = fs.readFileSync(filePath);
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  } catch {
    sendJson(response, 404, { message: "Arquivo não encontrado." });
  }
}

async function startServer() {
  await initializeDatabase();

  const server = http.createServer(async (request, response) => {
    try {
      if (request.url?.startsWith("/api/")) {
        await handleApi(request, response);
        return;
      }

      const asset = publicFiles[request.url] || publicFiles["/"];
      serveStaticFile(response, path.join(ROOT_DIR, asset));
    } catch (error) {
      sendJson(response, 500, { message: error.message || "Erro interno do servidor." });
    }
  });

  server.listen(PORT, () => {
    console.log(`FatureMais disponível em http://localhost:${PORT}`);
    console.log(
      `MySQL conectado em ${dbConfig.host}:${dbConfig.port} | banco: ${dbName}`
    );
  });
}

startServer().catch((error) => {
  console.error("Falha ao iniciar o servidor:", error.message);
  process.exit(1);
});
