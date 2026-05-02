const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const mysql = require("mysql2/promise");

const ROOT_DIR = __dirname;

const publicFiles = {
  "/": "index.html",
  "/index.html": "index.html",
  "/login.html": "login.html",
  "/cadastro.html": "cadastro.html",
  "/usuarios.html": "usuarios.html",
  "/home.html": "home.html",
  "/style.css": "style.css",
  "/shared.js": "shared.js",
  "/login.js": "login.js",
  "/cadastro.js": "cadastro.js",
  "/usuarios.js": "usuarios.js",
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

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const isRailway =
  Boolean(process.env.RAILWAY_ENVIRONMENT) ||
  Boolean(process.env.RAILWAY_PROJECT_ID) ||
  Boolean(process.env.RAILWAY_STATIC_URL);

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria nao definida: ${name}`);
  }

  return value;
}

function getFirstEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return "";
}

function requireAnyEnv(...names) {
  const value = getFirstEnv(...names);

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria nao definida: ${names.join(" ou ")}`);
  }

  return value;
}

const dbHost = isRailway ? requireAnyEnv("DB_HOST", "MYSQLHOST") : getFirstEnv("DB_HOST") || "127.0.0.1";
const dbPort = isRailway ? Number(requireAnyEnv("DB_PORT", "MYSQLPORT")) : Number(getFirstEnv("DB_PORT") || 3306);
const dbUser = isRailway ? requireAnyEnv("DB_USER", "MYSQLUSER") : getFirstEnv("DB_USER") || "root";
const dbPassword = isRailway ? requireAnyEnv("DB_PASSWORD", "MYSQLPASSWORD") : getFirstEnv("DB_PASSWORD");
const dbName = getFirstEnv("DB_NAME", "MYSQLDATABASE") || "sistema_contas_pagar";
const authSecret = process.env.AUTH_SECRET || `${dbUser}:${dbPassword}:${dbHost}`;

