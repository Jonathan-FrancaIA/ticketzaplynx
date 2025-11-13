# Plano de Implementação: Suporte a WAHA e Baileys

## Visão Geral
Este plano detalha a implementação de suporte ao WAHA (WhatsApp HTTP API) mantendo a compatibilidade com o Baileys atual, permitindo que o usuário escolha entre os dois provedores no momento da configuração da conexão.

## Análise Atual

### Backend:
- Atualmente usa Baileys via `wbot.ts` com `@whiskeysockets/baileys`
- Tem uma estrutura com provedores em `services/BaileysServices/` e `services/WbotServices/`
- O modelo `Whatsapp` armazena configurações de conexão
- Controladores e rotas já existentes para gerenciamento de conexões

### Frontend:
- Tela de conexões permite adicionar/editar conexões
- Modal de conexão tem configurações específicas para WhatsApp
- O componente permite definir nome, mensagens, filas, etc.

## Diferenças Fundamentais

### Baileys:
- Usa WebSocket para conexão direta com o WhatsApp
- Gera QR Code para autenticação
- Requer manutenção constante da conexão

### WAHA:
- Usa API HTTP para comunicação
- Pode usar QR Code ou código numérico para autenticação
- Requer endpoints para receber webhooks
- Mais estável e com mais recursos (canais, conversão de mídia, etc.)

## Arquitetura Proposta

```
├── src/
│   ├── providers/
│   │   ├── WhatsAppProvider.ts (interface abstrata)
│   │   ├── BaileysProvider.ts (implementação adaptada)
│   │   └── WahaProvider.ts (nova implementação)
│   ├── services/
│   │   └── WhatsAppManagerService.ts (gerencia provedor ativo)
│   ├── routes/
│   │   └── wahaWebhookRoutes.ts (novas rotas para webhooks da WAHA)
│   ├── controllers/
│   │   └── WahaWebhookController.ts (novo controlador para webhooks)
│   └── models/
│       └── WhatsApp.ts (atualizado com campos de provedor)
```

## Modelos Atualizados

### WhatsApp Model (src/models/Whatsapp.ts)
Adicionar os seguintes campos:
- `provider`: 'baileys' | 'waha' (padrão: 'baileys')
- `waha_session_id`: string (para sessões WAHA)
- `waha_webhook_url`: string (URL para webhooks da sessão WAHA)
- `waha_api_url`: string (URL da API WAHA, se diferente da padrão)
- `waha_api_token`: string (token de autenticação da API WAHA)

## Provedores Implementados

### Interface Comum (src/providers/WhatsAppProvider.ts)
```typescript
interface WhatsAppProvider {
  startSession(whatsapp: Whatsapp): Promise<void>;
  stopSession(whatsappId: number): Promise<void>;
  logout(whatsappId: number): Promise<void>;
  sendText(whatsappId: number, number: string, message: string): Promise<any>;
  sendMedia(whatsappId: number, number: string, message: string, mediaPath: string): Promise<any>;
  sendImage(whatsappId: number, number: string, imageBuffer: Buffer, filename: string, caption: string): Promise<any>;
  getQrCode(whatsappId: number): Promise<{ qrCode: string; pairingCode?: string }>;
  checkConnection(whatsappId: number): Promise<boolean>;
  getConnectionState(whatsappId: number): Promise<string>;
}
```

### Baileys Provider (src/providers/BaileysProvider.ts)
Adaptar a lógica existente do `wbot.ts` para seguir a interface.

### WAHA Provider (src/providers/WahaProvider.ts)
Implementar a interface usando chamadas HTTP para a API WAHA.

## Endpoints para Webhooks da WAHA

### Rota para Receber Webhooks (src/routes/wahaWebhookRoutes.ts)
```
POST /api/waha/webhook/:sessionId - Recebe webhooks da WAHA
```

### Controlador de Webhooks (src/controllers/WahaWebhookController.ts)
- Recebe eventos da WAHA
- Processa e converte para eventos internos do sistema
- Dispara sockets para atualizar frontend
- Salva mensagens no banco de dados

## Processamento de Eventos da WAHA

A WAHA envia os seguintes eventos via webhook:
- message (mensagem recebida)
- message.reaction (reação a mensagem)
- message.ack (status de entrega)
- message.revoked (mensagem revogada)
- message.edited (mensagem editada)
- group.v2.join (entrada em grupo)
- group.v2.leave (saída de grupo)
- session.status (alteração de status da sessão)
- etc.

Precisamos converter esses eventos para o formato interno do sistema:
- Salvar mensagens no modelo Message
- Atualizar status de sessão no modelo WhatsApp
- Emitir eventos via socket para o frontend
- Criar/atualizar tickets no modelo Ticket

## Frontend Atualizações

### Modal de Conexão (src/components/WhatsAppModal/index.js)
- Adicionar campo para selecionar provedor
- Campos específicos para WAHA:
  - URL da API
  - Token de autenticação
  - ID da sessão (opcional - pode ser gerado automaticamente)
- Ocultar campos de importação de mensagens para WAHA (não suportado da mesma forma)

### Lista de Conexões (src/pages/Connections/index.js)
- Mostrar tipo de provedor na lista
- Ajustar botões e ações conforme o provedor

## Configurações

### Variáveis de ambiente (exemplo)
```
# Configurações padrão para WAHA
WAHA_API_URL=http://localhost:2266
WAHA_API_TOKEN=seu_token_aqui
WAHA_WEBHOOK_BASE_URL=https://seusite.com/api/waha/webhook
```

## Implementação Passo a Passo

### Fase 1: Preparação (Semana 1)
1. Atualizar modelo WhatsApp com campos de provedor
2. Criar interface abstrata de provedor
3. Criar estrutura de diretórios

### Fase 2: Implementação Backend (Semana 2)
4. Adaptar Baileys para nova interface
5. Criar provedor para WAHA
6. Criar gerenciador de provedores
7. Implementar rota e controlador para webhooks da WAHA

### Fase 3: Integração Frontend (Semana 3)
8. Atualizar modal de conexão com opção de provedor
9. Atualizar lista de conexões para mostrar provedor

### Fase 4: Testes e Revisão (Semana 4)
10. Testar ambos os provedores
11. Resolver problemas de compatibilidade
12. Documentar a nova funcionalidade

## Considerações Especiais

### Autenticação
- Baileys: QR Code
- WAHA: QR Code ou código numérico
- Ambos devem suportar persistência de sessão

### Webhooks da WAHA
- Precisamos de uma URL pública para receber webhooks
- O sistema deve registrar automaticamente essa URL na WAHA
- Webhooks recebidos devem ser processados de forma assíncrona

### Compatibilidade
- Manter todas as funcionalidades existentes
- Garantir que os mesmos eventos sejam disparados
- As mensagens devem ser salvas no mesmo formato
- Os tickets devem ser criados da mesma forma

### Desempenho
- A comunicação com a WAHA é via HTTP, o que pode ser mais lento
- Precisamos de mecanismos de cache para operações frequentes
- Considerar filas para operações assíncronas

## Testes Necessários

### Testes Unitários
- Testar cada provedor individualmente
- Testar o gerenciador de provedores
- Testar o processamento de webhooks

### Testes de Integração
- Testar conexão completa com Baileys
- Testar conexão completa com WAHA
- Testar envio/recebimento de mensagens
- Testar eventos e webhooks

### Testes Funcionais
- Testar fluxo completo do usuário
- Testar troca entre provedores
- Testar persistência de sessão