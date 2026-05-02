# FatureMais

Sistema inicial de contas a pagar com:

- landing page profissional
- cadastro de novos usuarios
- login integrado ao banco MySQL
- home protegida por sessao
- suporte a MySQL remoto com SSL

## Como executar

1. Abra o terminal na pasta do projeto.
2. Execute o arquivo `database.sql` no MySQL Workbench para recriar o modelo exatamente como no DER.
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
- `primeiro-acesso.sql`: modelo para inserir o primeiro usuario em `seguranca.tbUsuarios`
- `.env.example`: configuracao de conexao com MySQL

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

## Observacao

O servidor cria automaticamente os schemas `seguranca`, `cadastro` e `financeiro` e depois aplica as tabelas do modelo atual. Para recriar o banco do zero seguindo o DER, execute primeiro `database.sql`. Para provedores como Aiven, utilize `DB_SSL=true`.