const dbConfig = {
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;
const schemas = {
  seguranca: "seguranca",
  cadastro: "cadastro",
  financeiro: "financeiro"
};

function getMainUserTable() {
  return `\`${schemas.seguranca}\`.\`tbUsuarios\``;
}

function getCompatUserTable() {
  return `\`${dbName}\`.\`tbUsuarios\``;
}

function getLegacyUsersTable() {
  return `\`${dbName}\`.\`users\``;
}

function getSchemaStatements() {
  return [
    `
      CREATE TABLE IF NOT EXISTS \`${schemas.seguranca}\`.\`tbUsuarios\` (
        usuario_id INT(10) NOT NULL AUTO_INCREMENT,
        nome VARCHAR(200) NOT NULL,
        login VARCHAR(50) NOT NULL,
        senha VARCHAR(255) NOT NULL,
        atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        atualizado_por INT(10) NULL,
        PRIMARY KEY (usuario_id),
        UNIQUE KEY uq_tbUsuarios_login (login),
        KEY idx_tbUsuarios_atualizado_por (atualizado_por),
        CONSTRAINT fk_tbUsuarios_atualizado_por
          FOREIGN KEY (atualizado_por) REFERENCES \`${schemas.seguranca}\`.\`tbUsuarios\` (usuario_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    `
      CREATE TABLE IF NOT EXISTS \`${schemas.cadastro}\`.\`tbPessoaTipo\` (
        pessoa_tipo_id INT(10) NOT NULL AUTO_INCREMENT,
        nome VARCHAR(200) NOT NULL,
        PRIMARY KEY (pessoa_tipo_id),
        UNIQUE KEY uq_tbPessoaTipo_nome (nome)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    `
      CREATE TABLE IF NOT EXISTS \`${schemas.cadastro}\`.\`tbPessoas\` (
        pessoa_id INT(11) NOT NULL AUTO_INCREMENT,
        nome VARCHAR(200) NOT NULL,
        cpf VARCHAR(14) NOT NULL,
        nascimento DATE NOT NULL,
        telefone VARCHAR(20) NOT NULL,
        pessoa_tipo_id INT(10) NOT NULL,
        atualizado_por INT(10) NULL,
        atualizado_em DATE NOT NULL DEFAULT (CURRENT_DATE),
        PRIMARY KEY (pessoa_id),
        UNIQUE KEY uq_tbPessoas_cpf (cpf),
        KEY idx_tbPessoas_pessoa_tipo_id (pessoa_tipo_id),
        KEY idx_tbPessoas_atualizado_por (atualizado_por),
        CONSTRAINT fk_tbPessoas_pessoa_tipo
          FOREIGN KEY (pessoa_tipo_id) REFERENCES \`${schemas.cadastro}\`.\`tbPessoaTipo\` (pessoa_tipo_id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE,
        CONSTRAINT fk_tbPessoas_atualizado_por
          FOREIGN KEY (atualizado_por) REFERENCES \`${schemas.seguranca}\`.\`tbUsuarios\` (usuario_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    `
      CREATE TABLE IF NOT EXISTS \`${schemas.financeiro}\`.\`tbTipoTitulo\` (
        tipo_titulo_id INT(11) NOT NULL AUTO_INCREMENT,
        descricao VARCHAR(100) NOT NULL,
        PRIMARY KEY (tipo_titulo_id),
        UNIQUE KEY uq_tbTipoTitulo_descricao (descricao)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    `
      CREATE TABLE IF NOT EXISTS \`${schemas.financeiro}\`.\`tbContasReceber\` (
        contas_receber_id INT(10) NOT NULL AUTO_INCREMENT,
        fornecedor_id INT(10) NOT NULL,
        valor INT(10) NOT NULL,
        data_vencimento DATE NOT NULL,
        data_pagamento DATE NULL,
        tipo_titulo_id INT(11) NOT NULL,
        atualizado_por INT(10) NULL,
        atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (contas_receber_id),
        UNIQUE KEY uq_tbContasReceber_fornecedor_id (fornecedor_id),
        KEY idx_tbContasReceber_tipo_titulo_id (tipo_titulo_id),
        KEY idx_tbContasReceber_atualizado_por (atualizado_por),
        CONSTRAINT fk_tbContasReceber_fornecedor
          FOREIGN KEY (fornecedor_id) REFERENCES \`${schemas.cadastro}\`.\`tbPessoas\` (pessoa_id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE,
        CONSTRAINT fk_tbContasReceber_tipo_titulo
          FOREIGN KEY (tipo_titulo_id) REFERENCES \`${schemas.financeiro}\`.\`tbTipoTitulo\` (tipo_titulo_id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE,
        CONSTRAINT fk_tbContasReceber_atualizado_por
          FOREIGN KEY (atualizado_por) REFERENCES \`${schemas.seguranca}\`.\`tbUsuarios\` (usuario_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `
  ];
}

async function initializeDatabase() {
  const bootstrapConnection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: dbConfig.ssl
  });

  await bootstrapConnection.query(`
    CREATE DATABASE IF NOT EXISTS \`${schemas.seguranca}\`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci
  `);
  await bootstrapConnection.query(`
    CREATE DATABASE IF NOT EXISTS \`${schemas.cadastro}\`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci
  `);
  await bootstrapConnection.query(`
    CREATE DATABASE IF NOT EXISTS \`${schemas.financeiro}\`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci
  `);
  await bootstrapConnection.query(`
    CREATE DATABASE IF NOT EXISTS \`${dbName}\`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci
  `);
  await bootstrapConnection.end();

  pool = mysql.createPool(dbConfig);

  for (const statement of getSchemaStatements()) {
    await pool.query(statement);
  }

  await pool.query(`DROP TABLE IF EXISTS \`${schemas.seguranca}\`.\`tbSessoes\``);

  await synchronizeAuthTables();
}

