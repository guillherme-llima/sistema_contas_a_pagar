INSERT INTO seguranca.tbUsuarios (nome, login, senha, atualizado_por)
VALUES (
  'Administrador FatureMais',
  'admin@faturemais.com',
  'c7d7ba65ac2f4884e04f1f7963f5c13a:b5129e0079d91fc502dd1988df5764d2bb894522f84877d8fd8ad9e68221b02d515adebe63efa734d2c752cecfc67f3d23f6ea9da8f5b1c9cc77a55b25791386',
  NULL
)
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  senha = VALUES(senha);

UPDATE seguranca.tbUsuarios
SET atualizado_por = usuario_id
WHERE login = 'admin@faturemais.com';
