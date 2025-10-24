Prontuário - Triagem Rápida
===========================

Pequena aplicação front-end (HTML/CSS/JS) para criar um prontuário/triagem onde existem 3 papéis:

- paciente: pode abrir uma consulta (responder perguntas)
- médico: pode ver a fila de espera, atender (assumir) e finalizar consultas
- moderador: pode ver todas as consultas, excluir, reabrir e atribuir a si

Como usar
---------

1. Abra o arquivo `index.html` no navegador (duplo clique ou arraste para a janela do navegador).
2. No canto superior, selecione o papel (Paciente / Médico / Moderador) e clique em "Entrar".
3. Como Paciente: preencha o formulário e clique em "Abrir Consulta". As consultas são salvas no localStorage do navegador.
4. Como Médico: coloque seu nome no campo e clique em "Entrar" para ver a fila. Clique em "Atender" para assumir uma consulta e "Finalizar" quando terminar.
5. Como Moderador: tem controle total sobre as consultas.

Persistência
-----------

Os dados são salvos localmente no `localStorage` do navegador (chave `consultas_v1`). Para limpar os dados, apague os dados do site nas configurações do navegador ou execute código no console: `localStorage.removeItem('consultas_v1')`.

Nota
----

Esta é uma versão simples e local (sem servidor). Para uso real em ambiente clínico é necessário adicionar autenticação, auditoria, criptografia e conformidade com normas de proteção de dados (por exemplo, LGPD). Este exemplo serve como protótipo para triagem e organização de filas.

Perfis de médicos
-----------------

O moderador pode adicionar perfis de médicos (nome, especialidade, contato e breve bio) pelo painel de Moderador. Os pacientes visualizam a lista de médicos disponíveis na sua tela. Os perfis são salvos no `localStorage` (chave `doctors_v1`).

Ordenação da fila
-----------------

A fila de atendimento prioriza pacientes com maior gravidade ("grave" > "moderado" > "leve"). Quando a gravidade for igual entre pacientes, a ordem é definida pela chegada (mais antigo primeiro). Médicos podem também encerrar (finalizar) consultas diretamente, seja em espera ou em andamento.

Comportamento adicional
-----------------------

- Auto-atribuição por especialidade: ao abrir uma consulta, o paciente pode selecionar uma especialidade desejada (campo no formulário). O sistema tentará atribuir automaticamente a um médico disponível com essa especialidade (escolhendo o com menor carga atual).
- Restrição de finalização: apenas o médico atribuído à consulta pode finalizá-la; o moderador ainda pode finalizar/excluir.
- Busca na aba de médicos: pacientes podem filtrar os médicos por nome ou especialidade usando a caixa de busca na aba "Médicos".
