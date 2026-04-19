# FatureMais

Sistema inicial de contas a pagar com:

- landing page profissional
- cadastro de novos usuarios
- login integrado ao banco MySQL
- home protegida por sessao
- suporte a MySQL remoto com SSL

## Como executar

1. Abra o terminal na pasta do projeto.
2. Execute o arquivo `database.sql` no MySQL Workbench.
3. Ajuste o arquivo `.env` com o host, porta, usuario, senha e banco do servidor MySQL.
4. Instale a dependencia:

```bash
npm install
```

5. Execute:

```bash
npm start
```

6. Acesse `http://localhost:3000`.

## Estrutura

- `index.html`: pagina inicial
- `login.html`: tela de login
- `cadastro.html`: tela de cadastro
- `home.html`: area autenticada
- `server.js`: servidor HTTP + API de autenticacao
- `database.sql`: script para executar no MySQL Workbench
- `primeiro-acesso.sql`: modelo para inserir o primeiro usuario diretamente no banco
- `.env.example`: configuracao de conexao com MySQL

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

## Observacao

O servidor cria automaticamente o banco configurado em `DB_NAME` e depois aplica as tabelas. Para provedores como Aiven, utilize `DB_SSL=true`.
