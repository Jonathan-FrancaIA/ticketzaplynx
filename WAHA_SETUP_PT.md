# Guia de Configuração da WAHA

## Visão Geral
Este guia fornece instruções detalhadas para implementar o suporte à WAHA (WhatsApp HTTP API) na plataforma WhatickeT ao lado da integração existente do Baileys.

## Endpoints da API WAHA

### Gerenciamento de Sessão
- `POST /api/sessions` - Criar uma sessão
- `GET /api/sessions` - Listar todas as sessões
- `GET /api/sessions/{session}` - Obter informações da sessão
- `PUT /api/sessions/{session}` - Atualizar uma sessão
- `DELETE /api/sessions/{session}` - Excluir uma sessão
- `POST /api/sessions/{session}/start` - Iniciar a sessão
- `POST /api/sessions/{session}/stop` - Parar a sessão
- `POST /api/sessions/{session}/logout` - Sair da sessão

### Autenticação
- `POST /api/{session}/auth/qr` - Obter QR code para pareamento
- `POST /api/{session}/auth/request-code` - Solicitar código de autenticação

### Envio de Mensagens
- `POST /api/sendText` - Enviar uma mensagem de texto
- `POST /api/sendImage` - Enviar uma imagem
- `POST /api/sendFile` - Enviar um arquivo
- `POST /api/sendVoice` - Enviar uma mensagem de voz
- `POST /api/sendVideo` - Enviar um vídeo
- `POST /api/sendButtons` - Enviar botões (mensagem interativa)

### Gerenciamento de Chat
- `GET /api/{session}/chats` - Obter chats
- `GET /api/{session}/chats/{chatId}/messages` - Obter mensagens no chat
- `POST /api/{session}/chats/{chatId}/messages/read` - Ler mensagens não lidas

### Gerenciamento de Contatos
- `GET /api/contacts/{contactId}` - Obter informações do contato
- `GET /api/contacts/check-exists` - Verificar se o número de telefone está registrado

### Configuração de Webhooks
- `POST /api/{session}/webhook` - Definir URL do webhook para sessão
- `GET /api/{session}/webhook` - Obter URL do webhook para sessão

## Variáveis de Configuração Necessárias

### Variáveis de Ambiente
```
WAHA_API_URL=http://localhost:2266
WAHA_API_TOKEN=seu_token_da_waha_aqui
WAHA_WEBHOOK_BASE_URL=https://seudominio.com/api/waha/webhook
WAHA_SESSION_TIMEOUT=30000
WAHA_MAX_RETRIES=3
WAHA_RETRY_DELAY=1000
```

## Tipos de Eventos da WAHA

A WAHA envia os seguintes eventos de webhook:
- `session.status` - Mudanças no status da sessão
- `message` - Mensagem recebida
- `message.reaction` - Reação à mensagem
- `message.ack` - Confirmação de mensagem
- `message.revoked` - Mensagem revogada
- `message.edited` - Mensagem editada
- `group.v2.join` - Evento de entrada no grupo
- `group.v2.leave` - Evento de saída do grupo
- `group.v2.update` - Atualização do grupo
- `group.v2.participants` - Mudança nos participantes do grupo
- `presence.update` - Atualização de presença do contato

## Diretrizes de Implementação

### 1. Gerenciamento de Sessão
Ao criar uma conexão WhatsApp com provedor WAHA:
1. Criar sessão via `/api/sessions`
2. Se autenticação por QR, buscar QR code e exibir ao usuário
3. Se autenticação por código, solicitar código para o número de telefone
4. Iniciar sessão via `/api/sessions/{session}/start`
5. Registrar endpoint de webhook para receber mensagens

### 2. Processamento de Mensagens
Quando a WAHA envia webhook de mensagem:
1. Verificar assinatura do webhook para segurança
2. Analisar conteúdo da mensagem
3. Converter para formato interno de mensagem
4. Salvar no banco de dados
5. Emitir evento de socket para frontend
6. Criar ticket se necessário

### 3. Envio de Mensagens
Ao enviar mensagens através da WAHA:
1. Formatar mensagem de acordo com requisitos da API WAHA
2. Fazer requisição HTTP para endpoint apropriado
3. Tratar resposta e erros
4. Atualizar status da mensagem no banco de dados

### 4. Tratamento de Erros
- Repetir requisições falhas com backoff exponencial
- Registrar informações detalhadas de erro para depuração
- Fornecer mensagens de erro amigáveis ao usuário
- Manter estado da sessão corretamente

### 5. Considerações de Segurança
- Validar requisições de webhook para prevenir acesso não autorizado
- Sanitizar todos os dados de entrada
- Usar armazenamento seguro de tokens
- Implementar limitação de taxa se necessário

## Exemplos de Payloads de Webhook

### Evento de Mensagem
```json
{
  "event": "message",
  "session": "nome-da-sessao",
  "data": {
    "id": "id-da-mensagem",
    "body": "Olá da WAHA!",
    "type": "chat",
    "timestamp": 1234567890,
    "from": "5511999999999@c.us",
    "to": "5511888888888@c.us"
  }
}
```

### Evento de Status de Sessão
```json
{
  "event": "session.status",
  "session": "nome-da-sessao",
  "data": {
    "status": "CONNECTED",
    "phone": "5511999999999"
  }
}
```

## Solução de Problemas

### Problemas Comuns
1. URL do webhook não acessível - Verifique se seu servidor é acessível publicamente
2. Falhas de autenticação - Verifique token da API e permissões
3. Formatação de mensagens - Verifique estrutura do payload da mensagem
4. Timeouts de sessão - Ajuste configurações de timeout conforme necessário

### Passos para Depuração
1. Ativar logging detalhado para chamadas da API WAHA
2. Verificar logs do servidor WAHA
3. Verificar conectividade de rede com instância WAHA
4. Testar endpoints da API manualmente com ferramentas como Postman