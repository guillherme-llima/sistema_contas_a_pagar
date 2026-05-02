CREATE DATABASE IF NOT EXISTS seguranca
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS cadastro
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS financeiro
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS financeiro.tbContasReceber;
DROP TABLE IF EXISTS cadastro.tbPessoas;
DROP TABLE IF EXISTS financeiro.tbTipoTitulo;
DROP TABLE IF EXISTS cadastro.tbPessoaTipo;
DROP TABLE IF EXISTS seguranca.tbUsuarios;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS seguranca.tbUsuarios (
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
    FOREIGN KEY (atualizado_por) REFERENCES seguranca.tbUsuarios (usuario_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cadastro.tbPessoaTipo (
  pessoa_tipo_id INT(10) NOT NULL AUTO_INCREMENT,
  nome VARCHAR(200) NOT NULL,
  PRIMARY KEY (pessoa_tipo_id),
  UNIQUE KEY uq_tbPessoaTipo_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cadastro.tbPessoas (
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
    FOREIGN KEY (pessoa_tipo_id) REFERENCES cadastro.tbPessoaTipo (pessoa_tipo_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_tbPessoas_atualizado_por
    FOREIGN KEY (atualizado_por) REFERENCES seguranca.tbUsuarios (usuario_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS financeiro.tbTipoTitulo (
  tipo_titulo_id INT(11) NOT NULL AUTO_INCREMENT,
  descricao VARCHAR(100) NOT NULL,
  PRIMARY KEY (tipo_titulo_id),
  UNIQUE KEY uq_tbTipoTitulo_descricao (descricao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS financeiro.tbContasReceber (
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
    FOREIGN KEY (fornecedor_id) REFERENCES cadastro.tbPessoas (pessoa_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_tbContasReceber_tipo_titulo
    FOREIGN KEY (tipo_titulo_id) REFERENCES financeiro.tbTipoTitulo (tipo_titulo_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_tbContasReceber_atualizado_por
    FOREIGN KEY (atualizado_por) REFERENCES seguranca.tbUsuarios (usuario_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