async function tableExists(schema, table) {
  const [userTables] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_name = ?
    `,
    [schema, table]
  );

  return Number(userTables[0]?.total || 0) > 0;
}

async function synchronizeAuthTables() {
  const hasLegacyUsers = await tableExists(dbName, "users");
  const hasCompatUsers = await tableExists(dbName, "tbUsuarios");

  if (hasLegacyUsers) {
    await migrateLegacyAuthData();
  }

  if (hasCompatUsers) {
    await syncMainUsersToCompatTable();
  }

  if (hasLegacyUsers) {
    await syncMainUsersToLegacyUsers();
  }
}

async function migrateLegacyAuthData() {
  if (!(await tableExists(dbName, "users"))) {
    return;
  }

  const [legacyUsers] = await pool.query(`
    SELECT id, nome, email, senha_hash, criado_em
    FROM ${getLegacyUsersTable()}
    ORDER BY id
  `);

  for (const legacyUser of legacyUsers) {
    const [existingUsers] = await pool.query(
      `SELECT usuario_id FROM ${getMainUserTable()} WHERE login = ? LIMIT 1`,
      [legacyUser.email]
    );

    if (existingUsers.length > 0) {
      continue;
    }

    const [insertResult] = await pool.query(
      `
        INSERT INTO ${getMainUserTable()} (nome, login, senha, atualizado_por)
        VALUES (?, ?, ?, NULL)
      `,
      [legacyUser.nome, legacyUser.email, legacyUser.senha_hash]
    );

    await pool.query(
      `
        UPDATE ${getMainUserTable()}
        SET atualizado_por = ?, atualizado_em = ?
        WHERE usuario_id = ?
      `,
      [insertResult.insertId, legacyUser.criado_em, insertResult.insertId]
    );
  }
}

async function syncMainUsersToCompatTable() {
  const [mainUsers] = await pool.query(`
    SELECT usuario_id, nome, login, senha, atualizado_em, atualizado_por
    FROM ${getMainUserTable()}
    ORDER BY usuario_id
  `);

  for (const user of mainUsers) {
    await pool.query(
      `
        INSERT INTO ${getCompatUserTable()} (usuario_id, nome, login, senha, atualizado_em, atualizado_por)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          nome = VALUES(nome),
          login = VALUES(login),
          senha = VALUES(senha),
          atualizado_em = VALUES(atualizado_em),
          atualizado_por = VALUES(atualizado_por)
      `,
      [user.usuario_id, user.nome, user.login, user.senha, user.atualizado_em, user.atualizado_por]
    );
  }
}

async function syncMainUsersToLegacyUsers() {
  const [mainUsers] = await pool.query(`
    SELECT usuario_id, nome, login, senha, atualizado_em
    FROM ${getMainUserTable()}
    ORDER BY usuario_id
  `);

  for (const user of mainUsers) {
    await pool.query(
      `
        INSERT INTO ${getLegacyUsersTable()} (id, nome, email, senha_hash, criado_em)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          nome = VALUES(nome),
          email = VALUES(email),
          senha_hash = VALUES(senha_hash),
          criado_em = VALUES(criado_em)
      `,
      [user.usuario_id, user.nome, user.login, user.senha, user.atualizado_em]
    );
  }
}

async function findUserByEmail(email) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const [mainUsers] = await pool.query(
    `
      SELECT usuario_id AS id, nome, login AS email, senha AS senha_hash
      FROM ${getMainUserTable()}
      WHERE login = ?
      LIMIT 1
    `,
    [normalizedEmail]
  );

  if (mainUsers[0]) {
    return mainUsers[0];
  }

  if (await tableExists(dbName, "tbUsuarios")) {
    const [compatUsers] = await pool.query(
      `
        SELECT usuario_id AS id, nome, login AS email, senha AS senha_hash
        FROM ${getCompatUserTable()}
        WHERE login = ?
        LIMIT 1
      `,
      [normalizedEmail]
    );

    if (compatUsers[0]) {
      await synchronizeAuthTables();
      return compatUsers[0];
    }
  }

  if (await tableExists(dbName, "users")) {
    const [legacyUsers] = await pool.query(
      `
        SELECT id, nome, email, senha_hash, criado_em
        FROM ${getLegacyUsersTable()}
        WHERE email = ?
        LIMIT 1
      `,
      [normalizedEmail]
    );

    const legacyUser = legacyUsers[0];
    if (legacyUser) {
      const [insertResult] = await pool.query(
        `
          INSERT INTO ${getMainUserTable()} (nome, login, senha, atualizado_por)
          VALUES (?, ?, ?, NULL)
        `,
        [legacyUser.nome, legacyUser.email, legacyUser.senha_hash]
      );

      await pool.query(
        `
          UPDATE ${getMainUserTable()}
          SET atualizado_por = ?, atualizado_em = ?
          WHERE usuario_id = ?
        `,
        [insertResult.insertId, legacyUser.criado_em, insertResult.insertId]
      );

      await synchronizeAuthTables();

      return {
        id: insertResult.insertId,
        nome: legacyUser.nome,
        email: legacyUser.email,
        senha_hash: legacyUser.senha_hash
      };
    }
  }

  return null;
}

async function createUser(nome, email, senhaHash) {
  const [result] = await pool.query(
    `
      INSERT INTO ${getMainUserTable()} (nome, login, senha, atualizado_por)
      VALUES (?, ?, ?, NULL)
    `,
    [nome, email, senhaHash]
  );

  await pool.query(
    `
      UPDATE ${getMainUserTable()}
      SET atualizado_por = ?
      WHERE usuario_id = ?
    `,
    [result.insertId, result.insertId]
  );

  await synchronizeAuthTables();

  return { id: result.insertId, nome, email };
}

function inferUserProfile(email) {
  return email === "admin@faturemais.com" ? "Administrador" : "Usuario";
}

function mapUserRow(row) {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    perfil: inferUserProfile(row.email)
  };
}

async function listUsers() {
  const [rows] = await pool.query(`
    SELECT usuario_id AS id, nome, login AS email
    FROM ${getMainUserTable()}
    ORDER BY usuario_id
  `);

  return rows.map(mapUserRow);
}

async function getUserById(userId) {
  const [rows] = await pool.query(
    `
      SELECT usuario_id AS id, nome, login AS email, senha AS senha_hash
      FROM ${getMainUserTable()}
      WHERE usuario_id = ?
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function updateUser(userId, nome, email, senha) {
  const existingUser = await getUserById(userId);

  if (!existingUser) {
    return null;
  }

  const [duplicatedUsers] = await pool.query(
    `
      SELECT usuario_id
      FROM ${getMainUserTable()}
      WHERE login = ?
        AND usuario_id <> ?
      LIMIT 1
    `,
    [email, userId]
  );

  if (duplicatedUsers.length > 0) {
    throw new Error("Ja existe um usuario cadastrado com este e-mail.");
  }

  const senhaHash = senha ? hashPassword(senha) : existingUser.senha_hash;

  await pool.query(
    `
      UPDATE ${getMainUserTable()}
      SET nome = ?, login = ?, senha = ?
      WHERE usuario_id = ?
    `,
    [nome, email, senhaHash, userId]
  );

  await synchronizeAuthTables();
  return getUserById(userId);
}

async function deleteUser(userId) {
  const existingUser = await getUserById(userId);

  if (!existingUser) {
    return false;
  }

  await pool.query(`UPDATE ${getMainUserTable()} SET atualizado_por = NULL WHERE atualizado_por = ?`, [userId]);
  await pool.query(`DELETE FROM ${getMainUserTable()} WHERE usuario_id = ?`, [userId]);

  if (await tableExists(dbName, "tbUsuarios")) {
    await pool.query(`DELETE FROM ${getCompatUserTable()} WHERE usuario_id = ?`, [userId]);
  }

  if (await tableExists(dbName, "users")) {
    await pool.query(`DELETE FROM ${getLegacyUsersTable()} WHERE id = ?`, [userId]);
  }

  return true;
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
        reject(new Error("JSON invalido."));
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

function encodeToken(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function signTokenPayload(encodedPayload) {
  return crypto.createHmac("sha256", authSecret).update(encodedPayload).digest("base64url");
}

function createSession(user) {
  const payload = {
    sub: user.id,
    login: user.email,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  };
  const encodedPayload = encodeToken(payload);
  const signature = signTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseSessionToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signTokenPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload.sub || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function findUserByToken(request) {
  const authHeader = request.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = parseSessionToken(token);

  if (!payload) {
    return null;
  }

  const [rows] = await pool.query(
    `
      SELECT usuario.usuario_id AS id, usuario.nome, usuario.login AS email
      FROM ${getMainUserTable()} usuario
      WHERE usuario.usuario_id = ?
      LIMIT 1
    `,
    [payload.sub]
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
      sendJson(response, 400, { message: "Preencha nome, e-mail e senha validos." });
      return;
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      sendJson(response, 409, { message: "Ja existe um usuario cadastrado com este e-mail." });
      return;
    }

    const createdUser = await createUser(nome, email, hashPassword(senha));

    sendJson(response, 201, {
      message: "Usuario criado com sucesso.",
      user: createdUser
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

    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(senha, user.senha_hash)) {
      sendJson(response, 401, { message: "Credenciais invalidas." });
      return;
    }

    const token = createSession(user);
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
      sendJson(response, 401, { message: "Sessao invalida ou expirada." });
      return;
    }

    sendJson(response, 200, { user: sanitizeUser(user) });
    return;
  }

  if (request.url?.startsWith("/api/users")) {
    const authenticatedUser = await findUserByToken(request);

    if (!authenticatedUser) {
      sendJson(response, 401, { message: "Sessao invalida ou expirada." });
      return;
    }

    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const idMatch = requestUrl.pathname.match(/^\/api\/users\/(\d+)$/);
    const userId = idMatch ? Number(idMatch[1]) : null;

    if (request.method === "GET" && requestUrl.pathname === "/api/users") {
      sendJson(response, 200, { users: await listUsers() });
      return;
    }

    if (request.method === "GET" && userId) {
      const user = await getUserById(userId);

      if (!user) {
        sendJson(response, 404, { message: "Usuario nao encontrado." });
        return;
      }

      sendJson(response, 200, { user: mapUserRow(user) });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/users") {
      const body = await getRequestBody(request);
      const nome = body.nome?.trim();
      const email = body.email?.trim().toLowerCase();
      const senha = body.senha?.trim();

      if (!nome || nome.length < 3 || !email || !senha || senha.length < 6) {
        sendJson(response, 400, { message: "Preencha nome, e-mail e senha validos." });
        return;
      }

      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        sendJson(response, 409, { message: "Ja existe um usuario cadastrado com este e-mail." });
        return;
      }

      const createdUser = await createUser(nome, email, hashPassword(senha));
      sendJson(response, 201, { message: "Usuario criado com sucesso.", user: { ...createdUser, perfil: inferUserProfile(createdUser.email) } });
      return;
    }

    if (request.method === "PUT" && userId) {
      const body = await getRequestBody(request);
      const nome = body.nome?.trim();
      const email = body.email?.trim().toLowerCase();
      const senha = body.senha?.trim();

      if (!nome || nome.length < 3 || !email) {
        sendJson(response, 400, { message: "Preencha nome e e-mail validos." });
        return;
      }

      try {
        const updatedUser = await updateUser(userId, nome, email, senha);

        if (!updatedUser) {
          sendJson(response, 404, { message: "Usuario nao encontrado." });
          return;
        }

        sendJson(response, 200, { message: "Usuario atualizado com sucesso.", user: mapUserRow(updatedUser) });
      } catch (error) {
        sendJson(response, 409, { message: error.message || "Nao foi possivel atualizar o usuario." });
      }
      return;
    }

    if (request.method === "DELETE" && userId) {
      if (authenticatedUser.id === userId) {
        sendJson(response, 400, { message: "Voce nao pode excluir o proprio usuario logado." });
        return;
      }

      const deleted = await deleteUser(userId);

      if (!deleted) {
        sendJson(response, 404, { message: "Usuario nao encontrado." });
        return;
      }

      sendJson(response, 200, { message: "Usuario excluido com sucesso." });
      return;
    }
  }

  sendJson(response, 404, { message: "Rota nao encontrada." });
}

function serveStaticFile(response, filePath) {
  const extension = path.extname(filePath);
  const contentType = mimeTypes[extension] || "application/octet-stream";

  try {
    const content = fs.readFileSync(filePath);
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  } catch {
    sendJson(response, 404, { message: "Arquivo nao encontrado." });
  }
}

async function startServer() {
  console.log("Ambiente de execucao:", {
    railway: isRailway,
    port: PORT,
    dbHost: process.env.DB_HOST || null,
    dbPort: process.env.DB_PORT || null,
    dbUser: process.env.DB_USER || null,
    dbName: process.env.DB_NAME || dbName,
    dbSsl: process.env.DB_SSL || null
  });

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

  server.listen(PORT, HOST, () => {
    console.log(`FatureMais disponivel em http://${HOST}:${PORT}`);
    console.log(
      `MySQL conectado em ${dbConfig.host}:${dbConfig.port} | schemas: ${schemas.seguranca}, ${schemas.cadastro}, ${schemas.financeiro}`
    );
  });
}

startServer().catch((error) => {
  console.error("Falha ao iniciar o servidor:", error.message);
  process.exit(1);
});
